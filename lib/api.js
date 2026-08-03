import crypto from 'crypto'
import { getCookie } from './store.js'

const GS_BASE = 'https://api-takumi.mihoyo.com'
const RECORD_BASE = 'https://api-takumi-record.mihoyo.com'
const BH3_API = `${RECORD_BASE}/game_record/app/honkai3rd/api`
const SALT_RECORD = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
const SALT_WEB = 'yBh10ikxtLPoIhgwgPZSv5dmfaOTSJ6a'
const APP_VERSION = '2.102.1'

const serverCache = new Map()

function md5(text) {
  return crypto.createHash('md5').update(String(text)).digest('hex')
}

function buildRecordDS(query = '') {
  const t = String(Math.floor(Date.now() / 1000))
  const r = String(Math.floor(Math.random() * 100000 + 100000))
  const sign = md5(`salt=${SALT_RECORD}&t=${t}&r=${r}&b=&q=${query}`)
  return `${t},${r},${sign}`
}

function buildWebDS() {
  const t = String(Math.floor(Date.now() / 1000))
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const r = Array.from({ length: 6 }, () => charset[Math.floor(Math.random() * charset.length)]).join('')
  const sign = md5(`salt=${SALT_WEB}&t=${t}&r=${r}`)
  return `${t},${r},${sign}`
}

function baseHeaders(extra = {}) {
  return {
    'x-rpc-app_version': APP_VERSION,
    'X-Requested-With': 'com.mihoyo.hyperion',
    'User-Agent': `Mozilla/5.0 (Linux; Android 13; PHK110 Build/SKQ1.221119.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.133 Mobile Safari/537.36 miHoYoBBS/${APP_VERSION}`,
    'x-rpc-client_type': '5',
    'Referer': 'https://webstatic.mihoyo.com/',
    'Origin': 'https://webstatic.mihoyo.com/',
    ...extra,
  }
}

function buildQuery(params = {}) {
  return Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
}

async function request(url, headers, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`接口返回异常 (HTTP ${res.status})`)
  }
  return json
}

function retcodeMessage(retcode, message = '') {
  const map = {
    10001: 'Cookie 未配置或已失效，请重新绑定',
    '-100': 'Cookie 已失效，请重新绑定',
    1034: '触发米游社风控验证码，请稍后重试或更换 Cookie',
    10035: '请求过于频繁，请稍后再试',
    '-51': '未找到该 UID 的绑定信息',
  }
  return map[String(retcode)] || message || `接口错误 (${retcode})`
}

export async function getUserGameRoles(cookie = '') {
  const query = 'game_biz=bh3_cn'
  const headers = baseHeaders({
    Cookie: cookie,
    DS: buildWebDS(),
  })
  const json = await request(`${GS_BASE}/binding/api/getUserGameRolesByCookie?${query}`, headers)
  if (Number(json.retcode) !== 0) {
    throw new Error(retcodeMessage(json.retcode, json.message))
  }
  return Array.isArray(json.data?.list) ? json.data.list : []
}

async function resolveServer(uid, cookie) {
  const cached = serverCache.get(String(uid))
  if (cached) return cached
  const roles = await getUserGameRoles(cookie)
  const role = roles.find(item => String(item.game_uid) === String(uid))
  const server = role?.region || 'prod_gf_cn'
  serverCache.set(String(uid), server)
  return server
}

export async function recordRequest(endpoint, uid, extraParams = {}, cookie = '') {
  const ck = cookie || getCookie(uid)
  if (!ck) {
    throw new Error('未配置 Cookie，请先使用 #崩坏3cookie 绑定')
  }
  const server = await resolveServer(uid, ck)
  const params = {
    role_id: String(uid),
    server,
    ...extraParams,
  }
  const query = buildQuery(params)
  const headers = baseHeaders({
    Cookie: ck,
    DS: buildRecordDS(query),
  })
  const json = await request(`${BH3_API}${endpoint}?${query}`, headers)
  if (Number(json.retcode) !== 0) {
    throw new Error(retcodeMessage(json.retcode, json.message))
  }
  return json.data || {}
}

export { BH3_API }
