'use server'

import { me } from '@/app/lib/utils'
import { AuditLogType, BuildStatus, PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'
import { spawn } from 'child_process'

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

export async function deployPreview(build: number): Promise<void> {
    const user = await me()
    if (user === null) throw new Error('User not authenticated')

    const buildData = await prisma.build.findUnique({
        where: { id: build }
    })
    if (buildData === null) throw new Error('Build not found')

    await prisma.build.update({
        where: { id: build },
        data: { status: BuildStatus.working }
    })

    try {
        const buildPath = `../dashboard-artifacts/builds/${build}`
        if (process.env.DEPLOY_MODE === 'local') {
            const previewPath = process.env.PREVIEW_PATH!

            // Remove all contents inside previewPath
            const previewEntries = await fs.readdir(previewPath)
            await Promise.all(
                previewEntries.map(entry =>
                    fs.rm(path.join(previewPath, entry), { recursive: true, force: true })
                )
            )
            await fs.cp(buildPath, previewPath, { recursive: true })
        } else if (process.env.DEPLOY_MODE === 'cloudflare') {
            await runCommand('npx', [ 'wrangler', 'pages', 'deploy', buildPath, '--project-name', process.env.PREVIEW_PROJECT! ], '.', {
                NODE_ENV: process.env.NODE_ENV,
                CLOUDFLARE_ACCOUNT_ID: process.env.CF_ACCOUNT_ID!,
                CLOUDFLARE_API_TOKEN: process.env.CF_API_TOKEN!
            })
        }
    } catch (e) {
        console.error(`While deploying preview for ${build}: ${e}`)
        await prisma.build.update({
            where: { id: build },
            data: { status: BuildStatus.inactive }
        })
        throw new Error('Deploy preview failed')
    }

    // Clear preview flags on other builds
    await prisma.build.updateMany({
        where: { status: BuildStatus.activePreview },
        data: { status: BuildStatus.inactive }
    })
    await prisma.build.updateMany({
        where: { status: BuildStatus.activeBoth },
        data: { status: BuildStatus.activeProduction }
    })
    // Set status on this build depending on existing production flag
    const newPreviewStatus =
        buildData.status === BuildStatus.activeProduction ||
        buildData.status === BuildStatus.activeBoth
            ? BuildStatus.activeBoth
            : BuildStatus.activePreview
    await prisma.build.update({
        where: { id: build },
        data: { status: newPreviewStatus }
    })

    await prisma.auditLog.create({
        data: {
            user,
            type: AuditLogType.publish,
            values: [ build.toString(), 'preview' ]
        }
    })
}

export async function deployProduction(build: number, password: string): Promise<boolean> {
    const user = await me()
    if (user === null) return false
    if (password !== process.env.DEPLOY_PASSWORD) return false

    const buildData = await prisma.build.findUnique({
        where: { id: build }
    })
    if (buildData === null) return false

    await prisma.build.update({
        where: { id: build },
        data: { status: BuildStatus.working }
    })

    try {
        const buildPath = `../dashboard-artifacts/builds/${build}`
        if (process.env.DEPLOY_MODE === 'local') {
            const prodPath = process.env.PROD_PATH!

            // Remove all contents inside prodPath
            const prodEntries = await fs.readdir(prodPath)
            await Promise.all(
                prodEntries.map(entry =>
                    fs.rm(path.join(prodPath, entry), { recursive: true, force: true })
                )
            )

            await fs.cp(buildPath, prodPath, { recursive: true })
        } else if (process.env.DEPLOY_MODE === 'cloudflare') {
            await runCommand('npx', [ 'wrangler', 'pages', 'deploy', buildPath, '--project-name', process.env.PROD_PROJECT! ], '.', {
                NODE_ENV: process.env.NODE_ENV,
                CLOUDFLARE_ACCOUNT_ID: process.env.CF_ACCOUNT_ID!,
                CLOUDFLARE_API_TOKEN: process.env.CF_API_TOKEN!
            })
        }
    } catch (e) {
        console.error(`While deploying production for ${build}: ${e}`)
        await prisma.build.update({
            where: { id: build },
            data: { status: BuildStatus.inactive }
        })
        throw new Error('Deploy production failed')
    }

    // Clear production flags on other builds
    await prisma.build.updateMany({
        where: { status: BuildStatus.activeProduction },
        data: { status: BuildStatus.inactive }
    })
    await prisma.build.updateMany({
        where: { status: BuildStatus.activeBoth },
        data: { status: BuildStatus.activePreview }
    })
    // Set status on this build depending on existing preview flag
    const newProdStatus =
        buildData.status === BuildStatus.activePreview ||
        buildData.status === BuildStatus.activeBoth
            ? BuildStatus.activeBoth
            : BuildStatus.activeProduction
    await prisma.build.update({
        where: { id: build },
        data: { status: newProdStatus }
    })

    await prisma.auditLog.create({
        data: {
            user,
            type: AuditLogType.publish,
            values: [ build.toString(), 'production' ]
        }
    })
    return true
}
