<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import dotsData from '@/assets/titan_dots.json'

const props = defineProps({
  titanType: { type: String, default: 'legion' }
})

const canvasRef = ref(null)

const HOLD = 4000
const TRANS = 2800
const PHASE = HOLD + TRANS
const DOT_RADIUS = 1.6

// State kept outside reactive (changes per frame)
let ctx = null
let W = 0, H = 0, DPR = 1
let shapes = []      // [sPts, bPts]
let particles = []
let phase = 0
let phaseStart = 0
let rafId = 0
let activeTitan = null
let resizeObs = null

function pngPts(normPts, srcAspect, fit) {
  const canvasAspect = W / H
  let drawW, drawH
  if (canvasAspect > srcAspect) {
    drawH = H * fit
    drawW = drawH * srcAspect
  } else {
    drawW = W * fit
    drawH = drawW / srcAspect
  }
  const ox = (W - drawW) / 2
  const oy = (H - drawH) / 2
  return normPts.map(p => ({ x: ox + p[0] * drawW, y: oy + p[1] * drawH }))
}

function buildShapes(titan) {
  const entry = dotsData[titan] || dotsData.legion
  shapes = [
    pngPts(entry.s.pts, entry.s.w / entry.s.h, 0.78),
    pngPts(entry.b.pts, entry.b.w / entry.b.h, 0.98)
  ]
}

function initParticles(n) {
  particles = []
  for (let i = 0; i < n; i++) {
    particles.push({
      via: { x: Math.random() * W, y: Math.random() * H },
      phX1: Math.random() * Math.PI * 2, phY1: Math.random() * Math.PI * 2,
      spX1: 0.18 + Math.random() * 0.22,
      spY1: 0.18 + Math.random() * 0.22,
      amX1: (0.8 + Math.random() * 2.5) * 1.5,
      amY1: (0.8 + Math.random() * 2.5) * 1.5,
      phX2: Math.random() * Math.PI * 2, phY2: Math.random() * Math.PI * 2,
      spX2: 0.55 + Math.random() * 0.55,
      spY2: 0.55 + Math.random() * 0.55,
      amX2: (0.25 + Math.random() * 0.8) * 1.5,
      amY2: (0.25 + Math.random() * 0.8) * 1.5,
      phA: Math.random() * Math.PI * 2,
      spA: 0.25 + Math.random() * 0.35
    })
  }
}

function setup() {
  const canvas = canvasRef.value
  if (!canvas) return
  DPR = window.devicePixelRatio || 1
  W = canvas.clientWidth
  H = canvas.clientHeight
  if (W === 0 || H === 0) return
  canvas.width = Math.floor(W * DPR)
  canvas.height = Math.floor(H * DPR)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

  buildShapes(activeTitan)
  if (!particles.length || particles.length !== shapes[0].length) {
    initParticles(shapes[0].length)
  }
}

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function tick(t) {
  rafId = requestAnimationFrame(tick)
  if (!shapes.length) return

  if (t - phaseStart >= PHASE) {
    phase = (phase + 1) % shapes.length
    phaseStart = t
    // Randomize via points for each particle on phase swap
    for (const p of particles) {
      p.via.x = Math.random() * W
      p.via.y = Math.random() * H
    }
  }
  const el = t - phaseStart
  const prog = el > HOLD ? ease(Math.min(1, (el - HOLD) / TRANS)) : 0
  const A = shapes[phase]
  const B = shapes[(phase + 1) % shapes.length]

  ctx.clearRect(0, 0, W, H)
  const ts = t * 0.001
  ctx.fillStyle = '#DCD7C9'

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i], a = A[i], b = B[i]
    let x, y
    if (!prog) { x = a.x; y = a.y }
    else {
      const om = 1 - prog
      x = om * om * a.x + 2 * om * prog * p.via.x + prog * prog * b.x
      y = om * om * a.y + 2 * om * prog * p.via.y + prog * prog * b.y
    }
    x += Math.sin(ts * p.spX1 + p.phX1) * p.amX1
       + Math.sin(ts * p.spX2 + p.phX2) * p.amX2
    y += Math.cos(ts * p.spY1 + p.phY1) * p.amY1
       + Math.cos(ts * p.spY2 + p.phY2) * p.amY2
    ctx.globalAlpha = 0.86 + Math.sin(ts * p.spA + p.phA) * 0.14
    ctx.beginPath()
    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function onResize() {
  setup()
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  activeTitan = props.titanType
  setup()
  phaseStart = performance.now()
  resizeObs = new ResizeObserver(onResize)
  resizeObs.observe(canvasRef.value)
  rafId = requestAnimationFrame(tick)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  if (resizeObs) resizeObs.disconnect()
})

watch(() => props.titanType, (t) => {
  if (t === activeTitan) return
  activeTitan = t
  buildShapes(activeTitan)
  // Reset phase so it holds the newly-loaded s before morphing to b
  phase = 0
  phaseStart = performance.now()
})
</script>

<template>
  <canvas ref="canvasRef" class="dot-matrix"></canvas>
</template>

<style scoped>
.dot-matrix {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
