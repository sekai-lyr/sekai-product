<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../api/world'
import { useAuth } from '../stores/auth'

const router = useRouter()
const auth = useAuth()
const registerMode = ref(false)
const email = ref('observer@sekai.local')
const password = ref('sekai-demo-123')
const displayName = ref('星港观察者')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const response = registerMode.value
      ? await authApi.register({ email: email.value, password: password.value, displayName: displayName.value })
      : await authApi.login({ email: email.value, password: password.value })
    auth.setSession(response.data.token, response.data.user)
    router.push('/worlds')
  } catch (err: any) {
    error.value = err.response?.data?.message || '无法连接世界引擎，请检查后端是否已启动。'
  } finally { loading.value = false }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-orbit"><span></span><span></span><span></span></div>
    <div class="auth-copy"><p class="eyebrow">SEKAI / WORLD ENGINE</p><h1>让世界<br /><span>自己运行。</span></h1><p>设定一个世界，观察它如何在时间里改变。你的行为会成为历史的一部分。</p></div>
    <form class="auth-card" @submit.prevent="submit">
      <p class="eyebrow">{{ registerMode ? 'CREATE OBSERVER' : 'WELCOME BACK' }}</p>
      <h2>{{ registerMode ? '建立观察者身份' : '进入世界' }}</h2>
      <label>邮箱<input v-model="email" type="email" required /></label>
      <label v-if="registerMode">显示名称<input v-model="displayName" required /></label>
      <label>密码<input v-model="password" type="password" minlength="8" required /></label>
      <p v-if="error" class="error-message">{{ error }}</p>
      <button class="primary-button full-width" :disabled="loading">{{ loading ? '连接中…' : registerMode ? '创建身份' : '开始观察' }}</button>
      <button type="button" class="text-button" @click="registerMode = !registerMode">{{ registerMode ? '已有身份？返回登录' : '第一次进入？创建身份' }}</button>
    </form>
  </section>
</template>
