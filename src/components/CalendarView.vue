<script setup>
import { computed } from 'vue'
import { useCalendars } from '../composables/useCalendars'
import { REFRESH_MINUTES } from '../config'
import {
  addDays, addMonths, weekDays, formatMonthYear, formatShortDate, formatTime, capitalize,
} from '../utils/date'
import MonthView from './MonthView.vue'
import WeekView from './WeekView.vue'

const date = defineModel('date', { type: Date, required: true })
const mode = defineModel('mode', { type: String, default: 'month' })
defineProps({ selected: Object })
const emit = defineEmits(['select'])

const { calendars, listError, toggleCalendar, loading, lastUpdated, refresh } = useCalendars()

const title = computed(() => {
  if (mode.value === 'month') return capitalize(formatMonthYear(date.value))
  const days = weekDays(date.value)
  return `${formatShortDate(days[0])} – ${formatShortDate(days[6])} ${days[6].getFullYear()}`
})

function step(n) {
  date.value = mode.value === 'month' ? addMonths(date.value, n) : addDays(date.value, 7 * n)
}

function showWeek(day) {
  date.value = day
  mode.value = 'week'
}
</script>

<template>
  <section class="calendar">
    <header class="toolbar">
      <div class="nav">
        <button class="icon-btn" aria-label="Précédent" @click="step(-1)">‹</button>
        <button class="pill" @click="date = new Date()">Aujourd'hui</button>
        <button class="icon-btn" aria-label="Suivant" @click="step(1)">›</button>
        <h2>{{ title }}</h2>
      </div>

      <div class="segmented">
        <button :class="{ on: mode === 'week' }" @click="mode = 'week'">Semaine</button>
        <button :class="{ on: mode === 'month' }" @click="mode = 'month'">Mois</button>
      </div>

      <div class="right">
        <button
          v-for="cal in calendars"
          :key="cal.id"
          class="chip"
          :class="{ off: !cal.visible, error: cal.error }"
          :style="{ '--c': cal.color }"
          :title="cal.error ? `Échec du chargement : ${cal.error}` : cal.visible ? 'Masquer' : 'Afficher'"
          @click="toggleCalendar(cal.id)"
        >
          <span class="dot" />{{ cal.name }}<span v-if="cal.error"> ⚠</span>
        </button>

        <button
          class="sync"
          :class="{ spinning: loading, error: listError }"
          :title="listError
            ? `Liste des calendriers introuvable : ${listError} — cliquer pour réessayer`
            : `Actualisé toutes les ${REFRESH_MINUTES} min — cliquer pour actualiser maintenant`"
          @click="refresh"
        >
          <span class="spin">⟳</span>
          <span v-if="listError">Erreur ⚠</span>
          <span v-else>{{ lastUpdated ? formatTime(lastUpdated) : 'Chargement…' }}</span>
        </button>
      </div>
    </header>

    <MonthView
      v-if="mode === 'month'"
      :date="date"
      :selected="selected"
      @select="emit('select', $event)"
      @show-day="showWeek"
    />
    <WeekView v-else :date="date" :selected="selected" @select="emit('select', $event)" />
  </section>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav .icon-btn {
  font-size: 20px;
}

h2 {
  margin: 0 0 0 10px;
  font-size: 19px;
  font-weight: 600;
}

.pill {
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.pill:hover {
  background: var(--card);
}

.segmented {
  display: flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--card);
}

.segmented button {
  padding: 5px 16px;
  border-radius: 999px;
}

.segmented .on {
  background: var(--panel);
  font-weight: 600;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
}

.right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: color-mix(in srgb, var(--c) 14%, transparent);
}

.chip .dot {
  background: var(--c);
}

.chip.off {
  background: none;
  color: var(--muted);
  text-decoration: line-through;
}

.chip.off .dot {
  background: var(--faint);
}

.chip.error {
  outline: 1px solid var(--danger);
}

.sync {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--muted);
}

.sync.error {
  color: var(--danger);
}

.sync:hover {
  background: var(--card);
}

.spin {
  display: inline-block;
  font-size: 14px;
}

.spinning .spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
