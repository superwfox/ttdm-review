<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'

const props = defineProps({
  match: { type: Object, required: true },
  playerStat: { type: Object, default: null },
  metrics: { type: Object, default: () => ({}) },
  primaryTitan: { type: String, default: null },
  titans: { type: Object, required: true }
})

const expanded = ref(false)
const chartExpanded = ref(false)
const toggles = ref({
  dDeaths: false,
  dScore: false,
  teamScore: false,
  enemyScore: false
})

const rootStyle = getComputedStyle(document.documentElement)
const fgRgb = rootStyle.getPropertyValue('--fg-rgb').trim() || '255,255,255'
const bgRgb = rootStyle.getPropertyValue('--bg-rgb').trim() || '0,0,0'

function formatTime(utcStr) {
  if (!utcStr) return ''
  const d = new Date(utcStr + 'Z')
  const beijing = new Date(d.getTime() + 8 * 3600000)
  return beijing.toISOString().slice(0, 16).replace('T', ' ')
}

function formatStat(v) {
  return Number(v || 0).toLocaleString('en-US')
}

function formatRank(n) {
  if (!n || n < 1) return '—'
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function rankColor(rank) {
  if (!rank) return `rgb(${fgRgb})`
  if (rank === 1) return '#ffd700'
  if (rank <= 3) return '#9eff9e'
  if (rank <= 6) return '#ffeb3b'
  return '#ff5252'
}

const bannerUrl = (() => {
  if (!props.primaryTitan) return null
  const banners = props.titans[props.primaryTitan]?.banners
  if (!banners || !banners.length) return null
  return banners[Math.floor(Math.random() * banners.length)]
})()

const mapName = computed(() => {
  const raw = props.match.map || ''
  return raw.replace(/^mp_/, '').replace(/_/g, ' ').toUpperCase()
})

const resultLabel = computed(() => {
  const r = props.match.result
  if (r === 'win') return { text: '胜利', color: '#9eff9e' }
  if (r === 'loss') return { text: '失败', color: '#ff5252' }
  if (r === 'draw') return { text: '平局', color: '#ffeb3b' }
  return { text: '', color: 'inherit' }
})

const finalScoreText = computed(() => {
  const fs = props.match.final_score
  if (!Array.isArray(fs) || fs.length < 2) return ''
  return `${fs[0]} : ${fs[1]}`
})

// ── Player list with friend/foe band ──
const sortedPlayers = computed(() => {
  if (!props.match.players) return []
  return [...props.match.players].sort((a, b) => (b.score || 0) - (a.score || 0))
})

const localTeam = computed(() => {
  const me = props.match.local_player_name
  const row = props.match.players?.find(p => p.name === me)
  return row?.team || null
})

function bandColor(team) {
  if (!localTeam.value || !team) return 'transparent'
  return team === localTeam.value ? 'rgba(120, 180, 255, 0.45)' : 'rgba(255, 120, 120, 0.45)'
}

// ── Chart data ──
const chartData = computed(() => {
  const tl = props.match.timeline
  if (!tl || !tl.length) return null

  const adjustHp = t => {
    let hp = t.health || 0
    if (!t.is_doomed && t.titan_type !== 'pilot' && t.titan_type !== 'unknown') hp += 2500
    if (hp > 65000) return 0
    return hp
  }

  // HP segmented by titan type (color per segment)
  const segments = []
  let cur = { type: tl[0].titan_type, points: [{ x: 0, y: adjustHp(tl[0]), titanType: tl[0].titan_type, sampleNum: tl[0].sample_num, deltaKills: tl[0].delta_kills || 0 }] }
  for (let i = 1; i < tl.length; i++) {
    const t = tl[i]
    const pt = { x: i, y: adjustHp(t), titanType: t.titan_type, sampleNum: t.sample_num, deltaKills: t.delta_kills || 0 }
    if (t.titan_type !== cur.type) {
      cur.points.push(pt)
      segments.push(cur)
      cur = { type: t.titan_type, points: [pt] }
    } else {
      cur.points.push(pt)
    }
  }
  segments.push(cur)

  const hpDatasets = segments.map(seg => {
    const color = props.titans[seg.type]?.color || '#ffffff'
    const r = parseInt(color.slice(1, 3), 16) || 0
    const g = parseInt(color.slice(3, 5), 16) || 0
    const b = parseInt(color.slice(5, 7), 16) || 0
    return {
      data: seg.points,
      borderColor: color,
      borderWidth: 1.5,
      pointRadius: 0,
      fill: { target: 'origin', above: `rgba(${r},${g},${b},0.06)` },
      tension: 0.1,
      yAxisID: 'y',
      parsing: { xAxisKey: 'x', yAxisKey: 'y' },
      spanGaps: true
    }
  })

  // Kill markers (always on)
  const killRadii = tl.map(t => (t.delta_kills > 0 ? 4 : 0))
  const killPoints = tl.map((t, i) => ({ x: i, y: adjustHp(t) }))
  hpDatasets.push({
    data: killPoints,
    borderColor: 'transparent',
    pointRadius: killRadii,
    pointBackgroundColor: '#FF9ECF',
    pointBorderColor: '#FF9ECF',
    hoverRadius: 0,
    fill: false,
    yAxisID: 'y',
    parsing: { xAxisKey: 'x', yAxisKey: 'y' },
    showLine: false
  })

  // Toggle series (cumulative dDeaths/dScore, raw teamScore/enemyScore)
  const extras = []
  let y2Max = 0

  function makeCumLine(key, color) {
    let acc = 0
    const pts = tl.map((t, i) => {
      acc += t[key] || 0
      return { x: i, y: acc }
    })
    y2Max = Math.max(y2Max, acc)
    return { data: pts, borderColor: color, borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y2', parsing: { xAxisKey: 'x', yAxisKey: 'y' }, spanGaps: true, _label: '' }
  }
  function makeRawLine(key, color) {
    let max = 0
    const pts = tl.map((t, i) => {
      const v = t[key] || 0
      if (v > max) max = v
      return { x: i, y: v }
    })
    y2Max = Math.max(y2Max, max)
    return { data: pts, borderColor: color, borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y2', parsing: { xAxisKey: 'x', yAxisKey: 'y' }, spanGaps: true, _label: '' }
  }

  if (toggles.value.dDeaths) extras.push({ ...makeCumLine('delta_deaths', '#ff7043'), _label: '累计死亡' })
  if (toggles.value.dScore) extras.push({ ...makeCumLine('delta_score', '#ffd54f'), _label: '累计得分' })
  if (toggles.value.teamScore) extras.push({ ...makeRawLine('team_score', '#64b5f6'), _label: '友方分' })
  if (toggles.value.enemyScore) extras.push({ ...makeRawLine('enemy_score', '#ef5350'), _label: '敌方分' })

  return {
    datasets: [...hpDatasets, ...extras],
    totalPoints: tl.length,
    y2Max: y2Max > 0 ? Math.ceil(y2Max / 0.9) : undefined,
    hasY2: extras.length > 0
  }
})

const totalSamples = computed(() => props.match.timeline?.length || 0)

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

const chartOptions = computed(() => {
  const data = chartData.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    elements: { point: { radius: 0, hoverRadius: 0, hitRadius: 14 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external(context) {
          let tip = context.chart.canvas.parentNode.querySelector('.chart-tooltip')
          if (!tip) {
            tip = document.createElement('div')
            tip.className = 'chart-tooltip'
            context.chart.canvas.parentNode.appendChild(tip)
          }
          const tm = context.tooltip
          if (tm.opacity === 0) { tip.style.opacity = '0'; return }
          const dp = tm.dataPoints?.[0]
          if (!dp) return
          const raw = dp.raw
          const sampleNum = raw.sampleNum || (raw.x + 1)
          const titanType = raw.titanType || 'unknown'
          const titanCfg = props.titans[titanType]
          const iconHtml = titanCfg?.icon
            ? `<img src="${titanCfg.icon}" style="width:32px;height:32px;object-fit:cover;display:block;margin:0 auto 4px;">`
            : ''
          const hp = raw.y
          const hpText = `<div style="font-size:14px;font-weight:bold;color:rgb(${fgRgb});text-align:center;">${formatStat(hp)}</div>`
          const killHtml = raw.deltaKills > 0 ? `<div style="font-size:12px;color:#FF9ECF;text-align:center;">☆${raw.deltaKills}</div>` : ''
          tip.innerHTML = `<div style="font-size:11px;color:rgba(${fgRgb},0.53);text-align:center;margin-bottom:4px;">${sampleNum} / ${totalSamples.value}</div>${iconHtml}${hpText}${killHtml}`
          tip.style.opacity = '1'
          const w = tip.offsetWidth || 80
          const maxLeft = context.chart.width - w
          const left = Math.max(0, Math.min(tm.caretX - w / 2, maxLeft))
          const top = Math.max(0, tm.caretY - tip.offsetHeight - 10)
          tip.style.left = left + 'px'
          tip.style.top = top + 'px'
        }
      }
    },
    scales: {
      x: { type: 'linear', display: false, min: 0, max: (data?.totalPoints || 1) - 1 },
      y: {
        beginAtZero: true,
        ticks: { color: `rgba(${fgRgb},0.27)`, font: { size: 10 } },
        grid: { color: `rgba(${fgRgb},0.04)` },
        border: { color: `rgba(${fgRgb},0.08)` }
      },
      y2: {
        display: data?.hasY2 || false,
        position: 'right',
        beginAtZero: true,
        max: data?.y2Max,
        ticks: { color: `rgba(${fgRgb},0.27)`, font: { size: 10 } },
        grid: { display: false },
        border: { color: `rgba(${fgRgb},0.08)` }
      }
    }
  }
})

const chartPlugins = [crosshairPlugin]

const chartKey = computed(() => {
  const t = toggles.value
  return `${t.dDeaths ? 1 : 0}${t.dScore ? 1 : 0}${t.teamScore ? 1 : 0}${t.enemyScore ? 1 : 0}-${chartExpanded.value ? 'e' : 'c'}`
})

const m = computed(() => props.metrics || {})
</script>

<template>
  <Teleport to="body" :disabled="!chartExpanded">
    <div v-if="chartExpanded" class="expand-backdrop" @click="chartExpanded = false"></div>
  </Teleport>
  <Teleport to="body" :disabled="!chartExpanded">
  <div class="glass-card card att-card" :class="{ 'chart-expanded': chartExpanded }">
    <div
      v-if="bannerUrl"
      class="card-banner"
      :style="{ backgroundImage: `url(${bannerUrl})` }"
    ></div>

    <div class="card-content">
      <div class="card-header">
        <span class="match-time">{{ formatTime(match.uploaded_at) }}</span>
        <span v-if="mapName" class="match-map">{{ mapName }}</span>
        <span v-if="resultLabel.text" class="match-result" :style="{ color: resultLabel.color }">{{ resultLabel.text }}</span>
        <span v-if="finalScoreText" class="match-score">{{ finalScoreText }}</span>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <div class="metric-value" :style="{ color: rankColor(m.rank) }">{{ formatRank(m.rank) }}</div>
          <div class="metric-label">排名</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ m.pvpRatio != null ? m.pvpRatio.toFixed(2) : '—' }}</div>
          <div class="metric-label">PvP 得分比</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ m.ttft || '—' }}</div>
          <div class="metric-label">首泰坦用时</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ m.titanUptime != null ? m.titanUptime.toFixed(1) + '%' : '—' }}</div>
          <div class="metric-label">泰坦时长</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ m.doomSurvive != null ? m.doomSurvive.toFixed(1) + '%' : '—' }}</div>
          <div class="metric-label">残血生还</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ m.scoreVelocity != null ? m.scoreVelocity : '—' }}<span v-if="m.scoreVelocity != null" class="metric-unit">/min</span></div>
          <div class="metric-label">峰值得分速度</div>
        </div>
      </div>

      <div v-if="chartData" class="chart-wrap">
        <Line :key="chartKey" :data="chartData" :options="chartOptions" :plugins="chartPlugins" />
      </div>
      <div v-else class="no-timeline">该玩家未上传 Timeline</div>

      <div class="card-toggles">
        <button
          v-for="(label, key) in { dDeaths: '死亡', dScore: '得分', teamScore: '友方', enemyScore: '敌方' }"
          :key="key"
          class="series-toggle"
          :class="{ active: toggles[key] }"
          @click="toggles[key] = !toggles[key]"
        >{{ label }}</button>

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

        <div class="hamburger-icon" :class="{ active: expanded }" @click="expanded = !expanded">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div class="expand-panel" :class="{ open: expanded }">
        <div class="player-list">
          <div class="player-row player-head">
            <span class="player-name">PLAYER</span>
            <span class="player-kills">KILLS</span>
            <span class="player-deaths">DEATHS</span>
            <span class="player-score">SCORE</span>
          </div>
          <div
            v-for="p in sortedPlayers"
            :key="p.name"
            class="player-row"
            :style="{ '--band-color': bandColor(p.team) }"
          >
            <span class="player-name" :title="p.name">{{ p.name }}</span>
            <span class="player-kills">{{ formatStat(p.kills) }}</span>
            <span class="player-deaths">{{ formatStat(p.deaths) }}</span>
            <span class="player-score">{{ formatStat(p.score) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.card { position: relative; transition: border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
.card.chart-expanded {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) !important;
  width: min(90vw, 1200px); max-height: 90vh; overflow-y: auto;
  z-index: 100; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75);
}
.expand-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99;
}
.card-banner {
  position: absolute; top: 0; left: 0; right: 0; height: 320px;
  background-size: auto 100%; background-position: right top; background-repeat: no-repeat;
  mask-image: linear-gradient(to left, rgba(0,0,0,0.35) 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,0.35) 0%, transparent 100%);
  mix-blend-mode: screen; pointer-events: none; border-radius: 12px;
}
.card-content { position: relative; z-index: 1; padding: 24px; }

.card-header {
  display: flex; align-items: baseline; gap: 16px; margin-bottom: 20px;
  flex-wrap: wrap;
}
.match-time { color: rgba(var(--fg-rgb), 0.33); font-size: 13px; }
.match-map { color: rgba(var(--fg-rgb), 0.7); font-size: 13px; letter-spacing: 1px; }
.match-result { font-size: 14px; font-weight: 700; }
.match-score { font-size: 13px; color: rgba(var(--fg-rgb), 0.55); font-variant-numeric: tabular-nums; }

/* Metric grid: 3 cols × 2 rows */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px 24px;
  margin-bottom: 20px;
}
.metric { display: flex; flex-direction: column; align-items: flex-start; }
.metric-value {
  font-size: 28px; line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--fg-rgb));
}
.metric-unit { font-size: 13px; color: rgba(var(--fg-rgb), 0.4); margin-left: 2px; }
.metric-label {
  font-size: 11px; color: rgba(var(--fg-rgb), 0.45);
  letter-spacing: 1px; margin-top: 4px;
}

.chart-wrap { height: 180px; margin-top: 8px; position: relative; }
.no-timeline { color: rgba(var(--fg-rgb), 0.2); font-size: 13px; margin-top: 8px; }
.chart-wrap :deep(.chart-tooltip) {
  position: absolute; pointer-events: none;
  background: rgba(var(--bg-rgb), 0.85);
  border: 1px solid rgba(var(--fg-rgb), 0.15);
  border-radius: 6px; padding: 6px 10px;
  transition: opacity 0.15s; z-index: 10;
}

.card-toggles {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 6px; margin-top: 10px; flex-wrap: wrap;
}
.series-toggle {
  height: 26px; padding: 0 10px; border-radius: 6px;
  border: 1px solid rgba(var(--fg-rgb), 0.15);
  background: rgb(var(--bg-rgb)); color: rgba(var(--fg-rgb), 0.5);
  font-size: 11px; font-family: inherit; letter-spacing: 0.5px;
  cursor: pointer; transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.series-toggle:hover { border-color: rgba(var(--fg-rgb), 0.4); }
.series-toggle.active {
  background: rgb(var(--fg-rgb));
  border-color: rgb(var(--fg-rgb));
  color: rgb(var(--bg-rgb));
}
.toggle-expand-chart, .hamburger-icon {
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid rgba(var(--fg-rgb), 0.15);
  background: rgb(var(--bg-rgb)); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, border-color 0.2s; box-sizing: border-box;
}
.toggle-expand-chart:hover, .hamburger-icon:hover { border-color: rgba(var(--fg-rgb), 0.4); }
.toggle-expand-chart.active, .hamburger-icon.active {
  background: rgb(var(--fg-rgb)); border-color: rgb(var(--fg-rgb));
}
.toggle-expand-chart .expand-svg { width: 14px; height: 14px; color: rgba(var(--fg-rgb), 0.5); transition: color 0.2s; }
.toggle-expand-chart.active .expand-svg { color: rgb(var(--bg-rgb)); }
.hamburger-icon { flex-direction: column; gap: 3px; }
.hamburger-icon span {
  display: block; width: 14px; height: 1.5px;
  background: rgba(var(--fg-rgb), 0.5); border-radius: 1px;
  transition: background 0.2s;
}
.hamburger-icon.active span { background: rgb(var(--bg-rgb)); }

.expand-panel {
  display: grid; grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0; margin-top: 16px; border-top: 1px solid rgba(var(--fg-rgb), 0.06);
}
.expand-panel.open { grid-template-rows: 1fr; opacity: 1; }
.expand-panel > .player-list { overflow: hidden; padding-top: 12px; }
.player-list { display: flex; flex-direction: column; gap: 4px; }
.player-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(3, minmax(54px, 0.8fr));
  gap: 12px; align-items: center;
  font-size: 13px; font-variant-numeric: tabular-nums;
  padding: 6px 8px; border-radius: 4px;
  background: linear-gradient(to right, var(--band-color, transparent) 0%, transparent 70%);
}
.player-name {
  min-width: 0; color: rgba(var(--fg-rgb), 0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.player-kills, .player-deaths, .player-score {
  text-align: right; color: rgba(var(--fg-rgb), 0.65);
}
.player-score { font-weight: bold; color: rgb(var(--fg-rgb)); }
.player-head {
  padding-top: 0; padding-bottom: 8px;
  border-bottom: 1px solid rgba(var(--fg-rgb), 0.08);
  color: rgba(var(--fg-rgb), 0.35);
  font-size: 11px; letter-spacing: 0.8px;
  background: none;
}
.player-head .player-name,
.player-head .player-kills,
.player-head .player-deaths,
.player-head .player-score {
  color: inherit; font-weight: 500;
}

@media (max-width: 640px) {
  .metric-grid { grid-template-columns: repeat(3, 1fr); gap: 10px 12px; }
  .metric-value { font-size: 22px; }
  .player-row { grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(46px, 0.7fr)); gap: 8px; font-size: 12px; }
}
</style>
