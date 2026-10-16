import { onMounted, ref } from 'vue'
import type { DiscoveredNavItem } from '../../../shared/navIcons.types'
import { NAV_ITEMS } from '../../../shared/navItems'
import { KeyDiscoveredNavItems } from '../../../storage-keys'
import { getStorage } from '../../../content-scripts/utilities/storage'

export interface PopupNavItem {
  id: string
  storageKey: string
  label: string
  viewBox: string
  innerHTML: string
}

const LOCAL_STORAGE_NAV_CACHE_KEY = 'xf_cached_nav_items'

/**
 * 将从页面探测到的原始数据格式化为 Popup 图标所需结构
 * 100% 遵照真实 DOM 树自然物理顺序与项数量，完全纯动态，杜绝任何硬编码静态项
 */
export function formatDiscoveredNavItems(discovered: DiscoveredNavItem[]): PopupNavItem[] {
  if (!Array.isArray(discovered) || discovered.length === 0) {
    return []
  }

  const result: PopupNavItem[] = []
  const seenIds = new Set<string>()

  for (const item of discovered) {
    if (!item.id || !item.storageKey || seenIds.has(item.id)) continue

    const isLiveLabelValid = item.label && !/^\d+[\+kKmM]?$/.test(item.label.trim())
    const defaultLabel = NAV_ITEMS.find((n) => n.id === item.id)?.label || 'Nav'

    result.push({
      id: item.id,
      storageKey: item.storageKey,
      label: isLiveLabelValid ? item.label : defaultLabel,
      viewBox: item.icon?.viewBox || '0 0 24 24',
      innerHTML: item.icon?.innerHTML || '',
    })
    seenIds.add(item.id)
  }

  return result
}

function getInitialNavItems(): PopupNavItem[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(LOCAL_STORAGE_NAV_CACHE_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 过滤已下线的创作者工作室
        const cleaned = parsed.filter((item) => item?.id && item.id !== 'creatorStudio')
        return cleaned.map((item) => {
          if (item && /^\d+[\+kKmM]?$/.test(String(item.label || '').trim())) {
            const fallback = NAV_ITEMS.find((s) => s.id === item.id)?.label
            return { ...item, label: fallback || item.label }
          }
          return item
        })
      }
    }
  } catch {}
  return []
}

/**
 * 纯动态 0ms 秒开的 SWR 导航项数据流：
 * 1. 同步初始值：从 localStorage 获取上一次真实探测缓存，瞬时渲染，不卡顿
 * 2. 异步实时更新：从 chrome.storage.local 读取 Content Script 最新探测项，自动更新并持久化
 */
export function useNavIcons() {
  const navItems = ref<PopupNavItem[]>(getInitialNavItems())

  onMounted(async () => {
    try {
      const discovered = (await getStorage(KeyDiscoveredNavItems)) as DiscoveredNavItem[] | undefined
      if (Array.isArray(discovered)) {
        const formatted = formatDiscoveredNavItems(discovered)
        const currentSig = navItems.value.map((i) => `${i.id}:${i.label}`).join('|')
        const newSig = formatted.map((i) => `${i.id}:${i.label}`).join('|')
        if (currentSig !== newSig) {
          navItems.value = formatted
          try {
            window.localStorage?.setItem(LOCAL_STORAGE_NAV_CACHE_KEY, JSON.stringify(formatted))
          } catch {}
        }
      }
    } catch {}
  })

  return { navItems }
}
