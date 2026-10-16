import { NAV_ITEMS, type NavIconId, type NavItemConfig } from '../../shared/navItems'
import type { DiscoveredNavItem, NavIcon } from '../../shared/navIcons.types'
import { KeyDiscoveredNavItems } from '../../storage-keys'
import { setStorage } from './storage'

const DEFAULT_VIEW_BOX = '0 0 24 24'

const TEST_ID_TO_NAV: Partial<Record<string, NavIconId>> = {
  AppTabBar_Explore_Link: 'explore',
  AppTabBar_Notifications_Link: 'notifications',
  AppTabBar_DirectMessage_Link: 'messages',
  AppTabBar_Calls_Link: 'calls',
  AppTabBar_Profile_Link: 'profile',
  AppTabBar_More_Menu: 'moreMenu',
  'premium-signup-tab': 'xPremium',
  'premium-hub-tab': 'xPremium',
  AppTabBar_Bookmarks_Link: 'bookmarks',
  AppTabBar_History_Link: 'bookmarks',
}

function readSvgFromLink(link: Element): NavIcon | null {
  const svg = link.querySelector('svg')
  if (!svg) return null

  const innerHTML = svg.innerHTML.trim()
  if (!innerHTML) return null

  return {
    innerHTML,
    viewBox: svg.getAttribute('viewBox') ?? DEFAULT_VIEW_BOX,
  }
}

function matchesSelector(el: Element, selector: string): boolean {
  for (const part of selector.split(',')) {
    try {
      if (el.matches(part.trim())) return true
    } catch {
      // invalid selector fragment — skip
    }
  }
  return false
}

function matchByHref(href: string): NavItemConfig | null {
  if (href.includes('/i/calls')) return findConfig('calls')
  if (href.includes('/i/grok')) return findConfig('grok')
  if (href.includes('/i/bookmarks') || href.includes('/i/history') || href.includes('/history')) return findConfig('bookmarks')
  if (href.includes('/compose/articles')) return findConfig('articles')
  if (href.includes('/topics')) return findConfig('topics')
  if (href.includes('/verified-orgs')) return findConfig('verifiedOrgs')
  if (href.includes('/jobs')) return findConfig('jobs')
  if (href.includes('/communities')) return findConfig('communities')
  if (href.includes('/lists')) return findConfig('lists')
  if (href.includes('premium')) return findConfig('xPremium')
  if (href.includes('creators/studio')) return findConfig('creatorStudio')
  return null
}

function findConfig(id: NavIconId): NavItemConfig | null {
  return NAV_ITEMS.find((item) => item.id === id) ?? null
}

function matchLinkToConfig(link: Element): NavItemConfig | null {
  const testId = link.getAttribute('data-testid')
  if (testId && TEST_ID_TO_NAV[testId]) {
    return findConfig(TEST_ID_TO_NAV[testId]!)
  }

  const href = link.getAttribute('href') ?? ''
  const byHref = matchByHref(href)
  if (byHref) return byHref

  for (const item of NAV_ITEMS) {
    if (matchesSelector(link, item.selector)) return item
  }

  return null
}

function isBadgeNumber(text: string): boolean {
  // 匹配纯数字或带加号/单位的未读数量角标（如 "1", "99+", "999", "1k"）
  return /^\d+[\+kKmM]?$/.test(text.trim())
}

function cleanUnreadFromAriaLabel(aria: string): string {
  let s = aria.trim()
  // 移除如 "Notifications (1 unread)" -> "Notifications"
  s = s.replace(/\s*[(（]\s*\d+[\+kKmM]?\s*(?:条未读|个未读|unread|new|items?)\s*[)）]/i, '')
  // 移除如 "3 unread notifications" -> "notifications"
  s = s.replace(/^\d+[\+kKmM]?\s*(?:unread|new)\s*(?:notifications?|messages?|items?)?/i, '')
  // 移除如 "1 条未读通知" -> "通知", "12条未读" -> ""
  s = s.replace(/^\d+[\+kKmM]?\s*(?:条|个|项|件)?\s*(?:未读|新)?\s*/i, '')
  // 移除如 "Notifications unread" -> "Notifications"
  s = s.replace(/\s*unread\s*$/i, '')
  return s.trim()
}

function getLabelFromLink(link: Element, fallbackId?: NavIconId): string {
  // 1. 结构化定位：X 侧栏链接结构通常为 a > div (外层) > [div: 图标与角标, div: 文字标签]
  // 优先取右侧第二列或最后一列作为文本列，从根源上避开第一列中的未读角标数字
  const directDivs = Array.from(link.querySelectorAll(':scope > div > div + div, :scope > div > div:last-child'))
  for (const col of directDivs) {
    const span = col.querySelector('[dir] span, span')
    const t = span?.textContent?.trim()
    if (t && !isBadgeNumber(t)) {
      return t
    }
  }

  // 2. 遍历所有 span，排除处于角标容器中的元素以及纯数字角标
  const allSpans = Array.from(link.querySelectorAll('span'))
  for (const span of allSpans) {
    if (span.closest('svg + div, [aria-label*="未读"], [aria-label*="unread"], [data-testid*="badge"]')) {
      continue
    }
    const t = span.textContent?.trim()
    if (t && !isBadgeNumber(t)) {
      return t
    }
  }

  // 3. 降级：从 aria-label 中提取并过滤未读数字
  const ariaLabel = link.getAttribute('aria-label')?.trim()
  if (ariaLabel && !isBadgeNumber(ariaLabel)) {
    const cleaned = cleanUnreadFromAriaLabel(ariaLabel)
    if (cleaned && !isBadgeNumber(cleaned)) {
      return cleaned
    }
  }

  // 4. 终极兜底：当页面只有角标数字（如极小屏幕模式）时，回退至内置的导航中文/英文名称
  if (fallbackId) {
    const config = NAV_ITEMS.find((item) => item.id === fallbackId)
    if (config?.label) return config.label
  }

  return 'Nav'
}

function findSideNav(): Element | null {
  const homeLink = document.querySelector('[data-testid="AppTabBar_Home_Link"]')
  const navFromHome = homeLink?.closest('nav[role="navigation"]')
  if (navFromHome) return navFromHome

  return (
    document.querySelector('header[role="banner"] nav[role="navigation"]') ??
    document.querySelector('nav[role="navigation"]')
  )
}

function collectNavLinks(nav: Element): Element[] {
  const direct = [...nav.children].filter((el) => el.matches('a, button'))
  if (direct.length > 0) return direct

  const selector =
    'a, button, a[data-testid^="AppTabBar_"], button[data-testid^="AppTabBar_"], a[data-testid="premium-signup-tab"], a[data-testid="premium-hub-tab"], a[href*="/i/grok"], a[href*="/i/calls"], a[href*="creators/studio"], a[href*="/i/history"], a[href*="/i/bookmarks"], a[href*="/history"]'
  const results: Element[] = []
  const seen = new Set<Element>()

  for (const link of nav.querySelectorAll(selector)) {
    const parentLink = link.parentElement?.closest('a, button')
    if (parentLink && parentLink !== link) continue
    if (seen.has(link)) continue
    seen.add(link)
    results.push(link)
  }

  return results
}

/** Scan live nav in DOM order; only return items that exist on the page. */
export function extractNavItems(): DiscoveredNavItem[] {
  const nav = findSideNav()
  if (!nav) return []

  const items: DiscoveredNavItem[] = []
  const seenIds = new Set<NavIconId>()

  for (const link of collectNavLinks(nav)) {
    const icon = readSvgFromLink(link)
    if (!icon) continue

    const config = matchLinkToConfig(link)
    if (!config || seenIds.has(config.id)) continue

    seenIds.add(config.id)
    items.push({
      id: config.id,
      storageKey: config.storageKey,
      label: getLabelFromLink(link, config.id),
      icon,
      href: link.getAttribute('href') || undefined,
    })
  }

  return items
}

export function getNavIconSvg(id: NavIconId): string | undefined {
  return extractNavItems().find((item) => item.id === id)?.icon.innerHTML
}

let lastSyncedNavSignature: string | null = null

/**
 * 空闲时静默将页面最新探测到的有效导航项推送到 storage 缓存（Push 模式）
 * 彻底纯粹的所见即所得：页面实际探测到什么就如实同步什么（未登录或无导航项时如实同步空数组）
 */
export async function syncNavItemsToStorage(): Promise<boolean> {
  try {
    const items = extractNavItems()
    const signature = items.map((i) => `${i.id}:${i.label}:${i.href ?? ''}`).join('|')
    if (signature === lastSyncedNavSignature) return false
    lastSyncedNavSignature = signature

    await setStorage({ [KeyDiscoveredNavItems]: items })
    return true
  } catch {
    return false
  }
}
