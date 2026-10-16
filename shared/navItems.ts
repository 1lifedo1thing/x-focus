import {
  KeyArticlesButton,
  KeyBookmarksButton,
  KeyCallsButton,
  KeyCommunitiesButton,
  KeyExploreButton,
  KeyGrokButton,
  KeyHomeButton,
  KeyJobsButton,
  KeyListsButton,
  KeyMessagesButton,
  KeyNotificationsButton,
  KeyCreatorStudioButton,
  KeyMoreMenuButton,
  KeyProfileButton,
  KeyTopicsButton,
  KeyVerifiedOrgsButton,
  KeyXPremiumButton,
} from '../storage-keys'

export type NavIconId =
  | 'home'
  | 'explore'
  | 'notifications'
  | 'messages'
  | 'calls'
  | 'grok'
  | 'xPremium'
  | 'lists'
  | 'bookmarks'
  | 'jobs'
  | 'communities'
  | 'articles'
  | 'topics'
  | 'verifiedOrgs'
  | 'profile'
  | 'creatorStudio'
  | 'moreMenu'

export interface NavItemConfig {
  id: NavIconId
  storageKey: string
  label: string
  selector: string
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'explore', storageKey: KeyExploreButton, label: '探索', selector: '[data-testid="AppTabBar_Explore_Link"]' },
  { id: 'notifications', storageKey: KeyNotificationsButton, label: '通知', selector: '[data-testid="AppTabBar_Notifications_Link"]' },
  { id: 'messages', storageKey: KeyMessagesButton, label: '聊天', selector: '[data-testid="AppTabBar_DirectMessage_Link"]' },
  { id: 'calls', storageKey: KeyCallsButton, label: '呼叫', selector: '[data-testid="AppTabBar_Calls_Link"], a[href*="/i/calls"]' },
  { id: 'grok', storageKey: KeyGrokButton, label: 'Grok', selector: 'a[href*="/i/grok"]' },
  { id: 'xPremium', storageKey: KeyXPremiumButton, label: 'Premium', selector: '[data-testid="premium-hub-tab"], [data-testid="premium-signup-tab"], a[href*="premium"]' },
  { id: 'lists', storageKey: KeyListsButton, label: '列表', selector: 'a[href*="/lists"][aria-label]' },
  { id: 'bookmarks', storageKey: KeyBookmarksButton, label: '历史', selector: 'a[href*="/i/bookmarks"], a[href*="/i/history"], a[href*="/history"]' },
  { id: 'jobs', storageKey: KeyJobsButton, label: '工作', selector: 'a[href*="/jobs"]' },
  { id: 'communities', storageKey: KeyCommunitiesButton, label: '社群', selector: 'a[href*="/communities"][aria-label]' },
  { id: 'articles', storageKey: KeyArticlesButton, label: '文章', selector: 'a[href="/compose/articles"]' },
  { id: 'topics', storageKey: KeyTopicsButton, label: '话题', selector: 'a[href*="/topics"]' },
  { id: 'verifiedOrgs', storageKey: KeyVerifiedOrgsButton, label: '认证组织', selector: 'a[href*="verified-orgs"]' },
  { id: 'profile', storageKey: KeyProfileButton, label: '个人资料', selector: '[data-testid="AppTabBar_Profile_Link"]' },
  { id: 'moreMenu', storageKey: KeyMoreMenuButton, label: '更多', selector: '[data-testid="AppTabBar_More_Menu"]' },
]
