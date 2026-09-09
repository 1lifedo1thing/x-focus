import { describe, it, expect } from 'vitest'
import { evaluateSpam, parseKeywordList, parseEnabledRules, serializeEnabledRules } from '../../shared/spam-rules'
import { SPAM_RULES } from '../../shared/spam-types'

describe('evaluateSpam - marketing_nickname', () => {
  it('hits when nickname contains 寻固炮', () => {
    const r = evaluateSpam({
      text: '正常评论',
      authorName: '梦琪🌸寻固炮🌸',
      authorHandle: 'user1',
    })
    expect(r.hits.some((h) => h.id === 'marketing_nickname')).toBe(true)
  })

  it('hits on handle containing marketing term', () => {
    const r = evaluateSpam({
      text: '正常评论',
      authorName: 'Alice',
      authorHandle: 'Alice同城',
    })
    expect(r.hits.some((h) => h.id === 'marketing_nickname')).toBe(true)
  })

  it('does not hit on clean nickname', () => {
    const r = evaluateSpam({
      text: '正常评论',
      authorName: 'Alice',
      authorHandle: 'alice',
    })
    expect(r.hits.some((h) => h.id === 'marketing_nickname')).toBe(false)
  })

  it('is case-insensitive (toLowerCase on both sides)', () => {
    // nicknameKeywords 默认是中文，但实现走 toLowerCase —— 验证全英文能命中
    // 这里用临时 keyword 列表来验证 case-insensitive 行为
    const r = evaluateSpam({
      text: '正常评论',
      authorName: 'CLICK HOME',
      authorHandle: 'bob',
      keywords: ['click home'],
    })
    expect(r.hits.some((h) => h.id === 'marketing_nickname')).toBe(true)
  })
})

describe('evaluateSpam - pure_emoji', () => {
  it('hits when text is all emoji (rendered as <img>)', () => {
    const r = evaluateSpam({ text: '🌻😂🌹', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'pure_emoji')).toBe(true)
  })

  it('does not hit when emoji is mixed with text', () => {
    const r = evaluateSpam({
      text: '哈哈🌻好笑',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'pure_emoji')).toBe(false)
  })

  it('does not hit on empty text', () => {
    const r = evaluateSpam({ text: '', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'pure_emoji')).toBe(false)
  })
})

describe('evaluateSpam - emoji_ratio', () => {
  it('hits when emoji ratio > 50%', () => {
    const r = evaluateSpam({ text: '🌻🌻🌻', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'emoji_ratio')).toBe(true)
  })

  it('does not hit on normal text', () => {
    const r = evaluateSpam({
      text: '这是一段正常的评论，包含一些 emoji 😀 但大部分是文字',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'emoji_ratio')).toBe(false)
  })

  it('includes ratio percentage in label', () => {
    const r = evaluateSpam({ text: '🌻🌻', authorName: 'X', authorHandle: 'x' })
    const hit = r.hits.find((h) => h.id === 'emoji_ratio')
    expect(hit?.label).toMatch(/\d+/)
  })
})

describe('evaluateSpam - short_text', () => {
  it('hits on text shorter than 8 chars', () => {
    const r = evaluateSpam({ text: '你好', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'short_text')).toBe(true)
  })

  it('does not hit on text with 8+ chars', () => {
    const r = evaluateSpam({
      text: '这是一段正常评论',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'short_text')).toBe(false)
  })

  it('does not hit on empty text (returns early)', () => {
    const r = evaluateSpam({ text: '', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'short_text')).toBe(false)
  })
})

describe('evaluateSpam - random_username (多维评分)', () => {
  // ── 应放过的正常用户模式 ──

  it('does NOT hit on alex8888（短 handle + 4 位重复数字, suspicion=15）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'alex8888' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on alice1234（短 handle, suspicion=15）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'alice1234' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on Jenny83922（名字+5数字, suspicion=40 < 60）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'Jenny83922' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on GustaveMac91181（名字+5数字, suspicion=50 < 60）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'GustaveMac91181' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on LoveCoding123（正常单词+简单数字）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'LoveCoding123' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on RealName1990（名字+年份）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'RealName1990' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on alice（纯字母无数字）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'alice' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on abcdefxyz（纯字母无数字）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'abcdefxyz' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  it('does NOT hit on toolongusername12（仅 2 位数字）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'toolongusername12' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(false)
  })

  // ── 应命中的随机/ Bot 模式 ──

  it('HITS on zxcvbnm12345（纯辅音 + 5 数字, suspicion >= 120）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'zxcvbnm12345' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(true)
  })

  it('HITS on a1b2c3d4e5（交替字符, suspicion = 60）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'a1b2c3d4e5' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(true)
  })

  it('HITS on hjkpqrt982（纯辅音字母+数字后缀, suspicion >= 60）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: 'hjkpqrt982' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(true)
  })

  it('HITS on 5847392abc（数字 > 50% + 大段数字, suspicion >= 70）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: '5847392abc' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(true)
  })

  it('HITS on 83922jnnylng（大段数字 + 辅音堆积 + 无元音, suspicion >= 120）', () => {
    const r = evaluateSpam({ text: '评论', authorName: 'X', authorHandle: '83922jnnylng' })
    expect(r.hits.some((h) => h.id === 'random_username')).toBe(true)
  })
})

describe('evaluateSpam - decorated_nickname', () => {
  it('hits when nickname has 2+ emoji', () => {
    const r = evaluateSpam({
      text: '评论内容',
      authorName: '🌸 软甜舰舰 🌺',
      authorHandle: 'user1',
    })
    expect(r.hits.some((h) => h.id === 'decorated_nickname')).toBe(true)
  })

  it('does not hit when nickname has 0 emoji', () => {
    const r = evaluateSpam({
      text: '评论内容',
      authorName: '普通昵称',
      authorHandle: 'user2',
    })
    expect(r.hits.some((h) => h.id === 'decorated_nickname')).toBe(false)
  })

  it('does not hit when nickname has only 1 emoji', () => {
    const r = evaluateSpam({
      text: '评论内容',
      authorName: '😀笑脸',
      authorHandle: 'user3',
    })
    expect(r.hits.some((h) => h.id === 'decorated_nickname')).toBe(false)
  })

  it('does not hit on empty nickname', () => {
    const r = evaluateSpam({
      text: '评论内容',
      authorName: '',
      authorHandle: 'user4',
    })
    expect(r.hits.some((h) => h.id === 'decorated_nickname')).toBe(false)
  })

  it('includes emoji count in label', () => {
    const r = evaluateSpam({
      text: '评论',
      authorName: '🌸🌺🌻小甜心',
      authorHandle: 'user',
    })
    const hit = r.hits.find((h) => h.id === 'decorated_nickname')
    expect(hit?.label).toMatch(/3.*个/)
  })
})

describe('evaluateSpam - marketing_keyword', () => {
  it('hits on text containing default keyword', () => {
    const r = evaluateSpam({
      text: '点击主页看更多',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'marketing_keyword')).toBe(true)
  })

  it('respects custom keyword list', () => {
    const r = evaluateSpam({
      text: '骗子太多',
      authorName: 'X',
      authorHandle: 'x',
      keywords: ['骗子'],
    })
    expect(r.hits.some((h) => h.id === 'marketing_keyword')).toBe(true)
  })

  it('is case-insensitive', () => {
    const r = evaluateSpam({
      text: 'CLICK HOME',
      authorName: 'X',
      authorHandle: 'x',
      keywords: ['click home'],
    })
    expect(r.hits.some((h) => h.id === 'marketing_keyword')).toBe(true)
  })

  it('does not hit when keywords list is empty', () => {
    const r = evaluateSpam({
      text: '点击主页看更多',
      authorName: 'X',
      authorHandle: 'x',
      keywords: [],
    })
    expect(r.hits.some((h) => h.id === 'marketing_keyword')).toBe(false)
  })
})

describe('evaluateSpam - repeated_chars', () => {
  it('hits on 4+ same Chinese char in a row', () => {
    const r = evaluateSpam({ text: '哈哈哈哈啊', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'repeated_chars')).toBe(true)
  })

  it('does not hit on 3 same chars', () => {
    const r = evaluateSpam({ text: '哈哈哈啊', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'repeated_chars')).toBe(false)
  })

  it('does NOT hit on text with URL containing repeated chars', () => {
    const r = evaluateSpam({
      text: 'DeepSeek API 用量监控工具：Windows 桌面查看余额与 Token 消耗 👉https://ahhhfsf.com/81293/',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'repeated_chars')).toBe(false)
  })

  it('does NOT hit on ASCII punctuation repetition', () => {
    const r = evaluateSpam({
      text: 'This is amazing!!!!! What??? ......',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'repeated_chars')).toBe(false)
  })

  it('does NOT hit on URL with path segments', () => {
    const r = evaluateSpam({
      text: '查看详情 https://example.com/foo/bar/baz/',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'repeated_chars')).toBe(false)
  })

  it('hits on repeated letters even with URL present', () => {
    const r = evaluateSpam({
      text: 'aaaaaa 网站 https://example.com',
      authorName: 'X',
      authorHandle: 'x',
    })
    expect(r.hits.some((h) => h.id === 'repeated_chars')).toBe(true)
  })

  it('hits on repeated emoji', () => {
    const r = evaluateSpam({ text: '😂😂😂😂', authorName: 'X', authorHandle: 'x' })
    expect(r.hits.some((h) => h.id === 'repeated_chars')).toBe(true)
  })
})

describe('evaluateSpam - score aggregation', () => {
  it('sums scores from all hit rules', () => {
    const r = evaluateSpam({
      text: '🌻😂',
      authorName: '梦琪🌸寻固炮',
      authorHandle: 'Jenny83922',
    })
    const expected = r.hits.reduce((acc, h) => acc + h.score, 0)
    expect(r.score).toBe(expected)
  })

  it('returns 0 when no rules hit', () => {
    const r = evaluateSpam({
      text: '这是一段很正常的评论，长度也够',
      authorName: 'Alice',
      authorHandle: 'alice',
    })
    expect(r.score).toBe(0)
    expect(r.category).toBe('normal')
  })
})

describe('evaluateSpam - category priority', () => {
  it('porn_spam wins over marketing', () => {
    // 同时命中 marketing_nickname (porn_spam) + marketing_keyword (marketing)
    const r = evaluateSpam({
      text: '点击主页',
      authorName: '寻固炮',
      authorHandle: 'x',
    })
    expect(r.category).toBe('porn_spam')
  })

  it('marketing wins over bot', () => {
    // 同时命中 marketing_keyword (marketing) + random_username (bot)
    const r = evaluateSpam({
      text: '点击主页',
      authorName: 'Alice',
      authorHandle: 'Jenny83922',
    })
    expect(r.category).toBe('marketing')
  })
})

describe('evaluateSpam - enabledRules gating', () => {
  it('skips rules not in enabled set', () => {
    const r = evaluateSpam({
      text: '点击主页',
      authorName: 'X',
      authorHandle: 'x',
      enabledRules: new Set(),
    })
    expect(r.score).toBe(0)
    expect(r.hits).toHaveLength(0)
  })

  it('only runs enabled rules', () => {
    const r = evaluateSpam({
      text: '点击主页',
      authorName: 'X',
      authorHandle: 'x',
      enabledRules: new Set(['marketing_keyword']),
    })
    expect(r.hits.map((h) => h.id)).toEqual(['marketing_keyword'])
  })
})

describe('parseKeywordList', () => {
  it('parses newline separated', () => {
    expect(parseKeywordList('点击主页\n同城\n约会')).toEqual([
      '点击主页',
      '同城',
      '约会',
    ])
  })

  it('parses comma separated (full-width and half-width)', () => {
    expect(parseKeywordList('点击主页,同城，约会')).toEqual([
      '点击主页',
      '同城',
      '约会',
    ])
  })

  it('trims and filters empty', () => {
    expect(parseKeywordList('  a  \n\n  b  ')).toEqual(['a', 'b'])
  })

  it('returns empty for null/undefined', () => {
    expect(parseKeywordList(null)).toEqual([])
    expect(parseKeywordList(undefined)).toEqual([])
    expect(parseKeywordList('')).toEqual([])
  })
})

describe('parseEnabledRules / serializeEnabledRules', () => {
  it('round-trips a full set', () => {
    const all = new Set(SPAM_RULES.map((r) => r.id))
    const serialized = serializeEnabledRules(all)
    const parsed = parseEnabledRules(serialized)
    expect(parsed).toEqual(all)
  })

  it('respects off marker', () => {
    const all = new Set(SPAM_RULES.map((r) => r.id))
    const subset = new Set(all)
    subset.delete('pure_emoji')
    subset.delete('short_text')
    const serialized = serializeEnabledRules(subset)
    const parsed = parseEnabledRules(serialized)
    expect(parsed.has('pure_emoji')).toBe(false)
    expect(parsed.has('short_text')).toBe(false)
    expect(parsed.has('marketing_keyword')).toBe(true)
  })

  it('returns all on when raw is empty/null', () => {
    const all = new Set(SPAM_RULES.map((r) => r.id))
    expect(parseEnabledRules(null)).toEqual(all)
    expect(parseEnabledRules('')).toEqual(all)
  })
})
