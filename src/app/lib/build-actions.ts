'use server'

import { me } from '@/app/lib/utils'
import { AuditLogType, Build, BuildStatus, PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import { exec } from 'promisify-child-process'

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
        if (await exists('working/repo')) {
            await exec('git pull', { cwd: 'working/repo' })
        } else {
            await exec(`git clone ${process.env.WEBSITE_REPO} working/repo --depth=1`)
        }
        await exec('npm install', { cwd: 'working/repo' })
        await exec('npm run build', { cwd: 'working/repo' })

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
