import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { JSDOM } from 'jsdom'

export interface SampleExpectation {
  // 期望总分下限（实际 score 应 >= 该值）
  minScore?: number
  // 期望总分上限（实际 score 应 <= 该值）
  maxScore?: number
  // 期望命中的规则 id 列表（实际必须包含）
  mustHit?: string[]
  // 期望不命中的规则 id 列表
  mustNotHit?: string[]
  // 期望分类
  category?: 'porn_spam' | 'bot' | 'marketing' | 'low_quality' | 'normal'
}

export interface Sample {
  name: string
  html: string
  expect: SampleExpectation
  note?: string
}

/**
 * 从 samples/ 目录加载所有样本（按子目录分类）
 * 子目录名会被加到样本 note 里，便于调试
 */
export function loadSamples(samplesDir: string, subDir: string): Sample[] {
  const dir = join(samplesDir, subDir)
  let entries: string[]
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.html'))
  } catch {
    return []
  }

  return entries.map((htmlFile) => {
    const name = basename(htmlFile, '.html')
    const html = readFileSync(join(dir, htmlFile), 'utf-8')
    const jsonPath = join(dir, `${name}.json`)
    let expectation: SampleExpectation = {}
    let note: string | undefined
    try {
      const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'))
      expectation = raw.expect ?? raw
      note = raw.note
    } catch {
      // 没有 .json 文件：用空期望
    }
    return {
      name: `${subDir}/${name}`,
      html,
      expect: expectation,
      note: note ? `[${subDir}] ${note}` : `[${subDir}]`,
    }
  })
}

/**
 * 把 HTML 字符串塞进 jsdom，模拟浏览器的 document
 */
export function createDOM(html: string): Document {
  const dom = new JSDOM(html)
  return dom.window.document
}
