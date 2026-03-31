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
  const offset = (Math.random() - 0.5) * 80 // -40vw ~ +40vw
  meteors.value.push({ id, offset })
  setTimeout(() => {
    meteors.value = meteors.value.filter(m => m.id !== id)
  }, 5800)
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
      :style="{ '--m-offset': m.offset + 'vw' }"
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

/* Meteor: small white square head + long wheat tail, slight glow */
.meteor {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 200px;
  background: linear-gradient(
    to bottom,
    #ffffff 0%,
    #ffffff 1.5%,
    wheat 4%,
    rgba(245,222,179,0.5) 30%,
    rgba(245,222,179,0.15) 60%,
    transparent 100%
  );
  border-radius: 1.5px;
  pointer-events: none;
  z-index: 0;
  animation: meteor-sweep 5.6s linear forwards;
  transform-origin: center center;
  box-shadow:
    0 0 4px 1px rgba(255,255,255,0.35),
    0 0 10px 2px rgba(245,222,179,0.2);
}

@keyframes meteor-sweep {
  0% {
    transform: translate(-50%, -50%) rotate(-45deg) translate(var(--m-offset), 130vmax);
    opacity: 0;
  }
  4% {
    opacity: 1;
  }
  92% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(-45deg) translate(var(--m-offset), -130vmax);
    opacity: 0;
  }
}
</style>
