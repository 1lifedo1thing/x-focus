import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { applyReplace } from '../../content-scripts/spam/scanner'

const STATE_ATTR = 'data-xf-spam-state'
const REPLACEMENT_ATTR = 'data-xf-spam-hidden-replacement'

function makeArticleWithParent(): {
  doc: Document
  article: HTMLElement
  parent: HTMLElement
} {
  const dom = new JSDOM(
    '<div id="timeline"><article data-testid="tweet">原始评论</article></div>',
  )
  const doc = dom.window.document
  const article = doc.querySelector<HTMLElement>('article[data-testid="tweet"]')!
  const parent = doc.getElementById('timeline')!
  return { doc, article, parent }
}

function makePlaceholder(doc: Document): HTMLElement {
  const el = doc.createElement('div')
  el.className = 'x-focus-spam-placeholder'
  el.textContent = 'spam placeholder'
  return el
}

describe('applyReplace', () => {
  it('hides article and inserts replacement sibling before it', () => {
    const { doc, article, parent } = makeArticleWithParent()
    applyReplace(article, makePlaceholder(doc))

    expect(article.style.display).toBe('none')
    expect(article.getAttribute(STATE_ATTR)).toBe('hidden')

    const replacement = parent.querySelector<HTMLElement>(
      `[${REPLACEMENT_ATTR}]`,
    )
    expect(replacement).not.toBeNull()
    expect(replacement!.previousElementSibling).toBeNull() // 第一个 child
    expect(replacement!.nextElementSibling).toBe(article)
    expect(replacement!.querySelector('.x-focus-spam-placeholder')).not.toBeNull()
  })

  it('removes stale replacements before inserting new one (idempotent)', () => {
    const { doc, article, parent } = makeArticleWithParent()
    applyReplace(article, makePlaceholder(doc))
    applyReplace(article, makePlaceholder(doc))

    const replacements = parent.querySelectorAll<HTMLElement>(
      `[${REPLACEMENT_ATTR}]`,
    )
    expect(replacements.length).toBe(1)
  })
})
