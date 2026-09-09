import { describe, it, expect, beforeEach } from 'vitest'
import {
  cleanupOrphanReplacements,
  isOwnNode,
  isSelfMutation,
} from '../../content-scripts/spam/scanner'

const STATE_ATTR = 'data-xf-spam-state'
const REPLACEMENT_ATTR = 'data-xf-spam-hidden-replacement'

// ── 辅助：查询 replacement 元素数量 ──

function countReps(): number {
  return document.querySelectorAll(`[${REPLACEMENT_ATTR}]`).length
}

// ── 辅助：构建 MutationRecord 用于 isSelfMutation（不依赖全局 document）──

function createMutation(
  type: MutationRecordType,
  added: Node[],
  removed: Node[],
): MutationRecord {
  return {
    type,
    target: null as unknown as Node,
    addedNodes: added as unknown as NodeList,
    removedNodes: removed as unknown as NodeList,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  } as MutationRecord
}

// ═══════════════════════════════════════════════════
// cleanupOrphanReplacements
// ═══════════════════════════════════════════════════
//
// 注意：cleanupOrphanReplacements 使用全局 document.querySelectorAll，
// 所以测试必须在全局 document.body 上设置 DOM，并在 beforeEach 中重置。
// ═══════════════════════════════════════════════════

describe('cleanupOrphanReplacements', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps replacement when followed by a hidden article', () => {
    document.body.innerHTML = `
      <div ${REPLACEMENT_ATTR}="1">replacement</div>
      <article data-testid="tweet" ${STATE_ATTR}="hidden">hidden</article>
    `
    cleanupOrphanReplacements()
    expect(countReps()).toBe(1)
  })

  it('removes replacement when there is no next sibling (last child)', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">visible</article>
      <div ${REPLACEMENT_ATTR}="1">orphan at end</div>
    `
    cleanupOrphanReplacements()
    expect(countReps()).toBe(0)
  })

  it('removes replacement when next sibling is NOT an article', () => {
    document.body.innerHTML = `
      <div ${REPLACEMENT_ATTR}="1">replacement</div>
      <div>some other div (not an article)</div>
    `
    cleanupOrphanReplacements()
    expect(countReps()).toBe(0)
  })

  it('removes replacement when article is not hidden (visible)', () => {
    document.body.innerHTML = `
      <div ${REPLACEMENT_ATTR}="1">replacement</div>
      <article data-testid="tweet">visible article</article>
    `
    cleanupOrphanReplacements()
    expect(countReps()).toBe(0)
  })

  it('keeps only one replacement before a hidden article (dedup)', () => {
    document.body.innerHTML = `
      <div ${REPLACEMENT_ATTR}="1">old replacement</div>
      <div ${REPLACEMENT_ATTR}="1">new replacement</div>
      <article data-testid="tweet" ${STATE_ATTR}="hidden">hidden</article>
    `
    cleanupOrphanReplacements()
    expect(countReps()).toBe(1)
  })

  it('keeps the replacement immediately before the article, removes older ones', () => {
    document.body.innerHTML = `
      <div ${REPLACEMENT_ATTR}="1">should be removed</div>
      <div ${REPLACEMENT_ATTR}="1">should remain</div>
      <article data-testid="tweet" ${STATE_ATTR}="hidden">hidden</article>
    `
    cleanupOrphanReplacements()
    const reps = document.querySelectorAll(`[${REPLACEMENT_ATTR}]`)
    expect(reps.length).toBe(1)
    expect(reps[0]?.textContent).toBe('should remain')
  })

  it('no-op when there are no replacements at all', () => {
    document.body.innerHTML = `
      <article data-testid="tweet">normal</article>
      <article data-testid="tweet">normal 2</article>
    `
    expect(() => cleanupOrphanReplacements()).not.toThrow()
    expect(document.querySelectorAll('article').length).toBe(2)
  })

  it('removes all adjacent replacements when article is not hidden', () => {
    document.body.innerHTML = `
      <div ${REPLACEMENT_ATTR}="1">rep 1</div>
      <div ${REPLACEMENT_ATTR}="1">rep 2</div>
      <article data-testid="tweet">visible</article>
    `
    cleanupOrphanReplacements()
    expect(countReps()).toBe(0)
  })

  it('deduplicates: keeps only the immediate replacement before each hidden article', () => {
    document.body.innerHTML = `
      <article data-testid="tweet" ${STATE_ATTR}="hidden">hidden 1</article>
      <div ${REPLACEMENT_ATTR}="1">extra oldest</div>
      <div ${REPLACEMENT_ATTR}="1">immediate</div>
      <article data-testid="tweet" ${STATE_ATTR}="hidden">hidden 2</article>
    `
    cleanupOrphanReplacements()
    // extra oldest 被去重删掉，immediate 保留
    expect(countReps()).toBe(1)
    const remaining = document.querySelector(`[${REPLACEMENT_ATTR}]`)
    expect(remaining?.textContent).toBe('immediate')
  })

  it('does NOT remove valid replacements before a hidden article spaced apart', () => {
    document.body.innerHTML = `
      <div ${REPLACEMENT_ATTR}="1">valid rep</div>
      <article data-testid="tweet" ${STATE_ATTR}="hidden">hidden</article>
      <div ${REPLACEMENT_ATTR}="1">another valid rep</div>
      <article data-testid="tweet" ${STATE_ATTR}="hidden">hidden 2</article>
    `
    cleanupOrphanReplacements()
    expect(countReps()).toBe(2)
  })
})

// ═══════════════════════════════════════════════════
// isOwnNode
// ═══════════════════════════════════════════════════

describe('isOwnNode', () => {
  it('returns true for an element with data-xf-kw-btn', () => {
    const el = document.createElement('div')
    el.setAttribute('data-xf-kw-btn', '1')
    expect(isOwnNode(el)).toBe(true)
  })

  it('returns true for an element with data-xf-spam-hidden-replacement', () => {
    const el = document.createElement('div')
    el.setAttribute('data-xf-spam-hidden-replacement', '1')
    expect(isOwnNode(el)).toBe(true)
  })

  it('returns true for an element with data-xf-spam-debug', () => {
    const el = document.createElement('div')
    el.setAttribute('data-xf-spam-debug', '1')
    expect(isOwnNode(el)).toBe(true)
  })

  it('returns true for a child of a self element (via parent hierarchy)', () => {
    const parent = document.createElement('div')
    parent.setAttribute('data-xf-kw-panel', '1')
    const child = document.createElement('span')
    child.textContent = 'inner'
    parent.appendChild(child)
    expect(isOwnNode(child)).toBe(true)
  })

  it('returns false for a plain div without our attributes', () => {
    const el = document.createElement('div')
    expect(isOwnNode(el)).toBe(false)
  })

  it('returns false for a non-element node (text node)', () => {
    const text = document.createTextNode('hello')
    expect(isOwnNode(text)).toBe(false)
  })

  it('returns false for a comment node', () => {
    const comment = document.createComment('test')
    expect(isOwnNode(comment)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════
// isSelfMutation
// ═══════════════════════════════════════════════════

describe('isSelfMutation', () => {
  it('returns true when added node is our own element (data-xf-kw-btn)', () => {
    const el = document.createElement('div')
    el.setAttribute('data-xf-kw-btn', '1')
    const record = createMutation('childList', [el], [])
    expect(isSelfMutation([record])).toBe(true)
  })

  it('returns false when added node is NOT our element', () => {
    const el = document.createElement('div')
    const record = createMutation('childList', [el], [])
    expect(isSelfMutation([record])).toBe(false)
  })

  it('returns false when removed node is NOT our element', () => {
    const el = document.createElement('div')
    const record = createMutation('childList', [], [el])
    expect(isSelfMutation([record])).toBe(false)
  })

  it('returns true for attribute-only mutations (skipped)', () => {
    const record: MutationRecord = {
      type: 'attributes',
      target: document.createElement('div'),
      addedNodes: [] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      previousSibling: null,
      nextSibling: null,
      attributeName: 'class',
      attributeNamespace: null,
      oldValue: null,
    }
    expect(isSelfMutation([record])).toBe(true)
  })

  it('returns true when our element is added along with its child (both are self)', () => {
    const parent = document.createElement('div')
    parent.setAttribute('data-xf-list-dropdown', '1')
    const child = document.createElement('span')
    parent.appendChild(child)
    const record = createMutation('childList', [parent], [])
    expect(isSelfMutation([record])).toBe(true)
  })

  it('returns true for multiple mutations all with self elements', () => {
    const el1 = document.createElement('div')
    el1.setAttribute('data-xf-kw-btn', '1')
    const el2 = document.createElement('div')
    el2.setAttribute('data-xf-list-btn', '1')
    const r1 = createMutation('childList', [el1], [])
    const r2 = createMutation('childList', [el2], [])
    expect(isSelfMutation([r1, r2])).toBe(true)
  })

  it('returns false when ANY mutation has a non-self node', () => {
    const selfEl = document.createElement('div')
    selfEl.setAttribute('data-xf-kw-btn', '1')
    const externalEl = document.createElement('div')
    const r1 = createMutation('childList', [selfEl], [])
    const r2 = createMutation('childList', [externalEl], [])
    expect(isSelfMutation([r1, r2])).toBe(false)
  })

  it('returns false for a text node (non-element) in childList mutation', () => {
    const text = document.createTextNode('hello')
    const record = createMutation('childList', [text], [])
    expect(isSelfMutation([record])).toBe(false)
  })

  it('returns true for empty records array', () => {
    expect(isSelfMutation([])).toBe(true)
  })
})
