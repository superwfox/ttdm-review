<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const scanlines = ref([])
const meteors = ref([])
let scanlineTimer = null
let meteorTimer = null
let scanlineId = 0
let meteorId = 0

function spawnScanline() {
  const isSingle = Math.random() > 0.5
  if (isSingle) {
    const id = ++scanlineId
    scanlines.value.push({ id })
    setTimeout(() => {
      scanlines.value = scanlines.value.filter(s => s.id !== id)
    }, 6000)
  } else {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const id = ++scanlineId
      const delay = i * 600
      setTimeout(() => {
        scanlines.value.push({ id })
        setTimeout(() => {
          scanlines.value = scanlines.value.filter(s => s.id !== id)
        }, 6000)
      }, delay)
    }
  }
}

function spawnMeteor() {
  const id = ++meteorId
  const offsetX = (Math.random() - 0.5) * 80 // -40vw ~ +40vw
  const angle = 30 + Math.random() * 25 // 30-55deg, roughly toward lower-left
  const duration = 3.5 + Math.random() * 2.5 // 3.5-6s
  const tailLen = 140 + Math.random() * 120 // 140-260px
  meteors.value.push({ id, offsetX, angle, duration, tailLen })
  setTimeout(() => {
    meteors.value = meteors.value.filter(m => m.id !== id)
  }, duration * 1000 + 200)
}

onMounted(() => {
  spawnScanline()
  scanlineTimer = setInterval(spawnScanline, 5000 + Math.random() * 3000)
  meteorTimer = setInterval(spawnMeteor, 4500)
})

onUnmounted(() => {
  clearInterval(scanlineTimer)
  clearInterval(meteorTimer)
})
</script>

<template>
  <div class="bg-scanlines">
    <div
      v-for="line in scanlines"
      :key="line.id"
      class="scanline"
    ></div>
    <div
      v-for="m in meteors"
      :key="m.id"
      class="meteor"
      :style="{
        '--m-offset': m.offsetX + 'vw',
        '--m-angle': m.angle + 'deg',
        '--m-duration': m.duration + 's',
        height: m.tailLen + 'px'
      }"
    ></div>
  </div>
</template>

<style scoped>
.bg-scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.scanline {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 300vmax;
  height: 240px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(var(--fg-rgb),0.03) 20%,
    rgba(var(--fg-rgb),0.05) 50%,
    rgba(var(--fg-rgb),0.03) 80%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 0;
  animation: scanline-sweep 6s linear forwards;
  transform-origin: center center;
}

@keyframes scanline-sweep {
  0% {
    transform: translate(-50%, -50%) rotate(-45deg) translateY(170vmax) scaleY(0.22);
    opacity: 0;
  }
  10% {
    transform: translate(-50%, -50%) rotate(-45deg) translateY(100vmax) scaleY(0.38);
    opacity: 1;
  }
  28% {
    transform: translate(-50%, -50%) rotate(-45deg) translateY(28vmax) scaleY(1.08);
  }
  38% {
    transform: translate(-50%, -50%) rotate(-45deg) translateY(0vmax) scaleY(1.45);
  }
  48% {
    transform: translate(-50%, -50%) rotate(-45deg) translateY(-18vmax) scaleY(1.08);
  }
  86% {
    transform: translate(-50%, -50%) rotate(-45deg) translateY(-100vmax) scaleY(0.38);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(-45deg) translateY(-170vmax) scaleY(0.22);
    opacity: 0;
  }
}

/* Meteor: bright head at bottom (leading edge), fading trail above */
/* Direction is independent from scanlines — each meteor has its own random angle */
.meteor {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 200px;
  /* Head (bright) at bottom = leading edge; tail (transparent) at top = trailing */
  background: linear-gradient(
    to top,
    rgba(255,255,255,0.9) 0%,
    wheat 3%,
    rgba(245,222,179,0.5) 12%,
    rgba(245,222,179,0.2) 35%,
    rgba(245,222,179,0.06) 60%,
    transparent 100%
  );
  border-radius: 2px;
  pointer-events: none;
  z-index: 0;
  animation: meteor-fall var(--m-duration, 4.5s) linear forwards;
  transform-origin: center center;
  /* Soft ambient glow along the trail */
  box-shadow:
    0 0 8px 2px rgba(255,255,255,0.25),
    0 0 18px 4px rgba(245,222,179,0.12);
}

/* Bright glowing head at the leading edge (bottom) */
.meteor::before {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  background: #fff;
  border-radius: 1px;
  box-shadow:
    0 0 6px 3px rgba(255,255,255,0.8),
    0 0 16px 6px rgba(245,222,179,0.5),
    0 0 30px 10px rgba(245,222,179,0.15);
}

/* Trailing debris particles — gradually smaller squares behind the head */
.meteor::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  background: transparent;
  /* Each box-shadow is a particle: (drift, distance-behind, blur, size, color) */
  box-shadow:
     1px  -18px  1px 1.8px rgba(255,255,255,0.6),
    -2px  -42px  1px 1.5px rgba(255,255,255,0.45),
     2px  -70px  1px 1.2px rgba(245,222,179,0.38),
    -1px -100px  1px 1px   rgba(245,222,179,0.28),
     2px -135px  0   0.8px rgba(245,222,179,0.2),
    -2px -170px  0   0.6px rgba(245,222,179,0.12),
     1px -210px  0   0.5px rgba(245,222,179,0.07);
}

@keyframes meteor-fall {
  0% {
    transform: translate(-50%, -50%) rotate(var(--m-angle, 40deg)) translate(var(--m-offset, 0), -130vmax);
    opacity: 0;
  }
  4% {
    opacity: 1;
  }
  92% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--m-angle, 40deg)) translate(var(--m-offset, 0), 130vmax);
    opacity: 0;
  }
}
</style>
