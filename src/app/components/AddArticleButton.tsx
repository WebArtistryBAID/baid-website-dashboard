'use client'

import { useTranslationClient } from '@/app/i18n/client'
import { useState } from 'react'
import { build } from '@/app/lib/build-actions'
import { addArticle } from '@/app/lib/article-actions'

export default function AddArticleButton() {
    const { t } = useTranslationClient('home')
    const [ text, setText ] = useState('')
    const [ isOpen, setIsOpen ] = useState(false)

    return (
        <>
            <button
                className="text-left btn"
                onClick={() => setIsOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                {t('actions.addArticle')}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="article-dialog-title"
                >
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                        <h2 id="article-dialog-title" className="text-lg font-semibold mb-4">
                            {t('actions.addArticle')}
                        </h2>
                        <input
                            type="text"
                            placeholder={t('article.inputPlaceholder')}
                            className="w-full text mb-5"
                            aria-label={t('article.inputLabel')}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                className="btn-secondary"
                                onClick={() => setIsOpen(false)}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                className="btn"
                                onClick={async () => {
                                    if (text.length < 1) return
                                    setIsOpen(false)
                                    try {
                                        if (new URL(text).host !== 'mp.weixin.qq.com') {
                                            return
                                        }
                                    } catch {
                                        return
                                    }
                                    await addArticle(text)
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
