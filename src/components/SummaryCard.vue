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

// Three palette tones cycled across bars for variety
const BAR_SHADES = [
  '#A27B5C', // accent
  '#C9A27F', // lighter tint
  '#7A5A40'  // deeper shade
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

function formatTime(utcStr) {
  if (!utcStr) return ''
  const d = new Date(utcStr + 'Z')
  const beijing = new Date(d.getTime() + 8 * 3600000)
  return beijing.toISOString().slice(5, 16).replace('T', ' ')
}

function ratingForDiff(d) {
  if (d > 5000) return { label: '较好', color: '#9eff9e' }
  if (d < -5000) return { label: '糟糕', color: '#ff5252' }
  return { label: '一般', color: '#ffeb3b' }
}

function ratingForRank(rank) {
  if (rank === 1) return { label: '惊艳', color: '#ffd700' }
  if (rank <= 3) return { label: '较好', color: '#9eff9e' }
  if (rank <= 6) return { label: '一般', color: '#ffeb3b' }
  return { label: '糟糕', color: '#ff5252' }
}

// Per-match stats, oldest → newest. Mixes TDM (avg dmg) and ATT (rank → percentage of maxY).
const lineStats = computed(() => {
  const arr = []
  for (const m of props.matches) {
    if (m.mode === 'att') {
      const rank = m.score_rank
      arr.push({ kind: 'att', rank, time: m.uploaded_at })
    } else {
      const s = props.getPlayerStat(m, props.searchName)
      if (!s) continue
      arr.push({
        kind: 'tdm',
        avg: s.avg,
        diff: (s.damage || 0) - (s.damageTaken || 0),
        time: m.uploaded_at
      })
    }
  }
  return arr.reverse()
})

const lineMaxY = computed(() => {
  const tdmAvgs = lineStats.value.filter(s => s.kind === 'tdm').map(s => s.avg)
  return tdmAvgs.length ? Math.max(...tdmAvgs) : 5000
})

const lineData = computed(() => {
  const stats = lineStats.value
  const maxY = lineMaxY.value
  const yVals = stats.map(s => {
    if (s.kind === 'att') {
      const r = s.rank || 12
      return Math.round(((12 - r) / 12) * maxY)
    }
    return s.avg
  })
  const colors = stats.map(s => s.kind === 'att' ? ratingForRank(s.rank || 12).color : ratingForDiff(s.diff).color)
  return {
    labels: stats.map(s => formatTime(s.time)),
    datasets: [{
      data: yVals,
      borderColor: `rgba(${fgRgb},0.4)`,
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: colors,
      pointBorderColor: colors,
      segment: {
        borderColor: ctx => colors[ctx.p1DataIndex] || `rgba(${fgRgb},0.4)`
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
        title: items => items[0].label,
        label: ctx => {
          const s = lineStats.value[ctx.dataIndex]
          if (s.kind === 'att') {
            const r = ratingForRank(s.rank || 12)
            return [`ATT 排名: ${s.rank ?? '—'}`, r.label]
          }
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
        <div class="block-title">各局表现</div>
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
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  .chart-slot {
    height: 180px;
  }
}
</style>
