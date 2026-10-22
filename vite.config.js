import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { calendarsFromEnv, feedEnvVar, feedPath } from './src/config.js'

// Builds one proxy route per calendar: /feeds/<id> → the URL in CAL_<ID>_URL.
// Vite fetches the feed server-side, so the private URL stays out of the page
// and the feed doesn't need CORS headers. `preview` reuses these routes.
function feedProxies(env, calendars) {
  const proxy = {}
  for (const { id } of calendars) {
    const url = new URL(env[feedEnvVar(id)].replace(/^webcals?:\/\//i, 'https://'))
    proxy[feedPath(id)] = {
      target: url.origin,
      changeOrigin: true,
      rewrite: () => url.pathname + url.search,
    }
  }
  return proxy
}

export default defineConfig(({ mode }) => {
  // '' prefix loads every variable, not only VITE_*; none of them are exposed to the client.
  const env = loadEnv(mode, process.cwd(), '')
  const calendars = calendarsFromEnv(env)
  if (!calendars.length) console.warn('[feeds] No CAL_<ID>_URL in .env — no calendar will load.')
  return {
    plugins: [vue()],
    // Only id, name and color reach the page; the URLs stay in this process.
    define: { __CALENDARS__: JSON.stringify(calendars) },
    // Any Host is answered: in production the reverse proxy (Traefik) decides which hosts
    // reach the app. `preview` inherits both settings.
    server: { proxy: feedProxies(env, calendars), allowedHosts: true },
  }
})
