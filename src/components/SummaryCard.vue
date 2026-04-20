<script setup>
import { computed } from 'vue'
import { Radar, Line } from 'vue-chartjs'

const props = defineProps({
  matches: { type: Array, required: true },
  searchName: { type: String, required: true },
  titans: { type: Object, required: true },
  getPlayerStat: { type: Function, required: true }
})

const rootStyle = getComputedStyle(document.documentElement)
const fgRgb = rootStyle.getPropertyValue('--fg-rgb').trim() || '255,255,255'

const HEX_TITANS = ['legion', 'ronin', 'northstar', 'scorch', 'tone', 'monarch', 'ion']

// Aggregate sample counts per titan across all loaded matches
const hexData = computed(() => {
  const counts = Object.fromEntries(HEX_TITANS.map(t => [t, 0]))
  for (const m of props.matches) {
    if (!m.timeline) continue
    for (const pt of m.timeline) {
      if (counts[pt.titan_type] !== undefined) counts[pt.titan_type]++
    }
  }
  const seconds = HEX_TITANS.map(t => counts[t] * 0.5)
  return {
    labels: HEX_TITANS.map(t => props.titans[t]?.name || t),
    datasets: [{
      data: seconds,
      backgroundColor: `rgba(${fgRgb},0.12)`,
      borderColor: `rgba(${fgRgb},0.6)`,
      borderWidth: 1.5,
      pointBackgroundColor: HEX_TITANS.map(t => props.titans[t]?.color || '#fff'),
      pointRadius: 3,
      pointHoverRadius: 5
    }]
  }
})

const hexOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.label}: ${ctx.parsed.r.toFixed(1)}s`
      }
    }
  },
  scales: {
    r: {
      beginAtZero: true,
      angleLines: { color: `rgba(${fgRgb},0.1)` },
      grid: { color: `rgba(${fgRgb},0.08)` },
      pointLabels: { color: `rgba(${fgRgb},0.7)`, font: { size: 11 } },
      ticks: { display: false, backdropColor: 'transparent' }
    }
  }
}))

// Per-match avg line with diff-based segment coloring
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
  return arr
})

function colorForDiff(d) {
  if (d > 5000) return '#9eff9e'
  if (d < -5000) return '#ff5252'
  return '#ffeb3b'
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
      pointBackgroundColor: stats.map(s => colorForDiff(s.diff)),
      pointBorderColor: stats.map(s => colorForDiff(s.diff)),
      segment: {
        borderColor: ctx => colorForDiff(stats[ctx.p1DataIndex]?.diff ?? 0)
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
          const sign = s.diff >= 0 ? '+' : ''
          return [`命均: ${s.avg}`, `差值: ${sign}${s.diff}`]
        }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: `rgba(${fgRgb},0.35)`, font: { size: 10 } },
      grid: { color: `rgba(${fgRgb},0.04)` },
      border: { color: `rgba(${fgRgb},0.08)` }
    },
    y: {
      beginAtZero: true,
      ticks: { color: `rgba(${fgRgb},0.35)`, font: { size: 10 } },
      grid: { color: `rgba(${fgRgb},0.04)` },
      border: { color: `rgba(${fgRgb},0.08)` }
    }
  }
}))
</script>

<template>
  <div class="glass-card summary-card">
    <div class="summary-content">
      <div class="summary-block hex-block">
        <div class="block-title">泰坦使用时长</div>
        <div class="chart-slot">
          <Radar :data="hexData" :options="hexOptions" />
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
  grid-template-columns: minmax(200px, 280px) 1fr;
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
  color: rgba(var(--fg-rgb), 0.4);
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
