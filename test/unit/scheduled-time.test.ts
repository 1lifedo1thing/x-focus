import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  parseScheduledTimeString,
  formatTimeAgo,
  formatRelativePublishTime,
  formatDurationGap,
  formatSmartScheduleTime,
  getIntervalTheme,
  getPickedTimeFromModal,
  attachSchedulePickerOverview,
  addScheduledRelativeTimes,
  removeScheduledPanorama,
  listenForScheduledTweetsApi,
  getPersistedScheduledPosts,
} from '../../content-scripts/options/scheduled-time'
import { KeyScheduledPostsCache } from '../../storage-keys'
import { XF_BRIDGE_MARKER } from '../../shared/bridge'

// 记录 storage 写入的内存模拟
export function makeStorageSpy() {
  const store: Record<string, unknown> = {}
  const writes: Array<Record<string, unknown>> = []
  return {
    store,
    writes,
    get: async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys]
      return arr.reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = store[k]
        return acc
      }, {})
    },
    set: async (data: Record<string, unknown>) => {
      writes.push(data)
      Object.assign(store, data)
    },
    remove: async () => {},
  }
}

describe('scheduled-time utility & Schedule Picker Overview', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
    // 固定测试时间为 2026-08-12 15:50:00 (本地时间)
    vi.setSystemTime(new Date(2026, 7, 12, 15, 50, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatRelativePublishTime', () => {
    it('正确计算相对发布时间格式 (例: 41分钟后, 1小时58分钟后, 1天12小时后)', () => {
      const now = new Date(2026, 7, 12, 15, 50, 0)
      expect(formatRelativePublishTime(new Date(2026, 7, 12, 16, 31, 0), now)).toBe('41分钟后')
      expect(formatRelativePublishTime(new Date(2026, 7, 12, 17, 48, 0), now)).toBe('1小时58分钟后')
      expect(formatRelativePublishTime(new Date(2026, 7, 13, 15, 50, 0), now)).toBe('1天后')
      expect(formatRelativePublishTime(new Date(2026, 7, 14, 3, 50, 0), now)).toBe('1天12小时后')
    })
  })

  describe('formatSmartScheduleTime', () => {
    it('对当天、明天、后天及跨月跨年日期进行智能精炼剥离', () => {
      const now = new Date(2026, 7, 12, 15, 50, 0) // 2026-08-12

      // 当天：无 dateTag，只有时间
      const todayResult = formatSmartScheduleTime(new Date(2026, 7, 12, 18, 30, 0), now)
      expect(todayResult).toEqual({
        dateTag: null,
        timeStr: '18:30',
        isToday: true,
      })

      // 明天
      const tomorrowResult = formatSmartScheduleTime(new Date(2026, 7, 13, 9, 15, 0), now)
      expect(tomorrowResult).toEqual({
        dateTag: '明天',
        timeStr: '09:15',
        isToday: false,
      })

      // 后天
      const afterTomorrowResult = formatSmartScheduleTime(new Date(2026, 7, 14, 10, 0, 0), now)
      expect(afterTomorrowResult).toEqual({
        dateTag: '后天',
        timeStr: '10:00',
        isToday: false,
      })

      // 同年跨多日：显示 MM-DD
      const futureResult = formatSmartScheduleTime(new Date(2026, 8, 20, 14, 20, 0), now)
      expect(futureResult).toEqual({
        dateTag: '09-20',
        timeStr: '14:20',
        isToday: false,
      })

      // 跨年：显示完整 YYYY-MM-DD
      const nextYearResult = formatSmartScheduleTime(new Date(2027, 0, 5, 8, 0, 0), now)
      expect(nextYearResult).toEqual({
        dateTag: '2027-01-05',
        timeStr: '08:00',
        isToday: false,
      })
    })
  })

  describe('getPickedTimeFromModal', () => {
    it('正确解析“安排表”弹窗中下拉菜单选中的年月日時分', () => {
      const modal = document.createElement('div')
      modal.innerHTML = `
        <select id="SELECTOR_1"><option value="8" selected>8 月</option></select>
        <select id="SELECTOR_2"><option value="12" selected>12</option></select>
        <select id="SELECTOR_3"><option value="2026" selected>2026</option></select>
        <select id="SELECTOR_4"><option value="17" selected>17</option></select>
        <select id="SELECTOR_5"><option value="04" selected>04</option></select>
      `

      const picked = getPickedTimeFromModal(modal)
      expect(picked).not.toBeNull()
      expect(parsedDateString(picked!)).toBe('2026-8-12 17:4')
    })

    it('正确解析动态 SELECTOR_11..15 编号（带 label）并立即读取最新时间，消除滞后性', () => {
      const modal = document.createElement('div')
      modal.innerHTML = `
        <label id="SELECTOR_11_LABEL">月</label>
        <select id="SELECTOR_11" aria-labelledby="SELECTOR_11_LABEL"><option value="9" selected>9 月</option></select>
        <label id="SELECTOR_12_LABEL">日</label>
        <select id="SELECTOR_12" aria-labelledby="SELECTOR_12_LABEL"><option value="14" selected>14</option></select>
        <label id="SELECTOR_13_LABEL">年</label>
        <select id="SELECTOR_13" aria-labelledby="SELECTOR_13_LABEL"><option value="2026" selected>2026</option></select>
        <label id="SELECTOR_14_LABEL">时</label>
        <select id="SELECTOR_14" aria-labelledby="SELECTOR_14_LABEL"><option value="15" selected>15</option></select>
        <label id="SELECTOR_15_LABEL">分</label>
        <select id="SELECTOR_15" aria-labelledby="SELECTOR_15_LABEL"><option value="24" selected>24</option></select>
        <input type="time" value="14:24" name="时间选择器">
      `

      // 即使隐藏的 input[type="time"] 滞后停留在旧值 14:24，也必须优先准确读取 select 的最新原生值 15:24
      const picked = getPickedTimeFromModal(modal)
      expect(picked).not.toBeNull()
      expect(parsedDateString(picked!)).toBe('2026-9-14 15:24')
    })

    function parsedDateString(date: Date): string {
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`
    }
  })

  describe('attachSchedulePickerOverview 可以在“中国标准时间”下方渲染排期全景面板', () => {
    it('装载 xf-schedule-picker-overview 看板', async () => {
      document.body.innerHTML = `
        <div role="dialog" aria-modal="true">
          <h2 id="modal-header">安排表</h2>
          <div dir="ltr">
            <svg viewBox="0 0 24 24"></svg>
            <span>将于 2026年8月12日周三 下午5:04 发布</span>
          </div>
          <select id="SELECTOR_1"><option value="8" selected>8 月</option></select>
          <select id="SELECTOR_2"><option value="12" selected>12</option></select>
          <select id="SELECTOR_3"><option value="2026" selected>2026</option></select>
          <select id="SELECTOR_4"><option value="17" selected>17</option></select>
          <select id="SELECTOR_5"><option value="4" selected>04</option></select>
          <div class="css-random-container-hash">
            <div>时区</div>
            <div>中国标准时间</div>
          </div>
        </div>
      `

      await attachSchedulePickerOverview()

      const overview = document.querySelector('.xf-schedule-picker-overview')
      expect(overview).not.toBeNull()
      expect(overview?.textContent).toContain('排期全景')
      expect(overview?.textContent).toContain('当前排期')

      // 验证弹窗顶部的 “将于...发布” 同一行放了相对时间 badge
      const headerBadge = document.querySelector('.xf-modal-header-right-badge')
      expect(headerBadge).not.toBeNull()
      expect(headerBadge?.textContent).toBe('1小时14分钟后')

      // 验证 removeScheduledPanorama 能够清除看板与 badge
      removeScheduledPanorama()
      expect(document.querySelector('.xf-schedule-picker-overview')).toBeNull()
      expect(document.querySelector('.xf-modal-header-right-badge')).toBeNull()
    })

    it('当用户在弹窗中修改时间下拉框时，排期全景面板立即响应更新，无滞后（不受任意动态哈希类名影响）', async () => {
      document.body.innerHTML = `
        <div role="dialog" aria-modal="true">
          <h2 id="modal-header">安排表</h2>
          <div class="arbitrary-dynamic-hash-1">
            <div dir="ltr">
              <span>将于 2026年9月14日周一 下午2:24 发布</span>
            </div>
          </div>
          <label id="SELECTOR_11_LABEL">月</label>
          <select id="SELECTOR_11" aria-labelledby="SELECTOR_11_LABEL"><option value="9" selected>9 月</option></select>
          <label id="SELECTOR_12_LABEL">日</label>
          <select id="SELECTOR_12" aria-labelledby="SELECTOR_12_LABEL"><option value="14" selected>14</option></select>
          <label id="SELECTOR_13_LABEL">年</label>
          <select id="SELECTOR_13" aria-labelledby="SELECTOR_13_LABEL"><option value="2026" selected>2026</option></select>
          <label id="SELECTOR_14_LABEL">时</label>
          <select id="SELECTOR_14" aria-labelledby="SELECTOR_14_LABEL"><option value="14" selected>14</option><option value="15">15</option></select>
          <label id="SELECTOR_15_LABEL">分</label>
          <select id="SELECTOR_15" aria-labelledby="SELECTOR_15_LABEL"><option value="24" selected>24</option></select>
          <input type="time" value="14:24" name="时间选择器">
          <div class="arbitrary-dynamic-hash-2">
            <div>时区</div>
            <div>中国标准时间</div>
          </div>
        </div>
      `

      await attachSchedulePickerOverview()

      const overview = document.querySelector('.xf-schedule-picker-overview')!
      expect(overview.textContent).toContain('2026-09-14 14:24')

      // 用户修改时钟 select 为 15
      const hourSelect = document.querySelector<HTMLSelectElement>('#SELECTOR_14')!
      hourSelect.value = '15'
      hourSelect.dispatchEvent(new Event('change', { bubbles: true }))
      await vi.advanceTimersByTimeAsync(0)

      // 验证排期全景面板立即更新为 15:24，无需等待第二次选择
      expect(overview.textContent).toContain('2026-09-14 15:24')
      expect(overview.textContent).not.toContain('2026-09-14 14:24')
    })
  })

  describe('addScheduledRelativeTimes (原生预排期管理页面增强)', () => {
    it('为排期卡片注入相对时间和背景色，且每个卡片仅保留顶部边框、不写入底部边框（避免相邻卡片双层线）', async () => {
      document.body.innerHTML = `
        <div data-testid="unsentTweet">
          <div class="card-inner">
            <div class="top-row">
              <div class="left-box">
                <div dir="ltr">
                  <span>将于 2026年8月12日周三 下午4:31 发布</span>
                </div>
              </div>
            </div>
            <div>第 1 条推文正文</div>
          </div>
        </div>
        <div data-testid="unsentTweet">
          <div class="card-inner">
            <div class="top-row">
              <div class="left-box">
                <div dir="ltr">
                  <span>将于 2026年8月12日周三 下午5:48 发布</span>
                </div>
              </div>
            </div>
            <div>第 2 条推文正文</div>
          </div>
        </div>
      `

      ;(globalThis as any).browser = { storage: { local: makeStorageSpy() } }

      await addScheduledRelativeTimes(true)

      const cards = document.querySelectorAll<HTMLElement>('[data-testid="unsentTweet"]')
      expect(cards).toHaveLength(2)

      // 验证每个排期只保留顶部边框，不写入底部边框，消除卡片相邻处的双层边框
      expect(cards[0].style.borderTop).toContain('1px solid')
      expect(cards[0].style.borderBottom).toBe('')
      expect(cards[1].style.borderTop).toContain('1px solid')
      expect(cards[1].style.borderBottom).toBe('')

      // 验证背景色与徽章注入成功
      expect(cards[0].style.backgroundColor).toBeTruthy()
      expect(cards[1].style.backgroundColor).toBeTruthy()
      expect(cards[0].querySelector('.xf-scheduled-relative-text')?.textContent).toBe('41分钟后')
      expect(cards[1].querySelector('.xf-scheduled-relative-text')?.textContent).toBe('1小时58分钟后')
      expect(cards[1].querySelector('.xf-scheduled-gap-badge')?.textContent).toContain('距上一条 1小时17分')

      // 测试清理
      removeScheduledPanorama()
      expect(cards[0].style.backgroundColor).toBe('')
      expect(cards[0].style.borderTop).toBe('')
      expect(cards[0].style.borderBottom).toBe('')
      expect(document.querySelector('.xf-scheduled-right-box')).toBeNull()
    })
  })

  describe('listenForScheduledTweetsApi (FetchScheduledTweets 拦截持久化)', () => {
    beforeEach(() => {
      const storage = makeStorageSpy()
      ;(globalThis as any).browser = { storage: { local: storage } }
      listenForScheduledTweetsApi()
    })

    function dispatchScheduledPayload(payload: unknown) {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: { type: 'XF_SCHEDULED_TWEETS', payload, __xf: XF_BRIDGE_MARKER },
        }),
      )
    }

    it('将 API 完整数据持久化（按时间升序 + 格式化时间）', async () => {
      dispatchScheduledPayload([
        {
          restId: 'b',
          timestamp: 1786549440000,
          text: 'Antigravity 升到 2.7.1',
        },
        {
          restId: 'a',
          timestamp: 1786533060000,
          text: '这几个网站让我找回了小时候的感觉',
        },
      ])

      await vi.advanceTimersByTimeAsync(0)

      const lastWrite = (globalThis as any).browser.storage.local.writes.at(-1)
      const raw = lastWrite?.[KeyScheduledPostsCache]
      expect(typeof raw).toBe('string')

      const items = JSON.parse(raw)
      expect(items).toHaveLength(2)
      // 按 timestamp 升序
      expect(items[0].restId).toBe('a')
      expect(items[1].restId).toBe('b')
      // 完整正文不再截断
      expect(items[0].text).toContain('小时候的感觉')
      // 格式化时间为 YYYY-MM-DD HH:mm
      expect(items[0].formattedTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    })

    it('接口返回空列表时清空缓存（允许空数组持久化）', async () => {
      dispatchScheduledPayload([])
      await vi.advanceTimersByTimeAsync(0)

      const lastWrite = (globalThis as any).browser.storage.local.writes.at(-1)
      expect(lastWrite?.[KeyScheduledPostsCache]).toBe('[]')
    })

    it('非数组 payload 被忽略，不写入 storage', async () => {
      dispatchScheduledPayload({ data: { viewer: {} } })
      await vi.advanceTimersByTimeAsync(0)

      expect((globalThis as any).browser.storage.local.writes).toHaveLength(0)
    })

    it('未携带桥接标记的广播被忽略（防止其他脚本伪造）', async () => {
      // 与拦截器同 type，但缺少 __xf 标记 → 监听端必须拒绝
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'XF_SCHEDULED_TWEETS',
            payload: [{ restId: 'x', timestamp: Date.now() + 10000, text: '伪造' }],
          },
        }),
      )
      await vi.advanceTimersByTimeAsync(0)

      expect((globalThis as any).browser.storage.local.writes).toHaveLength(0)
    })
  })

  describe('getPersistedScheduledPosts sessionStorage 回退', () => {
    it('storage 为空时回退读取拦截器写入的条目快照', async () => {
      ;(globalThis as any).browser = { storage: { local: makeStorageSpy() } }
      sessionStorage.setItem(
        'xf_scheduled_items_last',
        JSON.stringify([
          { restId: 'x', timestamp: 1786533060000, text: '快照正文' },
          { restId: 'y', timestamp: 1786549440000, text: '第二条' },
        ]),
      )

      const items = await getPersistedScheduledPosts()
      expect(items).toHaveLength(2)
      expect(items[0].restId).toBe('x')
      expect(items[0].text).toBe('快照正文')
      expect(items[0].formattedTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
      // 按时间升序
      expect(items[0].timestamp).toBeLessThan(items[1].timestamp)

      sessionStorage.removeItem('xf_scheduled_items_last')
    })
  })
})
