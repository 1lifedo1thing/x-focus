import { describe, it, expect } from 'vitest'
import { evaluateSpam, parseEnabledRules } from '../../shared/spam-rules'
import { defaultSpamKeywords } from '../../storage-keys'

const allRules = parseEnabledRules('')

const cases = [
  { name: 'jump10_luv', author: '🌸软甜舰舰🌸', handle: 'jump10_luv', text: '🌸🍒🌺😘😋😇🥰😘😍🍒🥰🤤😘🥰😍🍆🍑🍌😋🤤😜😂😳😳😳' },
  { name: 'jean_bever97184', author: '若安🌸寻固炮🌸点击主页', handle: 'jean_bever97184', text: '☝️🎂🙏😇🌷🤤💋😍🥰❤️💕🤤💕😂😘' },
  { name: 'SassoonVer19250', author: '欣璇🌸寻固炮🌸点击主页', handle: 'SassoonVer19250', text: '👇😜😍🥰🤤😘😍🤤😍😘🤤🤤😘😜😎😂' },
  // 来自推文 https://x.com/xupaopaogm/status/2097631096779542689 评论区
  { name: 'yzjddb (矩阵引流+变体营销词)', author: 'a.x', handle: 'yzjddb', text: '比她好看的没她骚 比她骚的没她好看 @yzjddb 0I' },
  { name: 'AliIsld (矩阵引流+变体营销词)', author: 'b.y', handle: 'AliIsld', text: '比她好看的没她骚 比她骚的没她好看 @AliIsld 0c' },
  { name: 'Tuya1su (Emoji混淆+引流)', author: 'Tuya', handle: 'Tuya1su', text: '应该👆没人比她骚了吧 @Tuya1su 🫣😡' },
  { name: 'Mw41416 (多词命中+矩阵引流)', author: 'm.w', handle: 'Mw41416', text: '微密圈反差就她玩得开 @Mw41416 0g' },
  { name: '030999_s_ry (英文字母噪音混淆+矩阵引流)', author: 'e.b', handle: '030999_s', text: 'X ry就比她骚 @030999_s 0J' },
  { name: '030999_s_bg (英文字母噪音混淆+矩阵引流)', author: 'f.h', handle: '030999_s', text: 'X bg就比她骚 @030999_s 0E' },
  { name: '030999_s_qb (英文字母噪音混淆+矩阵引流)', author: 't.h', handle: '030999_s', text: 'X qb就比她骚 @030999_s 0d' },
]

describe('real spam from screenshot', () => {
  for (const c of cases) {
    it(`${c.name} should score >= 55 (blocked as spam)`, () => {
      const r = evaluateSpam({
        text: c.text,
        authorName: c.author,
        authorHandle: c.handle,
        keywords: defaultSpamKeywords,
        enabledRules: allRules,
      })
      console.log(`${c.name}: score=${r.score} hits=${r.hits.map((h) => `${h.id}(${h.score})`).join(' ')}`)
      expect(r.score).toBeGreaterThanOrEqual(55)
    })
  }

  it('user custom keyword scenario (比她好看的没她骚 + 比她骚的没她好看) scores >= 55', () => {
    // 模拟用户在词库中单独添加这两个复合短语的情况
    const customKeywords = ['比她好看的没她骚', '比她骚的没她好看']
    const r = evaluateSpam({
      text: '比她好看的没她骚 比她骚的没她好看 @yzjddb 0I',
      authorName: 'a.x',
      authorHandle: 'yzjddb',
      keywords: customKeywords,
      enabledRules: allRules,
    })
    console.log(`user custom scenario: score=${r.score} hits=${r.hits.map((h) => `${h.id}(${h.score})`).join(' ')}`)
    expect(r.score).toBeGreaterThanOrEqual(55)
    expect(r.hits.some((h) => h.id === 'marketing_keyword')).toBe(true)
    const kwHit = r.hits.find((h) => h.id === 'marketing_keyword')
    // 命中 2 个关键词，分值为 35 + 15 = 50
    expect(kwHit?.score).toBe(50)
  })
})
