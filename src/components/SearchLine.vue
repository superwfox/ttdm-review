<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'search'])

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function onKeydown(e) {
  if (e.key === 'Enter') emit('search')
}
</script>

<template>
  <div class="search-line" :class="{ focused: !!modelValue }">
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
    <div class="underline"></div>
  </div>
</template>

<style scoped>
.search-line {
  position: relative;
  width: 100%;
  padding: 6px 2px 10px 2px;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: rgb(var(--fg-rgb));
  font-family: inherit;
  font-size: 18px;
  padding: 0 2px;
  letter-spacing: 2px;
}

.placeholder {
  position: absolute;
  top: 50%;
  left: 4px;
  transform: translateY(-56%);
  pointer-events: none;
  color: rgba(var(--fg-rgb), 0.35);
  font-size: 16px;
  letter-spacing: 2px;
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
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(var(--fg-rgb), 0.35);
  transition: background 0.25s;
}

.search-line.focused .underline,
.search-input:focus ~ .underline {
  background: rgb(var(--fg-rgb));
}
</style>
