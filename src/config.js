// How often every subscribed calendar is re-downloaded.
export const REFRESH_MINUTES = 5

// The calendars are declared in the environment of boloxe-api (CAL_<ID>_* variables). Its
// endpoint returns the list (id, name, color) without `id`, and a calendar's ICS feed with
// `?id=<id>`. It downloads the feed itself, so the private URLs never reach the browser and
// the feeds don't need CORS headers.
export const API_URL = 'https://api.boloxe.com/calendrier'
// Read from .env at build time, so it ends up in the bundle: the page is behind Cloudflare
// Access, and the key only keeps the endpoint from being public.
export const API_KEY = import.meta.env.VITE_CALENDAR_API_KEY ?? ''

export const feedUrl = (id) => `${API_URL}?id=${encodeURIComponent(id)}`
