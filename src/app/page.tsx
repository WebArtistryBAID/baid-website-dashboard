import { useTranslation } from '@/app/i18n'
import { getWagtailPath, me } from '@/app/lib/utils'
import { redirect } from 'next/navigation'
import { getLatestBuilds } from '@/app/lib/build-actions'
import { BuildStatus } from '@prisma/client'
import If from '@/app/lib/If'
import BuildButton from '@/app/components/BuildButton'

export default async function Home() {
    const { t } = await useTranslation('home')
    const user = await me()
    if (user === null) {
        redirect('/admin/login/?next=/') // Redirects to Wagtail for authentication
    }
    return <main>
        <h1 className="mb-5 text-4xl font-bold">{t('welcome', { name: user })}</h1>

        <h2 className="text-xl mb-3">{t('actions.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <a href={process.env.PREVIEW_URL} className="btn-secondary">{t('actions.prev')}</a>
            <a href={process.env.PROD_URL} className="btn-secondary">{t('actions.prod')}</a>
            <a href={await getWagtailPath()} className="btn-secondary">{t('actions.wagtail')}</a>
            <BuildButton/>
        </div>

        <h2 className="text-xl mb-3">{t('builds.title')}</h2>
        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('builds.user')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('builds.message')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('builds.time')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('builds.status')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('builds.actions')}
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {(await getLatestBuilds()).map(b => <tr key={b.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{b.user}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{b.message}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{t(`status.${b.status}`)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <If condition={b.status !== BuildStatus.working && b.status !== BuildStatus.error}>
                                <div className="flex gap-3 flex-wrap">
                                    <button className="btn-secondary text-sm">{t('builds.preview')}</button>
                                    <button className="btn-danger text-sm">{t('builds.prod')}</button>
                                </div>
                            </If>
                        </td>
                    </tr>)}
                </tbody>
            </table>
        </div>
    </main>
}
