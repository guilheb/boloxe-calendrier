import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Served at boloxe.com/calendrier/ by Cloudflare Workers, which maps a request path to the
// same path in dist/ (see wrangler.jsonc).
export default defineConfig({
  base: '/calendrier/',
  build: { outDir: 'dist/calendrier', emptyOutDir: true },
  plugins: [vue()],
})
