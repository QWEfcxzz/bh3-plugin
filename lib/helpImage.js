import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getAllCharacters } from './characters.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'bh3', 'help.png')

const CRYSTELF_RENDERER_URL = fileURLToPath(
  new URL('../../crystelf-plugin/lib/system/puppeteerRenderer.js', import.meta.url)
)

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getElysiaArt() {
  const list = getAllCharacters()
  const preferred = list.find(character => character.name === '粉色妖精小姐♪')
  const fallback = list.find(character =>
    (character.aliases || []).some(alias => alias.includes('爱莉希雅'))
  )
  const target = preferred || fallback
  if (!target) return { background: '', portrait: '' }
  return {
    background: target.background || '',
    portrait: target.portrait || '',
  }
}

function commandRows(items) {
  return items
    .map(item => {
      const [command, description] = item
      return `
        <div class="cmd-row">
          <code>${escapeHtml(command)}</code>
          <span>${escapeHtml(description)}</span>
        </div>`
    })
    .join('')
}

function buildHelpHtml(art = {}) {
  const portrait = art.portrait
    ? `<div class="art"><img src="${escapeHtml(art.portrait)}" alt="爱莉希雅"></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { overflow-x: hidden; }
  body {
    width: 900px;
    font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
    color: #fff;
    background:
      radial-gradient(900px 480px at 82% -8%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 62%),
      radial-gradient(640px 420px at 12% 6%, rgba(255, 214, 232, 0.95), rgba(255, 214, 232, 0) 68%),
      radial-gradient(760px 520px at 78% 52%, rgba(232, 178, 244, 0.75), rgba(232, 178, 244, 0) 66%),
      radial-gradient(680px 520px at 20% 78%, rgba(208, 168, 244, 0.7), rgba(208, 168, 244, 0) 64%),
      linear-gradient(180deg, #fbd8f0 0%, #eecdf4 38%, #d3b4f0 72%, #bda0ea 100%);
    position: relative;
    overflow-x: visible;
    padding: 36px 44px 30px;
  }
  .sky {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(520px 260px at 30% 14%, rgba(255, 244, 250, 0.9), rgba(255, 244, 250, 0) 70%),
      radial-gradient(420px 220px at 66% 30%, rgba(255, 228, 240, 0.65), rgba(255, 228, 240, 0) 72%);
    pointer-events: none;
  }
  .content { position: relative; z-index: 2; }
  .art {
    position: absolute;
    right: 0;
    top: -34px;
    width: 330px;
    height: 470px;
    overflow: hidden;
    z-index: 1;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(to bottom, #000 42%, rgba(0, 0, 0, 0.55) 62%, transparent 88%);
    mask-image: linear-gradient(to bottom, #000 42%, rgba(0, 0, 0, 0.55) 62%, transparent 88%);
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    filter: drop-shadow(0 6px 24px rgba(190, 90, 150, 0.45)) saturate(1.06);
  }
  .header { display: flex; flex-direction: column; }
  .title {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: 2px;
    background: linear-gradient(92deg, #d63a8c 8%, #b23ac4 45%, #8e35c9 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 2px 5px rgba(255, 255, 255, 0.95))
            drop-shadow(0 4px 14px rgba(214, 77, 148, 0.45));
  }
  .subtitle {
    margin-top: 10px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 3.5px;
    color: #7a4a9e;
  }
  .divider {
    margin: 22px 0 20px;
    height: 2px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.95), rgba(255, 180, 215, 0.55), rgba(200, 150, 235, 0.2), transparent);
    border-radius: 3px;
    box-shadow: 0 0 14px rgba(255, 190, 220, 0.5);
  }
  .section {
    margin-top: 20px;
    background: linear-gradient(150deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18));
    border: 1px solid rgba(255, 214, 232, 0.65);
    border-radius: 22px;
    padding: 18px 24px 14px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow:
      0 10px 36px rgba(160, 80, 160, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.55);
  }
  .section-title {
    font-size: 21px;
    font-weight: 800;
    margin-bottom: 10px;
    padding-left: 13px;
    border-left: 4px solid #d64d94;
    border-radius: 2px;
    color: #8e2f68;
    letter-spacing: 1px;
    text-shadow: 0 1px 3px rgba(255, 255, 255, 0.8);
  }
  .cmd-row {
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 6.5px 2px;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.35);
    font-size: 15px;
  }
  .cmd-row:last-child { border-bottom: none; }
  .cmd-row code {
    flex: 0 0 278px;
    font-family: "SF Mono", Consolas, monospace;
    font-size: 13.5px;
    font-weight: 600;
    color: #6d2358;
    background: rgba(255, 255, 255, 0.88);
    border-radius: 9px;
    padding: 3.5px 11px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(160, 70, 140, 0.18);
  }
  .cmd-row span { color: #57204a; }
  .example {
    margin-top: 18px;
    font-size: 13.5px;
    color: #57204a;
    line-height: 1.8;
    text-align: center;
    background: rgba(255, 255, 255, 0.62);
    border-radius: 14px;
    padding: 9px 16px;
    border: 1px solid rgba(214, 77, 148, 0.45);
  }
</style>
</head>
<body>
  <div class="sky"></div>
  ${portrait}
  <div class="content">
    <div class="header">
      <div class="title">【崩坏3 查询助手】</div>
      <div class="subtitle">HONKAI IMPACT 3RD · QUERY PLUGIN</div>
    </div>
    <div class="divider"></div>

    <div class="section">
      <div class="section-title">战绩查询</div>
      ${commandRows([
        ['#崩坏3面板 [UID]', '总览：等级 / 收藏 / 深渊 / 战场'],
        ['#崩坏3便笺 [UID]', '体力 / 训练值 / 活动奖励'],
        ['#崩坏3角色 [UID] [角色]', '角色列表 / 单个角色面板'],
        ['#崩坏3深渊 [UID]', '超弦空间 + 量子奇点'],
        ['#崩坏3战场 [UID]', '记忆战场战绩'],
        ['#崩坏3逐光 [UID]', '往世乐土战绩'],
        ['#崩坏3cookie <Cookie>', '主人配置公共 Cookie（群友免绑）'],
      ])}
    </div>

    <div class="section">
      <div class="section-title">角色数据</div>
      ${commandRows([
        ['#崩坏3角色图 <名字/别名>', '角色立绘 + 背景图 + 档案'],
        ['#崩坏3伤害 <角色> <攻击>', '伤害估算（倍率/增伤/暴击可调）'],
        ['#崩坏3角色列表', '110 名女武神清单'],
      ])}
    </div>

    <div class="section">
      <div class="section-title">图鉴查询</div>
      ${commandRows([
        ['#崩坏3图鉴 <关键词>', '搜索图鉴（支持别名）'],
        ['#崩坏3角色图鉴 <名字>', '角色图鉴'],
        ['#崩坏3武器图鉴 <名字>', '武器图鉴'],
        ['#崩坏3圣痕图鉴 <名字>', '圣痕图鉴'],
        ['#崩坏3图鉴详情 <编号>', '查看指定条目'],
      ])}
    </div>

    <div class="example">
      示例：#崩坏3伤害 炎律 1400 300 20 100 200　·　#崩坏3角色图 爱莉希雅　·　#崩坏3面板 100000001
    </div>
  </div>
</body>
</html>`
}

export async function renderHelpImage() {
  const art = getElysiaArt()
  const html = buildHelpHtml(art)
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  // 优先使用已安装的 crystelf-plugin 共享渲染器，其次自带的 puppeteer
  try {
    const { renderHtmlToImage } = await import(CRYSTELF_RENDERER_URL)
    await renderHtmlToImage({
      html,
      outputPath: OUTPUT_FILE,
      viewport: { width: 900, height: 600, deviceScaleFactor: 2 },
      contentOptions: { waitUntil: 'networkidle2' },
      afterContent: async page => {
        await page.evaluate(() => Promise.all(
          Array.from(document.images).map(img =>
            img.complete
              ? Promise.resolve()
              : new Promise(resolve => {
                  img.onload = resolve
                  img.onerror = resolve
                })
          )
        ))
        await page.evaluate(() => {
          const contentHeight = Math.ceil(document.body.getBoundingClientRect().height)
          document.documentElement.style.height = `${contentHeight}px`
          document.body.style.height = `${contentHeight}px`
        })
      },
    })
    return OUTPUT_FILE
  } catch (error) {
    try {
      await renderWithPuppeteer(html)
      return OUTPUT_FILE
    } catch (fallbackError) {
      if (globalThis.logger?.warn) {
        globalThis.logger.warn(`[bh3] 帮助图渲染失败，已回退纯文本: ${error.message} / ${fallbackError.message}`)
      }
      return null
    }
  }
}

async function renderWithPuppeteer(html = '') {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle2' })
    await page.evaluate(() => Promise.all(
      Array.from(document.images).map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(resolve => {
              img.onload = resolve
              img.onerror = resolve
            })
      )
    ))
    await page.evaluate(() => {
      const contentHeight = Math.ceil(document.body.getBoundingClientRect().height)
      document.documentElement.style.height = `${contentHeight}px`
      document.body.style.height = `${contentHeight}px`
    })
    const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewport({ width: 900, height: contentHeight, deviceScaleFactor: 2 })
    const imageBuffer = await page.screenshot({ fullPage: true })
    fs.writeFileSync(OUTPUT_FILE, imageBuffer)
    return OUTPUT_FILE
  } finally {
    await browser.close().catch(() => {})
  }
}

export { buildHelpHtml }
