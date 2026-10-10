<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { worldApi } from '../api/world'
import type { World } from '../types'

const router = useRouter()
const worlds = ref<World[]>([])
const name = ref('星港初航')
const seed = ref(20260101)
const loading = ref(false)
const error = ref('')

async function load() { try { worlds.value = (await worldApi.list()).data } catch { error.value = '无法读取世界列表。' } }
async function create() {
  loading.value = true; error.value = ''
  try { const world = (await worldApi.create({ name: name.value, seed: seed.value })).data; router.push(`/worlds/${world.id}`) }
  catch (err: any) { error.value = err.response?.data?.message || '创建世界失败。' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="page narrow-page">
    <div class="page-heading"><div><p class="eyebrow">WORLD SELECTOR / 01</p><h1>选择一个世界</h1><p class="lede">每个世界都有自己的时间、规则和记忆。</p></div></div>
    <div class="world-grid">
      <button v-for="world in worlds" :key="world.id" class="world-card" @click="router.push(`/worlds/${world.id}`)"><span class="card-index">WORLD {{ String(world.id).padStart(2, '0') }}</span><strong>{{ world.name }}</strong><span>seed · {{ world.seed }}</span><span class="card-arrow">↗</span></button>
      <form class="world-card create-card" @submit.prevent="create"><span class="card-index">NEW SIMULATION</span><strong>创建种子世界</strong><input v-model="name" aria-label="世界名称" /><input v-model.number="seed" aria-label="随机种子" type="number" /><button class="primary-button" :disabled="loading">{{ loading ? '创建中…' : '初始化世界 →' }}</button></form>
    </div>
    <p v-if="error" class="error-message">{{ error }}</p>
  </section>
</template>
