/**
 * 等待指定 selector 的元素出现在 DOM 中。
 * 使用 MutationObserver 监听，比 setTimeout 固定延迟更可靠。
 * @param selector  CSS 选择器
 * @param timeoutMs 超时毫秒数（默认 3000，超时返回 null）
 * @param root      监听的根元素（默认 document.body）
 */
export default function waitForElement(
  selector: string,
  timeoutMs = 3000,
  root: HTMLElement | Document = document.body,
): Promise<Element | null> {
  // 如果元素已存在，立即返回
  const existing = root.querySelector(selector)
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeoutMs)

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector)
      if (el) {
        clearTimeout(timer)
        observer.disconnect()
        resolve(el)
      }
    })

    observer.observe(root, { childList: true, subtree: true })
  })
}
