import { defineConfig } from 'wxt'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  browser: 'chrome',
  dev: {
    server: {
      port: 3005,
    },
  },
  modules: [],
  vite: () => ({
    plugins: [vue(), tailwindcss()],
    customLogger: {
      info(msg) { console.info(msg) },
      warn(msg) {
        if (msg.includes('INVALID_ANNOTATION')) return
        console.warn(msg)
      },
      warnOnce(msg) {
        if (msg.includes('INVALID_ANNOTATION')) return
        console.warn(msg)
      },
      error(msg) { console.error(msg) },
      clearScreen() {},
      hasErrorLogged(error) { return false },
      hasWarned: false,
    },
  }),
  manifest: (env) => ({
    name: 'X Focus',
    description: 'X/Twitter 界面定制、评论垃圾过滤、爆款雷达与效率辅助工具。',
    permissions: ['storage'],
    action: {
      default_title: 'X Focus',
      default_popup: 'popup.html',
    },
  }),
})
