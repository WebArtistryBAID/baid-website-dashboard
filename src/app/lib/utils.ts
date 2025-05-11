'use server'

import { cookies } from 'next/headers'

export async function getWagtailPath(): Promise<string> {
    if (process.env.WAGTAIL_PATH!.startsWith('/')) {
        return process.env.HOSTED! + process.env.WAGTAIL_PATH!
    }
    return process.env.WAGTAIL_PATH!
}

export async function me(): Promise<string | null> {
    //if (process.env.WAGTAIL_PATH!.includes('localhost')) {
    //    return 'Test User'
    //}

    const jar = await cookies()
    if (!jar.has('sessionid')) {
        return null
    }

    // We're doing some stupid HTML parsing
    const res = await fetch(await getWagtailPath(), {
        method: 'GET',
        headers: {
            Cookie: `sessionid=${jar.get('sessionid')?.value}`
        }
    })

    if (res.status !== 200) {
        return null
    }

    const text = await res.text()
    const match = text.match(/<h2 class="w-label-1 w-mt-0 w-mb-1">(.+?)<\/h2>/)
    if (!match) {
        return null
    }
    return match[1]
}
