<script setup>
import { ref, onMounted } from 'vue'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarElement,
  BarController,
  LineController,
  Filler,
  Tooltip
} from 'chart.js'
import ScanlineBackground from './components/ScanlineBackground.vue'
import SearchBar from './components/SearchBar.vue'
import MatchCard from './components/MatchCard.vue'
import SummaryCard from './components/SummaryCard.vue'
import NicknameModal from './components/NicknameModal.vue'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, BarElement, BarController, LineController, Filler, Tooltip)

// Titan type config
// Banner images support multiple variants: titan_b.png, titan_b1.png, titan_b2.png, etc.
// Add new banner images to public/titans/ following the naming pattern, then add paths to the banners array.
const TITANS = {
  legion:    { name: '军团',   color: '#00e5ff', icon: '/titans/legion_s.png',    banners: ['/titans/legion_b.png'] },
  ronin:     { name: '浪人',   color: '#ffd600', icon: '/titans/ronin_s.png',     banners: ['/titans/ronin_b.png'] },
  northstar: { name: '北极星', color: '#448aff', icon: '/titans/northstar_s.png', banners: ['/titans/northstar_b.png'] },
  scorch:    { name: '烈焰',   color: '#ff9100', icon: '/titans/scorch_s.png',    banners: ['/titans/scorch_b.png'] },
  tone:      { name: '强力',   color: '#c6ff00', icon: '/titans/tone_s.png',      banners: ['/titans/tone_b.png'] },
  monarch:   { name: '帝王',   color: '#d500f9', icon: '/titans/monarch_s.png',   banners: ['/titans/monarch_b.png'] },
  ion:       { name: '离子',   color: '#ff1744', icon: '/titans/ion_s.png',       banners: ['/titans/ion_b.png'] },
  pilot:     { name: '铁驭',   color: '#aaaaaa', icon: null, banners: [] },
  unknown:   { name: '',       color: '#333333', icon: null, banners: [] }
}

function getTitanColor(type) {
  return TITANS[type]?.color || '#ffffff'
}

const searchName = ref('')
const matches = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const searched = ref(false)
const hasMore = ref(false)

// Nickname system
const showNicknameModal = ref(false)
const nicknamePlayerName = ref('')
const currentNickname = ref('')
const hasNicknameRecord = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/api/nickname')
    const data = await res.json()
    if (data.ok && data.has_record) {
      nicknamePlayerName.value = data.player_name
      hasNicknameRecord.value = true
      if (!data.has_nickname) {
        showNicknameModal.value = true
      } else {
        currentNickname.value = data.nickname
      }
    }
  } catch {}
})

function onNicknameSaved(nick) {
  currentNickname.value = nick
  showNicknameModal.value = false
}

function openNicknameModal() {
  showNicknameModal.value = true
}

async function search() {
  const name = searchName.value.trim()
  if (!name) return

  loading.value = true
  error.value = ''
  matches.value = []
  searched.value = true
  hasMore.value = false

  try {
    const res = await fetch(`/api/query?name=${encodeURIComponent(name)}&offset=0`)
    const data = await res.json()
    if (!data.ok) {
      error.value = data.error || 'Query failed'
      return
    }
    matches.value = data.matches
    hasMore.value = data.has_more
    // Handle nickname redirect
    if (data.redirected_from && data.actual_name) {
      searchName.value = data.actual_name
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  const name = searchName.value.trim()
  if (!name || loadingMore.value) return

  loadingMore.value = true

  try {
    const res = await fetch(`/api/query?name=${encodeURIComponent(name)}&offset=${matches.value.length}`)
    const data = await res.json()
    if (!data.ok) {
      error.value = data.error || 'Load more failed'
      return
    }
    matches.value.push(...data.matches)
    hasMore.value = data.has_more
  } catch (e) {
    error.value = e.message
  } finally {
    loadingMore.value = false
  }
}

function adjustHealth(t) {
  let hp = t.health
  if (!t.is_doomed && t.titan_type !== 'pilot' && t.titan_type !== 'unknown') {
    hp += 2500
  }
  if (hp > 65000) return 0
  return hp
}

function calcDamageTaken(timeline) {
  if (!timeline || timeline.length < 2) return 0
  let total = 0
  for (let i = 1; i < timeline.length; i++) {
    const prev = adjustHealth(timeline[i - 1])
    const curr = adjustHealth(timeline[i])
    if (curr < prev) {
      total += prev - curr
    }
  }
  return total
}

function getPlayerStat(match, name) {
  const p = match.players.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (!p) return null
  const avg = p.deaths > 0 ? Math.round(p.damage / p.deaths) : p.damage
  const damageTaken = calcDamageTaken(match.timeline)
  return { ...p, avg, damageTaken }
}

// Extract unique titan types used in a timeline (excluding pilot/unknown)
function getUsedTitans(timeline) {
  if (!timeline || !timeline.length) return []
  const types = new Set()
  for (const t of timeline) {
    const tt = t.titan_type
    if (tt && tt !== 'pilot' && tt !== 'unknown') types.add(tt)
  }
  return [...types]
}

// Get the primary titan (most samples) for banner background
function getPrimaryTitan(timeline) {
  if (!timeline || !timeline.length) return null
  const counts = {}
  for (const t of timeline) {
    const tt = t.titan_type
    if (tt && tt !== 'pilot' && tt !== 'unknown') {
      counts[tt] = (counts[tt] || 0) + 1
    }
  }
  let max = 0, primary = null
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) { max = v; primary = k }
  }
  return primary
}

// Build segmented chart data — each segment colored by titan type
// perLife: when true, damage resets on each death and y1Max is per-life max
function getChartData(timeline, perLife = false) {
  if (!timeline || !timeline.length) return null

  function adjustHealthChart(t) {
    const hp = adjustHealth(t)
    return { hp, executed: hp === 0 && t.health > 0 }
  }

  // Pre-compute life spans for per-life mode
  let indexToLifeMaxDmg = null
  if (perLife) {
    const spans = []
    let lifeStart = 0, dmg = 0
    for (let i = 0; i < timeline.length; i++) {
      const { hp } = adjustHealthChart(timeline[i])
      if (hp === 0) {
        spans.push({ start: lifeStart, end: i, totalDmg: dmg })
        lifeStart = i + 1
        dmg = 0
      } else {
        dmg += (timeline[i].delta_damage || 0)
      }
    }
    spans.push({ start: lifeStart, end: timeline.length - 1, totalDmg: dmg })
    indexToLifeMaxDmg = new Array(timeline.length)
    for (const span of spans) {
      for (let j = span.start; j <= span.end; j++) {
        indexToLifeMaxDmg[j] = span.totalDmg
      }
    }
  }

  const segments = []
  let runDmg = 0, lifeDmg = 0, maxLifeDmg = 0

  function makePoint(t, i) {
    const { hp, executed } = adjustHealthChart(t)
    const delta = t.delta_damage || 0
    runDmg += delta
    if (perLife) {
      if (hp === 0) lifeDmg = 0
      else lifeDmg += delta
      maxLifeDmg = Math.max(maxLifeDmg, lifeDmg)
    }
    const point = { x: i, y: hp, executed, titanType: t.titan_type, sampleNum: t.sample_num, deltaKills: t.delta_kills || 0 }
    if (perLife) {
      point.lifeDmg = lifeDmg
      point.lifeMaxDmg = indexToLifeMaxDmg[i]
    } else {
      point.cumDeltaDmg = runDmg
    }
    return point
  }

  const firstPoint = makePoint(timeline[0], 0)
  let cur = { type: timeline[0].titan_type, points: [firstPoint] }

  for (let i = 1; i < timeline.length; i++) {
    const t = timeline[i]
    const point = makePoint(t, i)
    if (t.titan_type !== cur.type) {
      cur.points.push(point)
      segments.push(cur)
      cur = { type: t.titan_type, points: [point] }
    } else {
      cur.points.push(point)
    }
  }
  segments.push(cur)

  const datasets = segments.map(seg => {
    const color = getTitanColor(seg.type)
    const hex = color
    const r = parseInt(hex.slice(1, 3), 16) || 0
    const g = parseInt(hex.slice(3, 5), 16) || 0
    const b = parseInt(hex.slice(5, 7), 16) || 0
    return {
      data: seg.points,
      borderColor: color,
      borderWidth: 1.5,
      pointRadius: 0,
      fill: { target: 'origin', above: `rgba(${r},${g},${b},0.06)` },
      tension: 0.1,
      parsing: { xAxisKey: 'x', yAxisKey: 'y' },
      spanGaps: true
    }
  })

  const hasDelta = timeline.some(t => t.delta_damage > 0)
  let cumDmg = 0
  if (hasDelta) {
    if (perLife) {
      let lDmg = 0
      const dmgPoints = timeline.map((t, i) => {
        const { hp } = adjustHealthChart(t)
        if (hp === 0) lDmg = 0
        else lDmg += (t.delta_damage || 0)
        return { x: i, y: lDmg }
      })
      const killRadii = timeline.map(t => (t.delta_kills > 0 ? 4 : 0))
      datasets.push({
        data: dmgPoints, borderColor: '#FF9ECF', borderWidth: 1.5,
        pointRadius: killRadii, pointBackgroundColor: '#FF9ECF', pointBorderColor: '#FF9ECF',
        hoverRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1',
        parsing: { xAxisKey: 'x', yAxisKey: 'y' }, spanGaps: true
      })
    } else {
      const dmgPoints = timeline.map((t, i) => { cumDmg += (t.delta_damage || 0); return { x: i, y: cumDmg } })
      const killRadii = timeline.map(t => (t.delta_kills > 0 ? 4 : 0))
      datasets.push({
        data: dmgPoints, borderColor: '#FF9ECF', borderWidth: 1.5,
        pointRadius: killRadii, pointBackgroundColor: '#FF9ECF', pointBorderColor: '#FF9ECF',
        hoverRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1',
        parsing: { xAxisKey: 'x', yAxisKey: 'y' }, spanGaps: true
      })
    }
  }

  return {
    datasets,
    y1Max: hasDelta ? (perLife ? Math.ceil(maxLifeDmg / 0.75) : Math.ceil(cumDmg / 0.75)) : undefined,
    totalPoints: timeline.length,
    perLife: !!perLife
  }
}
</script>

<template>
  <div class="app-root">
    <ScanlineBackground />

    <div class="container">
      <h1 class="title">  TTDM</h1>

      <SearchBar
        v-model="searchName"
        :loading="loading"
        @search="search"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <p v-if="!loading && searched && matches.length === 0" class="empty">
        无数据
      </p>

      <div class="cards">
        <SummaryCard
          v-if="matches.length > 0"
          :matches="matches"
          :searchName="searchName.trim()"
          :titans="TITANS"
          :getPlayerStat="getPlayerStat"
        />

        <MatchCard
          v-for="match in matches"
          :key="match.id"
          :match="match"
          :playerStat="getPlayerStat(match, searchName.trim())"
          :usedTitans="getUsedTitans(match.timeline)"
          :primaryTitan="getPrimaryTitan(match.timeline)"
          :chartData="getChartData(match.timeline)"
          :chartDataPerLife="getChartData(match.timeline, true)"
          :titans="TITANS"
        />
      </div>

      <div v-if="hasMore || hasNicknameRecord" class="load-more-wrap">
        <button v-if="hasMore" class="load-more-btn" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '...' : '加载更多' }}
        </button>
        <button v-if="hasNicknameRecord" class="nickname-edit-btn" @click="openNicknameModal">
          {{ currentNickname ? '修改别名' : '设置别名' }}
        </button>
      </div>
    </div>

    <NicknameModal
      v-if="showNicknameModal"
      :playerName="nicknamePlayerName"
      :currentNickname="currentNickname"
      @close="showNicknameModal = false"
      @save="onNicknameSaved"
    />
  </div>
</template>

<style>
/* Root wrapper */
.app-root {
  position: relative;
  min-height: 100vh;
}

/* Card — solid orange, three brightness levels used across the app */
.glass-card {
  background: rgb(var(--o-mid));
  border: 1px solid rgba(var(--o-bright), 0.35);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

/* Layout */
.container {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 20px;
}

.title {
  font-size: 48px;
  margin-bottom: -20px;
  font-weight: 900;
  position: relative;
  z-index: 2;
}

.error {
  color: #f44;
  margin-bottom: 16px;
}

.empty {
  color: rgba(var(--fg-rgb), 0.27);
  text-align: center;
  margin-top: 40px;
}

/* Cards */
.cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Load more */
.load-more-wrap {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.load-more-btn,
.nickname-edit-btn {
  background: rgb(var(--o-mid));
  color: rgb(var(--fg-rgb));
  border: 1px solid rgba(var(--o-bright), 0.5);
  border-radius: 8px;
  padding: 12px 48px;
  font-size: 16px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.load-more-btn:hover,
.nickname-edit-btn:hover {
  background: rgb(var(--o-bright));
  color: rgb(var(--bg-rgb));
  border-color: rgb(var(--o-bright));
}

.load-more-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
