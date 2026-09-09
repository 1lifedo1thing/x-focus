import { KeySpamLog, KeySpamStats } from '../storage-keys'
import type { DailyStats, SpamCategory, SpamLogEntry } from './spam-types'
import { SPAM_CATEGORY_LABEL } from './spam-types'

const MAX_LOG_ENTRIES = 200 // 防止 storage 过大
const STAT_RETENTION_DAYS = 30

// 运行时去重 Map：同一推文 5 分钟内不重复记录
// X 虚拟列表重建 DOM 会导致同一推文被多次扫描，避免日志/统计膨胀
const DEDUP_TTL_MS = 5 * 60 * 1000
const dedupCache = new Map<string, number>()

function dedupKey(entry: Omit<SpamLogEntry, 'id' | 'timestamp'>): string {
  return `${entry.authorHandle ?? ''}|${(entry.text ?? '').slice(0, 30)}|${entry.category}`
}

function isDuplicate(key: string): boolean {
  const now = Date.now()
  // 惰性清理过期条目 (由于 Map 维护插入顺序且时间单调递增，遇到第一个未过期的即可跳出，平均 O(1) 时间)
  for (const [k, ts] of dedupCache) {
    if (now - ts > DEDUP_TTL_MS) {
      dedupCache.delete(k)
    } else {
      break
    }
  }
  const last = dedupCache.get(key)
  if (last && now - last < DEDUP_TTL_MS) return true
  dedupCache.set(key, now)
  return false
}

export function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function emptyCategoryStats(): Record<SpamCategory, number> {
  return {
    porn_spam: 0,
    bot: 0,
    marketing: 0,
    low_quality: 0,
    normal: 0,
  }
}

export async function readLog(): Promise<SpamLogEntry[]> {
  const data = await browser.storage.local.get(KeySpamLog)
  const raw = data[KeySpamLog]
  if (!Array.isArray(raw)) return []
  return raw as SpamLogEntry[]
}

export async function readStats(): Promise<DailyStats[]> {
  const data = await browser.storage.local.get(KeySpamStats)
  const raw = data[KeySpamStats]
  if (!Array.isArray(raw)) return []
  return raw as DailyStats[]
}

// 串行化 read-modify-write：并发 recordIntercept 不会丢日志
let queue: Promise<unknown> = Promise.resolve()
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn) as Promise<T>
  queue = next.catch(() => {})
  return next
}

export async function recordIntercept(entry: Omit<SpamLogEntry, 'id' | 'timestamp'>): Promise<void> {
  // 去重：同推文在 5 分钟内只记一次
  if (isDuplicate(dedupKey(entry))) return

  return serialize(async () => {
    const log = await readLog()
    const stats = await readStats()
    const today = getTodayKey()

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const fullEntry: SpamLogEntry = {
      id,
      timestamp: Date.now(),
      ...entry,
    }
    const nextLog = [fullEntry, ...log].slice(0, MAX_LOG_ENTRIES)

    let todayStat = stats.find((s) => s.date === today)
    if (!todayStat) {
      todayStat = { date: today, total: 0, byCategory: emptyCategoryStats() }
      stats.unshift(todayStat)
    }
    todayStat.total += 1
    todayStat.byCategory[entry.category] = (todayStat.byCategory[entry.category] || 0) + 1

    // 清理过期统计
    const cutoff = Date.now() - STAT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const nextStats = stats.filter((s) => {
      const ts = new Date(s.date).getTime()
      return Number.isFinite(ts) && ts >= cutoff - 24 * 60 * 60 * 1000
    })

    await browser.storage.local.set({
      [KeySpamLog]: nextLog,
      [KeySpamStats]: nextStats,
    })
  })
}

export async function clearLog(): Promise<void> {
  await browser.storage.local.remove(KeySpamLog)
}

export async function clearStats(): Promise<void> {
  await browser.storage.local.remove(KeySpamStats)
}

export async function getTodayStats(): Promise<{
  total: number
  byCategory: Record<SpamCategory, number>
}> {
  const stats = await readStats()
  const today = getTodayKey()
  const todayStat = stats.find((s) => s.date === today)
  if (!todayStat) {
    return { total: 0, byCategory: emptyCategoryStats() }
  }
  return {
    total: todayStat.total,
    byCategory: { ...emptyCategoryStats(), ...todayStat.byCategory },
  }
}

export function summarizeCategory(
  byCategory: Record<SpamCategory, number>,
): { category: SpamCategory; label: string; count: number }[] {
  return (Object.keys(byCategory) as SpamCategory[])
    .filter((c) => c !== 'normal')
    .map((c) => ({
      category: c,
      label: SPAM_CATEGORY_LABEL[c],
      count: byCategory[c] || 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
}
