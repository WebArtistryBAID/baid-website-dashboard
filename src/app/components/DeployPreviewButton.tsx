'use client'

import { useTranslationClient } from '@/app/i18n/client'
import { useState } from 'react'
import { deployPreview } from '@/app/lib/deploy-actions'

export default function DeployPreviewButton({ build }: { build: number }) {
    const { t } = useTranslationClient('home')
    const [ isOpen, setIsOpen ] = useState(false)
    const [ loading, setLoading ] = useState(false)

    return (
        <>
            <button
                className="btn-secondary"
                onClick={() => setIsOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                {t('builds.preview')}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`preview-title-${build}`}
                >
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                        <h2 id={`preview-title-${build}`} className="text-lg font-semibold mb-4">
                            {t('builds.preview')}
                        </h2>
                        <p className="text-sm mb-5">{t('deploy.previewMessage')}</p>
                        <div className="flex justify-end space-x-2">
                            <button
                                className="btn-secondary"
                                onClick={() => setIsOpen(false)}
                                disabled={loading}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                className="btn"
                                onClick={async () => {
                                    setLoading(true)
                                    await deployPreview(build)
                                    setLoading(false)
                                    location.reload()
                                }}
                                disabled={loading}
                            >
                                {t('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
