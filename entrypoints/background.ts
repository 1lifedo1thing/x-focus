import { migrateSpamStorage } from '../shared/spam-migration'

async function downloadMediaFile(
  url: string,
  filename?: string,
): Promise<{ ok: boolean; downloadId?: number; error?: string }> {
  try {
    if (!url) return { ok: false, error: '未提供有效下载 URL' }
    const downloadId = await browser.downloads.download({
      url,
      filename: filename || undefined,
      saveAs: false,
    })
    return { ok: true, downloadId }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void migrateSpamStorage()
  })

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'XF_DOWNLOAD_MEDIA') {
      void (async () => {
        try {
          const result = await downloadMediaFile(
            String(message.url || ''),
            message.filename ? String(message.filename) : undefined,
          )
          sendResponse(result)
        } catch (e: any) {
          sendResponse({ ok: false, error: String(e?.message || e) })
        }
      })()
      return true
    }
  })
})
