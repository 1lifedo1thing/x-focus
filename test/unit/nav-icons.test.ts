import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { extractNavItems, getNavIconSvg, syncNavItemsToStorage } from '../../content-scripts/utilities/navIcons'
import { formatDiscoveredNavItems } from '../../entrypoints/popup/composables/useNavIcons'
import { allSettingsKeys, KeyDiscoveredNavItems } from '../../storage-keys'

describe('extractNavItems', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://x.com/home',
    })
    globalThis.document = dom.window.document
    // @ts-expect-error jsdom window 类型兼容
    globalThis.window = dom.window
  })

  afterEach(() => {
    dom.window.close()
  })

  it('omits home nav item and extracts history (/i/history) as bookmarks', () => {
    document.body.innerHTML = `
      <header role="banner">
        <nav role="navigation">
          <a data-testid="AppTabBar_Home_Link" href="/home">
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <div><div></div><div><span>主页</span></div></div>
          </a>
          <a data-testid="AppTabBar_Explore_Link" href="/explore">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10"/></svg>
            <div><div></div><div><span>探索</span></div></div>
          </a>
          <a data-testid="AppTabBar_Notifications_Link" href="/notifications">
            <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z"/></svg>
            <div><div></div><div><span>通知</span></div></div>
          </a>
          <a data-testid="AppTabBar_DirectMessage_Link" href="/messages">
            <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18"/></svg>
            <div><div></div><div><span>聊天</span></div></div>
          </a>
          <a data-testid="AppTabBar_Calls_Link" href="/i/calls" role="link">
            <svg viewBox="0 0 24 24"><path d="M3 6.42383C3.00022 4.533 4.533 3.00022 6.42383 3"/></svg>
            <div><div></div><div><span>呼叫</span></div></div>
          </a>
          <a href="/i/grok" role="link">
            <svg viewBox="0 0 24 24"><path d="M5 3v18l7-3 7 3V3z"/></svg>
            <div><div></div><div><span>Grok</span></div></div>
          </a>
          <a data-testid="premium-signup-tab" href="/i/premium_sign_up">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12"/></svg>
            <div><div></div><div><span>Premium</span></div></div>
          </a>
          <a href="/i/history" role="link">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <div><div></div><div><span>历史</span></div></div>
          </a>
          <a href="/compose/articles" role="link">
            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14"/></svg>
            <div><div></div><div><span>文章</span></div></div>
          </a>
          <a data-testid="AppTabBar_Profile_Link" href="/user">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4"/></svg>
            <div><div></div><div><span>个人资料</span></div></div>
          </a>
          <button data-testid="AppTabBar_More_Menu" role="button">
            <svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2"/></svg>
            <div><div></div><div><span>更多</span></div></div>
          </button>
        </nav>
      </header>
    `

    const items = extractNavItems()
    expect(items.map((i) => i.id)).toEqual([
      'explore',
      'notifications',
      'messages',
      'calls',
      'grok',
      'xPremium',
      'bookmarks',
      'articles',
      'profile',
      'moreMenu',
    ])
    expect(items.length).toBe(10)

    const callsItem = items.find((i) => i.id === 'calls')!
    expect(callsItem.label).toBe('呼叫')

    const historyItem = items.find((i) => i.id === 'bookmarks')!
    expect(historyItem.label).toBe('历史')
    expect(historyItem.icon.innerHTML).toContain('M19 21l-7-5-7 5V5')
  })

  it('also matches traditional /i/bookmarks path', () => {
    document.body.innerHTML = `
      <header role="banner">
        <nav role="navigation">
          <a href="/i/bookmarks" role="link">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5"/></svg>
            <div><div></div><div><span>书签</span></div></div>
          </a>
        </nav>
      </header>
    `

    const items = extractNavItems()
    expect(items.map((i) => i.id)).toEqual(['bookmarks'])
    expect(items[0].label).toBe('书签')
  })

  it('returns SVG via getNavIconSvg', () => {
    document.body.innerHTML = `
      <nav role="navigation">
        <a data-testid="AppTabBar_Home_Link" href="/home">
          <svg><path d="M10 20"/></svg>
        </a>
        <a data-testid="AppTabBar_Explore_Link" href="/explore">
          <svg><path d="M12 2"/></svg>
        </a>
      </nav>
    `
    expect(getNavIconSvg('explore')).toBe('<path d="M12 2"></path>')
    expect(getNavIconSvg('home' as any)).toBeUndefined()
  })

  it('extracts premium-hub-tab (/i/premium) as xPremium with localized label', () => {
    document.body.innerHTML = `
      <header role="banner">
        <nav role="navigation">
          <a data-testid="premium-hub-tab" href="/i/premium">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6"/></svg>
            <div><div></div><div><span>订阅</span></div></div>
          </a>
        </nav>
      </header>
    `

    const items = extractNavItems()
    expect(items.map((i) => i.id)).toEqual(['xPremium'])
    expect(items[0].label).toBe('订阅')
  })

  it('带未读角标数字（如 1 条未读）的通知按钮，必须精准提取真实名称“通知”，绝不能提取成数字“1”', () => {
    document.body.innerHTML = `
      <header role="banner">
        <nav role="navigation">
          <a data-testid="AppTabBar_Notifications_Link" href="/notifications" role="link" aria-label="1 条未读通知">
            <div>
              <div class="icon-col">
                <svg viewBox="0 0 24 24"><path d="M12 22"/></svg>
                <div aria-label="1 条未读通知">
                  <div dir="ltr"><span>1</span></div>
                </div>
              </div>
              <div class="label-col">
                <div dir="ltr"><span>通知</span></div>
              </div>
            </div>
          </a>
        </nav>
      </header>
    `

    const items = extractNavItems()
    expect(items.length).toBe(1)
    expect(items[0].id).toBe('notifications')
    expect(items[0].label).toBe('通知')
  })

  it('formatDiscoveredNavItems 会防御性清洗历史脏缓存中的纯数字角标并回退到真实名称', () => {
    const dirtyDiscovered = [
      {
        id: 'notifications' as const,
        storageKey: 'notificationsButton',
        label: '1', // 模拟此前被误写入的角标数字
        icon: { innerHTML: '<path d="M12 22"/>', viewBox: '0 0 24 24' },
      },
    ]

    const formatted = formatDiscoveredNavItems(dirtyDiscovered)
    const notif = formatted.find((i) => i.id === 'notifications')
    expect(notif?.label).toBe('通知')
  })
})

describe('changeXPremiumButton', () => {
  it('纯 CSS 优雅控制原生 Premium 按钮显隐，不注入任何假 DOM 节点', async () => {
    const { changeXPremiumButton } = await import('../../content-scripts/options/navigation')
    document.body.innerHTML = `
      <header role="banner">
        <nav role="navigation">
          <a data-testid="premium-hub-tab" href="/i/premium" aria-label="订阅">
            <span>订阅</span>
          </a>
          <a data-testid="AppTabBar_Profile_Link" href="/user">
            <span>个人资料</span>
          </a>
        </nav>
      </header>
    `

    // 测试开启状态
    changeXPremiumButton('on')
    expect(document.querySelector('.xf-sidebar-button')).toBeNull()
    expect(document.querySelectorAll('a[href*="premium"]').length).toBe(1)

    // 测试关闭状态
    changeXPremiumButton('off')
    const hideStyle = document.getElementById('xf-style-xPremium')
    expect(hideStyle).not.toBeNull()
    expect(hideStyle?.textContent).toContain('display: none')
    expect(document.querySelector('.xf-sidebar-button')).toBeNull()
  })
})

describe('syncNavItemsToStorage (后台静默推送缓存)', () => {
  it('提取有效导航项并存入 KeyDiscoveredNavItems，且具有签名去重能力', async () => {
    const memoryStore: Record<string, unknown> = {}
    ;(globalThis as any).browser = {
      storage: {
        local: {
          get: async () => memoryStore,
          set: async (obj: Record<string, unknown>) => Object.assign(memoryStore, obj),
        },
      },
    }

    document.body.innerHTML = `
      <header role="banner">
        <nav role="navigation">
          <a data-testid="premium-hub-tab" href="/i/premium">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6"/></svg>
            <div><div></div><div><span>订阅</span></div></div>
          </a>
          <a data-testid="AppTabBar_DirectMessage_Link" href="/messages">
            <svg viewBox="0 0 24 24"><path d="M20 4H4"/></svg>
            <div><div></div><div><span>聊天</span></div></div>
          </a>
        </nav>
      </header>
    `

    const synced = await syncNavItemsToStorage()
    expect(synced).toBe(true)
    const cached = memoryStore[KeyDiscoveredNavItems] as any[]
    expect(cached).toBeDefined()
    expect(cached.length).toBe(2)
    expect(cached[0].id).toBe('xPremium')
    expect(cached[0].label).toBe('订阅')
    expect(cached[0].href).toBe('/i/premium')

    // 重复执行时签名未变，跳过重复写入
    const secondSync = await syncNavItemsToStorage()
    expect(secondSync).toBe(false)
  })

  it('页面无导航项时（如未登录），如实同步空数组实现完全所见即所得', async () => {
    const memoryStore: Record<string, unknown> = {
      [KeyDiscoveredNavItems]: [{ id: 'oldItem' }],
    }
    ;(globalThis as any).browser = {
      storage: {
        local: {
          get: async () => memoryStore,
          set: async (obj: Record<string, unknown>) => Object.assign(memoryStore, obj),
        },
      },
    }

    document.body.innerHTML = `
      <header role="banner">
        <nav role="navigation"></nav>
      </header>
    `

    const synced = await syncNavItemsToStorage()
    expect(synced).toBe(true)
    expect(memoryStore[KeyDiscoveredNavItems]).toEqual([])
  })
})

describe('formatDiscoveredNavItems (纯动态格式化与顺序保障)', () => {
  it('正确将页面嗅探到的真实标签、viewBox 与 SVG 转换为 Popup 所需项', () => {
    const discovered = [
      {
        id: 'xPremium' as const,
        storageKey: 'xPremiumButton',
        label: '订阅 (会员特权)',
        icon: {
          innerHTML: '<path d="M-new-svg-icon" />',
          viewBox: '0 0 32 32',
        },
        href: '/i/premium',
      },
    ]

    const formatted = formatDiscoveredNavItems(discovered)
    expect(formatted.length).toBe(1)
    expect(formatted[0].id).toBe('xPremium')
    expect(formatted[0].label).toBe('订阅 (会员特权)')
    expect(formatted[0].innerHTML).toBe('<path d="M-new-svg-icon" />')
    expect(formatted[0].viewBox).toBe('0 0 32 32')
  })

  it('严格 100% 遵循页面探测到的 Live DOM 自然物理顺序与项目数量', () => {
    // 模拟真实页面 DOM 顺序：聊天 -> 呼叫 -> Grok
    const customDiscovered = [
      { id: 'messages', storageKey: 'messagesButton', label: '聊天' },
      { id: 'calls', storageKey: 'callsButton', label: '呼叫' },
      { id: 'grok', storageKey: 'grokButton', label: 'Grok' },
    ] as any

    const formatted = formatDiscoveredNavItems(customDiscovered)
    expect(formatted.length).toBe(3)
    expect(formatted.map((i) => i.id)).toEqual(['messages', 'calls', 'grok'])
  })

  it('空探测数据时安全返回空数组，触发空状态占位提示', () => {
    expect(formatDiscoveredNavItems([])).toEqual([])
  })
})
