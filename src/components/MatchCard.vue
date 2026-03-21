<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS
} from 'chart.js'

const props = defineProps({
  match: { type: Object, required: true },
  playerStat: { type: Object, default: null },
  usedTitans: { type: Array, default: () => [] },
  primaryTitan: { type: String, default: null },
  chartData: { type: Object, default: null },
  titans: { type: Object, required: true }
})

const expanded = ref(false)
const expandPanel = ref(null)

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

function getSortedPlayers() {
  if (!props.match.players) return []
  return [...props.match.players]
    .map(p => ({
      ...p,
      avg: p.deaths > 0 ? Math.round(p.damage / p.deaths) : p.damage
    }))
    .sort((a, b) => b.avg - a.avg)
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
    if (chart.tooltip?._active?.length) {
      const x = chart.tooltip._active[0].element.x
      const yAxis = chart.scales.y
      const ctx = chart.ctx
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x, yAxis.top)
      ctx.lineTo(x, yAxis.bottom)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.stroke()
      ctx.restore()
    }
  }
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: {
    mode: 'index',
    intersect: false
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
        const titanType = raw.titanType || 'unknown'
        const sampleNum = raw.sampleNum || (raw.x + 1)
        const titanCfg = props.titans[titanType]
        const hpColor = hp < 1500 ? '#ff9100' : '#fff'

        const iconHtml = titanCfg?.icon
          ? `<img src="${titanCfg.icon}" style="width:32px;height:32px;object-fit:cover;display:block;margin:0 auto 4px;">`
          : ''

        tooltipEl.innerHTML = `
          <div style="font-size:11px;color:#888;text-align:center;margin-bottom:4px;">${sampleNum} / ${totalSamples.value}</div>
          ${iconHtml}
          <div style="font-size:14px;font-weight:bold;color:${hpColor};text-align:center;">${hp}</div>
        `

        tooltipEl.style.opacity = '1'
        const pos = context.chart.canvas.getBoundingClientRect()
        const tooltipWidth = tooltipEl.offsetWidth || 80
        tooltipEl.style.left = (tooltipModel.caretX - tooltipWidth / 2) + 'px'
        tooltipEl.style.top = (tooltipModel.caretY - tooltipEl.offsetHeight - 10) + 'px'
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
        <span class="match-time">{{ match.uploaded_at }}</span>
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
      <div ref="expandPanel" class="expand-panel" :class="{ open: expanded }">
        <div class="player-list">
          <div v-for="p in getSortedPlayers()" :key="p.name" class="player-row">
            <span class="player-name">{{ p.name }}:</span>
            <span class="player-avg">{{ p.avg }}</span>
            <span class="player-detail">{{ p.kills }} kills  {{ p.deaths }} deaths  {{ p.damage }} damage</span>
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
  inset: 0;
  background-size: cover;
  background-position: center right;
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
  gap: 6px;
}

.player-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.player-name {
  color: rgba(255,255,255,0.7);
}

.player-avg {
  font-weight: bold;
  color: #fff;
}

.player-detail {
  color: rgba(255,255,255,0.35);
  font-size: 13px;
}
</style>
