<script setup>
import { computed } from 'vue'
import { Bar, Line } from 'vue-chartjs'

const props = defineProps({
  matches: { type: Array, required: true },
  searchName: { type: String, required: true },
  titans: { type: Object, required: true },
  getPlayerStat: { type: Function, required: true }
})

const rootStyle = getComputedStyle(document.documentElement)
const fgRgb = rootStyle.getPropertyValue('--fg-rgb').trim() || '255,236,212'
const oBright = rootStyle.getPropertyValue('--o-bright').trim() || '255,140,48'
const oDeep = rootStyle.getPropertyValue('--o-deep').trim() || '32,18,8'

const BAR_TITANS = ['legion', 'ronin', 'northstar', 'scorch', 'tone', 'monarch', 'ion']

// Three orange tones cycled across bars for variety
const BAR_SHADES = [
  '#ff8a32', // bright
  '#ffb46b', // light
  '#cc5a14'  // deep
]

// Aggregate sample counts per titan across all loaded matches (1 sample = 0.5s)
const barData = computed(() => {
  const counts = Object.fromEntries(BAR_TITANS.map(t => [t, 0]))
  for (const m of props.matches) {
    if (!m.timeline) continue
    for (const pt of m.timeline) {
      if (counts[pt.titan_type] !== undefined) counts[pt.titan_type]++
    }
  }
  const seconds = BAR_TITANS.map(t => counts[t] * 0.5)
  return {
    labels: BAR_TITANS.map(t => props.titans[t]?.name || t),
    datasets: [{
      data: seconds,
      backgroundColor: BAR_TITANS.map((_, i) => BAR_SHADES[i % BAR_SHADES.length]),
      borderRadius: 4,
      borderSkipped: false,
      maxBarThickness: 28
    }]
  }
})

const barOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.parsed.y.toFixed(1)}s`
      }
    }
  },
  scales: {
    x: {
      ticks: { color: `rgba(${fgRgb},0.7)`, font: { size: 11 } },
      grid: { display: false },
      border: { color: `rgba(${oBright},0.3)` }
    },
    y: {
      beginAtZero: true,
      ticks: { color: `rgba(${fgRgb},0.45)`, font: { size: 10 } },
      grid: { color: `rgba(${oBright},0.08)` },
      border: { color: `rgba(${oBright},0.3)` }
    }
  }
}))

// Per-match stats, oldest → newest
const lineStats = computed(() => {
  const arr = []
  for (const m of props.matches) {
    const s = props.getPlayerStat(m, props.searchName)
    if (!s) continue
    arr.push({
      avg: s.avg,
      diff: (s.damage || 0) - (s.damageTaken || 0)
    })
  }
  return arr.reverse()
})

function ratingForDiff(d) {
  if (d > 5000) return { label: '较好', color: '#9eff9e' }
  if (d < -5000) return { label: '糟糕', color: '#ff5252' }
  return { label: '一般', color: '#ffeb3b' }
}

const lineData = computed(() => {
  const stats = lineStats.value
  return {
    labels: stats.map((_, i) => i + 1),
    datasets: [{
      data: stats.map(s => s.avg),
      borderColor: `rgba(${fgRgb},0.4)`,
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: stats.map(s => ratingForDiff(s.diff).color),
      pointBorderColor: stats.map(s => ratingForDiff(s.diff).color),
      segment: {
        borderColor: ctx => ratingForDiff(stats[ctx.p1DataIndex]?.diff ?? 0).color
      },
      fill: false
    }]
  }
})

const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'nearest', axis: 'x', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: items => `第 ${items[0].label} 局`,
        label: ctx => {
          const s = lineStats.value[ctx.dataIndex]
          const r = ratingForDiff(s.diff)
          const sign = s.diff >= 0 ? '+' : ''
          return [`命均: ${s.avg}`, `差值: ${sign}${s.diff} (${r.label})`]
        }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: `rgba(${fgRgb},0.45)`, font: { size: 10 } },
      grid: { color: `rgba(${oBright},0.06)` },
      border: { color: `rgba(${oBright},0.3)` }
    },
    y: {
      beginAtZero: true,
      ticks: { color: `rgba(${fgRgb},0.45)`, font: { size: 10 } },
      grid: { color: `rgba(${oBright},0.08)` },
      border: { color: `rgba(${oBright},0.3)` }
    }
  }
}))
</script>

<template>
  <div class="glass-card summary-card">
    <div class="summary-content">
      <div class="summary-block bar-block">
        <div class="block-title">泰坦使用时长</div>
        <div class="chart-slot">
          <Bar :data="barData" :options="barOptions" />
        </div>
      </div>
      <div class="summary-block line-block">
        <div class="block-title">各局命均</div>
        <div class="chart-slot">
          <Line :data="lineData" :options="lineOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-card {
  padding: 20px 24px;
}

.summary-content {
  display: grid;
  grid-template-columns: minmax(220px, 300px) 1fr;
  gap: 20px;
  align-items: stretch;
}

.summary-block {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.block-title {
  font-size: 12px;
  color: rgba(var(--fg-rgb), 0.55);
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.chart-slot {
  position: relative;
  height: 200px;
  min-width: 0;
}

@media (max-width: 640px) {
  .summary-content {
    grid-template-columns: 1fr;
  }
  .chart-slot {
    height: 180px;
  }
}
</style>
