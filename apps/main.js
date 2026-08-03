import {
  getUserGameRoles,
  recordRequest,
} from '../lib/api.js'
import {
  formatWikiDetail,
  wikiDetail,
  wikiSearch,
} from '../lib/wiki.js'
import {
  findCharacter,
  getAllCharacters,
  searchCharacters,
} from '../lib/characters.js'
import { calculateDamage } from '../lib/damage.js'
import { renderHelpImage } from '../lib/helpImage.js'
import { renderCardImage } from '../lib/cardImage.js'
import {
  getBindUid,
  getCookie,
  getExternalCk,
  removeBindUid,
  setBindUid,
  setCookie,
} from '../lib/store.js'

const PREFIX = '#?(崩坏3|崩三|bbb)'

const ATTRIBUTE_MAP = {
  1: '生物',
  2: '异能',
  3: '机械',
  4: '量子',
  5: '虚数',
  6: '星尘',
}

function formatDuration(seconds = 0) {
  const total = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours}小时${minutes}分`
  if (minutes > 0) return `${minutes}分钟`
  return `${total}秒`
}

function formatTime(value = '') {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function battleAreaLabel(area = 0) {
  const map = { 1: '低级区', 2: '中级区', 3: '高级区' }
  return map[Number(area)] || `${area}区`
}

function formatIndex(data = {}) {
  const role = data.role || {}
  const stats = data.stats || {}
  const pref = data.preference || {}
  const lines = [
    `=== ${role.nickname || '未知舰长'} 的崩坏3面板 ===`,
    `等级 ${role.level || '?'} · 区服 ${role.region || '未知'}`,
  ]
  const basic = []
  if (stats.active_day_number) basic.push(`活跃 ${stats.active_day_number} 天`)
  if (stats.achievement_number) basic.push(`成就 ${stats.achievement_number}`)
  if (stats.suit_number) basic.push(`服装 ${stats.suit_number}`)
  if (basic.length) lines.push(basic.join(' | '))

  const collection = []
  if (stats.armor_number) collection.push(`女武神 ${stats.armor_number}`)
  if (stats.sss_armor_number) collection.push(`SSS ${stats.sss_armor_number}`)
  if (stats.elf_number) collection.push(`人偶 ${stats.elf_number}`)
  if (stats.weapon_number) collection.push(`武器 ${stats.weapon_number}`)
  if (stats.five_star_weapon_number) collection.push(`5星武器 ${stats.five_star_weapon_number}`)
  if (stats.stigmata_number) collection.push(`圣痕 ${stats.stigmata_number}`)
  if (stats.five_star_stigmata_number) collection.push(`5星圣痕 ${stats.five_star_stigmata_number}`)
  if (collection.length) lines.push(collection.join(' | '))

  lines.push('')
  lines.push(`深渊：${stats.new_abyss?.level || '?'}段 · 第${stats.new_abyss?.cup_number || '?'}杯 · 历史最高 ${stats.abyss_score || 0}分 (${stats.abyss_floor || '?'}层)`)
  lines.push(`战场：${battleAreaLabel(stats.battle_field_area)} · 前${stats.battle_field_ranking_percentage || '?'}% · 最高 ${stats.battle_field_score || 0}分`)
  if (stats.god_war_max_punish_level || stats.god_war_max_challenge_score) {
    lines.push(`逐光：最高难度 ${stats.god_war_max_punish_level || '?'} · 最高挑战 ${stats.god_war_max_challenge_score || 0}分`)
  }
  if (pref.comprehensive_score) {
    lines.push(`综合：${pref.comprehensive_rating || '?'} (${pref.comprehensive_score}分)`)
  }
  return lines.join('\n')
}

function formatNote(data = {}) {
  const lines = ['=== 崩坏3 实时便笺 ===']
  lines.push(`体力：${data.current_stamina ?? '?'}/${data.max_stamina ?? '?'}（${formatDuration(data.stamina_recover_time)}后回满）`)
  if (data.current_train_score !== undefined) {
    lines.push(`训练值：${data.current_train_score}/${data.max_train_score ?? '?'}`)
  }
  const abyss = data.greedy_endless
  if (abyss?.is_open) {
    lines.push(`量子奇点：奖励 ${abyss.cur_reward ?? 0}/${abyss.max_reward ?? 0} · ${formatTime(abyss.schedule_end)}结束`)
  }
  const ultra = data.ultra_endless
  if (ultra?.is_open) {
    lines.push(`超弦空间：组别Lv.${ultra.group_level ?? '?'} · 分数 ${ultra.challenge_score ?? 0} · ${formatTime(ultra.schedule_end)}结束`)
  }
  const field = data.battle_field
  if (field?.is_open) {
    lines.push(`记忆战场：奖励 ${field.cur_reward ?? 0}/${field.max_reward ?? 0} (SSS ${field.cur_sss_reward ?? 0}/${field.max_sss_reward ?? 0}) · ${formatTime(field.schedule_end)}结束`)
  }
  const godWar = data.god_war
  if (godWar?.is_open) {
    lines.push(`逐光：奖励 ${godWar.cur_reward ?? 0}/${godWar.max_reward ?? 0} · ${formatTime(godWar.schedule_end)}结束`)
  }
  return lines.join('\n')
}

function formatCharacters(data = {}) {
  const list = Array.isArray(data.characters) ? data.characters : []
  if (list.length === 0) {
    return '该账号暂无角色数据。'
  }
  const lines = [`=== 崩坏3 角色（${list.length}） ===`]
  const shown = list.slice(0, 12)
  for (const item of shown) {
    const character = item.character || {}
    const avatar = character.avatar || {}
    const weapon = character.weapon || {}
    const stigmata = Array.isArray(character.stigmatas) ? character.stigmatas : []
    const elf = character.elf || {}
    const attribute = ATTRIBUTE_MAP[Number(avatar.attribute_id)] || ''
    const parts = [
      `Lv.${avatar.level ?? '?'}`,
      avatar.name || '未知女武神',
      attribute ? `[${attribute}]` : '',
      `★${avatar.star ?? '?'}`,
    ]
    const equip = []
    if (weapon?.name) equip.push(`武:${weapon.name}`)
    if (stigmata.length) equip.push(`圣:${stigmata.map(s => s.name).join('/')}`)
    if (elf?.name) equip.push(`偶:${elf.name}`)
    let line = parts.filter(Boolean).join(' ')
    if (equip.length) line += `\n   ${equip.join(' ')}`
    lines.push(line)
  }
  if (list.length > shown.length) {
    lines.push(`...共 ${list.length} 名角色`)
  }
  return lines.join('\n')
}

function formatAbyss(data = {}, title = '深渊') {
  const reports = Array.isArray(data.reports) ? data.reports : []
  if (reports.length === 0) {
    return `=== 崩坏3 ${title} ===\n暂无数据。`
  }
  const lines = [`=== 崩坏3 ${title} ===`]
  for (const report of reports.slice(0, 3)) {
    const boss = report.boss || {}
    const lineup = Array.isArray(report.lineup) ? report.lineup : []
    lines.push('')
    lines.push(`BOSS：${boss.name || '未知'} · 分数 ${report.score ?? 0} · ${formatTime(report.updated_time_second)}`)
    if (lineup.length) {
      lines.push(`阵容：${lineup.map(a => a.name).join(' / ')}`)
    }
  }
  return lines.join('\n')
}

function formatBattleField(data = {}) {
  const reports = Array.isArray(data.reports) ? data.reports : []
  if (reports.length === 0) {
    return '=== 崩坏3 记忆战场 ===\n暂无数据。'
  }
  const lines = ['=== 崩坏3 记忆战场 ===']
  for (const report of reports.slice(0, 2)) {
    lines.push('')
    lines.push(`排名 ${report.rank ?? '?'} · 前${report.ranking_percentage ?? '?'}% · ${battleAreaLabel(report.area)} · 总分 ${report.score ?? 0}`)
    for (const info of Array.isArray(report.battle_infos) ? report.battle_infos : []) {
      const lineup = Array.isArray(info.lineup) ? info.lineup : []
      const elf = info.elf || {}
      const squad = [...(elf?.name ? [elf.name] : []), ...lineup.map(a => a.name)]
      if (squad.length) {
        lines.push(`  队伍：${squad.join(' / ')}`)
      }
    }
  }
  return lines.join('\n')
}

function formatGodWar(data = {}) {
  const records = Array.isArray(data.records) ? data.records : []
  if (records.length === 0) {
    return '=== 崩坏3 逐光 ===\n暂无数据。'
  }
  const lines = ['=== 崩坏3 逐光（往世乐土） ===']
  for (const record of records.slice(0, 5)) {
    const main = record.main_avatar || {}
    const support = Array.isArray(record.support_avatars) ? record.support_avatars : []
    lines.push(`难度 ${record.punish_level ?? '?'} · 分数 ${record.score ?? 0} · Lv.${record.level ?? '?'} · ${formatTime(record.settle_time_second)}`)
    const squad = [main.name, ...support.map(a => a.name)].filter(Boolean)
    if (squad.length) {
      lines.push(`  阵容：${squad.join(' / ')}`)
    }
  }
  return lines.join('\n')
}

function avatarItem(avatar = {}, extra = {}) {
  const img = avatar.icon_path
    || avatar.background_path
    || avatar.sec_part_icon
    || avatar.avatar
    || ''
  const attribute = ATTRIBUTE_MAP[Number(avatar.attribute_id)] || ''
  const tagParts = []
  if (extra.label) tagParts.push(extra.label)
  if (avatar.star) tagParts.push(`★${avatar.star}`)
  if (extra.level) tagParts.push(`Lv.${extra.level}`)
  if (attribute) tagParts.push(attribute)
  return { name: avatar.name || '未知', img, tag: tagParts.filter(Boolean).join(' ') }
}

function buildIndexStats(data = {}) {
  const role = data.role || {}
  const stats = data.stats || {}
  return [
    { label: '等级', value: role.level ?? '?' },
    { label: '活跃天数', value: stats.active_day_number ?? 0 },
    { label: '成就', value: stats.achievement_number ?? 0 },
    { label: '女武神', value: stats.armor_number ?? 0 },
    { label: 'SSS装甲', value: stats.sss_armor_number ?? 0 },
    { label: '武器', value: stats.weapon_number ?? 0 },
    { label: '圣痕', value: stats.stigmata_number ?? 0 },
    { label: '深渊', value: stats.new_abyss?.level ?? '?' },
  ]
}

function buildCharactersCard(data = {}) {
  const list = Array.isArray(data.characters) ? data.characters : []
  if (list.length === 0) {
    return { text: '该账号暂无角色数据。', avatarGroups: [] }
  }
  const showCount = Math.min(list.length, 30)
  const text = list.length > showCount ? `共 ${list.length} 名角色，显示前 ${showCount} 名` : `共 ${list.length} 名角色`
  return {
    text,
    avatarGroups: [{
      title: '角色列表',
      items: list.slice(0, showCount).map(item => avatarItem(item.character?.avatar || {})),
    }],
  }
}

const NEW_ABYSS_LEVEL = { 1: '禁忌', 2: '原罪I', 3: '原罪II', 4: '原罪III', 5: '苦痛I', 6: '苦痛II', 7: '苦痛III', 8: '红莲', 9: '寂灭' }
const OLD_ABYSS_LEVEL = { D: '禁忌', C: '原罪', B: '苦痛', A: '红莲', S: '寂灭' }
const GODWAR_LEVEL = { 303: '沦没', 304: '戒约', 305: '侵蚀', 306: '终尽' }

function buildAbyssCard(data = {}, title = '超弦空间') {
  const reports = Array.isArray(data.reports) ? data.reports : []
  if (reports.length === 0) {
    return { text: `暂无${title}记录。`, avatarGroups: [] }
  }
  const text = [`共 ${reports.length} 期记录`].join('\n')
  const avatarGroups = reports.map((report, index) => {
    const boss = report.boss || {}
    const lineup = Array.isArray(report.lineup) ? report.lineup : []
    const items = lineup.map(character => avatarItem(character))
    if (report.elf?.avatar) {
      items.push(avatarItem({ name: report.elf.name || '人偶', avatar: report.elf.avatar, star: report.elf.star }))
    }
    const levelLabel = report.isOldData
      ? OLD_ABYSS_LEVEL[report.level] || '未知段位'
      : NEW_ABYSS_LEVEL[report.level] || '未知段位'
    return {
      title: `第${index + 1}期 · ${boss.name || 'BOSS'} · ${report.score ?? 0}分 · ${levelLabel}`,
      items,
    }
  })
  return { text, avatarGroups }
}

function buildBattleFieldCard(data = {}) {
  const reports = Array.isArray(data.reports) ? data.reports : []
  if (reports.length === 0) {
    return { text: '暂无记忆战场记录。', avatarGroups: [] }
  }
  const text = reports.map((report, index) =>
    `第${index + 1}期：排名 ${report.rank ?? '?'} · 前${report.ranking_percentage ?? '?'}% · ${battleAreaLabel(report.area)}`
  ).join('\n')
  const avatarGroups = reports.map((report, index) => {
    const info = report.battle_infos?.[0] || {}
    const lineup = Array.isArray(info.lineup) ? info.lineup : []
    const items = lineup.map(character => avatarItem(character))
    if (info.elf?.avatar) {
      items.push(avatarItem({ name: info.elf.name || '人偶', avatar: info.elf.avatar, star: info.elf.star }))
    }
    return {
      title: `第${index + 1}期队伍 · ${report.score ?? 0}分`,
      items,
    }
  })
  return { text, avatarGroups }
}

function buildGodWarCard(data = {}) {
  const summary = data.summary || {}
  const stats = [
    { label: '解锁装甲', value: summary.avatar_numbers ?? 0 },
    { label: '命定歧路', value: summary.max_support_point ?? 0 },
    { label: '追忆之证', value: summary.extra_item_number ?? 0 },
    { label: '满强化装甲', value: summary.max_level_avatar_number ?? 0 },
    { label: '最高挑战', value: summary.max_challenge_score ?? 0 },
  ]
  const avatarGroups = []
  const transcript = Array.isArray(data.avatar_transcript) ? data.avatar_transcript : []
  if (transcript.length > 0) {
    avatarGroups.push({
      title: '装甲成绩单',
      items: transcript.map(item => avatarItem(item.avatar || {}, { level: item.level })),
    })
  }
  const records = Array.isArray(data.records) ? data.records : []
  records.forEach((record, index) => {
    const main = record.main_avatar || {}
    const supports = Array.isArray(record.support_avatars) ? record.support_avatars : []
    const items = []
    if (main.icon_path || main.background_path || main.sec_part_icon) {
      items.push(avatarItem(main, { label: '出战' }))
    }
    for (const support of supports) {
      if (support.icon_path || support.background_path || support.sec_part_icon) {
        items.push(avatarItem(support, { label: '支援' }))
      }
    }
    if (record.elf?.avatar) {
      items.push(avatarItem({ name: record.elf.name || '人偶', avatar: record.elf.avatar, star: record.elf.star }, { label: '人偶' }))
    }
    const difficulty = GODWAR_LEVEL[record.punish_level] || `难度${record.punish_level ?? '?'}`
    if (items.length > 0) {
      avatarGroups.push({
        title: `第${index + 1}次挑战 · ${difficulty} · ${record.score ?? 0}分`,
        items,
      })
    }
  })
  const text = records.length > 0 ? `共 ${records.length} 次挑战记录` : '暂无挑战记录'
  return { text, stats, avatarGroups }
}

function buildHelp() {
  return [
    '=== 崩坏3 查询插件 ===',
    '',
    '【战绩查询】（主人配置一次公共 Cookie，群友只凭 UID 即可查询）',
    '#崩坏3cookie <完整Cookie>　　主人配置公共 Cookie',
    '#崩坏3cookie <UID> <Cookie>　为指定 UID 配置专用 Cookie',
    '#崩坏3绑定 <UID> / #崩坏3切换 <UID>　绑定或切换查询 UID',
    '#崩坏3当前　　　　　　　　　查看当前 UID',
    '#崩坏3解绑　　　　　　　　　解除绑定',
    '',
    '#崩坏3面板　　总览（等级/收藏/深渊/战场）',
    '#崩坏3便笺　　体力/训练值/活动奖励',
    '#崩坏3角色 [角色名]　　　　角色头像列表 / 单个角色面板',
    '#崩坏3深渊　　超弦空间战绩',
    '#崩坏3战场　　记忆战场战绩',
    '#崩坏3逐光　　往世乐土战绩',
    '（以上命令默认查询绑定的 UID，也可临时加 UID：如 #崩坏3面板 100000001）',
    '',
    '【角色数据】（内置 110 名女武神数据库，支持别名）',
    '#崩坏3角色图 <名字/别名>　　角色立绘 + 背景图 + 角色档案',
    '#崩坏3角色 <UID> <角色名>　角色面板（大头像/装备/六维，仿喵喵风格）',
    '#崩坏3伤害 <角色> [攻击]　 伤害估算（攻击省略时自动用图鉴基础攻击）',
    '  例：#崩坏3伤害 炎律 300 20 100 200',
    '',
    '【图鉴查询】（公开数据，无需 Cookie）',
    '#崩坏3图鉴 <关键词>　　　　搜索图鉴',
    '#崩坏3角色图鉴 <名字>　　　角色图鉴',
    '#崩坏3武器图鉴 <名字>　　　武器图鉴',
    '#崩坏3圣痕图鉴 <名字>　　　圣痕图鉴',
    '#崩坏3图鉴详情 <编号>　　　查看指定条目',
    '',
    '提示：以上命令前缀也可使用「崩三」或「bbb」。',
  ].join('\n')
}

function isMaster(e = {}) {
  return e?.isMaster === true
}

export class Bh3Plugin extends plugin {
  constructor() {
    super({
      name: 'bh3-plugin',
      dsc: '崩坏3全功能查询',
      event: 'message',
      priority: -2000,
      rule: [
        { reg: `^${PREFIX}(帮助|菜单|使用)$`, fnc: 'help' },
        { reg: `^${PREFIX}帮助文本$`, fnc: 'helpText' },
        { reg: `^${PREFIX}绑定\\s*$`, fnc: 'help' },
        { reg: `^${PREFIX}绑定\\s+(\\d{5,12})$`, fnc: 'bindUid' },
        { reg: `^${PREFIX}(切换|切换uid|切换UID)\\s+(\\d{5,12})$`, fnc: 'switchUid' },
        { reg: `^${PREFIX}(当前|当前uid|当前UID|我的uid|查看uid)\\s*$`, fnc: 'showCurrentUid' },
        { reg: `^${PREFIX}解绑\\s*$`, fnc: 'unbindUid' },
        { reg: `^${PREFIX}cookie(\\s+(\\d{5,12}))?(\\s+[\\s\\S]+)?$`, fnc: 'setCookie' },
        { reg: `^${PREFIX}(伤害|伤害计算)\\s+([\\s\\S]+)$`, fnc: 'damageCommand' },
        { reg: `^${PREFIX}(角色图|立绘|背景图|图鉴卡)\\s+([\\s\\S]+)$`, fnc: 'characterArtCommand' },
        { reg: `^${PREFIX}角色列表(?:\\s+(\\d{5,12}))?$`, fnc: 'showCharacters' },
        { reg: `^${PREFIX}图鉴详情\\s+(\\d+)\\s*$`, fnc: 'wikiDetailCommand' },
        { reg: `^${PREFIX}(角色图鉴|武器图鉴|圣痕图鉴|人偶图鉴|协同者图鉴)\\s+([\\s\\S]+)$`, fnc: 'wikiSearchByType' },
        { reg: `^${PREFIX}(图鉴|查询|wiki)\\s+([\\s\\S]+)$`, fnc: 'wikiSearchCommand' },
        { reg: `^${PREFIX}(面板|总览|我的|主页)(\\s+(\\d{5,12}))?$`, fnc: 'showIndex' },
        { reg: `^${PREFIX}(便笺|体力)(\\s+(\\d{5,12}))?$`, fnc: 'showNote' },
        { reg: `^${PREFIX}角色(\\s+(\\d{5,12}))?(\\s+([\\s\\S]+))?$`, fnc: 'showCharacters' },
        { reg: `^${PREFIX}(深渊|超弦)(\\s+(\\d{5,12}))?$`, fnc: 'showAbyss' },
        { reg: `^${PREFIX}(战场|记忆战场)(\\s+(\\d{5,12}))?$`, fnc: 'showBattleField' },
        { reg: `^${PREFIX}(逐光)(\\s+(\\d{5,12}))?$`, fnc: 'showGodWar' },
      ],
    })
  }

  async help(e) {
    const imagePath = await renderHelpImage()
    if (imagePath && globalThis.segment?.image) {
      return e.reply(globalThis.segment.image(imagePath))
    }
    return e.reply(buildHelp())
  }

  async helpText(e) {
    return e.reply(buildHelp())
  }

  async replyWithCard(e, options = {}) {
    const imagePath = await renderCardImage(options)
    const seg = globalThis.segment
    const messages = []
    if (imagePath && seg?.image) {
      messages.push(seg.image(imagePath))
    }
    const links = (Array.isArray(options.links) ? options.links : []).filter(Boolean)
    if (links.length > 0) {
      messages.push(`链接：\n${links.join('\n')}`)
    }
    if (messages.length > 0) {
      return e.reply(messages)
    }
    return e.reply(options.text || '查询结果为空。')
  }

  async bindUid(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}绑定\\s+(\\d{5,12})$`))
    const uid = match?.[2] || match?.[1] || ''
    if (!uid) {
      return e.reply('请使用：#崩坏3绑定 <游戏UID>')
    }
    setBindUid(e.user_id, uid)
    return e.reply(`已绑定崩坏3 UID：${uid}（可通过 #崩坏3面板 查询）`)
  }

  async unbindUid(e) {
    removeBindUid(e.user_id)
    return e.reply('已解除崩坏3 UID 绑定。')
  }

  async switchUid(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(切换|切换uid|切换UID)\\s+(\\d{5,12})$`))
    const uid = match?.[3] || ''
    if (!uid) {
      return e.reply('用法：#崩坏3切换 <UID>')
    }
    setBindUid(e.user_id, uid)
    return e.reply(`已将当前查询 UID 切换为：${uid}（发送 #崩坏3当前 可查看）`)
  }

  async showCurrentUid(e) {
    const uid = getBindUid(e.user_id)
    if (!uid) {
      return e.reply('尚未绑定 UID。发送 #崩坏3绑定 <UID> 或 #崩坏3切换 <UID> 绑定。')
    }
    return e.reply(`当前绑定的崩坏3 UID：${uid}（发送 #崩坏3切换 <新UID> 可切换）`)
  }

  async setCookie(e) {
    if (!isMaster(e)) {
      return e.reply('仅 Bot 主人可以配置 Cookie。')
    }
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}cookie(\\s+(\\d{5,12}))?(\\s+[\\s\\S]+)?$`))
    const uid = match?.[3] || ''
    const cookie = String(match?.[4] || '').trim()
    if (!cookie) {
      return e.reply('用法：#崩坏3cookie [UID] <米游社完整Cookie>')
    }
    try {
      const roles = await getUserGameRoles(cookie)
      if (roles.length === 0) {
        return e.reply('Cookie 有效，但未找到崩坏3 角色，请确认账号已开通崩坏3 战绩。')
      }
      const names = roles.map(role => `${role.nickname}(${role.game_uid})`).join('、')
      setCookie(uid, cookie)
      return e.reply(`Cookie 已保存${uid ? `（UID ${uid}）` : '（默认）'}，检测到角色：${names}`)
    } catch (error) {
      return e.reply(`Cookie 校验失败：${error.message}`)
    }
  }

  async withUid(e, action, explicitUid = '') {
    const uid = explicitUid || getBindUid(e.user_id)
    if (!uid) {
      return e.reply('请提供 UID 或先使用 #崩坏3绑定 <UID> 绑定你的游戏 UID。')
    }
    const cookie = getCookie(uid) || getCookie('') || await getExternalCk(uid)
    if (!cookie) {
      return e.reply(`无法查询 UID ${uid}：崩坏3战绩接口仅支持查询账号本人的号。\n请先用逍遥插件登录该 UID 对应的米游社账号（#扫码登录 / #绑定），或让主人执行 #崩坏3cookie ${uid} <完整Cookie> 为该 UID 配置。`)
    }
    try {
      return await action(uid, cookie)
    } catch (error) {
      return e.reply(`查询失败：${error.message}`)
    }
  }

  async showIndex(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(面板|总览|我的|主页)(\\s+(\\d{5,12}))?$`))
    return this.withUid(e, async (uid, cookie) => {
      const data = await recordRequest('/index', uid, {}, cookie)
      return this.replyWithCard(e, {
        title: '崩坏3 面板',
        subtitle: `UID ${uid}`,
        text: formatIndex(data),
        stats: buildIndexStats(data),
        portrait: data.role?.AvatarUrl || '',
      })
    }, match?.[4] || '')
  }

  async showNote(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(便笺|体力)(\\s+(\\d{5,12}))?$`))
    return this.withUid(e, async (uid, cookie) => {
      const data = await recordRequest('/note', uid, {}, cookie)
      return this.replyWithCard(e, {
        title: '崩坏3 实时便笺',
        subtitle: `UID ${uid}`,
        text: formatNote(data),
      })
    }, match?.[4] || '')
  }

  async showCharacters(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}角色(?:列表)?(\\s+(\\d{5,12}))?(\\s+([\\s\\S]+))?$`))
    const uid = match?.[3] || ''
    const keyword = String(match?.[5] || '').trim()
    if (!uid && !keyword) {
      const list = getAllCharacters()
      const lines = [`=== 崩坏3 女武神数据库（${list.length}） ===`]
      lines.push(list.map(character => character.name).join('、'))
      return this.replyWithCard(e, {
        title: '崩坏3 女武神数据库',
        subtitle: `共 ${list.length} 名角色`,
        text: lines.join('\n'),
      })
    }
    if (!uid && keyword) {
      const archive = this.characterArchiveReply(keyword)
      if (typeof archive === 'string') {
        return e.reply(archive)
      }
      return e.reply(archive)
    }
    return this.withUid(e, async (uidValue, cookie) => {
      const data = await recordRequest('/characters', uidValue, {}, cookie)
      if (keyword) {
        const panel = this.formatSingleCharacter(data, keyword, uidValue)
        return this.replyWithCard(e, {
          title: '崩坏3 角色面板',
          subtitle: `UID ${uidValue}`,
          text: panel.text,
          portrait: panel.portrait,
          links: panel.links,
          characterPanel: panel.characterPanel,
        })
      }
      const card = buildCharactersCard(data)
      return this.replyWithCard(e, {
        title: '崩坏3 角色',
        subtitle: `UID ${uidValue}`,
        text: card.text,
        avatarGroups: card.avatarGroups,
      })
    }, uid)
  }

  async showAbyss(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(深渊|超弦)(\\s+(\\d{5,12}))?$`))
    return this.withUid(e, async (uidValue, cookie) => {
      const cards = []
      for (const [endpoint, label] of [
        ['/newAbyssReport', '超弦空间'],
        ['/latestOldAbyssReport', '量子奇点'],
      ]) {
        try {
          const report = await recordRequest(endpoint, uidValue, {}, cookie)
          cards.push(buildAbyssCard(report, label))
        } catch {
          // 该模式对该等级账号不可用时跳过
        }
      }
      const text = cards.map(card => card.text).filter(Boolean).join('\n')
      const avatarGroups = cards.flatMap(card => card.avatarGroups)
      return this.replyWithCard(e, {
        title: '崩坏3 深渊',
        subtitle: `UID ${uidValue}`,
        text: text || '暂无深渊数据。',
        avatarGroups: avatarGroups,
      })
    }, match?.[4] || '')
  }

  async showBattleField(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(战场|记忆战场)(\\s+(\\d{5,12}))?$`))
    return this.withUid(e, async (uid, cookie) => {
      const data = await recordRequest('/battleFieldReport', uid, {}, cookie)
      const card = buildBattleFieldCard(data)
      return this.replyWithCard(e, {
        title: '崩坏3 记忆战场',
        subtitle: `UID ${uid}`,
        text: card.text,
        avatarGroups: card.avatarGroups,
      })
    }, match?.[4] || '')
  }

  async showGodWar(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(逐光)(\\s+(\\d{5,12}))?$`))
    return this.withUid(e, async (uid, cookie) => {
      const data = await recordRequest('/godWar', uid, {}, cookie)
      const card = buildGodWarCard(data)
      return this.replyWithCard(e, {
        title: '崩坏3 逐光',
        subtitle: `UID ${uid}`,
        text: card.text,
        stats: card.stats,
        avatarGroups: card.avatarGroups,
      })
    }, match?.[4] || '')
  }

  async damageCommand(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(伤害|伤害计算)\\s+([\\s\\S]+)$`))
    const rest = String(match?.[3] || '').trim()
    const tokens = rest.split(/\s+/).filter(Boolean)
    if (tokens.length < 1) {
      return e.reply('用法：#崩坏3伤害 <角色名> [攻击力] [技能倍率%] [增伤%] [暴击率%] [暴击伤害%] [防御]\n攻击力可省略，省略时自动使用角色图鉴基础攻击。\n示例：#崩坏3伤害 薪炎之律者 300 50 100 150')
    }
    const name = tokens[0]
    const numbers = tokens.slice(1).map(token => Number(String(token).replace(/%/g, '')))
    const character = findCharacter(name)
    if (!character) {
      const suggestions = searchCharacters(name).slice(0, 5)
      const hint = suggestions.length
        ? `，可输入：${suggestions.map(item => item.name).join('、')}`
        : ''
      return e.reply(`未找到角色「${name}」${hint}。`)
    }
    const attack = Number.isFinite(numbers[0]) ? numbers[0] : (character.baseAttack || 0)
    if (attack <= 0) {
      return e.reply(`角色「${character.name}」暂无数值数据，请手动提供攻击力：\n#崩坏3伤害 ${character.name} <攻击力> [倍率%]`)
    }
    const result = calculateDamage({
      attack,
      multiplier: numbers[1] ?? 100,
      bonus: numbers[2] ?? 0,
      critRate: numbers[3] ?? 100,
      critDamage: numbers[4] ?? 150,
      defense: numbers[5] ?? (character.element === '物理' ? 500 : 0),
      physical: character.element === '物理',
    })
    const lines = [
      `=== 伤害估算：${character.name} ===`,
      `元素：${character.element || '未知'} · 属性：${character.attribute || '未知'} · 武器：${character.weaponType || '未知'}`,
      '',
      Number.isFinite(numbers[0]) ? '' : `（攻击力未提供，自动使用图鉴基础攻击 ${result.attack}）`,
      `攻击力 ${result.attack} × 技能倍率 ${result.multiplier}%`,
      `增伤 ${result.bonus}% · 暴击率 ${result.critRate}% · 暴击伤害 ${result.critDamage}%`,
      result.physical
        ? `物理角色：防御减免 ${result.defenseReduction.toFixed(1)}%（按防御 ${result.defense} 估算）`
        : `元素角色：抗性减免 ${result.resistance}%`,
      '',
      `基础伤害：${Math.round(result.baseDamage)}`,
      `暴击伤害：${Math.round(result.critValue)}`,
      `期望伤害：${Math.round(result.expectedDamage)}`,
      '',
      '注：伤害为估算值，未计入队友加成、易伤、穿透与技能特性。',
    ]
    return this.replyWithCard(e, {
      title: '崩坏3 伤害计算',
      subtitle: character.name,
      text: lines.join('\n'),
      portrait: character.portrait || '',
      stats: [
        { label: '基础伤害', value: Math.round(result.baseDamage) },
        { label: '暴击伤害', value: Math.round(result.critValue) },
        { label: '期望伤害', value: Math.round(result.expectedDamage) },
      ],
    })
  }

  async characterArtCommand(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(角色图|立绘|背景图|图鉴卡)\\s+([\\s\\S]+)$`))
    const keyword = String(match?.[3] || '').trim()
    return e.reply(this.characterArchiveReply(keyword))
  }

  characterArchiveReply(keyword = '') {
    const character = findCharacter(keyword)
    if (!character) {
      const suggestions = searchCharacters(keyword).slice(0, 5)
      const hint = suggestions.length
        ? `，可输入：${suggestions.map(item => item.name).join('、')}`
        : ''
      return `未找到角色「${keyword}」${hint}。`
    }
    const seg = globalThis.segment
    const images = []
    const push = url => {
      if (url && /^https?:\/\//.test(String(url)) && seg?.image) {
        images.push(seg.image(String(url)))
      }
    }
    push(character.background)
    push(character.portrait)
    push(character.icon)
    const aliasText = character.aliases?.length ? `别名：${character.aliases.join('、')}` : ''
    const hexagon = character.hexagon && Object.keys(character.hexagon).length
      ? `\n六维：${Object.entries(character.hexagon).map(([key, value]) => `${key}${value}`).join(' / ')}`
      : ''
    const text = [
      `=== ${character.name} ===`,
      aliasText,
      `元素：${character.element || '未知'} · 属性：${character.attribute || '未知'}`,
      `武器：${character.weaponType || '未知'} · 初始阶级：${character.rarity || '未知'}`,
      `定位：${character.role || '未知'}`,
      hexagon,
    ].filter(Boolean).join('\n')
    if (images.length === 0) {
      return text
    }
    return [...images, text]
  }

  formatSingleCharacter(data = {}, keyword = '', uid = '') {
    const list = Array.isArray(data.characters) ? data.characters : []
    const matches = list.filter(item => {
      const name = String(item.character?.avatar?.name || '')
      const dbHit = findCharacter(keyword)
      return name === keyword || name.includes(keyword) || (dbHit && name === dbHit.name)
    })
    if (matches.length === 0) {
      return { text: `UID ${uid} 下未找到角色「${keyword}」。`, portrait: '', links: [], characterPanel: null }
    }
    const first = matches[0].character || {}
    const avatar = first.avatar || {}
    const weapon = first.weapon || {}
    const stigmatas = Array.isArray(first.stigmatas) ? first.stigmatas : []
    const elf = first.elf || {}
    const dbChar = findCharacter(avatar.name || keyword)
    const links = avatar.wiki_url ? [avatar.wiki_url] : []
    const hexagon = dbChar?.hexagon
      ? Object.entries(dbChar.hexagon).map(([key, value]) => ({ key, value }))
      : []
    return {
      text: matches.length > 1 ? `共找到 ${matches.length} 名匹配角色，显示首位。` : '',
      portrait: dbChar?.portrait || '',
      links: Array.from(new Set(links)),
      characterPanel: {
        avatar: avatar.figure_path || avatar.background_path || avatar.icon_path || '',
        name: avatar.name || '未知角色',
        level: avatar.level,
        star: avatar.star,
        attribute: dbChar?.attribute || ATTRIBUTE_MAP[Number(avatar.attribute_id)] || '',
        element: dbChar?.element || '',
        rarity: dbChar?.rarity || '',
        weaponType: dbChar?.weaponType || '',
        baseAttack: dbChar?.baseAttack || '',
        weapon: weapon?.name
          ? { name: weapon.name, img: weapon.icon || '', rarity: weapon.rarity ?? weapon.max_rarity }
          : null,
        stigmatas: stigmatas.map(item => ({
          name: item.name || '',
          img: item.icon || '',
          rarity: item.rarity,
        })),
        elf: elf?.name
          ? { name: elf.name, img: elf.avatar || '', rarity: elf.rarity }
          : null,
        hexagon,
      },
    }
  }

  async wikiSearchCommand(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(图鉴|查询|wiki)\\s+([\\s\\S]+)$`))
    return this.searchWiki(e, String(match?.[3] || '').trim(), '')
  }

  async wikiSearchByType(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}(角色图鉴|武器图鉴|圣痕图鉴|人偶图鉴|协同者图鉴)\\s+([\\s\\S]+)$`))
    const type = String(match?.[2] || '')
    const keyword = String(match?.[3] || '').trim()
    return this.searchWiki(e, keyword, type)
  }

  async wikiDetailCommand(e) {
    const match = String(e.msg || '').match(new RegExp(`^${PREFIX}图鉴详情\\s+(\\d+)\\s*$`))
    const id = match?.[2] || ''
    try {
      const detail = await wikiDetail(id)
      if (!detail?.id) {
        return e.reply('未找到该图鉴条目。')
      }
      const text = formatWikiDetail(detail)
      return this.replyWithCard(e, {
        title: '崩坏3 图鉴',
        subtitle: `条目 #${detail.id}`,
        text,
        portrait: detail.icon || '',
        links: detail.bbs_url ? [detail.bbs_url] : [],
      })
    } catch (error) {
      return e.reply(`图鉴查询失败：${error.message}`)
    }
  }

  async searchWiki(e, keyword = '', type = '') {
    if (!keyword) {
      return e.reply('请提供要查询的关键词，例如：#崩坏3图鉴 琪亚娜')
    }
    try {
      const dbHit = findCharacter(keyword)
      const searchKeyword = dbHit ? dbHit.name : keyword
      let results = await wikiSearch(searchKeyword)
      if (type) {
        const keywords = {
          角色图鉴: ['女武神', '角色'],
          武器图鉴: ['武器'],
          圣痕图鉴: ['圣痕'],
          人偶图鉴: ['人偶'],
          协同者图鉴: ['协同者'],
        }
        const filter = keywords[type] || []
        const matched = results.filter(item => filter.some(word => item.channel?.includes(word) || item.parent?.includes(word)))
        if (matched.length > 0) {
          results = matched
        }
      }
      if (results.length === 0) {
        return e.reply(`未找到与「${keyword}」相关的图鉴内容。`)
      }
      if (results.length === 1) {
        const detail = await wikiDetail(results[0].id)
        const text = formatWikiDetail(detail)
        return this.replyWithCard(e, {
          title: '崩坏3 图鉴',
          subtitle: `${results[0].parent}/${results[0].channel}`,
          text,
          portrait: detail.icon || '',
          links: detail.bbs_url ? [detail.bbs_url] : [],
        })
      }
      const lines = [`找到 ${results.length} 条与「${keyword}」相关的内容：`, '']
      for (const item of results.slice(0, 8)) {
        const channel = item.parent ? `${item.parent}/${item.channel}` : item.channel
        lines.push(`[${item.id}] ${item.title}${channel ? `（${channel}）` : ''}`)
      }
      lines.push('', '发送 #崩坏3图鉴详情 <编号> 查看详情。')
      return this.replyWithCard(e, {
        title: '崩坏3 图鉴搜索',
        subtitle: `关键词：${keyword}`,
        text: lines.join('\n'),
        links: results.slice(0, 8).map(item => item.bbs_url).filter(Boolean),
      })
    } catch (error) {
      return e.reply(`图鉴查询失败：${error.message}`)
    }
  }
}
