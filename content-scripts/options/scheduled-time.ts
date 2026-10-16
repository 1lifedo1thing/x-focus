import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { KeyScheduledPostsCache, KeyScheduledPanorama } from '../../storage-keys'
import { XF_BRIDGE_MARKER, SCHEDULED_TWEETS_TYPE } from '../../shared/bridge'
import { getStorage, setStorage } from '../utilities/storage'
import addStyles, { removeStyles } from '../utilities/addStyles'

dayjs.extend(relativeTime)

export type DateInput = string | number | Date | dayjs.Dayjs

export interface IntervalTheme {
  category: 'first_soon' | 'first_normal' | 'tight' | 'normal' | 'moderate' | 'long'
  label: string
  bg: string
  accentColor: string
  borderColor: string
  badgeBg: string
}

export interface PersistedScheduledItem {
  restId?: string
  timestamp: number
  formattedTime: string
  text: string
}

/**
 * 格式化相对发布时间
 * 例：43分钟后、1小时后、1小时15分钟后、1天12小时后
 */
export function formatRelativePublishTime(targetDate: Date, now: Date = new Date()): string {
  const diffMs = targetDate.getTime() - now.getTime()
  if (diffMs <= 0) return '即将发布'

  const totalMinutes = Math.floor(diffMs / (60 * 1000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const mins = totalMinutes % 60

  if (days > 0) {
    return hours > 0 ? `${days}天${hours}小时后` : `${days}天后`
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}小时${mins}分钟后` : `${hours}小时后`
  }
  if (mins > 0) {
    return `${mins}分钟后`
  }
  return '1分钟内'
}

/**
 * 兼容导出：格式化相对时间
 */
export function formatTimeAgo(inputTime: DateInput | null | undefined): string {
  if (inputTime === null || inputTime === undefined || inputTime === '')
    return ''

  const formattedTime = dayjs(inputTime)
  if (!formattedTime.isValid())
    return ''

  return formatRelativePublishTime(formattedTime.toDate())
}

/**
 * 将毫秒时间间隔转为易读中文（如：30分钟、1小时15分、1天2小时）
 */
export function formatDurationGap(ms: number): string {
  if (ms < 0) ms = 0
  const totalMinutes = Math.floor(ms / (60 * 1000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const mins = totalMinutes % 60

  if (days > 0) {
    return hours > 0 ? `${days}天${hours}小时` : `${days}天`
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
  }
  return `${mins}分钟`
}

export interface SmartScheduleTime {
  dateTag: string | null
  timeStr: string
  isToday: boolean
}

/**
 * 智能精炼排期时间显示（剥离冗余年份噪音，聚焦当日时间与相对日期）
 */
export function formatSmartScheduleTime(targetDate: Date, now: Date = new Date()): SmartScheduleTime {
  const targetDay = dayjs(targetDate)
  const nowDay = dayjs(now)
  const timeStr = targetDay.format('HH:mm')

  if (targetDay.isSame(nowDay, 'day')) {
    return { dateTag: null, timeStr, isToday: true }
  }

  if (targetDay.isSame(nowDay.add(1, 'day'), 'day')) {
    return { dateTag: '明天', timeStr, isToday: false }
  }

  if (targetDay.isSame(nowDay.add(2, 'day'), 'day')) {
    return { dateTag: '后天', timeStr, isToday: false }
  }

  const isSameYear = targetDay.isSame(nowDay, 'year')
  const dateTag = isSameYear ? targetDay.format('MM-DD') : targetDay.format('YYYY-MM-DD')
  return { dateTag, timeStr, isToday: false }
}

/**
 * 格式化日期分组标签（无 emoji，极简清晰）
 */
export function formatDateGroupLabel(targetDate: Date, now: Date = new Date()): string {
  const targetDay = dayjs(targetDate)
  const nowDay = dayjs(now)

  if (targetDay.isSame(nowDay, 'day')) {
    return `今天 · ${targetDay.format('MM-DD')}`
  }
  if (targetDay.isSame(nowDay.add(1, 'day'), 'day')) {
    return `明天 · ${targetDay.format('MM-DD')}`
  }
  if (targetDay.isSame(nowDay.add(2, 'day'), 'day')) {
    return `后天 · ${targetDay.format('MM-DD')}`
  }

  const isSameYear = targetDay.isSame(nowDay, 'year')
  return isSameYear ? targetDay.format('MM-DD') : targetDay.format('YYYY-MM-DD')
}

/**
 * 根据是否为首条及时间间隔获取视觉配色主题
 */
export function getIntervalTheme(isFirst: boolean, gapMs: number): IntervalTheme {
  if (isFirst) {
    const hoursFromNow = gapMs / (3600 * 1000)
    if (hoursFromNow <= 2) {
      return {
        category: 'first_soon',
        label: '即将发布',
        bg: 'rgba(16, 185, 129, 0.08)',
        accentColor: 'rgb(16, 185, 129)',
        borderColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
      }
    }
    return {
      category: 'first_normal',
      label: '首条排期',
      bg: 'rgba(14, 165, 233, 0.07)',
      accentColor: 'rgb(14, 165, 233)',
      borderColor: '#0ea5e9',
      badgeBg: 'rgba(14, 165, 233, 0.15)',
    }
  }

  const gapHours = gapMs / (3600 * 1000)

  if (gapHours < 2) {
    // 间隔过密 (< 2 小时) -> 警示琥珀橙
    return {
      category: 'tight',
      label: '间隔过密',
      bg: 'rgba(245, 158, 11, 0.09)',
      accentColor: 'rgb(245, 158, 11)',
      borderColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.18)',
    }
  }

  if (gapHours < 8) {
    // 正常间隔 (2 - 8 小时) -> 清新蓝
    return {
      category: 'normal',
      label: '正常间隔',
      bg: 'rgba(59, 130, 246, 0.07)',
      accentColor: 'rgb(59, 130, 246)',
      borderColor: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.15)',
    }
  }

  if (gapHours < 24) {
    // 半天/跨夜 (8 - 24 小时) -> 靛蓝
    return {
      category: 'moderate',
      label: '半天/跨夜',
      bg: 'rgba(99, 102, 241, 0.07)',
      accentColor: 'rgb(99, 102, 241)',
      borderColor: '#6366f1',
      badgeBg: 'rgba(99, 102, 241, 0.15)',
    }
  }

  // 跨日间隔 (>= 24 小时) -> 紫罗兰
  return {
    category: 'long',
    label: '跨日间隔',
    bg: 'rgba(168, 85, 247, 0.08)',
    accentColor: 'rgb(168, 85, 247)',
    borderColor: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
  }
}

/**
 * 解析排期推文文本中的发布时间
 */
export function parseScheduledTimeString(text: string): Date | null {
  if (!text) return null

  // 1. 中文格式
  const cnMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?(?:\s*周[一二三四五六日])?\s*(上午|下午|凌晨|中午|晚上|AM|PM)?\s*(\d{1,2}):(\d{2})/i)
  if (cnMatch) {
    const year = parseInt(cnMatch[1], 10)
    const month = parseInt(cnMatch[2], 10) - 1
    const day = parseInt(cnMatch[3], 10)
    const period = cnMatch[4] ? cnMatch[4].toUpperCase() : ''
    let hour = parseInt(cnMatch[5], 10)
    const minute = parseInt(cnMatch[6], 10)

    if (period === '下午' || period === '晚上' || period === 'PM') {
      if (hour < 12) hour += 12
    } else if (period === '上午' || period === '凌晨' || period === 'AM') {
      if (hour === 12) hour = 0
    } else if (period === '中午') {
      if (hour < 12 && hour !== 12) hour += 12
    }

    const date = new Date(year, month, day, hour, minute, 0)
    if (!isNaN(date.getTime())) return date
  }

  // 2. 英文格式
  const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
  const enMatch = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (enMatch) {
    const month = months[enMatch[1].toLowerCase()]
    const day = parseInt(enMatch[2], 10)
    const year = parseInt(enMatch[3], 10)
    let hour = parseInt(enMatch[4], 10)
    const minute = parseInt(enMatch[5], 10)
    const period = enMatch[6] ? enMatch[6].toUpperCase() : ''

    if (period === 'PM' && hour < 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0

    const date = new Date(year, month, day, hour, minute, 0)
    if (!isNaN(date.getTime())) return date
  }

  // 3. 标准 ISO / YYYY-MM-DD HH:mm 格式
  const isoMatch = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})/)
  if (isoMatch) {
    const date = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10), parseInt(isoMatch[4], 10), parseInt(isoMatch[5], 10))
    if (!isNaN(date.getTime())) return date
  }

  return null
}

/**
 * 读取持久化保存的排期列表缓存。
 * 优先读 chrome.storage.local；为空时回退读 MAIN world 拦截器写入的
 * sessionStorage 条目快照（postMessage → storage 链路丢失/晚注册时兜底）。
 */
export async function getPersistedScheduledPosts(): Promise<PersistedScheduledItem[]> {
  // 1. chrome.storage.local 缓存
  try {
    const raw = await getStorage(KeyScheduledPostsCache)
    if (typeof raw === 'string' && raw) {
      const items = JSON.parse(raw) as PersistedScheduledItem[]
      if (Array.isArray(items)) return items
    }
  } catch {}

  // 2. sessionStorage 快照回退
  try {
    const snapshot = sessionStorage.getItem('xf_scheduled_items_last')
    if (snapshot) {
      const raw = JSON.parse(snapshot) as Array<{ restId: string; timestamp: number; text: string }>
      if (Array.isArray(raw)) {
        return raw
          .filter((item) => typeof item.timestamp === 'number' && !isNaN(item.timestamp))
          .map((item) => ({
            restId: item.restId,
            timestamp: item.timestamp,
            formattedTime: dayjs(new Date(item.timestamp)).format('YYYY-MM-DD HH:mm'),
            text: item.text,
          }))
          .sort((a, b) => a.timestamp - b.timestamp)
      }
    }
  } catch {}

  return []
}

/**
 * 持久化保存排期列表缓存
 */
export async function persistScheduledPosts(items: PersistedScheduledItem[]) {
  try {
    await setStorage({ [KeyScheduledPostsCache]: JSON.stringify(items) })
  } catch {}
}

/**
 * 自动清理已到期/过去的时间戳项
 */
export async function prunePastScheduledPosts() {
  try {
    const raw = await getStorage(KeyScheduledPostsCache)
    if (typeof raw === 'string' && raw) {
      const items = JSON.parse(raw) as PersistedScheduledItem[]
      if (Array.isArray(items) && items.length) {
        const now = Date.now()
        const valid = items.filter((item) => item.timestamp > now)
        if (valid.length !== items.length) {
          await persistScheduledPosts(valid)
        }
      }
    }
  } catch {}
}

let lastScheduledPruneAt = 0
const SCHEDULED_PRUNE_INTERVAL_MS = 60 * 1000

export function maintainScheduledPostsCache(): void {
  const now = Date.now()
  if (now - lastScheduledPruneAt < SCHEDULED_PRUNE_INTERVAL_MS) return
  lastScheduledPruneAt = now
  void prunePastScheduledPosts()
}

/**
 * 监听来自 MAIN world fetch 拦截器的 postMessage，
 * 接收到 FetchScheduledTweets API 完整数据后持久化到 storage。
 * 应在插件初始化时调用一次。
 */
export function listenForScheduledTweetsApi() {
  // 与主世界拦截器共用同一个调试开关：window.__XF_DEBUG_SCHEDULED__
  const debug = () =>
    !!(window as unknown as { __XF_DEBUG_SCHEDULED__?: boolean }).__XF_DEBUG_SCHEDULED__

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.type !== SCHEDULED_TWEETS_TYPE) return
    // 仅接受本扩展 MAIN 拦截器的广播（携带桥接标记），忽略其他脚本的同名消息
    if (event.data.__xf !== XF_BRIDGE_MARKER) return

    try {
      const raw = event.data.payload as Array<{
        restId: string
        timestamp: number
        text: string
      }>
      if (!Array.isArray(raw)) return

      if (debug()) console.log('[X Focus 排期持久化] 收到广播', raw.length, '条', raw)

      // 允许空数组：接口返回空列表时同样持久化，清掉已删除排期的旧缓存
      const items: PersistedScheduledItem[] = raw
        .filter((item) => typeof item.timestamp === 'number' && !isNaN(item.timestamp))
        .map((item) => ({
          restId: item.restId,
          timestamp: item.timestamp,
          formattedTime: dayjs(new Date(item.timestamp)).format('YYYY-MM-DD HH:mm'),
          text: item.text,
        }))
        .sort((a, b) => a.timestamp - b.timestamp)

      void persistScheduledPosts(items).then(() => {
        if (debug()) console.log('[X Focus 排期持久化] 已写入 storage', items.length, '条')
      })
    } catch (e) {
      if (debug()) console.warn('[X Focus 排期持久化] 处理失败', e)
    }
  })
}

/**
 * 根据排期文本计算相对时间字符串
 */
export function getScheduledRelativeTime(text: string): string | null {
  const date = parseScheduledTimeString(text)
  if (!date) return null
  return formatRelativePublishTime(date)
}

/**
 * 清除页面上由排期全景功能注入的所有 DOM 元素与样式
 */
export function removeScheduledPanorama() {
  document.querySelectorAll('.xf-schedule-picker-overview').forEach((el) => el.remove())
  document.querySelectorAll('.xf-modal-header-right-badge').forEach((el) => el.remove())
  document.querySelectorAll('.xf-scheduled-right-box').forEach((el) => el.remove())
  removeStyles('scheduledPanoramaStyles')
  document.querySelectorAll('[data-testid="unsentTweet"]').forEach((card) => {
    const cardEl = card as HTMLElement
    cardEl.style.backgroundColor = ''
    cardEl.style.borderTop = ''
    cardEl.style.borderBottom = ''
    delete cardEl.dataset.xfLayoutStyled
  })
}

/**
 * 在每个排期帖子右上角（同一行，两端对齐）展示相对时间
 * 持久化数据由 listenForScheduledTweetsApi() 通过 API 拦截完成，此处不再重复写入
 */
export async function addScheduledRelativeTimes(state?: string | number | boolean) {
  try {
    if (state === 'off' || state === 'hide') {
      removeScheduledPanorama()
      return
    }
    if (state === undefined) {
      const stored = await getStorage(KeyScheduledPanorama)
      if (stored === 'off' || stored === 'hide') {
        removeScheduledPanorama()
        return
      }
    }
    const unsentTweets = document.querySelectorAll('[data-testid="unsentTweet"]')
    if (unsentTweets.length) {
      const scheduledItems: Array<{ card: HTMLElement, date: Date, textSpan: Element }> = []

      unsentTweets.forEach((card) => {
        const cardEl = card as HTMLElement
        const textSpan = Array.from(cardEl.querySelectorAll('span, div')).find(el => {
          return el.children.length === 0 && (el.textContent?.includes('将于') || el.textContent?.includes('Will send on'))
        })

        if (!textSpan) return

        const textContent = textSpan.textContent || ''
        const date = parseScheduledTimeString(textContent)
        if (date) {
          scheduledItems.push({ card: cardEl, date, textSpan })
        }
      })

      if (scheduledItems.length) {
        // 按发布时间从早到晚排序
        scheduledItems.sort((a, b) => a.date.getTime() - b.date.getTime())

        const now = new Date()

        scheduledItems.forEach((item, index) => {
          const { card, date, textSpan } = item
          // eslint-disable-next-line @typescript-eslint/no-unused-vars

          const isFirst = index === 0
          const prevDate = isFirst ? null : scheduledItems[index - 1].date
          const gapMs = isFirst ? Math.max(0, date.getTime() - now.getTime()) : Math.max(0, date.getTime() - (prevDate?.getTime() ?? now.getTime()))

          const theme = getIntervalTheme(isFirst, gapMs)
          const relTimeStr = formatRelativePublishTime(date, now)
          const gapStr = isFirst ? '' : formatDurationGap(gapMs)

          card.style.backgroundColor = theme.bg
          card.style.borderTop = `1px solid ${theme.borderColor}55`
          card.style.borderBottom = ''
          card.style.transition = 'background-color 0.2s ease, border-color 0.2s ease'

          if (card.parentElement && card.parentElement.tagName === 'BUTTON') {
            const btn = card.parentElement as HTMLElement
            btn.style.backgroundColor = 'transparent'
          }

          const dirEl = (textSpan.closest('div[dir="ltr"]') || textSpan.parentElement) as HTMLElement
          const leftBox = (dirEl.parentElement as HTMLElement) || dirEl
          const topRow = (leftBox.parentElement as HTMLElement) || leftBox

          // 布局样式每 tick 相同，只在首次设置一次，避免 cssText += 无限增长
          if (!card.dataset.xfLayoutStyled) {
            card.dataset.xfLayoutStyled = '1'
            topRow.style.cssText += 'display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; width: 100% !important;'
            leftBox.style.cssText += 'display: inline-flex !important; align-items: center !important; flex-shrink: 1 !important; overflow: hidden !important;'
            dirEl.style.cssText += 'display: inline-flex !important; align-items: center !important; gap: 4px !important;'
          }

          if (topRow.parentElement && topRow.parentElement !== card) {
            (topRow.parentElement as HTMLElement).style.width = '100%'
          }

          let rightBox = topRow.querySelector('.xf-scheduled-right-box') as HTMLElement | null
          if (!rightBox) {
            rightBox = document.createElement('div')
            rightBox.className = 'xf-scheduled-right-box'
            topRow.appendChild(rightBox)
          }

          rightBox.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin-left: auto !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
          `

          let relBadge = rightBox.querySelector('.xf-scheduled-relative-text') as HTMLElement | null
          if (!relBadge) {
            relBadge = document.createElement('span')
            relBadge.className = 'xf-scheduled-relative-text'
            rightBox.appendChild(relBadge)
          }

          relBadge.style.cssText = `
            display: inline-block !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            color: ${theme.accentColor} !important;
            background-color: ${theme.badgeBg} !important;
            border: 1px solid ${theme.borderColor}44 !important;
            padding: 2px 8px !important;
            border-radius: 12px !important;
            line-height: 16px !important;
            white-space: nowrap !important;
          `
          relBadge.textContent = relTimeStr

          let gapBadge = rightBox.querySelector('.xf-scheduled-gap-badge') as HTMLElement | null
          if (isFirst) {
            if (gapBadge) gapBadge.remove()
          } else {
            if (!gapBadge) {
              gapBadge = document.createElement('span')
              gapBadge.className = 'xf-scheduled-gap-badge'
              rightBox.appendChild(gapBadge)
            }
            const gapText = theme.category === 'tight' ? `⚠️ 距上一条 ${gapStr}` : `距上一条 ${gapStr}`
            gapBadge.style.cssText = `
              display: inline-block !important;
              font-size: 11px !important;
              font-weight: 600 !important;
              color: ${theme.accentColor} !important;
              background-color: ${theme.badgeBg} !important;
              border: 1px dashed ${theme.borderColor}88 !important;
              padding: 2px 6px !important;
              border-radius: 10px !important;
              line-height: 16px !important;
              white-space: nowrap !important;
            `
            gapBadge.textContent = gapText
          }
        })
      }
    }

    // 同时尝试检测并装载“安排表”选时间弹窗看板
    void attachSchedulePickerOverview()
  } catch {}
}

/**
 * 智能提取“安排表”弹窗中的年月日時分 5 个原生 select 元素
 * 杜绝硬编码 ID（如 SELECTOR_1..5），自适应 Twitter 界面在不同生命周期下生成的动态编号（如 SELECTOR_11..15）
 */
export function extractSelectsFromModal(modal: Element): {
  selYear: HTMLSelectElement | null
  selMonth: HTMLSelectElement | null
  selDay: HTMLSelectElement | null
  selHour: HTMLSelectElement | null
  selMinute: HTMLSelectElement | null
} {
  const selects = Array.from(modal.querySelectorAll<HTMLSelectElement>('select'))

  let selYear: HTMLSelectElement | null = null
  let selMonth: HTMLSelectElement | null = null
  let selDay: HTMLSelectElement | null = null
  let selHour: HTMLSelectElement | null = null
  let selMinute: HTMLSelectElement | null = null

  // 1. 优先通过关联 label 或 aria-label 精准识别每一个 select
  for (const sel of selects) {
    const labelId = sel.getAttribute('aria-labelledby')
    const labelEl = labelId ? modal.querySelector(`#${labelId}`) : null
    const text = (
      labelEl?.textContent ||
      sel.getAttribute('aria-label') ||
      sel.closest('div')?.querySelector('label')?.textContent ||
      sel.parentElement?.querySelector('label')?.textContent ||
      ''
    ).trim().toLowerCase()

    if (text.includes('年') || text.includes('year')) {
      selYear = sel
    } else if (text.includes('月') || text.includes('month')) {
      selMonth = sel
    } else if (text.includes('日') || text.includes('day')) {
      selDay = sel
    } else if (text.includes('时') || text.includes('hour')) {
      selHour = sel
    } else if (text.includes('分') || text.includes('minute') || text.includes('min')) {
      selMinute = sel
    }
  }

  // 2. 若 label 无法完全匹配，通过 role="group" 或 aria-label 分组推断
  if (!selYear || !selMonth || !selDay) {
    const dateGroup = modal.querySelector('[aria-label*="日期"], [aria-label*="Date"], [aria-label*="date"]')
    if (dateGroup) {
      const dateSelects = Array.from(dateGroup.querySelectorAll<HTMLSelectElement>('select'))
      if (dateSelects.length === 3) {
        if (!selMonth) selMonth = dateSelects[0]
        if (!selDay) selDay = dateSelects[1]
        if (!selYear) selYear = dateSelects[2]
      }
    }
  }

  if (!selHour || !selMinute) {
    const timeGroup = modal.querySelector('[aria-label*="时间"], [aria-label*="Time"], [aria-label*="time"]')
    if (timeGroup) {
      const timeSelects = Array.from(timeGroup.querySelectorAll<HTMLSelectElement>('select'))
      if (timeSelects.length === 2) {
        if (!selHour) selHour = timeSelects[0]
        if (!selMinute) selMinute = timeSelects[1]
      }
    }
  }

  // 3. 兼容历史硬编码 ID（如部分轻量单元测试环境）
  if (!selYear) selYear = modal.querySelector<HTMLSelectElement>('#SELECTOR_3')
  if (!selMonth) selMonth = modal.querySelector<HTMLSelectElement>('#SELECTOR_1')
  if (!selDay) selDay = modal.querySelector<HTMLSelectElement>('#SELECTOR_2')
  if (!selHour) selHour = modal.querySelector<HTMLSelectElement>('#SELECTOR_4')
  if (!selMinute) selMinute = modal.querySelector<HTMLSelectElement>('#SELECTOR_5')

  // 4. 若正好有 5 个 select 且依然缺失，按标准 DOM 顺序兜底 [月, 日, 年, 时, 分]
  if (selects.length === 5) {
    if (!selMonth) selMonth = selects[0]
    if (!selDay) selDay = selects[1]
    if (!selYear) selYear = selects[2]
    if (!selHour) selHour = selects[3]
    if (!selMinute) selMinute = selects[4]
  }

  return { selYear, selMonth, selDay, selHour, selMinute }
}

/**
 * 解析“安排表”弹窗中当前选中的 Date
 */
export function getPickedTimeFromModal(modal: Element): Date | null {
  try {
    // 1. 优先从原生 select 获取当前值（用户直接操作的交互源头，实时无延迟）
    const { selYear, selMonth, selDay, selHour, selMinute } = extractSelectsFromModal(modal)

    if (
      selYear?.value &&
      selMonth?.value &&
      selDay?.value &&
      selHour?.value !== undefined &&
      selHour?.value !== '' &&
      selMinute?.value !== undefined &&
      selMinute?.value !== ''
    ) {
      const y = parseInt(selYear.value, 10)
      const m = parseInt(selMonth.value, 10) - 1
      const d = parseInt(selDay.value, 10)
      const h = parseInt(selHour.value, 10)
      const min = parseInt(selMinute.value, 10)
      const dt = new Date(y, m, d, h, min, 0)
      if (!isNaN(dt.getTime())) return dt
    }

    // 2. 备选：从原生 input[type="date"] 与 input[type="time"] 获取
    const dateInput = modal.querySelector('input[type="date"]') as HTMLInputElement | null
    const timeInput = modal.querySelector('input[type="time"]') as HTMLInputElement | null
    if (dateInput?.value && timeInput?.value) {
      const [y, m, d] = dateInput.value.split('-').map(Number)
      const [h, min] = timeInput.value.split(':').map(Number)
      const dt = new Date(y, m - 1, d, h, min, 0)
      if (!isNaN(dt.getTime())) return dt
    }

    const headerText = modal.querySelector('.r-7sv4c2 div[dir="ltr"]')?.textContent || modal.textContent || ''
    return parseScheduledTimeString(headerText)
  } catch {
    return null
  }
}

/**
 * 在“安排表”选时间弹窗下装载“排期全景 (全景分布看板)”
 */
export async function attachSchedulePickerOverview() {
  try {
    const stored = await getStorage(KeyScheduledPanorama)
    if (stored === 'off' || stored === 'hide') {
      removeScheduledPanorama()
      return
    }

    const modals = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'))
    const scheduleModal = modals.find((modal) => {
      const headerText = modal.querySelector('#modal-header')?.textContent || modal.textContent || ''
      return (
        (headerText.includes('安排表') || headerText.includes('Schedule')) &&
        modal.querySelector('select, input[type="date"], input[type="time"]')
      )
    }) as HTMLElement | null

    if (!scheduleModal) return
    addStyles('scheduledPanoramaStyles', SCHEDULED_PANORAMA_STYLES)

    // 寻找“中国标准时间”对应的文本容器（基于语义多语言文本定位，不依赖任何哈希类名）
    const timezoneSpan = Array.from(scheduleModal.querySelectorAll('span, div')).find((el) => {
      return (
        el.children.length === 0 &&
        (el.textContent?.includes('中国标准时间') ||
          el.textContent?.includes('Standard Time') ||
          el.textContent?.includes('时区') ||
          el.textContent?.includes('Time zone'))
      )
    })

    let timezoneSection: HTMLElement | null = null
    if (timezoneSpan) {
      // 沿 DOM 树向上回溯：找到位于表单主容器下并列的时区卡片/小节（完全杜绝动态哈希类名依赖）
      let curr: HTMLElement | null = timezoneSpan as HTMLElement | null
      while (curr && curr.parentElement) {
        if (curr.parentElement.querySelector('select, input[type="date"], input[type="time"]')) {
          timezoneSection = curr
          break
        }
        if (curr.parentElement === scheduleModal) {
          timezoneSection = curr
          break
        }
        curr = curr.parentElement
      }
      if (!timezoneSection) {
        timezoneSection = (timezoneSpan.parentElement?.parentElement || timezoneSpan.parentElement) as HTMLElement | null
      }
    } else {
      // 极端兜底：若未匹配到时区文本，定位到最后一个表单选择控件所在的小节区块之后
      const lastInput = scheduleModal.querySelector('select:last-of-type, input[type="time"]')
      let curr: HTMLElement | null = lastInput as HTMLElement | null
      while (curr && curr.parentElement) {
        if (curr.parentElement.children.length > 1 && curr.parentElement.querySelector('select, input')) {
          timezoneSection = curr
          break
        }
        curr = curr.parentElement
      }
    }

    if (!timezoneSection) return

    let overviewContainer = scheduleModal.querySelector('.xf-schedule-picker-overview') as HTMLElement | null
    if (!overviewContainer) {
      overviewContainer = document.createElement('div')
      overviewContainer.className = 'xf-schedule-picker-overview'
      timezoneSection.insertAdjacentElement('afterend', overviewContainer)
    }

    // 绑定事件监听与双重调度（事件捕获委托模式，避免内部元素重绘导致监听丢失）
    if (!(scheduleModal as any).__xf_schedule_listeners_installed) {
      ;(scheduleModal as any).__xf_schedule_listeners_installed = true

      const triggerRefresh = () => {
        const container = scheduleModal.querySelector('.xf-schedule-picker-overview') as HTMLElement | null
        if (container) {
          void renderSchedulePickerOverview(scheduleModal, container)
        }
      }

      const handleModalChange = () => {
        triggerRefresh()
        setTimeout(triggerRefresh, 50)
        setTimeout(triggerRefresh, 250)
      }

      scheduleModal.addEventListener('change', handleModalChange, true)
      scheduleModal.addEventListener('input', handleModalChange, true)

      let mutationDebounceTimer: any = null
      const observer = new MutationObserver((mutations) => {
        let hasRelevantChange = false
        for (const mut of mutations) {
          const target = mut.target as HTMLElement | null
          if (target?.closest?.('.xf-schedule-picker-overview, .xf-modal-header-right-badge')) {
            continue
          }
          hasRelevantChange = true
          break
        }
        if (hasRelevantChange) {
          if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer)
          mutationDebounceTimer = setTimeout(triggerRefresh, 40)
        }
      })

      observer.observe(scheduleModal, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }

    await renderSchedulePickerOverview(scheduleModal, overviewContainer)
  } catch {}
}

export interface ScheduleOverviewOptions {
  pickedDate?: Date | null
  showGotoBtn?: boolean
  showToggleSwitch?: boolean
  isCollapsed?: boolean
  maxHeight?: string
  minHeight?: string
  isDrawer?: boolean
  showWarningNotice?: boolean
}

export function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * 统一构建“排期全景”看板内容 HTML
 */
export function buildScheduleOverviewHtml(
  items: PersistedScheduledItem[],
  options: ScheduleOverviewOptions = {}
): string {
  const {
    pickedDate = null,
    showGotoBtn = true,
    showToggleSwitch = false,
    isCollapsed = false,
    maxHeight,
    minHeight,
    isDrawer = false,
    showWarningNotice = false,
  } = options

  const now = new Date()

  // 暗黑模式检测与文本色彩自适应（兼容纯黑 Lights Out 与暗蓝 Dim）
  const isDark =
    typeof document !== 'undefined' &&
    (document.body?.style?.backgroundColor?.includes('rgb(0, 0, 0)') ||
      document.body?.style?.backgroundColor?.includes('rgb(21, 32, 43)') ||
      (!document.body?.style?.backgroundColor?.includes('rgb(255, 255, 255)') &&
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)')?.matches))

  const primaryTextColor = isDark ? '#e7e9ea' : '#0f1419'
  const secondaryTextColor = isDark ? '#8b98a5' : '#536471'
  const groupDividerColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(128, 128, 128, 0.25)'

  // 按自然日分组（消除单条内堆叠日期的挤压问题，零 emoji 极简呈现）
  type NodeItem = {
    date: Date
    isNewPicked: boolean
    text?: string
    globalIdx: number
  }

  const nodes: NodeItem[] = items.map((item, idx) => ({
    date: new Date(item.timestamp),
    isNewPicked: false,
    text: item.text,
    globalIdx: idx,
  }))

  if (pickedDate) {
    nodes.push({
      date: pickedDate,
      isNewPicked: true,
      globalIdx: -1,
    })
  }

  nodes.sort((a, b) => a.date.getTime() - b.date.getTime())
  nodes.forEach((n, i) => {
    n.globalIdx = i
  })

  interface DateGroup {
    dateKey: string
    dateLabel: string
    items: NodeItem[]
  }

  const groups: DateGroup[] = []
  nodes.forEach((n) => {
    const key = dayjs(n.date).format('YYYY-MM-DD')
    let g = groups.find((grp) => grp.dateKey === key)
    if (!g) {
      g = {
        dateKey: key,
        dateLabel: formatDateGroupLabel(n.date, now),
        items: [],
      }
      groups.push(g)
    }
    g.items.push(n)
  })

  let timelineItemsHtml = ''

  if (nodes.length === 0) {
    timelineItemsHtml = `
      <div style="text-align: center; padding: 24px 16px; color: #8b98a5;">
        <div style="font-size: 13px; font-weight: 600;">暂无待发排期推文</div>
        <div style="font-size: 11px; margin-top: 4px; opacity: 0.75;">点击“预排期”可新建并安排推文</div>
      </div>
    `
  } else {
    groups.forEach((group, gIdx) => {
      // 跨天间隔计算
      let crossDayGapStr = ''
      if (gIdx > 0) {
        const prevGroup = groups[gIdx - 1]
        const lastNodeOfPrevGroup = prevGroup.items[prevGroup.items.length - 1]
        const firstNodeOfCurrGroup = group.items[0]
        const crossGapMs = firstNodeOfCurrGroup.date.getTime() - lastNodeOfPrevGroup.date.getTime()
        crossDayGapStr = `跨夜 ${formatDurationGap(crossGapMs)}`
      }

      // 日期分组 Header（无 emoji，极简线条，天与天之间留出充足间距）
      timelineItemsHtml += `
        <div class="xf-schedule-group-header" style="display: flex; align-items: center; gap: 8px; margin: ${gIdx === 0 ? '4px 0 8px 0' : '8px 0 4px 0'}; font-size: 12px; font-weight: 700; color: ${secondaryTextColor};">
          <span style="white-space: nowrap;">${group.dateLabel}</span>
          <span style="font-size: 11px; font-weight: 500; opacity: 0.65;">(${group.items.length}条)</span>
          <span style="flex: 1; border-top: 1px dashed ${groupDividerColor};"></span>
          ${crossDayGapStr ? `<span style="font-size: 11px; font-weight: 500; opacity: 0.75; white-space: nowrap;">${crossDayGapStr}</span>` : ''}
        </div>
      `

      // 组内各排期节点
      group.items.forEach((node) => {
        const gIdx = node.globalIdx
        const prevNode = gIdx === 0 ? null : nodes[gIdx - 1]

        // 组内节点间连线与间隔指示
        if (gIdx > 0 && prevNode && dayjs(node.date).isSame(dayjs(prevNode.date), 'day')) {
          const gapMs = Math.max(0, node.date.getTime() - prevNode.date.getTime())
          const isTight = gapMs < 2 * 3600 * 1000
          const gapStr = formatDurationGap(gapMs)
          const lineCol = isTight ? '#f59e0b' : 'rgba(128, 128, 128, 0.28)'

          timelineItemsHtml += `
            <div style="display: flex; align-items: center; margin: 2px 0 2px 65px; font-size: 11px; line-height: 1;">
              <svg width="2" height="14" viewBox="0 0 2 14" style="margin-right: 8px; flex-shrink: 0; display: inline-block;">
                <line x1="1" y1="0" x2="1" y2="14" stroke="${lineCol}" stroke-width="2" stroke-dasharray="2.5 2.5" />
              </svg>
              <span style="color: ${isTight ? '#d97706' : '#8b98a5'}; ${isTight ? 'font-weight: 600;' : 'opacity: 0.8;'} white-space: nowrap;">
                ${isTight ? '过密' : '间隔'} ${gapStr}
              </span>
            </div>
          `
        }

        const isFirst = gIdx === 0
        const gapFromPrevOrNow = isFirst
          ? Math.max(0, node.date.getTime() - now.getTime())
          : Math.max(0, node.date.getTime() - (prevNode?.date.getTime() ?? now.getTime()))
        const theme = getIntervalTheme(isFirst, gapFromPrevOrNow)
        const timeStr = dayjs(node.date).format('HH:mm')
        const fullDateStr = dayjs(node.date).format('YYYY-MM-DD HH:mm')

        if (node.isNewPicked) {
          timelineItemsHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 10px; border-radius: 6px; background: rgba(29, 155, 240, 0.1); border: 1px solid rgba(29, 155, 240, 0.35); min-height: 32px; box-sizing: border-box;">
              <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                <span style="width: 44px; flex-shrink: 0; font-family: monospace, sans-serif; font-size: 13px; font-weight: 700; color: rgb(29, 155, 240); text-align: right;">${timeStr}</span>
                <span style="width: 2px; height: 14px; border-radius: 1px; background: rgb(29, 155, 240); flex-shrink: 0;"></span>
                <span style="font-size: 12px; font-weight: 600; color: rgb(29, 155, 240); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">当前排期</span>
              </div>
              <span style="font-size: 11px; font-family: monospace, sans-serif; color: rgb(29, 155, 240); opacity: 0.7; white-space: nowrap; margin-left: 8px;">${fullDateStr}</span>
            </div>
          `
        } else {
          timelineItemsHtml += `
            <div style="display: flex; align-items: center; gap: 10px; padding: 5px 10px; border-radius: 6px; background: ${theme.bg}; border: 1px solid ${theme.borderColor}33; min-height: 32px; box-sizing: border-box; transition: background 0.15s ease;">
              <span style="width: 44px; flex-shrink: 0; font-family: monospace, sans-serif; font-size: 13px; font-weight: 700; color: ${theme.accentColor}; text-align: right;">${timeStr}</span>
              <span style="width: 2px; height: 14px; border-radius: 1px; background: ${theme.accentColor}; flex-shrink: 0; opacity: 0.6;"></span>
              <span class="xf-schedule-item-text" style="flex: 1; min-width: 0; font-size: 12px; line-height: 1.4; color: ${primaryTextColor}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(node.text || '')}">
                ${escapeHtml(node.text || '(无正文或媒体推文)')}
              </span>
            </div>
          `
        }
      })
    })
  }

  // “预排期”直达链接
  const gotoBtnHtml = showGotoBtn
    ? `
      <a href="/compose/post/unsent/scheduled" class="xf-scheduled-goto-btn" title="直达预排期管理 (https://x.com/compose/post/unsent/scheduled)" style="display: inline-flex !important; align-items: center !important; gap: 3px !important; font-size: 13px !important; font-weight: 500 !important; color: rgb(29, 155, 240) !important; text-decoration: none !important; cursor: pointer !important; margin-left: 2px !important; transition: opacity 0.15s ease !important; user-select: none !important;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
        <span>预排期</span>
      </a>
    `
    : ''

  // “刷新”按钮
  const refreshBtnHtml = `
    <button class="xf-scheduled-refresh-btn" aria-label="刷新排期" title="刷新排期列表并清理已过期推文" style="background: transparent !important; border: none !important; cursor: pointer !important; color: rgb(29, 155, 240) !important; padding: 2px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; transition: transform 0.3s ease, opacity 0.15s ease !important; user-select: none !important; margin-left: 2px !important;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
      </svg>
    </button>
  `

  // “展开 / 收起”切换开关按钮
  const toggleSwitchHtml = showToggleSwitch
    ? `
      <button class="xf-scheduled-toggle-switch" aria-label="${isCollapsed ? '展开排期全景' : '收起排期全景'}" title="${isCollapsed ? '展开排期全景' : '收起排期全景'}" style="display: inline-flex !important; align-items: center !important; gap: 4px !important; padding: 2px 8px !important; border-radius: 9999px !important; font-size: 12px !important; font-weight: 600 !important; color: rgb(29, 155, 240) !important; background: rgba(29, 155, 240, 0.12) !important; border: 1px solid rgba(29, 155, 240, 0.3) !important; cursor: pointer !important; user-select: none !important; transition: all 0.15s ease !important;">
        <span>${isCollapsed ? '展开' : '收起'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          ${isCollapsed
            ? '<path d="M12 16l-6-6 1.41-1.41L12 13.17l4.59-4.58L18 10z"/>'
            : '<path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>'
          }
        </svg>
      </button>
    `
    : ''

  const closeBtnHtml = isDrawer
    ? `
      <button class="xf-scheduled-drawer-close" aria-label="关闭排期全景" style="background: transparent !important; border: none !important; cursor: pointer !important; color: var(--color-text-secondary, #536471) !important; padding: 4px !important; border-radius: 50% !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; margin-left: 8px !important;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.59 12L5 6.41 6.41 5 12 10.59 17.59 5 19 6.41 13.41 12 19 17.59 17.59 19 12 13.41 6.41 19 5 17.59 10.59 12z"/>
        </svg>
      </button>
    `
    : ''

  const warningNoticeHtml = showWarningNotice
    ? '<span style="font-size: 11px; font-weight: 600; color: #d97706; white-space: nowrap;">过密警示 &lt;2h</span>'
    : ''

  return `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${isCollapsed ? '0' : '4px'}; padding-bottom: ${isCollapsed ? '0' : '4px'}; ${isCollapsed ? '' : 'border-bottom: 1px solid rgba(255, 255, 255, 0.12);'}">
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: rgb(29, 155, 240);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 4V3h2v1h6V3h2v1h1.5C19.89 4 21 5.12 21 6.5v12c0 1.38-1.11 2.5-2.5 2.5h-13C4.12 21 3 19.88 3 18.5v-12C3 5.12 4.12 4 5.5 4H7zm0 2H5.5c-.27 0-.5.22-.5.5v12c0 .28.23.5.5.5h13c.28 0 .5-.22.5-.5v-12c0-.28-.22-.5-.5-.5H17v1h-2V6H9v1H7V6z"/>
        </svg>
        <span>排期全景</span>
        ${gotoBtnHtml}
        ${refreshBtnHtml}
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        ${warningNoticeHtml}
        <span style="font-size: 12px; font-weight: 600; color: #8b98a5; background: rgba(255, 255, 255, 0.08); padding: 3px 10px; border-radius: 12px; white-space: nowrap;">
          共 ${items.length}${pickedDate ? ' <span style="color: rgb(29, 155, 240); font-weight: 700; background: rgba(29, 155, 240, 0.18); padding: 1px 6px; border-radius: 8px; margin: 0 2px;">+1</span>' : ''} 条
        </span>
        ${toggleSwitchHtml}
        ${closeBtnHtml}
      </div>
    </div>

    <div class="xf-scheduled-body" style="${isCollapsed ? 'display: none !important;' : ''}">
      <div style="display: flex; flex-direction: column; gap: 4px; padding-bottom: 6px;${maxHeight ? ` max-height: ${maxHeight}; overflow-y: auto; padding-right: 4px;` : ''}${minHeight ? ` min-height: ${minHeight};` : ''}">
        ${timelineItemsHtml}
      </div>
    </div>
  `
}

export function bindScheduleGotoButtons(container: HTMLElement) {
  container.querySelectorAll<HTMLAnchorElement>('.xf-scheduled-goto-btn').forEach((btn) => {
    if ((btn as any).__xf_bound) return
    ;(btn as any).__xf_bound = true
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      window.location.href = 'https://x.com/compose/post/unsent/scheduled'
    })
  })

  container.querySelectorAll<HTMLButtonElement>('.xf-scheduled-refresh-btn').forEach((btn) => {
    if ((btn as any).__xf_bound) return
    ;(btn as any).__xf_bound = true
    btn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      btn.style.transform = 'rotate(360deg)'
      await prunePastScheduledPosts()
      setTimeout(() => {
        btn.style.transform = 'rotate(0deg)'
      }, 350)
    })
  })
}

/**
 * 渲染“安排表”弹窗看板的核心逻辑
 */
async function renderSchedulePickerOverview(modal: HTMLElement, container: HTMLElement) {
  const pickedDate = getPickedTimeFromModal(modal)
  const cachedItems = await getPersistedScheduledPosts()
  const now = new Date()

  // 1. 在弹窗顶部的 “将于 2026年X月X日...发布” 同一行添加/更新两端分散对齐的相对时间 Badge
  const headerSpan = Array.from(modal.querySelectorAll('span, div')).find((el) => {
    return el.children.length === 0 && (el.textContent?.includes('将于') || el.textContent?.includes('Will send on'))
  })

  if (headerSpan && pickedDate) {
    const headerDir = (headerSpan.closest('div[dir="ltr"]') || headerSpan.parentElement) as HTMLElement
    if (headerDir) {
      if (!headerDir.dataset.xfHeaderStyled) {
        headerDir.style.cssText += 'display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; width: 100% !important;'
        headerDir.dataset.xfHeaderStyled = '1'
      }

      if (!headerDir.querySelector('.xf-modal-header-left')) {
        const leftSpan = document.createElement('span')
        leftSpan.className = 'xf-modal-header-left'
        leftSpan.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;'
        while (headerDir.firstChild) {
          leftSpan.appendChild(headerDir.firstChild)
        }
        headerDir.appendChild(leftSpan)
      }

      let rightBadge = headerDir.querySelector('.xf-modal-header-right-badge') as HTMLElement | null
      if (!rightBadge) {
        rightBadge = document.createElement('span')
        rightBadge.className = 'xf-modal-header-right-badge'
        headerDir.appendChild(rightBadge)
      }

      const relStr = formatRelativePublishTime(pickedDate, now)
      rightBadge.style.cssText = `
        display: inline-block !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        color: rgb(29, 155, 240) !important;
        background-color: rgba(29, 155, 240, 0.12) !important;
        border: 1px solid rgba(29, 155, 240, 0.3) !important;
        padding: 2px 8px !important;
        border-radius: 12px !important;
        white-space: nowrap !important;
        margin-left: auto !important;
      `
      rightBadge.textContent = relStr
    }
  }

  container.style.cssText = `
    padding: 10px 12px !important;
    background-color: transparent !important;
    border: 1px solid rgba(29, 155, 240, 0.25) !important;
    border-radius: 12px !important;
    box-sizing: border-box !important;
    width: 100% !important;
  `

  const html = buildScheduleOverviewHtml(cachedItems, {
    pickedDate,
    showGotoBtn: false,
    showWarningNotice: true,
  })

  if (container.dataset.xfOverviewSig === html) return
  container.innerHTML = html
  container.dataset.xfOverviewSig = html
  bindScheduleGotoButtons(container)
}

const SCHEDULED_PANORAMA_STYLES = `
/* 排期看板推文正文文本与分组标题 - 深度暗黑模式适配 */
.xf-schedule-item-text {
  color: #0f1419 !important;
}

body[style*="background-color: rgb(0, 0, 0)"] .xf-schedule-item-text,
body[style*="background-color: rgb(21, 32, 43)"] .xf-schedule-item-text {
  color: #e7e9ea !important;
}

@media (prefers-color-scheme: dark) {
  body:not([style*="background-color: rgb(255, 255, 255)"]) .xf-schedule-item-text {
    color: #e7e9ea !important;
  }
}

.xf-schedule-group-header {
  color: #536471 !important;
}

body[style*="background-color: rgb(0, 0, 0)"] .xf-schedule-group-header,
body[style*="background-color: rgb(21, 32, 43)"] .xf-schedule-group-header {
  color: #8b98a5 !important;
}

@media (prefers-color-scheme: dark) {
  body:not([style*="background-color: rgb(255, 255, 255)"]) .xf-schedule-group-header {
    color: #8b98a5 !important;
  }
}
`
