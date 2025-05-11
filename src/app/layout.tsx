import type { Metadata } from 'next'
import './globals.css'
import { Inter, Noto_Sans_SC } from 'next/font/google'

import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import NextTopLoader from 'nextjs-toploader'
import If from '@/app/lib/If'

config.autoAddCss = false

export const metadata: Metadata = {
    title: 'Dashboard',
    description: 'BAID website management.'
}

const inter = Inter({
    subsets: [ 'latin', 'latin-ext' ],
    variable: '--font-inter'
})

const notoSans = Noto_Sans_SC({
    subsets: [ 'latin', 'latin-ext' ],
    variable: '--font-noto-sans-sc'
})

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body
            className={`antialiased ${inter.variable} ${notoSans.variable}`}
            >
                <NextTopLoader/>
                {children}
            </body>
        </html>
    )
}
