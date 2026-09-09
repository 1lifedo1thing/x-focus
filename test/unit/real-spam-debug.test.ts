import { describe, it, expect } from 'vitest'
import { evaluateSpam, parseEnabledRules } from '../../shared/spam-rules'
import { defaultSpamKeywords } from '../../storage-keys'

const allRules = parseEnabledRules('marketing_nickname:on,emoji_ratio:on,short_text:on,random_username:on,marketing_keyword:on,pure_emoji:on,decorated_nickname:on,repeated_chars:on')

const cases = [
  { name: 'jump10_luv', author: '🌸软甜舰舰🌸', handle: 'jump10_luv', text: '🌸🍒🌺😘😋😇🥰😘😍🍒🥰🤤😘🥰😍🍆🍑🍌😋🤤😜😂😳😳😳' },
  { name: 'jean_bever97184', author: '若安🌸寻固炮🌸点击主页', handle: 'jean_bever97184', text: '☝️🎂🙏😇🌷🤤💋😍🥰❤️💕🤤💕😂😘' },
  { name: 'SassoonVer19250', author: '欣璇🌸寻固炮🌸点击主页', handle: 'SassoonVer19250', text: '👇😜😍🥰🤤😘😍🤤😍😘🤤🤤😘😜😎😂' },
]

describe('real spam from screenshot', () => {
  for (const c of cases) {
    it(`${c.name} should score >= 60`, () => {
      const r = evaluateSpam({
        text: c.text,
        authorName: c.author,
        authorHandle: c.handle,
        keywords: defaultSpamKeywords,
        enabledRules: allRules,
      })
      console.log(`${c.name}: score=${r.score} hits=${r.hits.map((h) => `${h.id}(${h.score})`).join(' ')}`)
      expect(r.score).toBeGreaterThanOrEqual(60)
    })
  }
})
