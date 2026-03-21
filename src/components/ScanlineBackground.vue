<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const scanlines = ref([])
let scanlineTimer = null
let scanlineId = 0

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

onMounted(() => {
  spawnScanline()
  scanlineTimer = setInterval(spawnScanline, 5000 + Math.random() * 3000)
})

onUnmounted(() => {
  clearInterval(scanlineTimer)
})
</script>

<template>
  <div class="bg-scanlines">
    <div
      v-for="line in scanlines"
      :key="line.id"
      class="scanline"
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
    rgba(255,255,255,0.4) 20%,
    rgba(255,255,255,0.8) 50%,
    rgba(255,255,255,0.4) 80%,
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
</style>
