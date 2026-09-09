import { describe, expect, it } from 'vitest'
import { buildDebugBar } from '../../content-scripts/spam/scanner'
import { installScrollStabilityStyles, removeScrollStabilityStyles } from '../../content-scripts/spam/debug-bar'
import { SCROLL_STABILITY_STYLE_ID } from '../../content-scripts/spam/dom-attrs'
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

describe('buildDebugBar', () => {
  it('renders as a positioned overlay so it does not change timeline height', () => {
    const bar = buildDebugBar(makeEvaluation(), 60)

    expect(bar.style.position).toBe('absolute')
    expect(bar.style.left).toBe('4px')
    expect(bar.style.right).toBe('4px')
    expect(bar.style.bottom).toBe('4px')
    expect(bar.style.margin).toBe('0px')
    expect(bar.style.pointerEvents).toBe('none')
    expect(bar.style.overflowAnchor).toBe('none')
    expect(bar.getAttribute('data-xf-debug-version')).toBe('2')
  })

  it('keeps the score key tied to threshold classification', () => {
    const bar = buildDebugBar(makeEvaluation({ score: 50, hits: [] }), 60)

    expect(bar.getAttribute('data-xf-score-key')).toBe('50|false|')
    expect(bar.textContent).toContain('✅ 通过')
  })

  it('treats a score equal to the threshold as hidden', () => {
    const bar = buildDebugBar(makeEvaluation({ score: 55, hits: [] }), 55)

    expect(bar.getAttribute('data-xf-score-key')).toBe('55|true|')
    expect(bar.textContent).toContain('🚫 会被隐藏')
  })

  it('disables scroll anchoring on the page scroll container to prevent scroll reversal', () => {
    removeScrollStabilityStyles()
    installScrollStabilityStyles()

    const css = document.getElementById(SCROLL_STABILITY_STYLE_ID)?.textContent

    // The page scroll container (<html> = the viewport) must have anchoring
    // disabled. Otherwise hiding articles above the viewport makes the browser
    // pull scrollTop backwards — opposite to the user's scroll direction.
    expect(css).toContain('html')
    expect(css).toContain('overflow-anchor: none')
    // ALL of the extension's own injected nodes must never become scroll anchors
    // (badges, keyword buttons, list dropdowns, debug bars, replacements…).
    expect(css).toContain('[data-xf-spam-hidden-replacement]')
    expect(css).toContain('[data-xf-spam-debug]')
    expect(css).toContain('[data-xf-kw-btn]')
    expect(css).toContain('[data-xf-list-dropdown]')
    expect(css).toContain('[data-xf-list-btn]')
    expect(css).toContain('[data-xf-kw-panel]')
  })
})
