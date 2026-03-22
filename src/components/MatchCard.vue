<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'

const props = defineProps({
  match: { type: Object, required: true },
  playerStat: { type: Object, default: null },
  usedTitans: { type: Array, default: () => [] },
  primaryTitan: { type: String, default: null },
  chartData: { type: Object, default: null },
  titans: { type: Object, required: true }
})

const expanded = ref(false)

function formatTime(utcStr) {
  if (!utcStr) return ''
  const d = new Date(utcStr + 'Z')
  const beijing = new Date(d.getTime() + 8 * 3600000)
  return beijing.toISOString().slice(0, 16).replace('T', ' ')
}

// Pick a random banner on mount (stable per card instance)
const bannerUrl = (() => {
  if (!props.primaryTitan) return null
  const banners = props.titans[props.primaryTitan]?.banners
  if (!banners || !banners.length) return null
  return banners[Math.floor(Math.random() * banners.length)]
})()

function toggleExpand() {
  expanded.value = !expanded.value
}

const sortedPlayers = computed(() => {
  if (!props.match.players) return []
  return [...props.match.players]
    .map(p => ({
      ...p,
      avg: p.deaths > 0 ? Math.round(p.damage / p.deaths) : p.damage
    }))
    .sort((a, b) => b.avg - a.avg)
})

function formatStat(value) {
  return Number(value || 0).toLocaleString('en-US')
}

// Total samples for tooltip display
const totalSamples = computed(() => {
  if (!props.match.timeline || !props.match.timeline.length) return 0
  return props.match.timeline.length
})

// Crosshair plugin (vertical line on hover)
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.()?.[0] || chart.tooltip?._active?.[0]
    if (!active) return

    const { x, y } = active.element
    const yAxis = chart.scales.y
    const ctx = chart.ctx

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, yAxis.top)
    ctx.lineTo(x, yAxis.bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.24)'
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#030303'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#00e5ff'
    ctx.stroke()
    ctx.restore()
  }
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  },
  elements: {
    point: {
      radius: 0,
      hoverRadius: 0,
      hitRadius: 14
    }
  },
  plugins: {
    tooltip: {
      enabled: false,
      external: function(context) {
        let tooltipEl = context.chart.canvas.parentNode.querySelector('.chart-tooltip')
        if (!tooltipEl) {
          tooltipEl = document.createElement('div')
          tooltipEl.className = 'chart-tooltip'
          context.chart.canvas.parentNode.appendChild(tooltipEl)
        }

        const tooltipModel = context.tooltip
        if (tooltipModel.opacity === 0) {
          tooltipEl.style.opacity = '0'
          return
        }

        const dataPoint = tooltipModel.dataPoints?.[0]
        if (!dataPoint) return

        const raw = dataPoint.raw
        const hp = raw.y
        const executed = raw.executed
        const titanType = raw.titanType || 'unknown'
        const sampleNum = raw.sampleNum || (raw.x + 1)
        const titanCfg = props.titans[titanType]
        const hpColor = executed ? '#ff1744' : hp < 1500 ? '#ff9100' : '#fff'

        const iconHtml = titanCfg?.icon
          ? `<img src="${titanCfg.icon}" style="width:32px;height:32px;object-fit:cover;display:block;margin:0 auto 4px;">`
          : ''

        const hpText = executed
          ? `<div style="font-size:14px;font-weight:bold;color:${hpColor};text-align:center;">处决</div>`
          : `<div style="font-size:14px;font-weight:bold;color:${hpColor};text-align:center;">${formatStat(hp)}</div>`

        tooltipEl.innerHTML = `
          <div style="font-size:11px;color:#888;text-align:center;margin-bottom:4px;">${sampleNum} / ${totalSamples.value}</div>
          ${iconHtml}
          ${hpText}
        `

        tooltipEl.style.opacity = '1'
        const tooltipWidth = tooltipEl.offsetWidth || 80
        const maxLeft = context.chart.width - tooltipWidth
        const left = Math.max(0, Math.min(tooltipModel.caretX - tooltipWidth / 2, maxLeft))
        const top = Math.max(0, tooltipModel.caretY - tooltipEl.offsetHeight - 10)
        tooltipEl.style.left = left + 'px'
        tooltipEl.style.top = top + 'px'
      }
    },
    legend: { display: false }
  },
  scales: {
    x: {
      type: 'linear',
      display: false
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#444', font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.04)' },
      border: { color: 'rgba(255,255,255,0.08)' }
    }
  }
}

const chartPlugins = [crosshairPlugin]
</script>

<template>
  <div class="glass-card card">
    <!-- Banner background -->
    <div
      v-if="bannerUrl"
      class="card-banner"
      :style="{
        backgroundImage: `url(${bannerUrl})`,
      }"
    ></div>

    <div class="card-content">
      <div class="card-header">
        <span class="match-time">{{ formatTime(match.uploaded_at) }}</span>
      </div>

      <template v-if="playerStat">
        <div class="stat-main">
          <div class="stat-main-left">
            <span class="avg">{{ playerStat.avg }}</span>
            <span class="avg-label">命均</span>
          </div>
          <div class="titan-icons" v-if="match.timeline">
            <img
              v-for="tt in usedTitans"
              :key="tt"
              :src="titans[tt]?.icon"
              :alt="titans[tt]?.name"
              :title="titans[tt]?.name"
              class="titan-icon"
              :style="{ borderColor: titans[tt]?.color }"
            />
          </div>
        </div>
        <div class="stat-row">
          <div class="stat-item">
            <span class="stat-value">{{ playerStat.kills }}</span>
            <span class="stat-label">KILLS</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ playerStat.deaths }}</span>
            <span class="stat-label">DEATHS</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ playerStat.damage }}</span>
            <span class="stat-label">DAMAGE</span>
          </div>
        </div>
      </template>

      <div v-if="chartData" class="chart-wrap">
        <Line :data="chartData" :options="chartOptions" :plugins="chartPlugins" />
      </div>
      <div v-else class="no-timeline">该玩家未上传 Timeline</div>

      <!-- Expand toggle -->
      <div class="expand-toggle" @click="toggleExpand">
        <div class="hamburger-icon" :class="{ active: expanded }">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <!-- Expanded player list -->
      <div class="expand-panel" :class="{ open: expanded }">
        <div class="player-list">
          <div class="player-row player-head">
            <span class="player-name">PLAYER</span>
            <span class="player-avg">AVG</span>
            <span class="player-kills">KILLS</span>
            <span class="player-deaths">DEATHS</span>
            <span class="player-damage">DAMAGE</span>
          </div>
          <div v-for="p in sortedPlayers" :key="p.name" class="player-row">
            <span class="player-name" :title="p.name">{{ p.name }}</span>
            <span class="player-avg">{{ formatStat(p.avg) }}</span>
            <span class="player-kills">{{ formatStat(p.kills) }}</span>
            <span class="player-deaths">{{ formatStat(p.deaths) }}</span>
            <span class="player-damage">{{ formatStat(p.damage) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
}

.card-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 320px;
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;
  mask-image: linear-gradient(to left, rgba(0,0,0,0.25) 0%, transparent 60%);
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,0.25) 0%, transparent 60%);
  pointer-events: none;
  border-radius: 12px;
}

.card-content {
  position: relative;
  z-index: 1;
  padding: 24px;
}

.card-header {
  margin-bottom: 16px;
}

.match-time {
  color: #555;
  font-size: 13px;
}

/* Stats */
.stat-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.stat-main-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.avg {
  font-size: 48px;
  line-height: 1;
}

.avg-label {
  font-size: 14px;
  color: #555;
}

.titan-icons {
  display: flex;
  gap: 6px;
  align-items: center;
}

.titan-icon {
  width: 64px;
  height: 64px;
  object-fit: cover;
  opacity: 1;
}

.stat-row {
  display: flex;
  gap: 32px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 20px;
}

.stat-label {
  font-size: 11px;
  color: #444;
  letter-spacing: 1px;
}

/* Chart */
.chart-wrap {
  height: 150px;
  margin-top: 8px;
  position: relative;
}

.no-timeline {
  color: #333;
  font-size: 13px;
  margin-top: 8px;
}

/* Custom tooltip */
.chart-wrap :deep(.chart-tooltip) {
  position: absolute;
  pointer-events: none;
  background: rgba(0,0,0,0.85);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  padding: 6px 10px;
  transition: opacity 0.15s;
  z-index: 10;
}

/* Expand toggle */
.expand-toggle {
  position: absolute;
  bottom: 12px;
  right: 16px;
  cursor: pointer;
  padding: 6px;
  z-index: 2;
}

.hamburger-icon {
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.2s;
}

.hamburger-icon span {
  display: block;
  width: 20px;
  height: 2px;
  background: rgba(255,255,255,0.4);
  border-radius: 1px;
  transition: background 0.2s;
}

.hamburger-icon.active span {
  background: rgba(255,255,255,0.7);
}

/* Expand panel with animation */
.expand-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  margin-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.expand-panel.open {
  grid-template-rows: 1fr;
  opacity: 1;
}

.expand-panel > .player-list {
  overflow: hidden;
  padding-top: 12px;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-row {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) repeat(4, minmax(54px, 0.8fr));
  gap: 12px;
  align-items: center;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  padding: 6px 0;
}

.player-name {
  min-width: 0;
  color: rgba(255,255,255,0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-avg {
  font-weight: bold;
  color: #fff;
}

.player-avg,
.player-kills,
.player-deaths,
.player-damage {
  text-align: right;
}

.player-kills,
.player-deaths,
.player-damage {
  color: rgba(255,255,255,0.58);
}

.player-head {
  padding-top: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.35);
  font-size: 11px;
  letter-spacing: 0.8px;
}

.player-head .player-name,
.player-head .player-avg,
.player-head .player-kills,
.player-head .player-deaths,
.player-head .player-damage {
  color: inherit;
  font-weight: 500;
}

@media (max-width: 640px) {
  .player-row {
    grid-template-columns: minmax(0, 1.4fr) repeat(4, minmax(42px, 0.7fr));
    gap: 8px;
    font-size: 12px;
  }

  .player-head {
    font-size: 10px;
  }
}
</style>
