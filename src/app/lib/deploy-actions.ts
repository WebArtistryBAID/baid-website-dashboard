'use server'

import { me } from '@/app/lib/utils'
import { AuditLogType, BuildStatus, PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'

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
        const buildPath = `working/builds/${build}`
        const previewPath = process.env.PREVIEW_PATH!
        await fs.rm(previewPath, { recursive: true, force: true })
        await fs.mkdir(previewPath, { recursive: true })
        await fs.cp(buildPath, previewPath, { recursive: true })
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
        const buildPath = `working/builds/${build}`
        const prodPath = process.env.PROD_PATH!
        await fs.rm(prodPath, { recursive: true, force: true })
        await fs.mkdir(prodPath, { recursive: true })
        await fs.cp(buildPath, prodPath, { recursive: true })
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
