'use client'

import { useTranslationClient } from '@/app/i18n/client'
import { useState } from 'react'
import If from '@/app/lib/If'
import { deployProduction } from '@/app/lib/deploy-actions'

export default function DeployProductionButton({ build }: { build: number }) {
    const { t } = useTranslationClient('home')
    const [ text, setText ] = useState('')
    const [ loading, setLoading ] = useState(false)
    const [ error, setError ] = useState(false)
    const [ isOpen, setIsOpen ] = useState(false)

    return (
        <>
            <button
                className="text-left btn-danger"
                onClick={() => setIsOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                {t('builds.prod')}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`prod-title-${build}`}
                >
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                        <h2 id={`prod-title-${build}`} className="text-lg font-semibold mb-4">
                            {t('builds.prod')}
                        </h2>
                        <p className="text-sm mb-1">{t('deploy.prodMessage')}</p>
                        <If condition={error}>
                            <p className="text-sm text-red-500 mb-1">
                                {t('deploy.inputError')}
                            </p>
                        </If>
                        <input
                            type="text"
                            placeholder={t('deploy.inputPlaceholder')}
                            className="w-full text mb-5"
                            aria-label={t('deploy.inputPlaceholder')}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                className="btn-secondary"
                                disabled={loading}
                                onClick={() => setIsOpen(false)}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                className="btn-danger"
                                disabled={loading}
                                onClick={async () => {
                                    if (text.length < 1) return
                                    setError(false)
                                    setLoading(true)
                                    const result = await deployProduction(build, text)
                                    setLoading(false)

                                    if (!result) {
                                        setError(true)
                                        return
                                    }
                                    location.reload()
                                }}
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
