'use server'

import { me } from '@/app/lib/utils'
import { AuditLogType, Build, BuildStatus, PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import { spawn } from 'child_process'
import * as path from 'path'

function runCommand(
    command: string,
    args: string[],
    cwd?: string,
    envVars?: NodeJS.ProcessEnv
): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`+ Running command: ${command} ${args.join(' ')}`)
        const options = {
            cwd,
            stdio: 'inherit' as const,
            shell: true,
            env: { ...process.env, ...envVars }
        }
        const child = spawn(command, args, options)
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
        if (await exists('../dashboard-artifacts/repo')) {
            await runCommand('git', [ 'pull' ], '../dashboard-artifacts/repo', {
                NODE_ENV: process.env.NODE_ENV,
                ALL_PROXY: process.env.PROXY
            })
        } else {
            await runCommand('git', [ 'clone', process.env.WEBSITE_REPO!, '../dashboard-artifacts/repo', '--depth=1' ],
                '.', {
                    NODE_ENV: process.env.NODE_ENV,
                    ALL_PROXY: process.env.PROXY
                })
        }

        if (!(await exists('../dashboard-artifacts/news'))) {
            await fs.mkdir('../dashboard-artifacts/news')
            await fs.writeFile('../dashboard-artifacts/news/db.json', '[]')
        }

        await runCommand('npm', [ 'ci' ], '../dashboard-artifacts/repo', {
            NODE_ENV: process.env.NODE_ENV,
            ALL_PROXY: process.env.PROXY
        })
        await runCommand('node', [ './scripts/pre.ts' ], '../dashboard-artifacts/repo', {
            NODE_ENV: process.env.NODE_ENV,
            ALL_PROXY: process.env.PROXY,
            WAGTAIL_BASE: process.env.WAGTAIL_AUTH_PATH!
        })
        await fs.cp('../dashboard-artifacts/news', '../dashboard-artifacts/repo/data/news', { recursive: true })
        await runCommand('./node_modules/.bin/vite', [ 'build' ], '../dashboard-artifacts/repo', {
            NODE_ENV: process.env.NODE_ENV,
            ALL_PROXY: process.env.PROXY
        })

        if (!await exists('../dashboard-artifacts/repo/dist')) {
            throw new Error('Build failed')
        }

        if (!await exists('../dashboard-artifacts/builds')) {
            await fs.mkdir('../dashboard-artifacts/builds')
        }

        await fs.mkdir(`../dashboard-artifacts/builds/${build.id}`)
        await fs.cp('../dashboard-artifacts/repo/dist/', `../dashboard-artifacts/builds/${build.id}/`, {
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

        // Prune older builds, keep only the latest ten
        const allEntries = await fs.readdir('../dashboard-artifacts/builds')
        const buildDirs = allEntries
            .filter(name => /^\d+$/.test(name))
            .sort((a, b) => parseInt(b) - parseInt(a))
        const toDelete = buildDirs.slice(10)
        for (const dir of toDelete) {
            await fs.rm(path.join('../dashboard-artifacts/builds', dir), { recursive: true, force: true })
        }
    } catch (e) {
        console.error(`+ Build ${build.id} failed with ${e}`)
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
