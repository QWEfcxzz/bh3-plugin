import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'bh3')
const BINDS_FILE = path.join(DATA_DIR, 'binds.json')
const COOKIES_FILE = path.join(DATA_DIR, 'cookies.json')
const MYS_DB = path.join(process.cwd(), 'data', 'db', 'data.db')

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    }
  } catch (error) {
    if (globalThis.logger?.warn) {
      globalThis.logger.warn(`[bh3] 读取 ${path.basename(file)} 失败: ${error.message}`)
    }
  }
  return fallback
}

function writeJson(file, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

export function getBindUid(qq = '') {
  return String(readJson(BINDS_FILE, {})[String(qq)] || '').trim()
}

export function setBindUid(qq = '', uid = '') {
  const data = readJson(BINDS_FILE, {})
  data[String(qq)] = String(uid).trim()
  writeJson(BINDS_FILE, data)
}

export function removeBindUid(qq = '') {
  const data = readJson(BINDS_FILE, {})
  delete data[String(qq)]
  writeJson(BINDS_FILE, data)
}

export function getCookie(uid = '') {
  const data = readJson(COOKIES_FILE, {})
  return String(data[String(uid)] || data._default || '').trim()
}

export function setCookie(uid = '', cookie = '') {
  const data = readJson(COOKIES_FILE, {})
  if (uid) {
    data[String(uid)] = String(cookie).trim()
  } else {
    data._default = String(cookie).trim()
  }
  writeJson(COOKIES_FILE, data)
}

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value) || fallback
  } catch {
    return fallback
  }
}

async function queryMysDb(sql) {
  const sqlite3 = await import('sqlite3')
  return new Promise((resolve, reject) => {
    const db = new sqlite3.default.Database(MYS_DB, sqlite3.default.OPEN_READONLY, openError => {
      if (openError) {
        reject(openError)
        return
      }
      db.all(sql, [], (queryError, rows) => {
        db.close()
        if (queryError) {
          reject(queryError)
        } else {
          resolve(rows || [])
        }
      })
    })
  })
}

// 读取逍遥插件/喵喵共享数据库里的米游社 CK（ltoken/ltuid/cookie_token）
// 注意：崩坏3战绩接口仅允许查询 Cookie 所属账号自己的号（跨号会报“用户信息不匹配”），
// 因此这里只返回“拥有该 UID”的账号 CK。
export async function getExternalCk(uid = '') {
  try {
    const rows = await queryMysDb(
      "SELECT ltuid, ck, uids FROM MysUsers WHERE ck IS NOT NULL AND ck != ''"
    )
    if (rows.length === 0) return ''

    const normalizedUid = String(uid || '')
    const ownerRow = rows.find(row => {
      const uids = safeJsonParse(row.uids)
      return Array.isArray(uids.bh3) && uids.bh3.includes(normalizedUid)
    })
    return ownerRow?.ck ? String(ownerRow.ck) : ''
  } catch (error) {
    if (globalThis.logger?.warn) {
      globalThis.logger.warn(`[bh3] 读取逍遥插件 CK 失败: ${error.message}`)
    }
    return ''
  }
}
