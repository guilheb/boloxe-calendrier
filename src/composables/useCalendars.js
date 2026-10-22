import { ref, computed } from 'vue'
import ICAL from 'ical.js'
import { REFRESH_MINUTES, feedPath, feedEnvVar } from '../config'
import { addDays, DAY_MS } from '../utils/date'
import { describeRecurrence } from '../utils/recurrence'

// Recurring events are expanded within this window around "now".
const EXPANSION_DAYS = 400
const MAX_OCCURRENCES = 2000

// Text colour for content drawn on top of a calendar colour: white or near-black,
// whichever has the higher WCAG contrast (e.g. near-black on yellow).
function textOn(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const l = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? '#1c1c1e' : '#fff'
}

// Calendars found in .env, injected by vite.config.js (see calendarsFromEnv).
const CALENDARS = __CALENDARS__

// Module-level state: every component calling useCalendars() shares it.
const calendars = ref(
  CALENDARS.map((c) => ({
    ...c,
    name: c.name ?? c.id,
    onColor: textOn(c.color),
    visible: true,
    error: null,
    loaded: false,
  })),
)
const eventsByCalendar = ref({})
const loading = ref(false)
const lastUpdated = ref(null)
const nextRefresh = ref(null)
const now = ref(new Date())
const selectedId = ref(null)

let refreshTimer = null
let clockTimer = null
let users = 0

// `recurrence` is the series' description (see describeRecurrence), or null for a one-off event.
function makeOccurrence(cal, item, start, end, recurrence = null) {
  const allDay = start.isDate
  const startDate = start.toJSDate()
  let endDate = end ? end.toJSDate() : startDate
  if (allDay && endDate <= startDate) endDate = new Date(startDate.getTime() + DAY_MS)
  if (endDate < startDate) endDate = startDate

  return {
    id: `${cal.id}|${item.uid}|${start.toString()}`,
    calendarId: cal.id,
    title: item.summary || '(Sans titre)',
    location: item.location || '',
    description: item.description || '',
    url: item.component.getFirstPropertyValue('url') || '',
    status: item.component.getFirstPropertyValue('status') || '',
    start: startDate,
    end: endDate,
    allDay,
    recurring: recurrence !== null,
    recurrence,
  }
}

function parseIcs(text, cal) {
  const root = new ICAL.Component(ICAL.parse(text))
  const feedName = root.getFirstPropertyValue('x-wr-calname')

  const rangeStart = ICAL.Time.fromJSDate(addDays(new Date(), -EXPANSION_DAYS))
  const rangeEnd = ICAL.Time.fromJSDate(addDays(new Date(), EXPANSION_DAYS))

  // Group by UID so modified occurrences (RECURRENCE-ID) override their master's instance.
  const masters = new Map()
  const exceptions = []
  for (const vevent of root.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(vevent)
    if (ev.isRecurrenceException()) exceptions.push(ev)
    else masters.set(ev.uid, ev)
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid)
    if (master) master.relateException(ex)
    else masters.set(`${ex.uid}|${ex.recurrenceId}`, ex)
  }

  const events = []
  for (const ev of masters.values()) {
    if (!ev.startDate) continue
    if (!ev.isRecurring()) {
      events.push(makeOccurrence(cal, ev, ev.startDate, ev.endDate))
      continue
    }
    const rrule = ev.component.getFirstPropertyValue('rrule')
    // Series defined only by RDATE (or an unusual FREQ) fall back to a plain label.
    const recurrence = (rrule && describeRecurrence(rrule, ev.startDate.toJSDate())) || 'Récurrent'
    const it = ev.iterator()
    for (let next, n = 0; (next = it.next()) && n < MAX_OCCURRENCES; n++) {
      if (next.compare(rangeEnd) > 0) break
      const occ = ev.getOccurrenceDetails(next)
      if (occ.endDate.compare(rangeStart) < 0) continue
      events.push(makeOccurrence(cal, occ.item, occ.startDate, occ.endDate, recurrence))
    }
  }
  return { name: feedName, events }
}

async function loadCalendar(cal) {
  try {
    const res = await fetch(feedPath(cal.id), { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    // Without a proxy route, Vite answers with the app's index.html instead of a 404.
    if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) {
      throw new Error(`flux introuvable — vérifier ${feedEnvVar(cal.id)} dans .env`)
    }
    const { name, events } = parseIcs(text, cal)
    eventsByCalendar.value = { ...eventsByCalendar.value, [cal.id]: events }
    if (!CALENDARS.find((c) => c.id === cal.id)?.name && name) cal.name = name
    cal.error = null
    cal.loaded = true
  } catch (err) {
    // Keep the previously loaded events; just flag the failure.
    cal.error = err.message || String(err)
  }
}

async function refresh() {
  if (loading.value) return
  loading.value = true
  await Promise.all(calendars.value.map(loadCalendar))
  loading.value = false
  lastUpdated.value = new Date()
  scheduleRefresh()
}

function scheduleRefresh() {
  clearTimeout(refreshTimer)
  const delay = REFRESH_MINUTES * 60_000
  nextRefresh.value = new Date(Date.now() + delay)
  refreshTimer = setTimeout(refresh, delay)
}

const calendarById = computed(() => Object.fromEntries(calendars.value.map((c) => [c.id, c])))

const events = computed(() =>
  calendars.value
    .filter((c) => c.visible)
    .flatMap((c) => eventsByCalendar.value[c.id] ?? [])
    .sort((a, b) => a.start - b.start || a.end - b.end),
)

// Looked up by id so the selection survives a refresh.
const selectedEvent = computed(() => events.value.find((e) => e.id === selectedId.value) ?? null)

function selectEvent(ev) {
  selectedId.value = ev?.id ?? null
}

function toggleCalendar(id) {
  const cal = calendarById.value[id]
  if (cal) cal.visible = !cal.visible
}

export function useCalendars() {
  return {
    calendars,
    calendarById,
    events,
    loading,
    lastUpdated,
    nextRefresh,
    now,
    selectedEvent,
    selectEvent,
    toggleCalendar,
    refresh,
  }
}

// Called once by the root component: starts the polling and the clock used for "now" displays.
export function startCalendarSync() {
  if (users++ === 0) {
    refresh()
    clockTimer = setInterval(() => (now.value = new Date()), 30_000)
  }
  return () => {
    if (--users === 0) {
      clearTimeout(refreshTimer)
      clearInterval(clockTimer)
    }
  }
}
