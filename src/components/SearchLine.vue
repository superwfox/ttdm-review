<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  titanName: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'search'])

const measureRef = ref(null)
const honorific = ref('大佬')
const now = ref(new Date())

const HONORIFICS = ['大佬', '高手', '大手子', '大人']

onMounted(() => {
  honorific.value = HONORIFICS[Math.floor(Math.random() * HONORIFICS.length)]
  // Refresh greeting every minute so the phrase changes when the hour rolls over
  setInterval(() => { now.value = new Date() }, 60_000)
})

function greetingByHour(h) {
  if (h >= 5 && h < 8)   return '早上好'
  if (h >= 8 && h < 11)  return '上午好'
  if (h >= 11 && h < 13) return '中午好'
  if (h >= 13 && h < 16) return '下午好'
  if (h >= 16 && h < 18) return '已经是傍晚'
  if (h >= 18 && h < 19) return '现在是晚饭时间'
  if (h >= 19 && h < 22) return '晚上好'
  if (h >= 22 && h < 24) return '时间不早了'
  if (h >= 0 && h < 3)   return '已经是深夜'
  return '凌晨了'
}

const greeting = computed(() => {
  if (!props.titanName) return ''
  const g = greetingByHour(now.value.getHours())
  return `${g},${props.titanName}${honorific.value}`
})

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
    <div v-if="greeting" class="greeting">{{ greeting }}</div>
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

.underline {
  position: absolute;
  right: 0;
  bottom: 30px;
  height: 1px;
  background: rgba(var(--fg-rgb), 0.55);
  transition: width 0.25s cubic-bezier(.4,0,.2,1), background 0.25s;
}

.search-input:focus ~ .underline {
  background: rgb(var(--fg-rgb));
}

.greeting {
  margin-top: 8px;
  font-size: 13px;
  letter-spacing: 2px;
  color: rgba(var(--fg-rgb), 0.55);
  text-align: right;
  padding-right: 4px;
}
</style>
