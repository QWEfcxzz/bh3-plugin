// 从米游社公开图鉴抓取全部女武神数据，生成 data/characters.json
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', 'data', 'characters.json')
const WIKI_BASE = 'https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki'

const ELEMENT_MAP = [
  [/火焰|火伤/, '火'],
  [/冰冻|冰霜|冰伤/, '冰'],
  [/雷电|雷伤/, '雷'],
  [/物理/, '物理'],
  [/量子/, '量子'],
  [/虚数/, '虚数'],
  [/星尘/, '星尘'],
]

function detectElement(roleText = '') {
  const text = String(roleText || '')
  const pair = ELEMENT_MAP.find(([regex]) => regex.test(text))
  return pair ? pair[1] : ''
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

async function wikiGet(path, params = {}) {
  params.app_sn = 'bh3_wiki'
  const query = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
  const json = await fetchJson(`${WIKI_BASE}${path}?${query}`)
  if (!json || Number(json.retcode) !== 0) {
    throw new Error(`wiki ${path} 失败: ${json?.message || 'unknown'}`)
  }
  return json.data
}

function extractBlocks(html = '') {
  const blocks = []
  const regex = /data-data="([^"]*)"/g
  let match = null
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]))
      if (Array.isArray(parsed)) blocks.push(...parsed)
      else blocks.push(parsed)
    } catch {
      // ignore malformed blocks
    }
  }
  return blocks
}

function parseFilters(ext = '') {
  const result = {}
  try {
    const parsed = JSON.parse(ext || '{}')
    const text = parsed.c_18?.filter?.text || '[]'
    const filters = JSON.parse(text)
    for (const filter of filters) {
      const [key, value] = String(filter).split('/')
      if (key === '属性') result.attribute = value
      if (key === '角色') result.character = value
      if (key === '初始阶级') result.rarity = value
      if (key === '装甲特性') result.trait = value
    }
  } catch {
    // ignore
  }
  return result
}

function pickShowcase(contents = [], avatar = '') {
  let portrait = ''
  let background = ''
  for (const section of contents) {
    for (const block of extractBlocks(section.text || '')) {
      if (String(block.partKey || '') !== 'costume') continue
      const items = Array.isArray(block.data?.items) ? block.data.items : []
      for (const item of items) {
        const img = String(item.img || '')
        const name = String(item.name_ || '')
        if (!img) continue
        if (/横版|horizontal/i.test(name)) {
          background = background || img
        } else if (/竖版|vertical/i.test(name)) {
          portrait = portrait || img
        }
      }
      if (!portrait) {
        const first = items.find(item => item.img)
        portrait = first ? String(first.img) : ''
      }
      if (!background) {
        const second = items.find((item, index) => index > 0 && item.img)
        background = second ? String(second.img) : (items[0]?.img ? String(items[0].img) : '')
      }
      if (portrait || background) return { portrait, background }
    }
  }
  if (!portrait) portrait = avatar
  return { portrait, background }
}

function parseEvaluation(contents = []) {
  const result = {
    aliases: [],
    weaponType: '',
    role: '',
    attribute: '',
    avatar: '',
    hexagon: {},
    baseAttack: null,
    life: null,
    defense: null,
  }
  for (const section of contents) {
    for (const block of extractBlocks(section.text || '')) {
      const data = block.data || {}
      const part = String(block.partKey || '')
      if (part === 'basicIntroduction') {
        if (data.avatar) result.avatar = String(data.avatar)
        for (const field of Array.isArray(data.mainFields) ? data.mainFields : []) {
          if (field.nameL === '别名' && field.valueL) {
            result.aliases = String(field.valueL)
              .split(/[、，,;；]/)
              .map(item => item.trim())
              .filter(Boolean)
          }
          if (field.nameL === '角色属性' && field.valueL) result.attribute = String(field.valueL)
          if (field.nameL === '武器类型' && field.valueL) result.weaponType = String(field.valueL)
          if (field.nameL === '角色定位' && field.valueL) result.role = String(field.valueL)
        }
        for (const item of Array.isArray(data.hexagon) ? data.hexagon : []) {
          if (item.key) result.hexagon[item.key] = item.value
        }
      }
      if (part === 'advanceData' && Array.isArray(data.advanceData) && data.advanceData.length > 0) {
        const last = data.advanceData[data.advanceData.length - 1]
        result.baseAttack = Number(last.attack) || null
        result.life = Number(last.life) || null
        result.defense = Number(last.defense) || null
      }
    }
  }
  return result
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const listData = await wikiGet('/v1/home/content/list', { channel_id: 18 })
const items = []
for (const section of listData?.list || []) {
  for (const item of section.list || []) {
    items.push(item)
  }
}

console.log(`女武神条目: ${items.length}，开始抓取详情...`)

const characters = []
let failed = 0
for (let index = 0; index < items.length; index++) {
  const item = items[index]
  const filters = parseFilters(item.ext || '')
  try {
    const data = await wikiGet('/v1/content/info', { content_id: item.content_id })
    const content = data?.content || {}
    const evaluation = parseEvaluation(content.contents || [])
    const showcase = pickShowcase(content.contents || [], evaluation.avatar)
    const name = String(content.title || item.title || '')
    const element = detectElement(evaluation.role || filters.trait)
    const aliases = new Set([...evaluation.aliases, filters.character, name].filter(Boolean))
    characters.push({
      id: Number(item.content_id),
      name,
      aliases: Array.from(aliases),
      character: filters.character || '',
      attribute: evaluation.attribute || filters.attribute || '',
      element,
      weaponType: evaluation.weaponType || '',
      role: evaluation.role || '',
      rarity: filters.rarity || '',
      icon: String(item.icon || ''),
      avatar: evaluation.avatar || '',
      portrait: showcase.portrait,
      background: showcase.background,
      baseAttack: evaluation.baseAttack,
      life: evaluation.life,
      defense: evaluation.defense,
      hexagon: evaluation.hexagon,
    })
    if ((index + 1) % 10 === 0 || index === items.length - 1) {
      console.log(`已抓取 ${index + 1}/${items.length}`)
    }
  } catch (error) {
    failed++
    console.warn(`跳过 ${item.title || item.content_id}: ${error.message}`)
  }
  await sleep(120)
}

characters.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'))

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
fs.writeFileSync(
  DATA_FILE,
  JSON.stringify({ generatedAt: new Date().toISOString(), characters }, null, 2),
  'utf8',
)

console.log(`完成：成功 ${characters.length} 个，失败 ${failed} 个 -> ${DATA_FILE}`)
