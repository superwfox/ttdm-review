<script setup>
</script>

<template>
  <div class="brand-wrap">
    <div class="brand-mask"></div>
    <div class="brand-text">
      <div class="brand-title">TTDM-Review</div>
      <div class="brand-sub">MADE BY SUDARK</div>
    </div>
  </div>
</template>

<style scoped>
.brand-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 96px;
  z-index: 20;
  pointer-events: none;
}

/* Soft gradient with blur that bleeds over any card scrolling behind the label */
.brand-mask {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: linear-gradient(
    160deg,
    rgb(var(--bg-rgb)) 0%,
    rgba(var(--bg-rgb), 0.75) 60%,
    transparent 100%
  );
  z-index: 1;
}

.brand-text {
  position: absolute;
  top: 22px;
  left: 28px;
  z-index: 2;
  letter-spacing: 1px;
}

.brand-title {
  font-size: 22px;
  font-weight: 700;
  color: rgb(var(--fg-rgb));
  line-height: 1;
}

.brand-sub {
  font-size: 10px;
  color: rgba(var(--fg-rgb), 0.45);
  letter-spacing: 2px;
  margin-top: 6px;
}
</style>
