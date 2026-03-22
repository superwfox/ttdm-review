<script setup>
import { ref } from 'vue'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
} from 'chart.js'
import ScanlineBackground from './components/ScanlineBackground.vue'
import SearchBar from './components/SearchBar.vue'
import MatchCard from './components/MatchCard.vue'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

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
const error = ref('')
const searched = ref(false)

async function search() {
  const name = searchName.value.trim()
  if (!name) return

  loading.value = true
  error.value = ''
  matches.value = []
  searched.value = true

  try {
    const res = await fetch(`/api/query?name=${encodeURIComponent(name)}`)
    const data = await res.json()
    if (!data.ok) {
      error.value = data.error || 'Query failed'
      return
    }
    matches.value = data.matches.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function getPlayerStat(match, name) {
  const p = match.players.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (!p) return null
  const avg = p.deaths > 0 ? Math.round(p.damage / p.deaths) : p.damage
  return { ...p, avg }
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
function getChartData(timeline) {
  if (!timeline || !timeline.length) return null

  function adjustHealth(t) {
    let hp = t.health
    if (!t.is_doomed && t.titan_type !== 'pilot' && t.titan_type !== 'unknown') {
      hp += 2500
    }
    return hp > 60000 ? 0 : hp
  }

  const segments = []
  let cur = { type: timeline[0].titan_type, points: [{ x: 0, y: adjustHealth(timeline[0]), titanType: timeline[0].titan_type, sampleNum: timeline[0].sample_num }] }

  for (let i = 1; i < timeline.length; i++) {
    const t = timeline[i]
    const point = { x: i, y: adjustHealth(t), titanType: t.titan_type, sampleNum: t.sample_num }
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
    return {
      data: seg.points,
      borderColor: color,
      borderWidth: 1.5,
      pointRadius: 0,
      fill: {
        target: 'origin',
        above: color
      },
      tension: 0.1,
      parsing: { xAxisKey: 'x', yAxisKey: 'y' },
      spanGaps: true
    }
  })

  // For fill to work with hex colors, convert to rgba
  for (const ds of datasets) {
    const hex = ds.borderColor
    const r = parseInt(hex.slice(1, 3), 16) || 0
    const g = parseInt(hex.slice(3, 5), 16) || 0
    const b = parseInt(hex.slice(5, 7), 16) || 0
    ds.fill = { target: 'origin', above: `rgba(${r},${g},${b},0.06)` }
  }

  return {
    datasets
  }
}
</script>

<template>
  <div class="app-root">
    <ScanlineBackground />

    <div class="container">
      <h1 class="title">TTDM</h1>

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
        <MatchCard
          v-for="match in matches"
          :key="match.id"
          :match="match"
          :playerStat="getPlayerStat(match, searchName.trim())"
          :usedTitans="getUsedTitans(match.timeline)"
          :primaryTitan="getPrimaryTitan(match.timeline)"
          :chartData="getChartData(match.timeline)"
          :titans="TITANS"
        />
      </div>
    </div>
  </div>
</template>

<style>
/* Root wrapper */
.app-root {
  position: relative;
  min-height: 100vh;
}

/* Glass card */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
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
  text-align: center;
  font-size: 48px;
  letter-spacing: 4px;
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
  color: #444;
  text-align: center;
  margin-top: 40px;
}

/* Cards */
.cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
