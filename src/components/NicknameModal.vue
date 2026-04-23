<script setup>
import { ref } from 'vue'

const props = defineProps({
  playerName: { type: String, default: '' },
  currentNickname: { type: String, default: '' }
})

const emit = defineEmits(['close', 'save'])

const nickname = ref(props.currentNickname || '')
const saving = ref(false)
const errorMsg = ref('')

async function save() {
  const val = nickname.value.trim()
  if (!val) return

  saving.value = true
  errorMsg.value = ''

  try {
    const res = await fetch('/api/nickname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: val })
    })
    const data = await res.json()
    if (!data.ok) {
      errorMsg.value = data.error || '设置失败'
      return
    }
    emit('save', val)
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="nickname-overlay" @click.self="$emit('close')">
    <div class="nickname-modal">
      <div class="nickname-title">设置别名</div>
      <div class="nickname-desc">
        当其他用户搜索此名称时，会自动重定向到
        <strong>{{ playerName }}</strong>
      </div>
      <input
        v-model="nickname"
        class="nickname-input"
        placeholder="输入别名"
        maxlength="32"
        @keydown.enter="save"
      />
      <p v-if="errorMsg" class="nickname-error">{{ errorMsg }}</p>
      <div class="nickname-actions">
        <button class="nickname-btn cancel" @click="$emit('close')">取消</button>
        <button class="nickname-btn confirm" :disabled="saving || !nickname.trim()" @click="save">
          {{ saving ? '...' : '确认' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nickname-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(var(--bg-rgb), 0.5);
  padding-bottom: 32px;
}

.nickname-modal {
  background: rgb(var(--o-mid));
  border: 1px solid rgba(var(--o-bright), 0.5);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  animation: slideUp 0.3s ease;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
}

@keyframes slideUp {
  from { transform: translateY(40px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.nickname-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}

.nickname-desc {
  font-size: 13px;
  color: rgba(var(--fg-rgb), 0.5);
  margin-bottom: 16px;
  line-height: 1.5;
}

.nickname-desc strong {
  color: rgba(var(--fg-rgb), 0.8);
}

.nickname-input {
  width: 100%;
  background: rgb(var(--o-deep));
  border: 1px solid rgba(var(--o-bright), 0.3);
  border-radius: 8px;
  color: rgb(var(--fg-rgb));
  padding: 12px 16px;
  font-size: 16px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.nickname-input:focus {
  border-color: rgb(var(--o-bright));
}

.nickname-error {
  color: #f44;
  font-size: 13px;
  margin-top: 8px;
}

.nickname-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}

.nickname-btn {
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s;
}

.nickname-btn.cancel,
.nickname-btn.confirm {
  background: rgb(var(--fg-rgb));
  color: rgb(var(--bg-rgb));
}

.nickname-btn.cancel {
  opacity: 0.6;
}

.nickname-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
