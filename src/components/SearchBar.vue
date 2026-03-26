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
  <div class="search-bar">
    <input
      :value="modelValue"
      @input="onInput"
      @keydown="onKeydown"
      placeholder="输入玩家ID查询"
      class="search-input"
    />
    <button @click="$emit('search')" :disabled="loading" class="search-btn">
      {{ loading ? '...' : '查询' }}
    </button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  padding: 26px 6px 6px 6px;
  position: relative;
  background: rgba(var(--bg-rgb), 0.22);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(var(--fg-rgb), 0.1);
  border-radius: 12px;
  overflow: hidden;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgb(var(--fg-rgb));
  padding: 14px 20px;
  font-size: 30px;
  font-family: inherit;
  outline: none;
}

.search-input::placeholder {
  color: rgba(var(--fg-rgb), 0.27);
}

.search-btn {
  background: rgb(var(--fg-rgb));
  color: rgb(var(--bg-rgb));
  border: none;
  border-radius: 8px;
  padding: 10px 28px;
  font-size: 20px;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s;
  align-self: flex-start;
}

.search-btn:hover {
  opacity: 0.85;
}

.search-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
