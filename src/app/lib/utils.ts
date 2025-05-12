'use server'

import { cookies } from 'next/headers'

export async function me(): Promise<string | null> {
    if (process.env.WAGTAIL_AUTH_PATH === 'dev') {
        return 'Test User'
    }

    const jar = await cookies()
    if (!jar.has('sessionid')) {
        return null
    }

    // We're doing some stupid HTML parsing
    const res = await fetch(process.env.WAGTAIL_AUTH_PATH! + '/admin', {
        method: 'GET',
        headers: {
            Cookie: `sessionid=${jar.get('sessionid')?.value}`
        },
        redirect: 'manual'
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
