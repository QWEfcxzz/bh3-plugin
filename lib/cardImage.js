import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

function renderLines(text = '') {
  const lines = String(text || '').split('\n')
  const parts = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      parts.push('<div class="gap"></div>')
      continue
    }
    const heading = line.match(/^===+\s*(.+?)\s*===+$/)
    if (heading) {
      parts.push(`<div class="h">${escapeHtml(heading[1])}</div>`)
      continue
    }
    if (/^[-—]{3,}$/.test(line)) {
      parts.push('<div class="divider"></div>')
      continue
    }
    const kv = line.match(/^([^：:]{1,14})[：:](.+)$/)
    if (kv) {
      parts.push(
        `<div class="kv"><span class="k">${escapeHtml(kv[1])}</span><span class="v">${escapeHtml(kv[2])}</span></div>`
      )
      continue
    }
    parts.push(`<div class="ln">${escapeHtml(line)}</div>`)
  }
  return parts.join('\n')
}

function buildCharacterPanel(panel = {}) {
  const hexagon = (Array.isArray(panel.hexagon) ? panel.hexagon : [])
    .map(item => `<span class="hex-chip">${escapeHtml(String(item.key || ''))} ${escapeHtml(String(item.value ?? ''))}</span>`)
    .join('')
  const equipCards = []
  if (panel.weapon?.name) {
    equipCards.push(`
      <div class="equip-card">
        <div class="equip-img"><img src="${escapeHtml(String(panel.weapon.img || ''))}" alt="" onerror="this.style.visibility='hidden'"></div>
        <div class="equip-name">${escapeHtml(panel.weapon.name)}</div>
        <div class="equip-tag">武器${panel.weapon.rarity ? ` ★${panel.weapon.rarity}` : ''}</div>
      </div>`)
  }
  for (const stigma of Array.isArray(panel.stigmatas) ? panel.stigmatas : []) {
    equipCards.push(`
      <div class="equip-card">
        <div class="equip-img"><img src="${escapeHtml(String(stigma.img || ''))}" alt="" onerror="this.style.visibility='hidden'"></div>
        <div class="equip-name">${escapeHtml(String(stigma.name || ''))}</div>
        <div class="equip-tag">圣痕${stigma.rarity ? ` ★${stigma.rarity}` : ''}</div>
      </div>`)
  }
  if (panel.elf?.name) {
    equipCards.push(`
      <div class="equip-card">
        <div class="equip-img"><img src="${escapeHtml(String(panel.elf.img || ''))}" alt="" onerror="this.style.visibility='hidden'"></div>
        <div class="equip-name">${escapeHtml(panel.elf.name)}</div>
        <div class="equip-tag">人偶${panel.elf.rarity ? ` ★${panel.elf.rarity}` : ''}</div>
      </div>`)
  }
  const chips = [
    panel.level ? `Lv.${panel.level}` : '',
    panel.star ? `★${panel.star}` : '',
    panel.attribute || '',
    panel.element ? `${panel.element}伤` : '',
    panel.rarity ? `初始${panel.rarity}` : '',
    panel.weaponType ? `${panel.weaponType}` : '',
  ].filter(Boolean).join(' · ')
  const statsLine = [panel.baseAttack ? `基础攻击 ${panel.baseAttack}` : ''].filter(Boolean).join(' ｜ ')
  return `
    <div class="cpanel">
      <div class="cp-left">
        <img class="cp-img" src="${escapeHtml(String(panel.avatar || ''))}" alt="" onerror="this.style.visibility='hidden'">
      </div>
      <div class="cp-right">
        <div class="cp-name">${escapeHtml(String(panel.name || ''))}</div>
        <div class="cp-chips">${escapeHtml(chips)}</div>
        ${statsLine ? `<div class="cp-stats">${escapeHtml(statsLine)}</div>` : ''}
        ${equipCards.length ? `<div class="equip-grid">${equipCards.join('')}</div>` : ''}
        ${hexagon ? `<div class="cp-hex">${hexagon}</div>` : ''}
      </div>
    </div>`
}

function buildCardHtml(options = {}) {
  const title = escapeHtml(options.title || '崩坏3 查询助手')
  const subtitle = escapeHtml(options.subtitle || 'HONKAI IMPACT 3RD')
  const portrait = options.portrait
    ? `<div class="art"><img src="${escapeHtml(options.portrait)}" alt=""></div>`
    : ''
  const body = renderLines(options.text || '')
  const stats = (Array.isArray(options.stats) ? options.stats : []).filter(Boolean)
  const statsHtml = stats.length
    ? `<div class="stats">${stats.map(item =>
        `<div class="stat"><div class="stat-v">${escapeHtml(String(item.value ?? ''))}</div><div class="stat-k">${escapeHtml(String(item.label ?? ''))}</div></div>`
      ).join('')}</div>`
    : ''
  const avatarGroups = (Array.isArray(options.avatarGroups) ? options.avatarGroups : []).filter(Boolean)
  const avatarsHtml = avatarGroups.map(group => {
    const items = (Array.isArray(group.items) ? group.items : []).filter(Boolean)
    const title = group.title ? `<div class="ag-title">${escapeHtml(group.title)}</div>` : ''
    const cards = items.map(item => `
      <div class="avatar-card">
        <div class="avatar-img-wrap">
          <img src="${escapeHtml(String(item.img || ''))}" alt="${escapeHtml(String(item.name || ''))}" onerror="this.style.visibility='hidden'">
        </div>
        <div class="avatar-name">${escapeHtml(String(item.name || ''))}</div>
        ${item.tag ? `<div class="avatar-tag">${escapeHtml(String(item.tag))}</div>` : ''}
      </div>`).join('')
    return `<div class="ag">${title}<div class="ag-grid">${cards}</div></div>`
  }).join('')
  const panel = options.characterPanel
    ? buildCharacterPanel(options.characterPanel)
    : ''
  const links = (Array.isArray(options.links) ? options.links : [])
    .filter(Boolean)
    .map(link => `<div class="link">链接：${escapeHtml(String(link))}</div>`)
    .join('')

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
    background:
      radial-gradient(900px 480px at 82% -8%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 62%),
      radial-gradient(640px 420px at 12% 6%, rgba(255, 214, 232, 0.95), rgba(255, 214, 232, 0) 68%),
      radial-gradient(760px 520px at 78% 52%, rgba(232, 178, 244, 0.75), rgba(232, 178, 244, 0) 66%),
      linear-gradient(180deg, #fbd8f0 0%, #eecdf4 42%, #d3b4f0 100%);
    position: relative;
    padding: 30px 42px 30px;
  }
  .art {
    position: absolute;
    right: 0;
    top: -26px;
    width: 300px;
    height: 400px;
    overflow: hidden;
    z-index: 1;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(to bottom, #000 40%, rgba(0,0,0,0.5) 62%, transparent 90%);
    mask-image: linear-gradient(to bottom, #000 40%, rgba(0,0,0,0.5) 62%, transparent 90%);
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
  }
  .content { position: relative; z-index: 2; }
  .title {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: 1.5px;
    background: linear-gradient(92deg, #d63a8c 8%, #b23ac4 45%, #8e35c9 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 2px 5px rgba(255,255,255,0.95)) drop-shadow(0 4px 14px rgba(214,77,148,0.45));
  }
  .subtitle {
    margin-top: 8px;
    font-size: 13px;
    letter-spacing: 2px;
    color: #7a4a9e;
  }
  .card {
    margin-top: 16px;
    background: linear-gradient(150deg, rgba(255,255,255,0.42), rgba(255,255,255,0.18));
    border: 1px solid rgba(255, 214, 232, 0.65);
    border-radius: 20px;
    padding: 18px 24px 14px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow: 0 10px 36px rgba(160, 80, 160, 0.22), inset 0 1px 0 rgba(255,255,255,0.55);
  }
  .h {
    font-size: 19px;
    font-weight: 800;
    color: #8e2f68;
    margin: 10px 0 8px;
    padding-left: 11px;
    border-left: 4px solid #d64d94;
    text-shadow: 0 1px 3px rgba(255,255,255,0.8);
  }
  .h:first-child { margin-top: 0; }
  .ln {
    font-size: 15px;
    color: #57204a;
    line-height: 1.75;
    padding: 1px 2px;
  }
  .kv {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 15px;
    line-height: 1.7;
    padding: 1px 2px;
  }
  .kv .k {
    flex: 0 0 auto;
    font-weight: 700;
    color: #a13570;
    background: rgba(255,255,255,0.55);
    border-radius: 7px;
    padding: 0 8px;
  }
  .kv .v { color: #57204a; }
  .divider {
    height: 1px;
    margin: 10px 0;
    background: rgba(214, 77, 148, 0.35);
  }
  .gap { height: 6px; }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 12px 0 4px;
  }
  .stat {
    background: rgba(255,255,255,0.5);
    border: 1px solid rgba(214, 77, 148, 0.35);
    border-radius: 12px;
    padding: 8px 6px;
    text-align: center;
  }
  .stat-v {
    font-size: 18px;
    font-weight: 800;
    color: #a13570;
  }
  .stat-k {
    font-size: 11px;
    color: #7a4a9e;
    margin-top: 2px;
  }
  .ag { margin-top: 14px; }
  .ag-title {
    font-size: 16px;
    font-weight: 700;
    color: #8e2f68;
    margin-bottom: 8px;
    padding-left: 10px;
    border-left: 4px solid #d64d94;
  }
  .ag-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .avatar-card {
    width: 128px;
    background: rgba(255,255,255,0.45);
    border: 1px solid rgba(214, 77, 148, 0.4);
    border-radius: 14px;
    padding: 8px;
    text-align: center;
    box-shadow: 0 4px 14px rgba(160, 80, 160, 0.18);
  }
  .avatar-img-wrap {
    width: 112px;
    height: 112px;
    margin: 0 auto;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255,255,255,0.4);
  }
  .avatar-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .avatar-name {
    font-size: 13px;
    font-weight: 700;
    color: #57204a;
    margin-top: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .avatar-tag {
    font-size: 11px;
    color: #a13570;
    margin-top: 2px;
  }
  .cpanel {
    display: flex;
    gap: 18px;
    background: rgba(255,255,255,0.45);
    border: 1px solid rgba(214, 77, 148, 0.4);
    border-radius: 16px;
    padding: 14px;
    margin-bottom: 6px;
    box-shadow: 0 6px 20px rgba(160, 80, 160, 0.18);
  }
  .cp-left {
    flex: 0 0 190px;
    height: 250px;
    border-radius: 14px;
    overflow: hidden;
    background: rgba(255,255,255,0.4);
  }
  .cp-left img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cp-right { flex: 1; min-width: 0; }
  .cp-name {
    font-size: 26px;
    font-weight: 800;
    color: #8e2f68;
    text-shadow: 0 1px 3px rgba(255,255,255,0.9);
  }
  .cp-chips {
    margin-top: 6px;
    font-size: 13px;
    color: #7a4a9e;
  }
  .cp-stats {
    margin-top: 6px;
    font-size: 14px;
    font-weight: 700;
    color: #a13570;
  }
  .equip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .equip-card {
    width: 96px;
    background: rgba(255,255,255,0.55);
    border: 1px solid rgba(214, 77, 148, 0.35);
    border-radius: 12px;
    padding: 6px;
    text-align: center;
  }
  .equip-img {
    width: 74px;
    height: 74px;
    margin: 0 auto;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255,255,255,0.5);
  }
  .equip-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .equip-name {
    font-size: 11px;
    color: #57204a;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .equip-tag {
    font-size: 10px;
    color: #a13570;
  }
  .cp-hex {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .hex-chip {
    font-size: 11px;
    color: #57204a;
    background: rgba(255,255,255,0.6);
    border: 1px solid rgba(214, 77, 148, 0.35);
    border-radius: 999px;
    padding: 2px 9px;
  }
  .links {
    margin-top: 14px;
    background: rgba(255,255,255,0.5);
    border: 1px solid rgba(214, 77, 148, 0.4);
    border-radius: 14px;
    padding: 10px 16px;
  }
  .link {
    font-size: 13px;
    color: #57204a;
    word-break: break-all;
    line-height: 1.7;
  }
</style>
</head>
<body>
  ${portrait}
  <div class="content">
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="card">${body}${panel}${statsHtml}${avatarsHtml}</div>
    ${links ? `<div class="links">${links}</div>` : ''}
  </div>
</body>
</html>`
}

async function renderWithShared(html, outputPath) {
  const { renderHtmlToImage } = await import(CRYSTELF_RENDERER_URL)
  await renderHtmlToImage({
    html,
    outputPath,
    viewport: { width: 900, height: 600, deviceScaleFactor: 2 },
    contentOptions: { waitUntil: 'domcontentloaded' },
    afterContent: async page => {
      // 头像较多的卡片不等待全部远程图片，最多等 1.2s 后截图
      await new Promise(resolve => setTimeout(resolve, 1200))
      await page.evaluate(() => {
        const h = Math.ceil(document.body.getBoundingClientRect().height)
        document.documentElement.style.height = `${h}px`
        document.body.style.height = `${h}px`
      })
    },
  })
  return outputPath
}

async function renderWithPuppeteer(html, outputPath) {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 1200))
    await page.evaluate(() => {
      const h = Math.ceil(document.body.getBoundingClientRect().height)
      document.documentElement.style.height = `${h}px`
      document.body.style.height = `${h}px`
    })
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewport({ width: 900, height: h, deviceScaleFactor: 2 })
    fs.writeFileSync(outputPath, await page.screenshot({ fullPage: true }))
    return outputPath
  } finally {
    await browser.close().catch(() => {})
  }
}

let counter = 0

export async function renderCardImage(options = {}) {
  const html = buildCardHtml(options)
  counter += 1
  const outputPath = path.join(process.cwd(), 'data', 'bh3', `card-${Date.now()}-${counter % 100}.png`)
  const outputDir = path.dirname(outputPath)
  fs.mkdirSync(outputDir, { recursive: true })
  // 清理 15 分钟前的临时卡片，避免无限积累
  try {
    const cutoff = Date.now() - 15 * 60 * 1000
    for (const file of fs.readdirSync(outputDir)) {
      if (!file.startsWith('card-') || !file.endsWith('.png')) continue
      const filePath = path.join(outputDir, file)
      const stat = fs.statSync(filePath)
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath)
      }
    }
  } catch {
    // 清理失败不影响渲染
  }
  try {
    await renderWithShared(html, outputPath)
    return outputPath
  } catch {
    try {
      await renderWithPuppeteer(html, outputPath)
      return outputPath
    } catch (error) {
      if (globalThis.logger?.warn) {
        globalThis.logger.warn(`[bh3] 卡片图片渲染失败: ${error.message}`)
      }
      return null
    }
  }
}

export { buildCardHtml }
