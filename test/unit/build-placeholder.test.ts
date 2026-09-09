import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { buildPlaceholder } from '../../content-scripts/spam/scanner'
import type { SpamEvaluation } from '../../shared/spam-types'

function makeEvaluation(overrides?: Partial<SpamEvaluation>): SpamEvaluation {
  return {
    score: 80,
    hits: [
      { id: 'pure_emoji', label: '纯 Emoji 评论', score: 40 },
      { id: 'short_text', label: '评论过短', score: 10 },
    ],
    category: 'low_quality',
    text: '🌻😂🌹',
    authorHandle: 'spam_bot',
    ...overrides,
  }
}

describe('buildPlaceholder', () => {
  it('does NOT render action buttons (recovery / whitelist / blacklist / false-positive)', () => {
    const dom = new JSDOM('')
    const placeholder = buildPlaceholder(makeEvaluation())

    expect(placeholder.querySelectorAll('button').length).toBe(0)
    expect(placeholder.textContent).not.toContain('恢复')
    expect(placeholder.textContent).not.toContain('加入白名单')
    expect(placeholder.textContent).not.toContain('拉黑作者')
    expect(placeholder.textContent).not.toContain('误判')
  })

  it('renders 🚫 icon and \"已隐藏\" label', () => {
    const placeholder = buildPlaceholder(makeEvaluation())
    expect(placeholder.textContent).toContain('🚫')
    expect(placeholder.textContent).toContain('已隐藏')
  })

  it('includes score and category in the placeholder', () => {
    const placeholder = buildPlaceholder(
      makeEvaluation({ score: 120, category: 'porn_spam' }),
    )
    expect(placeholder.textContent).toContain('120')
    expect(placeholder.textContent).toContain('porn_spam')
  })

  it('renders each hit label when hits are present', () => {
    const placeholder = buildPlaceholder(makeEvaluation())
    expect(placeholder.textContent).toContain('纯 Emoji 评论')
    expect(placeholder.textContent).toContain('评论过短')
  })

  it('omits hit details when hits is empty', () => {
    const placeholder = buildPlaceholder(makeEvaluation({ hits: [] }))
    const childDivs = placeholder.querySelectorAll(':scope > div')
    expect(childDivs.length).toBe(1) // 只有 line，没有 hits div
  })
})
