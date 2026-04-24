<script setup>
</script>

<template>
  <div class="brand-bar">
    <div class="brand-mask"></div>
    <div class="brand-text">
      <div class="brand-title">TTDM-Review</div>
      <div class="brand-sub">MADE BY SUDARK</div>
    </div>
  </div>
</template>

<style scoped>
/* Full-width fixed top bar. The mask is wider + taller so the lower edge */
/* fades smoothly into the scrolling area behind it.                    */
.brand-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  z-index: 20;
  pointer-events: none;
}

.brand-mask {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: linear-gradient(
    180deg,
    rgb(var(--bg-rgb)) 0%,
    rgba(var(--bg-rgb), 0.85) 50%,
    rgba(var(--bg-rgb), 0.45) 80%,
    transparent 100%
  );
  /* The soft fade — blur itself also needs to taper so cards reappear crisp */
  mask-image: linear-gradient(180deg, #000 0%, #000 55%, rgba(0,0,0,0.6) 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 55%, rgba(0,0,0,0.6) 80%, transparent 100%);
  z-index: 1;
}

.brand-text {
  position: absolute;
  top: 24px;
  left: 36px;
  z-index: 2;
  letter-spacing: 1px;
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--fg-rgb));
  line-height: 1;
}

.brand-sub {
  font-size: 11px;
  color: rgba(var(--fg-rgb), 0.5);
  letter-spacing: 2px;
  margin-top: 8px;
}
</style>
