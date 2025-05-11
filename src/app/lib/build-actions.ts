'use server'

import { me } from '@/app/lib/utils'
import { AuditLogType, Build, BuildStatus, PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import { spawn } from 'child_process'

function runCommand(command: string, args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`+ Running command: ${command} ${args.join(' ')}`)
        const child = spawn(command, args, { cwd, stdio: 'inherit', shell: true })
        child.on('close', code => {
            if (code === 0) resolve()
            else reject(new Error(`+ ${command} exited with code ${code}`))
        })
    })
}

const prisma = new PrismaClient()

export async function getLatestBuilds(): Promise<Build[]> {
    const user = await me()
    if (user == null) {
        return []
    }
    return prisma.build.findMany({
        where: {
            user
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 10
    })
}

export async function build(message: string): Promise<Build | null> {
    const user = await me()
    if (user == null) {
        return null
    }
    const build = await prisma.build.create({
        data: {
            message,
            user,
            status: BuildStatus.working
        }
    })
    await prisma.auditLog.create({
        data: {
            user,
            type: AuditLogType.build,
            values: [ build.id.toString() ]
        }
    })
    void workOnBuild(build)
    return build
}

async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path, fs.constants.F_OK)
        return true
    } catch {
        return false
    }
}

async function workOnBuild(build: Build): Promise<void> {
    try {
        console.log(`+ Starting build process for ${build.id}`)
        if (await exists('working/repo')) {
            await runCommand('git', [ 'pull' ], 'working/repo')
        } else {
            await runCommand('git', [ 'clone', process.env.WEBSITE_REPO!, 'working/repo', '--depth=1' ])
        }
        await runCommand('npm', [ 'install' ], 'working/repo')
        await runCommand('npm', [ 'run', 'build' ], 'working/repo')

        if (!await exists('working/repo/dist')) {
            throw new Error('Build failed')
        }

        if (!await exists('working/builds')) {
            await fs.mkdir('working/builds')
        }

        await fs.mkdir(`working/builds/${build.id}`)
        await fs.cp('working/repo/dist/', `working/builds/${build.id}/`, {
            recursive: true,
            force: true
        })

        await prisma.build.update({
            where: {
                id: build.id
            },
            data: {
                status: BuildStatus.inactive
            }
        })
    } catch {
        await prisma.build.update({
            where: {
                id: build.id
            },
            data: {
                status: BuildStatus.error
            }
        })
    }
}
