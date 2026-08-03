// 崩坏3 伤害估算（简化公式，供参考）
//
// 元素伤害 = 攻击力 × 技能倍率 × (1 + 增伤) × (1 + 易伤) × (1 - 抗性) × 暴击期望
// 物理伤害 额外乘 (1 - 防御减免)，减免 = 防御 / (防御 + 2000)
// 暴击期望 = 1 + 暴击率 × 暴击伤害

function toPercent(value = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export function calculateDamage(options = {}) {
  const attack = Math.max(0, toPercent(options.attack))
  const multiplier = Math.max(0, toPercent(options.multiplier ?? 100)) / 100
  const bonus = Math.max(0, toPercent(options.bonus ?? 0)) / 100
  const vulnerable = Math.max(0, toPercent(options.vulnerable ?? 0)) / 100
  const resistance = Math.min(1, Math.max(0, toPercent(options.resistance ?? 0)) / 100)
  const critRate = Math.min(1, Math.max(0, toPercent(options.critRate ?? 100)) / 100)
  const critDamage = Math.max(0, toPercent(options.critDamage ?? 150)) / 100
  const defense = Math.max(0, toPercent(options.defense ?? 0))
  const physical = options.physical === true

  let baseDamage = attack * multiplier * (1 + bonus) * (1 + vulnerable) * (1 - resistance)
  const defenseReduction = physical && defense > 0 ? defense / (defense + 2000) : 0
  if (defenseReduction > 0) {
    baseDamage *= 1 - defenseReduction
  }

  const critExpectation = 1 + critRate * critDamage
  const expectedDamage = baseDamage * critExpectation
  const critValue = baseDamage * (1 + critDamage)

  return {
    attack,
    multiplier: multiplier * 100,
    bonus: bonus * 100,
    vulnerable: vulnerable * 100,
    resistance: resistance * 100,
    critRate: critRate * 100,
    critDamage: critDamage * 100,
    defense,
    physical,
    defenseReduction: defenseReduction * 100,
    baseDamage,
    critValue,
    expectedDamage,
  }
}
