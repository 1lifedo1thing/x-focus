export interface LanguageInfo {
  isForeign: boolean
  detectedLang: string
}

/**
 * 判断某个 DOM 节点是否位于推文内部的「引用推文卡片（Quote Tweet）」中
 */
export function isInsideQuotedTweet(el: Element, article: HTMLElement): boolean {
  let curr: Element | null = el
  while (curr && curr !== article) {
    // 1. 引用推文特定 testid
    if (curr.getAttribute('data-testid') === 'quoteTweet') {
      return true
    }
    // 2. 引用推文卡片容器在 X 中通常是带有 role="link" 的非 <a> 元素 (如 div[tabindex="0"][role="link"])
    if (curr.getAttribute('role') === 'link' && curr.tagName.toLowerCase() !== 'a') {
      return true
    }
    // 3. 引用推文的外层无障碍标签
    const ariaLabel = curr.getAttribute('aria-label')?.toLowerCase() || ''
    if (ariaLabel.includes('引用') || ariaLabel.includes('quote')) {
      return true
    }
    curr = curr.parentElement
  }

  // 4. 辅助检查：如果 article 包含多个 [data-testid="tweetText"]，检查 el 是否属于引用推文的 DOM 子树
  const allTweetTexts = Array.from(article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
  if (allTweetTexts.length > 1) {
    const mainTextEl = allTweetTexts[0]
    for (let i = 1; i < allTweetTexts.length; i++) {
      const quoteTextEl = allTweetTexts[i]
      if (quoteTextEl.contains(el)) return true
      let p = quoteTextEl.parentElement
      while (p && p !== article) {
        if (p.contains(el) && !p.contains(mainTextEl)) return true
        p = p.parentElement
      }
    }
  }

  return false
}

const KNOWN_LANG_MAP: Record<string, string> = {
  // 英语
  english: '英语',
  en: '英语',
  eng: '英语',
  英文: '英语',
  英語: '英语',
  anglais: '英语',
  inglés: '英语',
  ingles: '英语',

  // 日语
  japanese: '日语',
  ja: '日语',
  jp: '日语',
  日文: '日语',
  日本語: '日语',
  japonais: '日语',
  japonés: '日语',
  japones: '日语',

  // 韩语
  korean: '韩语',
  ko: '韩语',
  kor: '韩语',
  韩文: '韩语',
  韓國語: '韩语',
  한국어: '韩语',
  coréen: '韩语',
  coreano: '韩语',

  // 越南语
  vietnamese: '越南语',
  vi: '越南语',
  vie: '越南语',
  越南文: '越南语',
  'tiếng việt': '越南语',
  vietnamien: '越南语',
  vietnamita: '越南语',

  // 法语
  french: '法语',
  fr: '法语',
  fra: '法语',
  法文: '法语',
  français: '法语',
  francais: '法语',
  francés: '法语',
  frances: '法语',

  // 西班牙语
  spanish: '西班牙语',
  es: '西班牙语',
  spa: '西班牙语',
  西班牙文: '西班牙语',
  español: '西班牙语',
  espanol: '西班牙语',
  espagnol: '西班牙语',

  // 德语
  german: '德语',
  de: '德语',
  deu: '德语',
  ger: '德语',
  德文: '德语',
  deutsch: '德语',
  allemand: '德语',
  alemán: '德语',
  aleman: '德语',

  // 俄语
  russian: '俄语',
  ru: '俄语',
  rus: '俄语',
  俄文: '俄语',
  русский: '俄语',
  russe: '俄语',
  ruso: '俄语',

  // 阿拉伯语
  arabic: '阿拉伯语',
  ar: '阿拉伯语',
  ara: '阿拉伯语',
  阿拉伯文: '阿拉伯语',
  'العربية': '阿拉伯语',
  arabe: '阿拉伯语',
  árabe: '阿拉伯语',

  // 泰语
  thai: '泰语',
  th: '泰语',
  tha: '泰语',
  泰文: '泰语',
  'ไทย': '泰语',
  thaï: '泰语',
  tailandés: '泰语',

  // 印尼语
  indonesian: '印尼语',
  id: '印尼语',
  ind: '印尼语',
  印尼文: '印尼语',
  'bahasa indonesia': '印尼语',
  indonésien: '印尼语',

  // 葡萄牙语
  portuguese: '葡萄牙语',
  pt: '葡萄牙语',
  por: '葡萄牙语',
  葡萄牙文: '葡萄牙语',
  português: '葡萄牙语',
  portugais: '葡萄牙语',
  portugués: '葡萄牙语',

  // 意大利语
  italian: '意大利语',
  it: '意大利语',
  ita: '意大利语',
  意大利文: '意大利语',
  italiano: '意大利语',
  italien: '意大利语',

  // 中文
  chinese: '中文',
  zh: '中文',
  中文: '中文',
  华语: '中文',
  國語: '中文',
  chinois: '中文',
  chino: '中文',
}

export function normalizeLanguageName(raw: string): string {
  const clean = raw.trim().toLowerCase()
  if (KNOWN_LANG_MAP[clean]) {
    return KNOWN_LANG_MAP[clean]
  }

  // 尝试使用 Intl.DisplayNames 将语言代码转为中文名
  try {
    const displayNames = new Intl.DisplayNames(['zh-CN'], { type: 'language' })
    const name = displayNames.of(clean)
    if (name && name !== clean) {
      return name
    }
  } catch {}

  // 若自身已是中文（如“英语”、“乌克兰语”），直接返回
  if (/^[\u4e00-\u9fa5]+$/.test(raw.trim())) {
    return raw.trim()
  }

  return raw.trim() || '外语'
}

const TRANSLATION_PATTERNS = [
  /^翻译自\s*(.+)$/i,
  /^翻譯自\s*(.+)$/i,
  /^Translated from\s*(.+)$/i,
  /^Traduire (?:de|depuis)\s*(.+)$/i,
  /^Traducido del?\s*(.+)$/i,
  /^(.+?)からの翻訳$/i,
]

/**
 * 自动识别推文的语言种类（中文 vs 外语）
 * 
 * 关键规则：
 * 1. 仅针对主推文进行识别，严格排除引用推文（Quote Tweet）内部的翻译标签与语言属性。
 * 2. 若主推文被 Twitter 翻译（带有「翻译自 xxx」），优先取翻译前的原始语种，以实现双语生成。
 * 3. 若无翻译标签，检查主推文的 lang 属性，并结合文本特征（汉字/假名/谚文/越语/拉丁字母）校验。
 */
export function detectTweetLanguage(article: HTMLElement | null, text: string): LanguageInfo {
  // 1. 检查主推文是否存在 "翻译自 xxx" / "Translated from xxx" 节点（排除引用推文）
  if (article) {
    const spans = Array.from(article.querySelectorAll('span'))
    for (const span of spans) {
      if (isInsideQuotedTweet(span, article)) continue

      const content = span.textContent?.trim() || ''
      for (const pattern of TRANSLATION_PATTERNS) {
        const match = content.match(pattern)
        if (match && match[1]) {
          const langName = normalizeLanguageName(match[1])
          if (langName === '中文') {
            return { isForeign: false, detectedLang: '中文' }
          }
          return { isForeign: true, detectedLang: langName }
        }
      }
    }
  }

  // 2. 检查主推文正文 DOM 的 lang 属性（排除引用推文中的 tweetText）
  if (article) {
    const allTweetTexts = Array.from(article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    const mainTweetTextEl =
      allTweetTexts.find((el) => !isInsideQuotedTweet(el, article)) ||
      article.querySelector<HTMLElement>('[data-testid="twitter-article-title"]') ||
      allTweetTexts[0]

    const langAttr = mainTweetTextEl?.getAttribute('lang')?.toLowerCase() || ''
    if (langAttr) {
      if (langAttr.startsWith('zh')) {
        return { isForeign: false, detectedLang: '中文' }
      }

      // 避免 Twitter 偶尔将中文误标为 en 等语种：检查中文字符
      const hanMatches = text.match(/[\u4e00-\u9fa5]/g)
      const hanCount = hanMatches ? hanMatches.length : 0
      const hasKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(text)
      if (hanCount >= 5 && !hasKana) {
        return { isForeign: false, detectedLang: '中文' }
      }

      const langName = normalizeLanguageName(langAttr.split('-')[0])
      if (langName === '中文') {
        return { isForeign: false, detectedLang: '中文' }
      }
      return { isForeign: true, detectedLang: langName }
    }
  }

  // 3. 基于文本特征的启发式语种识别
  const trimmedText = text.trim()
  if (trimmedText) {
    // 日语假名（平假名/片假名）
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(trimmedText)) {
      return { isForeign: true, detectedLang: '日语' }
    }
    // 韩语谚文
    if (/[\uac00-\ud7af]/.test(trimmedText)) {
      return { isForeign: true, detectedLang: '韩语' }
    }
    // 阿拉伯语
    if (/[\u0600-\u06ff]/.test(trimmedText)) {
      return { isForeign: true, detectedLang: '阿拉伯语' }
    }
    // 俄语西里尔字母
    if (/[\u0400-\u04ff]/.test(trimmedText)) {
      return { isForeign: true, detectedLang: '俄语' }
    }
    // 泰语
    if (/[\u0e00-\u0e7f]/.test(trimmedText)) {
      return { isForeign: true, detectedLang: '泰语' }
    }
    // 越南语特有声调与字母
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(trimmedText)) {
      return { isForeign: true, detectedLang: '越南语' }
    }
    // 汉字字符
    const hanChars = trimmedText.match(/[\u4e00-\u9fa5]/g)
    if (hanChars && hanChars.length >= 2) {
      return { isForeign: false, detectedLang: '中文' }
    }
    // 纯英文/拉丁字母为主（Latin 字母数量 >= 8 且无汉字）
    const latinChars = trimmedText.match(/[a-zA-Z]/g)
    if (latinChars && latinChars.length >= 8 && (!hanChars || hanChars.length === 0)) {
      return { isForeign: true, detectedLang: '英语' }
    }
  }

  // 4. 默认回退为中文
  return { isForeign: false, detectedLang: '中文' }
}
