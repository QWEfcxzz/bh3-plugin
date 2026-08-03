import fs from 'fs'
import path from 'path'
import { Bh3Plugin } from './apps/main.js'

if (!globalThis.segment) {
  const oicq = await import('oicq')
  globalThis.segment = oicq.segment
}

const dataDir = path.join(process.cwd(), 'data', 'bh3')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (globalThis.logger?.info) {
  globalThis.logger.info('崩坏3查询插件加载中...')
}

const apps = { Bh3Plugin }

export { apps }
