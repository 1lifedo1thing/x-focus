import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { extractTweetInfo } from '../../shared/parse-tweet'
import { evaluateSpam } from '../../shared/spam-rules'
import { loadSamples, createDOM } from '../helpers/load-samples'

const SAMPLES_DIR = resolve(__dirname, '../samples')

describe('sample classification - spam/*', () => {
  const samples = loadSamples(SAMPLES_DIR, 'spam')

  it('loads at least one spam sample (regression guard)', () => {
    expect(samples.length).toBeGreaterThan(0)
  })

  for (const sample of samples) {
    it(`${sample.name} → expected category and score`, () => {
      const doc = createDOM(sample.html)
      const article = doc.querySelector('article[data-testid="tweet"]')
      expect(article, `${sample.name}: article not found`).not.toBeNull()

      const info = extractTweetInfo(doc, article! as HTMLElement)
      expect(info, `${sample.name}: parse failed`).not.toBeNull()

      const ev = evaluateSpam({
        text: info!.text,
        authorName: info!.authorName,
        authorHandle: info!.authorHandle,
      })

      // 输出可读报告（失败时）
      const summary = {
        authorName: info!.authorName,
        authorHandle: info!.authorHandle,
        text: info!.text,
        score: ev.score,
        category: ev.category,
        hits: ev.hits.map((h) => `${h.id}(${h.score})`),
      }

      const exp = sample.expect
      if (exp.minScore !== undefined) {
        expect(
          ev.score,
          `${sample.name} score below min (${JSON.stringify(summary)})`,
        ).toBeGreaterThanOrEqual(exp.minScore)
      }
      if (exp.maxScore !== undefined) {
        expect(
          ev.score,
          `${sample.name} score above max (${JSON.stringify(summary)})`,
        ).toBeLessThanOrEqual(exp.maxScore)
      }
      if (exp.category) {
        expect(
          ev.category,
          `${sample.name} category mismatch (${JSON.stringify(summary)})`,
        ).toBe(exp.category)
      }
      if (exp.mustHit) {
        for (const ruleId of exp.mustHit) {
          expect(
            ev.hits.some((h) => h.id === ruleId),
            `${sample.name} should hit ${ruleId} (${JSON.stringify(summary)})`,
          ).toBe(true)
        }
      }
      if (exp.mustNotHit) {
        for (const ruleId of exp.mustNotHit) {
          expect(
            ev.hits.some((h) => h.id === ruleId),
            `${sample.name} should NOT hit ${ruleId} (${JSON.stringify(summary)})`,
          ).toBe(false)
        }
      }
    })
  }
})

describe('sample classification - normal/*', () => {
  const samples = loadSamples(SAMPLES_DIR, 'normal')

  if (samples.length === 0) {
    it.skip('no normal samples yet', () => {})
    return
  }

  it('loads at least one normal sample (regression guard)', () => {
    expect(samples.length).toBeGreaterThan(0)
  })

  for (const sample of samples) {
    it(`${sample.name} → stays below fold threshold`, () => {
      const doc = createDOM(sample.html)
      const article = doc.querySelector('article[data-testid="tweet"]')! as HTMLElement
      const info = extractTweetInfo(doc, article)
      expect(info, `${sample.name}: parse failed`).not.toBeNull()

      const ev = evaluateSpam({
        text: info!.text,
        authorName: info!.authorName,
        authorHandle: info!.authorHandle,
      })

      const exp = sample.expect
      if (exp.maxScore !== undefined) {
        expect(ev.score).toBeLessThanOrEqual(exp.maxScore)
      } else {
        // 默认期望：正常评论不应被 fold（阈值 55）
        expect(
          ev.score,
          `${sample.name} normal comment should score < 55`,
        ).toBeLessThan(55)
      }
    })
  }
})

describe('sample classification - edge/*', () => {
  const samples = loadSamples(SAMPLES_DIR, 'edge')

  // 空目录时跳过——避免 "No test found in suite" 警告
  if (samples.length === 0) {
    it.skip('no edge samples yet', () => {})
    return
  }

  for (const sample of samples) {
    it(`${sample.name}`, () => {
      const doc = createDOM(sample.html)
      const article = doc.querySelector('article[data-testid="tweet"]')! as HTMLElement
      const info = extractTweetInfo(doc, article)
      expect(info).not.toBeNull()
      const ev = evaluateSpam({
        text: info!.text,
        authorName: info!.authorName,
        authorHandle: info!.authorHandle,
      })
      const exp = sample.expect
      if (exp.maxScore !== undefined) {
        expect(ev.score).toBeLessThanOrEqual(exp.maxScore)
      }
      if (exp.minScore !== undefined) {
        expect(ev.score).toBeGreaterThanOrEqual(exp.minScore)
      }
    })
  }
})
