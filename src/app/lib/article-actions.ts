'use server'

import { AuditLogType, Build, BuildStatus, PrismaClient } from '@prisma/client'
import { me } from './utils'
import * as fs from 'fs/promises'
import { spawn } from 'child_process'
import * as path from 'path'

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

async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path, fs.constants.F_OK)
        return true
    } catch {
        return false
    }
}

const prisma = new PrismaClient()
let ongoingTask = false

export async function addArticle(link: string): Promise<Build | null> {
    if (ongoingTask) {
        return null
    }
    const user = await me()
    if (user == null) {
        return null
    }
    const build = await prisma.build.create({
        data: {
            message: 'Add article',
            user,
            status: BuildStatus.working
        }
    })
    await prisma.auditLog.create({
        data: {
            user,
            type: AuditLogType.build,
            values: [ build.id.toString(), link ]
        }
    })
    void workOnAddArticle(build, link)
    return build
}

// CAVEAT: It is expected that there has already been an "initial build" before this.
async function workOnAddArticle(build: Build, link: string) {
    ongoingTask = true
    try {
        console.log(`+ Starting article download for ${build.id} from ${link}.`)
        // STEP 0: Download the article
        await fs.mkdir(`/tmp/article-build-${build.id}`)
        await runCommand(path.join(process.env.HOME!, 'blobs', 'downloader'), [ link, `/tmp/article-build-${build.id}`, '--image=save' ], `/tmp/article-build-${build.id}`)

        // Move from /tmp/article-build-${build.id}/(...) to /tmp/article-build-${build.id}/article
        const files = await fs.readdir(`/tmp/article-build-${build.id}`)
        await fs.rename(path.join(`/tmp/article-build-${build.id}`, files[0]), path.join(`/tmp/article-build-${build.id}`, 'article'))


        console.log('+ Reading Markdown content.')
        // STEP 1: Read the Markdown content
        // Read the only Markdown file from /tmp/article-build-${build.id}/article.
        const articleFiles = await fs.readdir(`/tmp/article-build-${build.id}/article`)
        const markdownFile = articleFiles.find(f => f.endsWith('.md'))
        if (!markdownFile) {
            throw new Error(`No Markdown file found while processing article.`)
        }
        const markdownContent = await fs.readFile(path.join(`/tmp/article-build-${build.id}/article`, markdownFile), 'utf-8')

        console.log('+ Calling image classifiers.')
        // Remove decorative image files.
        const toRemove = []
        const toKeep = []
        for (const file of articleFiles.filter(f => f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp'))) {
            const r = await fetch(`http://localhost:59192?image=/tmp/article-build-${build.id}/article/${file}`)
            if ((await r.text()) === 'decorative') {
                toRemove.push(file)
                await fs.rm(path.join(`/tmp/article-build-${build.id}/article`, file), { force: true })
            } else {
                toKeep.push(file)
            }
        }
        console.log('+ Removed decorative images: ' + toRemove.toString())

        // Call DeepSeek to process the article
        // STEP 2: Sanitize content
        console.log('+ Calling DeepSeek to sanitize article content.')
        console.log('Sending prompt:\n' + SANITIZE_LITERAL.replace('{{PLACEHOLDER}}', build.id.toString()).replace('{{IMAGE_BLACKLIST}}', toRemove.toString())
            + markdownContent)
        const sanitizeResp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: SANITIZE_LITERAL.replace('{{PLACEHOLDER}}', build.id.toString()).replace('{{IMAGE_BLACKLIST}}', toRemove.toString())
                            + markdownContent
                    }
                ],
                stream: false
            })
        })
        console.log('+ DeepSeek responded with sanitized content.')
        const srj = await sanitizeResp.json()
        const srRawContent = srj.choices[0].message.content
        const srStrippedContent = srRawContent.replace(/^```json\s*/, '').replace(/```$/, '')
        const sr = JSON.parse(srStrippedContent)

        const titleChinese = sr.title
        const contentChinese = sr.content
        const excerptChinese = sr.excerpt
        const date = sr.date
        const cover = sr.cover

        // STEP 3: Translate content
        console.log('+ Calling DeepSeek to translate article content.')
        console.log('Sending prompt:\n' + TRANSLATE_LITERAL + '#' + titleChinese + '\n\n' + contentChinese)
        const translateResp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: TRANSLATE_LITERAL + '#' + titleChinese + '\n\n' + contentChinese
                    }
                ],
                stream: false
            })
        })
        console.log('+ DeepSeek responded with translated content.')
        const trj = await translateResp.json()
        const trRawContent = trj.choices[0].message.content
        const trStrippedContent = trRawContent.replace(/^```json\s*/, '').replace(/```$/, '')
        const tr = JSON.parse(trStrippedContent)

        const title = tr.title
        const content = tr.content
        const excerpt = tr.excerpt

        // STEP 4: DEPLOY
        // Add to database
        console.log('+ Adding to news database.')
        const newsDB = JSON.parse(await fs.readFile('../dashboard-artifacts/news/db.json', 'utf-8'))
        newsDB.push({
            date,
            title,
            titleCN: titleChinese,
            id: build.id,
            cover,
            excerpt,
            images: toKeep,
            excerptCN: excerptChinese
        })
        await fs.writeFile('../dashboard-artifacts/news/db.json', JSON.stringify(newsDB))

        // Move all image files
        await fs.mkdir(`../dashboard-artifacts/news/${build.id}`)
        await fs.mkdir(`../dashboard-artifacts/news/${build.id}/images`)
        const imageFiles = await fs.readdir(`/tmp/article-build-${build.id}/article`)
        for (const file of imageFiles) {
            if (file.endsWith('.jpeg') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.webp')) {
                await fs.cp(path.join(`/tmp/article-build-${build.id}/article`, file), path.join(`../dashboard-artifacts/news/${build.id}/images`, file))
            }
        }

        // Write metadata
        await fs.writeFile(`../dashboard-artifacts/news/${build.id}/metadata.json`, JSON.stringify({
            date,
            title,
            titleCN: titleChinese,
            id: build.id,
            cover,
            excerpt,
            images: toKeep,
            excerptCN: excerptChinese
        }))

        // Write content
        await fs.writeFile(path.join(`../dashboard-artifacts/news/${build.id}`, 'content.md'), content)
        await fs.writeFile(path.join(`../dashboard-artifacts/news/${build.id}`, 'content-zh.md'), contentChinese)

        // Clean up temporary directory
        await fs.rm(`/tmp/article-build-${build.id}`, { recursive: true, force: true })

        // STEP 5: UPDATE BUILD
        console.log(`+ Starting build process for ${build.id}`)
        console.log('+ It is expected that another build has been made already.')

        await fs.cp('../dashboard-artifacts/news', '../dashboard-artifacts/repo/data/news', { recursive: true })
        await runCommand('./node_modules/.bin/vite', [ 'build' ], '../dashboard-artifacts/repo', {
            NODE_ENV: process.env.NODE_ENV,
            ALL_PROXY: process.env.PROXY
        })
        if (!await exists('../dashboard-artifacts/repo/dist')) {
            throw new Error('Build failed')
        }

        if (!await exists('../dashboard-artifacts/builds')) {
            await fs.mkdir('../dashboard-artifacts/builds')
        }

        await fs.mkdir(`../dashboard-artifacts/builds/${build.id}`)
        await fs.cp('../dashboard-artifacts/repo/dist/', `../dashboard-artifacts/builds/${build.id}/`, {
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

        // Prune older builds, keep only the latest ten
        const allEntries = await fs.readdir('../dashboard-artifacts/builds')
        const buildDirs = allEntries
            .filter(name => /^\d+$/.test(name))
            .sort((a, b) => parseInt(b) - parseInt(a))
        const toDelete = buildDirs.slice(10)
        for (const dir of toDelete) {
            await fs.rm(path.join('../dashboard-artifacts/builds', dir), { recursive: true, force: true })
        }
    } catch (e) {
        console.error(`+ Build ${build.id} failed with ${e}`)
        await prisma.build.update({
            where: {
                id: build.id
            },
            data: {
                status: BuildStatus.error
            }
        })
    } finally {
        ongoingTask = false
    }
}

const TRANSLATE_LITERAL = `现在我会给你一段中文内容，Markdown 格式，你需要翻译为英文。翻译时，注意文从字顺，不要有语病，大小写、标点符号正确。不要翻译图片。不要翻译 \\n (\\n 是换行的意思)。保留一切其他内容。输出一段 JSON。"content" (key String) 包含正文内容，但是必须删去大标题。"title" (key String) 包含单独翻译的标题。"excerpt" (key String) 包含一小段 20 词以内的内容概要，供读者参考。翻译中文人名时注意先姓后名，用拼音，如张丹萌为 Zhang Danmeng。翻译时注意专有名词。有些专有名词中文表述可能略有不同，请适当调整。这篇内容的题材是校园新闻报导，翻译时请符合一般格式。不要保留任何中文内容，只保留英文。不要保留任何中文内容，只保留英文。保留所有图片和其他 Markdown 结构。
AGAIN, ABSOLUTELY DO NOT MIX CHINESE AND ENGLISH. DO NOT DO SOMETHING LIKE 导师 (instructor). THAT IS UNNECESSARY. ONLY INCLUDE ENGLISH CONTENT. I REPEAT, ENGLISH CONTENT ONLY.

专有名词:
北京中学: Beijing Academy
北京中学国际部: Beijing Academy International Division (可缩写为 BAID)
北中国际: BAID
BA大讲堂: BA Lectures
北中小讲师: BAID Speaker
世界大课堂: BA World School
阅历课程: Experiential Program
北京文化探究: Beijing Cultural Exploration
职业体验: Career Experience
英才学者: Elite Scholar
世界因我更美好: Better Me, Better World
仁智勇乐: Benevolence, Wisdom, Bravery, Happiness
和而不同 乐在其中: Embrace Harmony and Differences
学会学习 学会共处 学会创新 学会生活: To Learn, To Cooperate, To Innovate, To Live
京领: KingLead
京西学校: Western Academy of Beijing (可缩写为 WAB，但尽量避免缩写)
社团: Student Club
选修课: Electives
年度人物: Person of the Year
月度任务: Person of the Month
学科周: Subject Week
国际风情周: International Theme Week
校友联络处: Alumni Association
中秋诗会: Mid-Autumn Poem Festival
大地课程: Nature Exploration
语文 (指课程): Chinese Literature
通用技术 (指课程): General Technology
信息技术 (指课程): Information Technology
综合英语 (指课程): Integrated English
文学与写作 (指课程): Literature
整本书阅读 (指课程): Guided Reading
戏剧 (指课程): Drama
专题数学 (指课程): Selected Topics in Mathematics
高阶数学 (指课程): Advanced Mathematics
高阶经济 (指课程): Advanced Economics
高阶物理 (指课程): Advanced Physics
沟通技巧 (指课程): Communication Skills
学术写作 (指课程): Academic Writing
跨文化交际 (指课程): Intercultural Communications
人文社科 (指课程): Social Studies Course Set (必须包含 Course Set)
EOT 经济竞赛 (指课程): Economics Olympiad Team
植物知道生命的答案 (指课程): Plants Know the Truth of Life
「丝绸之路」之跨学科探索 (指课程): Silk Road Exploration
近现代物理 (指课程): Modern Physics
版画 (指课程): Printmaking
升学指导: College Counseling
班会: Homeroom
社团: Student Club
戏剧节: Drama Festival
北中好声音: Sing! BA
北中杯: BA Cup
北中小舞台: BAID's Got Talent
露营: Camping

内容:
`

const SANITIZE_LITERAL = `接下来你将对一段中文内容进行处理。这段内容以 Markdown 的形式提供给你，是由微信公众号内容转换而成的文字。因为微信公众号转换不准确，一些装饰文字元素可能也包含在文本里了。你需要删除这些装饰元素，只保留正文，并删除标题、公众号名称、日期等信息。请注意，图片也是正文的一部分，你应当保留图片的 Markdown 格式。你应该以 JSON 格式输出你的结果，包含字符串 "content"，表示 Markdown 内容；字符串 "title"，表示提取出的文章标题；和字符串 "date"，表示你从文本开头提取出的日期，以 yyyy-MM-dd 格式呈现。还有字符串 "cover"，表示你从文本中提取出的**第一个图片**的链接。链接在 Markdown 图片格式中。最后，还有字符串 “excerpt"，表示 50 字以内的文本概要，供读者参考。最后一件事情: 你还应该将所有图片链接前都加上 https://cms.beijing.academy/news/{{PLACEHOLDER}}/images/ 的前缀。你输出的 cover 里也应当有这个前缀。适当地改善排版，将部分文字标为标题、加粗等，请在你输出的 content 中使用 Markdown 排版。还有一件事情: 删除所有 svg 和 gif 图片，同时删除如下的图片: {{IMAGE_BLACKLIST}}。同时 cover 应该是**删除图片完成后**的第一个图片。删除完成后的第一个图片，请注意。
内容:
`
