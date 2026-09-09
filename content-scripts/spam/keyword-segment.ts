export interface SegmentInfo {
  text: string
  /** 该段是否适合作为关键词（过滤掉 URL/@/纯 emoji/纯标点） */
  useful: boolean
}

export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s) || /^t\.co\//i.test(s) || /^www\./i.test(s)
}

export function isHandle(s: string): boolean {
  return /^@\w{1,15}$/.test(s)
}

export function isPureEmoji(s: string): boolean {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu
  const emojiCount = (s.match(emojiRegex) || []).length
  if (emojiCount === 0) return false
  const stripped = s
    .replace(emojiRegex, '')
    .replace(/[\s\u200C\u200D\u2060\uFEFF]/g, '')
  return stripped.length === 0
}

export function isPurePunct(s: string): boolean {
  return /^[，。！？、；：""''（）【】《》·…—\-,.!?;:'"()\[\]{}<>@#$%^&*+=\/\\|`~\s]+$/.test(s)
}

export function segmentText(text: string): SegmentInfo[] {
  let raw: Intl.SegmentData[]
  try {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
    raw = [...segmenter.segment(text)]
  } catch {
    raw = text
      .split(/([\s,，。！？、；：""''·…—\u2000-\u206F]+)/)
      .filter(Boolean)
      .map((s) => ({ segment: s, index: 0, input: text, isWordLike: /\w/.test(s) }))
  }

  const result: SegmentInfo[] = []
  for (const seg of raw) {
    const t = seg.segment.trim()
    if (!t) continue
    const useful = !isUrl(t) && !isHandle(t) && !isPureEmoji(t) && !isPurePunct(t)
    result.push({ text: t, useful })
  }
  return result
}
