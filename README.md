# boloxe-wallcal

A Vue 3 page that subscribes to several ICS calendar feeds, refreshes them every few minutes, and shows them in four panels:

1. **Monthly overview**: a small month with a colored dot per event. Clicking a day opens that week in the main calendar.
2. **Upcoming events**: the next 7 days, scrollable, grouped by day.
3. **Main calendar**: Month or Week view, with a show/hide chip per calendar and a refresh indicator.
4. **Event details**: shown only while an event is selected.

## Getting started

```sh
npm install
npm run dev       # dev server, at /calendrier/
npm run build     # production build in dist/calendrier/
npm run preview   # serve the production build
```

## Configuration

### Calendars (boloxe-api)

The calendars are declared in the environment of [boloxe-api](../boloxe-api), not here: each `CAL_<ID>_URL` there adds one calendar, with optional `CAL_<ID>_NAME` and `CAL_<ID>_COLOR`. **To add a calendar,** add it there; this app needs neither a change nor a rebuild.

Its `calendrier` endpoint (`API_URL` in `src/config.js`):

- without parameters, returns the list: `[{ id, name, color }]`, sorted by ID. When `name` is `null`, the feed's `X-WR-CALNAME` is used.
- with `?id=<id>`, downloads that calendar's ICS feed and returns it (502 if it isn't an iCalendar file).

Both require the `X-Internal-Api-Key` header. The page calls the API directly, so the feed providers never see the browser: the private feed URLs stay in the API, and Google Calendar and iCloud feeds work even though they don't send CORS headers. The API's CORS allows `localhost` and `*.boloxe.com`.

### API key (`.env`)

```sh
cp .env.example .env
```

`VITE_CALENDAR_API_KEY` is the API's `INTERNAL_API_KEY`. Vite reads it at build time and puts it in the page's JavaScript: anyone who can open the page can read it. That's acceptable because the page is behind Cloudflare Access. Restart `npm run dev` or rebuild after changing it.

The refresh interval (`REFRESH_MINUTES`) is in `src/config.js`.

### Deployment

The page is static and served by Cloudflare Workers (static assets only, no Worker script) at `boloxe.com/calendrier` and `www.boloxe.com/calendrier` (`wrangler.jsonc`). Workers maps a request path to the same path in the assets directory, so Vite builds with `base: '/calendrier/'` into `dist/calendrier/`, and `wrangler.jsonc` uploads `dist/`.

To deploy, run `npm run build` (it puts the key from `.env` in the page), then `npx wrangler deploy` (`npx wrangler login` the first time). Cloudflare Access protecting `/calendrier` is configured in the Cloudflare dashboard, not here.

Week-view settings are at the top of `src/components/WeekView.vue`:

- `HOUR_PX`: height of one hour, currently 96px.
- `MIN_EVENT_PX`: minimum height of an event, so short events stay readable.
- `FIRST_HOUR`: the hour the grid opens scrolled to, currently 6 AM.

## Stack

| Piece | Version | Role |
|---|---|---|
| **Vue 3** | 3.5 | UI, using the Composition API with `<script setup>` |
| **ical.js** | 2.2 | Parses the `.ics` feeds and expands repeating events |
| **Vite** | 8 | Dev server and production build |
| **@vitejs/plugin-vue** | 6 | Compiles the `.vue` files |

There's no router, state library (Pinia), UI kit, CSS framework or date library. Shared state is a plain composable, styling is scoped CSS, and dates use native `Date` and `Intl`. The production bundle is about 158 KB of JS (54 KB gzipped), and most of that is Vue and ical.js.

## Project layout

```
src/
  config.js                    refresh interval, API URL and key
vite.config.js                 base path and output in dist/calendrier/
wrangler.jsonc                 Cloudflare Workers: routes, dist/ as static assets
.env.example                   template for .env (API key)
  main.js / App.vue            entry + grid layout, view state (date, mode)
  style.css                    color variables, light/dark theme, shared classes
  composables/useCalendars.js  fetching, parsing, polling, selection
  utils/date.js                date math + Intl formatters
  components/
    MiniMonth.vue              panel 1
    UpcomingList.vue           panel 2
    CalendarView.vue           panel 3 toolbar, switches between:
      MonthView.vue
      WeekView.vue
    EventDetail.vue            panel 4
```

## Data flow

### Shared state

`useCalendars.js` keeps its state at module level, outside the function. Every component that calls `useCalendars()` therefore shares the same refs, so all four panels see the same data without Pinia or provide/inject.

- `calendars`: the list from the API, plus runtime fields (`visible`, `error`, `loaded`).
- `eventsByCalendar`: the parsed events for each feed.
- `events`: a computed list of every visible event, merged and sorted. All panels read this.
- `selectedEvent`: looked up by id, so a selected event stays selected after a refresh. Each occurrence's id is `calendarId|UID|start`, which stays the same between downloads.
- `now`: a clock that updates every 30 seconds. It drives the "now / in 11 hours" status, the grayed-out past events and the red current-time line.

### Fetching and polling

- `startCalendarSync()` is called once from `App.vue`.
- The first round loads the calendar list from the API. If that fails, the refresh button shows « Erreur ⚠ » and every round retries it.
- It downloads all feeds in parallel from the API (`?id=<id>`) with `fetch(…, { cache: 'no-store' })`, so the browser cache never serves an old copy.
- After each round finishes, it schedules the next one with `setTimeout`. A slow round therefore can't overlap the next one, which `setInterval` could allow.
- The refresh button calls the same `refresh()` and restarts the countdown.
- If a feed fails, its previously loaded events are kept and its chip is outlined in red with a ⚠.

### Parsing with ical.js

1. `ICAL.parse` turns the text into a structure, and `ICAL.Component` and `ICAL.Event` wrap each `VEVENT`.
2. Events are grouped by UID. A modified single occurrence (one with `RECURRENCE-ID`) is attached to its series with `relateException`, so the modified version replaces the original.
3. Repeating events are expanded with `event.iterator()`, but only within ±400 days of today and at most 2,000 occurrences. Without that limit, an endless `RRULE` would expand forever.
4. Each occurrence becomes a plain object (`{ id, title, start, end, allDay, location, description, … }`) with native `Date`s. Times are converted to the browser's time zone at this step.
5. For all-day events, the end date in the feed is the day after the event ends. The detail panel subtracts a day so it shows the actual last day.

## Rendering details

- **Month grids** (`monthGrid()`) always contain whole Sunday-to-Saturday weeks, so a month has 4–6 rows. The CSS row count comes from the number of days.
- **Which events fall on a day** is decided by `occursOn(ev, day)`: an event is included if it overlaps that day at all. That's why a game from 11 PM to 2 AM appears on both days.
- **Week view layout** (`layoutDay()`):
  - Timed events are cut to the day's boundaries and given a minimum length of 30 minutes.
  - They're grouped into clusters of events that overlap each other.
  - Within a cluster, each event goes into the first column that's free at its start time.
  - Width is `100% / column count` and the horizontal position is `column / count`. This is the same simple approach Google and Apple use.
  - Vertical position and height come from `HOUR_PX`.
- **Language:** the interface is in French. Dates are formatted with `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` using the `LOCALE` constant (`'fr-CA'`) in `utils/date.js`, which gives "mar. 6 oct.", "20 h 00" and "dans 11 heures". `Intl` returns lowercase French ("mardi", "octobre 2026"), so headings go through `capitalize()`. Event titles and notes come from the feeds and stay in their original language.
- **Theme:** colors are CSS variables in `style.css`, with a dark palette under `prefers-color-scheme: dark`. Shades of each calendar's color are made with `color-mix()`, so a new feed only needs one base color (from the API).
- **Event notes** are HTML-escaped first and links are added afterwards. Feed text is untrusted, so this keeps the `v-html` safe from injection.

## Limits

- **The API is required:** without it (or with a wrong key), no calendar loads.
- **No server-side cache:** every open tab downloads each feed on every refresh, through the API. That's fine on one home computer.
- **The key is public to the page's visitors:** with it, anyone can read the calendars through the API. Cloudflare Access limits who can open the page.
- **Nothing is saved between visits:** which calendars are hidden and the last fetched data are lost on reload. You could save them in `localStorage` with a few lines, or show cached data while offline.
- **Time zones:** it relies on ical.js's time-zone handling. `VTIMEZONE` blocks inside the feed work. A `TZID` with no definition in the feed falls back to "floating" local time.
- **No tests yet.** `utils/date.js` and `layoutDay()` are pure functions, so they'd be the easiest place to start with Vitest, which plugs straight into the existing Vite setup.
