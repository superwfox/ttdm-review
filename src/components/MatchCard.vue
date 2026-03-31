<script setup>
import { ref, computed, watch } from 'vue'
import { Line } from 'vue-chartjs'

const props = defineProps({
  match: { type: Object, required: true },
  playerStat: { type: Object, default: null },
  usedTitans: { type: Array, default: () => [] },
  primaryTitan: { type: String, default: null },
  chartData: { type: Object, default: null },
  chartDataPerLife: { type: Object, default: null },
  titans: { type: Object, required: true }
})

const expanded = ref(false)
const perLifeDamage = ref(false)
const chartExpanded = ref(false)

// Active chart data switches based on per-life toggle
const activeChartData = computed(() =>
  perLifeDamage.value && props.chartDataPerLife ? props.chartDataPerLife : props.chartData
)

// Read CSS theme variables for canvas-based rendering
const rootStyle = getComputedStyle(document.documentElement)
const fgRgb = rootStyle.getPropertyValue('--fg-rgb').trim() || '255,255,255'
const bgRgb = rootStyle.getPropertyValue('--bg-rgb').trim() || '0,0,0'

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
    ctx.strokeStyle = `rgba(${fgRgb},0.24)`
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = `rgb(${bgRgb})`
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#00e5ff'
    ctx.stroke()
    ctx.restore()
  }
}

// Reactive chart options — y1Max adapts when toggling per-life mode
const chartOptions = computed(() => {
  const data = activeChartData.value
  return {
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
          const hpColor = executed ? '#ff1744' : hp < 1500 ? '#ff9100' : `rgb(${fgRgb})`

          const iconHtml = titanCfg?.icon
            ? `<img src="${titanCfg.icon}" style="width:32px;height:32px;object-fit:cover;display:block;margin:0 auto 4px;">`
            : ''

          const hpText = executed
            ? `<div style="font-size:14px;font-weight:bold;color:${hpColor};text-align:center;">处决</div>`
            : `<div style="font-size:14px;font-weight:bold;color:${hpColor};text-align:center;">${formatStat(hp)}</div>`

          // Damage tooltip: per-life shows lifeDmg/lifeMaxDmg, normal shows cumDeltaDmg
          let dmgHtml = ''
          if (raw.lifeDmg !== undefined) {
            // Per-life mode
            if (raw.lifeDmg > 0 || raw.lifeMaxDmg > 0) {
              const killHtml = raw.deltaKills > 0 ? ` <span style="color:rgb(${fgRgb});font-weight:bold;">☆${raw.deltaKills}</span>` : ''
              dmgHtml = `<div style="font-size:12px;color:#FF9ECF;text-align:center;margin-top:2px;">${formatStat(raw.lifeDmg)} / ${formatStat(raw.lifeMaxDmg)}${killHtml}</div>`
            }
          } else if (raw.cumDeltaDmg > 0) {
            // Normal mode
            dmgHtml = `<div style="font-size:12px;color:#FF9ECF;text-align:center;margin-top:2px;">${formatStat(raw.cumDeltaDmg)}${raw.deltaKills > 0 ? ` <span style="color:rgb(${fgRgb});font-weight:bold;">☆` + raw.deltaKills + '</span>' : ''}</div>`
          }

          tooltipEl.innerHTML = `
            <div style="font-size:11px;color:rgba(${fgRgb},0.53);text-align:center;margin-bottom:4px;">${sampleNum} / ${totalSamples.value}</div>
            ${iconHtml}
            ${hpText}
            ${dmgHtml}
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
        display: false,
        min: 0,
        max: (data?.totalPoints || 1) - 1
      },
      y: {
        beginAtZero: true,
        ticks: { color: `rgba(${fgRgb},0.27)`, font: { size: 10 } },
        grid: { color: `rgba(${fgRgb},0.04)` },
        border: { color: `rgba(${fgRgb},0.08)` }
      },
      y1: {
        display: false,
        min: 0,
        max: data?.y1Max || 4000,
        position: 'right'
      }
    }
  }
})

const chartPlugins = [crosshairPlugin]

// Force chart key to trigger re-render when toggling modes
const chartKey = computed(() =>
  `${perLifeDamage.value ? 'life' : 'cum'}-${chartExpanded.value ? 'exp' : 'col'}`
)
</script>

<template>
  <div class="glass-card card" :class="{ 'chart-expanded': chartExpanded }">
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
            <span class="stat-value">
              {{ playerStat.damage }}<template v-if="playerStat.damageTaken > 0"><span class="damage-taken" :class="{ 'damage-higher': playerStat.damage > playerStat.damageTaken, 'damage-lower': playerStat.damage < playerStat.damageTaken }">{{ playerStat.damage > playerStat.damageTaken ? '>' : playerStat.damage < playerStat.damageTaken ? '<' : '=' }}{{ formatStat(playerStat.damageTaken) }}</span></template>
            </span>
            <span class="stat-label">DAMAGE</span>
          </div>
        </div>
      </template>

      <div v-if="activeChartData" class="chart-wrap">
        <Line :key="chartKey" :data="activeChartData" :options="chartOptions" :plugins="chartPlugins" />
      </div>
      <div v-else class="no-timeline">该玩家未上传 Timeline</div>

      <!-- Card toggles area -->
      <div class="card-toggles">
        <!-- Per-life damage toggle -->
        <div
          v-if="chartData"
          class="toggle-checkbox"
          :class="{ checked: perLifeDamage }"
          @click="perLifeDamage = !perLifeDamage"
          title="每条生命伤害"
        >
          <svg viewBox="0 0 16 16" class="check-svg">
            <polyline points="3.5 8 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Expand chart toggle -->
        <div
          v-if="chartData"
          class="toggle-expand-chart"
          :class="{ active: chartExpanded }"
          @click="chartExpanded = !chartExpanded"
          title="展开图表"
        >
          <svg viewBox="0 0 16 16" class="expand-svg">
            <path d="M10 2h4v4M6 14H2v-4" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="14" y1="2" x2="9" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="2" y1="14" x2="7" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- Expand player list toggle (hamburger) -->
        <div class="hamburger-icon" :class="{ active: expanded }" @click="toggleExpand">
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
  transition:
    margin 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Expanded card: stretch via equal negative margins, keep visible gap from edges */
.card.chart-expanded {
  margin-left: calc((100% - 100vw) / 2 + 16px);
  margin-right: calc((100% - 100vw) / 2 + 16px);
  border-radius: 8px;
}

.card-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 320px;
  background-size: auto 100%;
  background-position: right top;
  background-repeat: no-repeat;
  mask-image: linear-gradient(to left, rgba(0,0,0,0.25) 0%, transparent 60%);
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,0.25) 0%, transparent 60%);
  pointer-events: none;
  border-radius: 12px;
  transition: mask-image 0.5s, -webkit-mask-image 0.5s, border-radius 0.5s;
}

/* When expanded: show more of the banner, only fade at left edge */
.card.chart-expanded .card-banner {
  mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.25) 160px, rgba(0,0,0,0.25) 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.25) 160px, rgba(0,0,0,0.25) 100%);
  border-radius: 0;
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
  color: rgba(var(--fg-rgb), 0.33);
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
  color: rgba(var(--fg-rgb), 0.33);
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
  color: rgba(var(--fg-rgb), 0.27);
  letter-spacing: 1px;
}

.damage-taken {
  font-size: 13px;
  color: rgba(var(--fg-rgb), 0.3);
  margin-left: 2px;
}

/* Chart */
.chart-wrap {
  height: 150px;
  margin-top: 8px;
  position: relative;
}

.no-timeline {
  color: rgba(var(--fg-rgb), 0.2);
  font-size: 13px;
  margin-top: 8px;
}

/* Custom tooltip */
.chart-wrap :deep(.chart-tooltip) {
  position: absolute;
  pointer-events: none;
  background: rgba(var(--bg-rgb), 0.85);
  border: 1px solid rgba(var(--fg-rgb), 0.15);
  border-radius: 6px;
  padding: 6px 10px;
  transition: opacity 0.15s;
  z-index: 10;
}

/* Card toggles area — flow-based, right-aligned */
.card-toggles {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  z-index: 2;
}

/* Shared toggle button base — unified rounded rectangle */
.toggle-checkbox,
.toggle-expand-chart,
.hamburger-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1.5px solid rgba(var(--fg-rgb), 0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
  box-sizing: border-box;
}

.toggle-checkbox:hover,
.toggle-expand-chart:hover,
.hamburger-icon:hover {
  border-color: rgba(var(--fg-rgb), 0.4);
  background: rgba(var(--fg-rgb), 0.06);
}

/* Active / checked state — filled background */
.toggle-checkbox.checked,
.toggle-expand-chart.active,
.hamburger-icon.active {
  background: rgba(var(--fg-rgb), 0.15);
  border-color: rgba(var(--fg-rgb), 0.4);
}

/* Per-life damage checkbox */
.toggle-checkbox .check-svg {
  width: 14px;
  height: 14px;
  color: rgba(var(--fg-rgb), 0.35);
  transition: color 0.2s;
}

.toggle-checkbox.checked .check-svg {
  color: rgb(var(--fg-rgb));
}

/* Expand chart toggle */
.toggle-expand-chart .expand-svg {
  width: 14px;
  height: 14px;
  color: rgba(var(--fg-rgb), 0.35);
  transition: color 0.2s;
}

.toggle-expand-chart.active .expand-svg {
  color: rgb(var(--fg-rgb));
}

/* Hamburger (expand player list) */
.hamburger-icon {
  flex-direction: column;
  gap: 3px;
}

.hamburger-icon span {
  display: block;
  width: 14px;
  height: 1.5px;
  background: rgba(var(--fg-rgb), 0.35);
  border-radius: 1px;
  transition: background 0.2s;
}

.hamburger-icon.active span {
  background: rgb(var(--fg-rgb));
}

/* Expand panel with animation */
.expand-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  margin-top: 16px;
  border-top: 1px solid rgba(var(--fg-rgb), 0.06);
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
  color: rgba(var(--fg-rgb), 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-avg {
  font-weight: bold;
  color: rgb(var(--fg-rgb));
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
  color: rgba(var(--fg-rgb), 0.58);
}

.player-head {
  padding-top: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(var(--fg-rgb), 0.08);
  color: rgba(var(--fg-rgb), 0.35);
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
