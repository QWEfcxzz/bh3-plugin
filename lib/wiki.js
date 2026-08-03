const WIKI_BASE = 'https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki'

async function wikiGet(path, params = {}) {
  params.app_sn = 'bh3_wiki'
  const query = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
  const res = await fetch(`${WIKI_BASE}${path}?${query}`, {
    signal: AbortSignal.timeout(15000),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    throw new Error('图鉴接口返回异常')
  }
  if (!json || Number(json.retcode) !== 0) {
    throw new Error(json?.message || '图鉴接口异常')
  }
  return json.data
}

export async function wikiSearch(keyword = '') {
  const data = await wikiGet('/v1/search/content', { keyword, page: 1 })
  return (data?.list || []).map(item => ({
    id: item.id,
    title: item.title,
    summary: item.summary || '',
    icon: item.icon || '',
    channel: item.channels?.[0]?.name || '',
    parent: item.channels?.[0]?.parent?.name || '',
    bbs_url: item.bbs_url || '',
  }))
}

export async function wikiDetail(contentId) {
  const data = await wikiGet('/v1/content/info', { content_id: contentId })
  const content = data?.content || {}
  return {
    id: content.id,
    title: content.title,
    icon: content.icon || '',
    summary: content.summary || '',
    contents: Array.isArray(content.contents) ? content.contents : [],
    bbs_url: content.bbs_url || '',
  }
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractDataBlocks(html = '') {
  const blocks = []
  const regex = /data-data="([^"]*)"/g
  let match = null
  while ((match = regex.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(match[1])
      const parsed = JSON.parse(decoded)
      if (Array.isArray(parsed)) {
        blocks.push(...parsed)
      } else {
        blocks.push(parsed)
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return blocks
}

export function formatWikiDetail(detail = {}) {
  const lines = []
  if (detail.title) {
    lines.push(`=== ${detail.title} ===`)
  }
  if (detail.summary) {
    lines.push(stripHtml(detail.summary).slice(0, 200))
  }

  const blocks = []
  for (const section of detail.contents || []) {
    blocks.push(...extractDataBlocks(section.text || ''))
  }

  const fields = []
  const skills = []
  for (const block of blocks) {
    const data = block.data || {}
    const tmpl = String(block.tmplKey || '')
    const part = String(block.partKey || '')
    if (part === 'basicIntroduction' && Array.isArray(data.mainFields)) {
      for (const field of data.mainFields) {
        if (field.nameL && field.valueL) fields.push(`${field.nameL}：${stripHtml(field.valueL)}`)
        if (field.nameR && field.valueR) fields.push(`${field.nameR}：${stripHtml(field.valueR)}`)
      }
    } else if (['weapon', 'stigmata'].includes(tmpl) && Array.isArray(data.attr)) {
      for (const attr of data.attr) {
        if (attr.key && attr.value) {
          skills.push(`${attr.key}：${stripHtml(attr.value)}`)
        }
      }
    } else if (part === 'main' && Array.isArray(data.skills)) {
      for (const skill of data.skills) {
        if (skill.name && skill.value) skills.push(`${skill.name}：${stripHtml(skill.value)}`)
      }
    } else if (data.mainFields && Array.isArray(data.mainFields)) {
      for (const field of data.mainFields) {
        if (field.nameL && field.valueL) fields.push(`${field.nameL}：${stripHtml(field.valueL)}`)
        if (field.nameR && field.valueR) fields.push(`${field.nameR}：${stripHtml(field.valueR)}`)
      }
    }
  }

  if (fields.length > 0) {
    lines.push('', '—— 基础信息 ——')
    lines.push(...fields.slice(0, 12))
  }
  if (skills.length > 0) {
    lines.push('', '—— 技能/属性 ——')
    lines.push(...skills.slice(0, 10))
  }

  if (lines.length <= 1) {
    const text = (detail.contents || [])
      .map(section => `【${section.name || '正文'}】\n${stripHtml(section.text || '').slice(0, 600)}`)
      .join('\n\n')
    if (text) lines.push(text.slice(0, 1500))
  }

  return lines.join('\n')
}

export { stripHtml }
