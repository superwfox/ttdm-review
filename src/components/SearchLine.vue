<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'search'])

const measureRef = ref(null)

// Measure text width to drive underline width; min = placeholder width
const textWidth = computed(() => {
  const el = measureRef.value
  if (!el) return 140
  return Math.max(140, el.offsetWidth + 24)
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function onKeydown(e) {
  if (e.key === 'Enter') emit('search')
}
</script>

<template>
  <div class="search-line">
    <span ref="measureRef" class="measure" aria-hidden="true">{{ modelValue || '输入名称' }}</span>
    <input
      :value="modelValue"
      @input="onInput"
      @keydown="onKeydown"
      class="search-input"
      autocomplete="off"
      spellcheck="false"
    />
    <span v-if="!modelValue && !loading" class="placeholder">输入名称</span>
    <span v-else-if="loading" class="placeholder loading">查询中…</span>
    <div class="underline" :style="{ width: textWidth + 'px' }"></div>
  </div>
</template>

<style scoped>
.search-line {
  position: relative;
  width: 100%;
  padding: 10px 4px 14px 4px;
  text-align: right;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: rgb(var(--fg-rgb));
  font-family: inherit;
  font-size: 30px;
  padding: 0 4px;
  letter-spacing: 3px;
  text-align: right;
}

/* Hidden mirror span that gives us the pixel width of the current text */
.measure {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  pointer-events: none;
  font-size: 30px;
  letter-spacing: 3px;
  padding: 0 4px;
  font-family: inherit;
}

.placeholder {
  position: absolute;
  bottom: 18px;
  right: 8px;
  pointer-events: none;
  color: rgba(var(--fg-rgb), 0.35);
  font-size: 28px;
  letter-spacing: 3px;
  animation: blink 2.5s ease-in-out infinite;
}

.placeholder.loading {
  animation-duration: 1.2s;
}

@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50%       { opacity: 0.75; }
}

/* Underline anchored to the right — width follows text length, so it grows leftward */
.underline {
  position: absolute;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(var(--fg-rgb), 0.55);
  transition: width 0.25s cubic-bezier(.4,0,.2,1), background 0.25s;
}

.search-input:focus ~ .underline {
  background: rgb(var(--fg-rgb));
}
</style>
