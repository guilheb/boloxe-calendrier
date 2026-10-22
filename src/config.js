// How often every subscribed calendar is re-downloaded.
export const REFRESH_MINUTES = 5

// Used in order for calendars without a CAL_<ID>_COLOR (Apple Calendar's palette).
export const DEFAULT_COLORS = ['#1badf8', '#ffcc00', '#63da38', '#ff2968', '#cc73e1', '#ff9500', '#a2845e']

export const feedEnvVar = (id) => `CAL_${id.toUpperCase()}_URL`
export const feedPath = (id) => `/feeds/${id}`

// Subscribed calendars are declared only in .env.local: every CAL_<ID>_URL is one
// calendar, with optional CAL_<ID>_NAME and CAL_<ID>_COLOR. When NAME is omitted, the
// feed's X-WR-CALNAME is used. The URL is left out of the result: it is served by the
// Vite proxy at /feeds/<id>, so it never reaches the browser and CORS doesn't apply.
export function calendarsFromEnv(env) {
  return Object.keys(env)
    .map((key) => key.match(/^CAL_([A-Z0-9_]+)_URL$/)?.[1])
    .filter((key) => key && env[`CAL_${key}_URL`])
    .map((key, i) => ({
      id: key.toLowerCase(),
      name: env[`CAL_${key}_NAME`] || undefined,
      color: env[`CAL_${key}_COLOR`] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }))
}
