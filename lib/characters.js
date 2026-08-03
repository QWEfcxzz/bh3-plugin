import fs from 'fs'
import { fileURLToPath } from 'url'

const DATA_FILE = fileURLToPath(new URL('../data/characters.json', import.meta.url))

let cache = null

function load() {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).characters || []
  } catch {
    cache = []
  }
  return cache
}

function normalize(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function getAllCharacters() {
  return load()
}

export function findCharacter(keyword = '') {
  const text = normalize(keyword)
  if (!text) return null
  const list = load()
  const exactName = list.find(item => normalize(item.name) === text)
  if (exactName) return exactName
  const exactAlias = list.find(item => item.aliases.some(alias => normalize(alias) === text))
  if (exactAlias) return exactAlias
  const nameHit = list.find(item => normalize(item.name).includes(text))
  if (nameHit) return nameHit
  return list.find(item => item.aliases.some(alias => normalize(alias).includes(text))) || null
}

export function searchCharacters(keyword = '') {
  const text = normalize(keyword)
  if (!text) return []
  const list = load()
  const exactName = list.filter(item => normalize(item.name) === text)
  const exactAlias = list.filter(item => item.aliases.some(alias => normalize(alias) === text))
  const contains = list.filter(item =>
    normalize(item.name).includes(text)
    || item.aliases.some(alias => normalize(alias).includes(text))
  )
  const seen = new Set()
  return [...exactName, ...exactAlias, ...contains]
    .filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .slice(0, 10)
}
