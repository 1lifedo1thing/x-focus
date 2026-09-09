import { defaultSpamKeywords } from '../storage-keys'
import type {
  RuleHit,
  SpamCategory,
  SpamEvaluation,
  SpamRuleId,
} from './spam-types'
import { SPAM_RULES } from './spam-types'

export interface RuleContext {
  text: string
  authorName: string
  authorHandle: string
  keywords: string[]
  enabledRules: Set<SpamRuleId>
}

function getRuleMeta(id: SpamRuleId) {
  return SPAM_RULES.find((r) => r.id === id)!
}

function countEmoji(text: string): number {
  // 常见 emoji 范围；注意 FE0F（变体选择器）和 U+200D（ZWJ）不是 emoji 本身
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu
  const matches = text.match(emojiRegex)
  return matches ? matches.length : 0
}

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, '').trim()
}

function checkMarketingNickname(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('marketing_nickname')
  const text = `${ctx.authorName} ${ctx.authorHandle}`.toLowerCase()
  // 使用统一词库同时匹配昵称
  const matched = ctx.keywords.find((kw) => kw && text.includes(kw.toLowerCase()))
  if (!matched) return null
  return { id: meta.id, label: `${meta.label}（"${matched}"）`, score: meta.defaultScore }
}

function checkEmojiRatio(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('emoji_ratio')
  const text = ctx.text
  if (!text) return null
  const emojiCount = countEmoji(text)
  if (emojiCount === 0) return null
  // 用代码点长度而非 UTF-16 长度，避免多字节 emoji 被算成 2
  const codePointLen = [...text].length
  if (codePointLen === 0) return null
  const ratio = emojiCount / codePointLen
  if (ratio < 0.5) return null
  return {
    id: meta.id,
    label: `${meta.label}（${Math.round(ratio * 100)}%）`,
    score: meta.defaultScore,
  }
}

function checkShortText(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('short_text')
  const stripped = ctx.text.trim()
  if (stripped.length >= 8) return null
  if (stripped.length === 0) return null
  return { id: meta.id, label: meta.label, score: meta.defaultScore }
}

function checkRandomUsername(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('random_username')
  const handle = ctx.authorHandle
  if (!handle) return null

  const h = handle.toLowerCase()
  if (!h.length) return null
  let suspicion = 0

  // 1. 大段连续数字（5位以上）：末尾随机数字段是 bot 常见特征
  const digitClusters = h.match(/\d+/g)
  const maxDigitLen = digitClusters ? Math.max(...digitClusters.map((d) => d.length)) : 0
  if (maxDigitLen >= 5) suspicion += 40
  else if (maxDigitLen === 4) suspicion += 15

  // 2. 连续辅音堆积（5+ 非元音非数字字符）：随机乱码典型特征（如 "zxcvbnm"）
  if (/[^aeiou\d]{5,}/.test(h)) suspicion += 50

  // 3. 数字占比超过 50%
  const digitRatio = (h.match(/\d/g)?.length || 0) / h.length
  if (digitRatio > 0.5) suspicion += 30

  // 4. 字母数字严格交替出现（算法生成特征，如 "a1b2c3d4e5"）
  if (/^(?:[a-z]\d){4,}$/.test(h) || /^(?:\d[a-z]){4,}$/.test(h)) suspicion += 60

  // 5. 字母部分完全无元音（如 "zxcvbnm123"）
  const lettersOnly = h.replace(/\d/g, '')
  if (lettersOnly.length >= 5 && !/[aeiou]/.test(lettersOnly)) suspicion += 30

  // 6. 超长 handle（12+ 字符）额外加权
  if (h.length > 12) suspicion += 10

  if (suspicion >= 60) {
    return { id: meta.id, label: meta.label, score: meta.defaultScore }
  }
  return null
}

function checkMarketingKeyword(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('marketing_keyword')
  if (!ctx.keywords.length) return null
  const text = ctx.text.toLowerCase()
  const matched = ctx.keywords.find((kw) => kw && text.includes(kw.toLowerCase()))
  if (!matched) return null
  return { id: meta.id, label: `${meta.label}（"${matched}"）`, score: meta.defaultScore }
}

function checkPureEmoji(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('pure_emoji')
  if (!ctx.text) return null
  // 去掉 emoji 后，还可能剩零宽字符（ZWNJ/ZWJ/WJ/BOM）和空白，一并去掉再判断
  const remaining = stripEmoji(ctx.text)
    .replace(/[\u200C\u200D\u2060\uFEFF]/g, '')
    .trim()
  if (remaining !== '') return null
  return { id: meta.id, label: meta.label, score: meta.defaultScore }
}

function checkDecoratedNickname(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('decorated_nickname')
  const name = ctx.authorName
  if (!name) return null
  const emojiCount = countEmoji(name)
  if (emojiCount < 2) return null
  return {
    id: meta.id,
    label: `${meta.label}（${emojiCount}个）`,
    score: meta.defaultScore,
  }
}

function checkRepeatedChars(ctx: RuleContext): RuleHit | null {
  const meta = getRuleMeta('repeated_chars')
  if (!ctx.text) return null

  // 1. 去掉 URL，避免网址中的重复字符（"https://", "ahhh", "//" 等）误判
  let text = ctx.text.replace(/https?:\/\/[^\s]+/g, ' ').trim()
  if (!text) return null

  // 2. 只检测非标点字符的连续重复 ≥4 次
  //    排除 ASCII 标点/符号/空白，这些重复是正常用法（!!!  ...  ---）
  //    汉字、字母、数字、emoji 的连续重复才是真正的 spam 信号
  const pattern = /([^\s.,!?\-:;_~#@*=|/\\])\1{3,}/u
  if (!pattern.test(text)) return null

  const match = text.match(pattern)!
  const preview = match[0].length > 5 ? match[0].slice(0, 5) + '…' : match[0]
  return {
    id: meta.id,
    label: `${meta.label}（"${preview}"）`,
    score: meta.defaultScore,
  }
}

const RULE_CHECKS: Record<SpamRuleId, (ctx: RuleContext) => RuleHit | null> = {
  marketing_nickname: checkMarketingNickname,
  emoji_ratio: checkEmojiRatio,
  short_text: checkShortText,
  random_username: checkRandomUsername,
  marketing_keyword: checkMarketingKeyword,
  pure_emoji: checkPureEmoji,
  decorated_nickname: checkDecoratedNickname,
  repeated_chars: checkRepeatedChars,
}

function inferCategory(hits: RuleHit[]): SpamCategory {
  if (hits.length === 0) return 'normal'
  // 命中规则的 category，按优先级排
  const order: SpamCategory[] = ['porn_spam', 'marketing', 'bot', 'low_quality']
  for (const cat of order) {
    if (hits.some((h) => getRuleMeta(h.id).category === cat)) {
      return cat
    }
  }
  return 'normal'
}

export function evaluateSpam(input: {
  text: string
  authorName: string
  authorHandle: string
  keywords?: string[]
  enabledRules?: Set<SpamRuleId> | null
}): SpamEvaluation {
  const enabledRules =
    input.enabledRules ?? new Set(SPAM_RULES.map((r) => r.id))
  const ctx: RuleContext = {
    text: input.text,
    authorName: input.authorName,
    authorHandle: input.authorHandle,
    keywords: input.keywords ?? defaultSpamKeywords,
    enabledRules,
  }

  const hits: RuleHit[] = []
  for (const rule of SPAM_RULES) {
    if (!enabledRules.has(rule.id)) continue
    const hit = RULE_CHECKS[rule.id](ctx)
    if (hit) hits.push(hit)
  }

  const score = hits.reduce((acc, h) => acc + h.score, 0)
  return {
    score,
    hits,
    category: inferCategory(hits),
    text: input.text,
    authorHandle: input.authorHandle,
  }
}

export function parseKeywordList(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseHandleList(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\n,，\s]+/)
    .map((s) => s.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean)
}

export function parseEnabledRules(
  raw: string | undefined | null,
): Set<SpamRuleId> {
  const all = new Set<SpamRuleId>(SPAM_RULES.map((r) => r.id))
  if (!raw) return all
  const map = new Map<string, string>()
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [id, val] = entry.split(':')
      if (id) map.set(id.trim(), (val || 'on').trim())
    })
  return new Set(
    SPAM_RULES.filter((r) => map.get(r.id) !== 'off').map((r) => r.id),
  )
}

export function serializeEnabledRules(set: Set<SpamRuleId>): string {
  return SPAM_RULES.map((r) => `${r.id}:${set.has(r.id) ? 'on' : 'off'}`).join(
    ',',
  )
}
