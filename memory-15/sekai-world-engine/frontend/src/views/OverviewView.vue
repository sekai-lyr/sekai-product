<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { worldApi } from '../api/world'
import type { AdvanceResult, WorldState } from '../types'

const route = useRoute(); const router = useRouter(); const worldId = Number(route.params.worldId)
const state = ref<WorldState | null>(null); const lastAdvance = ref<AdvanceResult | null>(null); const loading = ref(true); const advancing = ref(false); const error = ref('')
const activeBranch = computed(() => state.value?.overview.branches.find(branch => branch.id === state.value?.branchId))
async function load() { loading.value = true; try { const overview = (await worldApi.overview(worldId)).data; state.value = (await worldApi.state(worldId, overview.branches[0].id)).data } catch (err: any) { error.value = err.response?.data?.message || '无法载入世界。' } finally { loading.value = false } }
async function advance() { if (!state.value) return; advancing.value = true; error.value = ''; try { lastAdvance.value = (await worldApi.advance(worldId, state.value.branchId, `day-${state.value.branchId}-${Date.now()}`)).data; await load() } catch (err: any) { error.value = err.response?.data?.message || '推进失败。' } finally { advancing.value = false } }
onMounted(load)
</script>

<template>
  <section class="page" v-if="state">
    <div class="page-heading overview-heading"><div><p class="eyebrow">{{ state.overview.world.name }} / OVERVIEW</p><h1>世界正在呼吸。</h1><p class="lede">{{ state.overview.city.description }}</p></div><button class="primary-button advance-button" :disabled="advancing" @click="advance"><span class="pulse-dot"></span>{{ advancing ? '模拟中…' : '推进一天' }} <small>SPACE ↗</small></button></div>
    <p v-if="error" class="error-message">{{ error }}</p>
    <div class="signal-strip"><div><span>WORLD DATE</span><strong>{{ state.overview.clock.currentDate }}</strong></div><div><span>ACTIVE BRANCH</span><strong>{{ activeBranch?.name }}</strong></div><div><span>ACTORS</span><strong>{{ state.actors.length }} <i>living states</i></strong></div><div><span>TIMELINE</span><strong>{{ state.timeline.length }} <i>records</i></strong></div></div>
    <div class="overview-grid"><div class="panel event-panel"><div class="panel-heading"><div><p class="eyebrow">TODAY'S TRACE</p><h2>今日发生</h2></div><router-link :to="`/worlds/${worldId}/timeline`">查看全部 ↗</router-link></div><div v-if="state.events.length" class="event-list"><button v-for="event in state.events.slice(0, 4)" :key="event.id" class="event-row" @click="router.push(`/worlds/${worldId}/events/${event.id}?branchId=${state.branchId}`)"><span class="event-mark">✦</span><span><strong>{{ event.title }}</strong><small>{{ event.description }}</small></span><em>{{ event.status === 'PENDING' ? '待处理' : '已解决' }}</em></button></div><div v-else class="empty-state">时间还没有留下事件。推进一天，让城市开始行动。</div></div>
      <div class="panel actor-panel"><div class="panel-heading"><div><p class="eyebrow">LIVING CAST</p><h2>角色状态</h2></div><router-link :to="`/worlds/${worldId}/actors`">角色群像 ↗</router-link></div><div class="actor-mini-list"><router-link v-for="actor in state.actors.slice(0, 6)" :key="actor.id" :to="`/worlds/${worldId}/actors/${actor.id}?branchId=${state.branchId}`"><span class="avatar">{{ actor.name.slice(0, 1) }}</span><span><strong>{{ actor.name }}</strong><small>{{ actor.role }}</small></span><span class="mood-bar"><i :style="{ width: `${actor.mood}%` }"></i></span></router-link></div></div></div>
    <div v-if="lastAdvance" class="simulation-result"><span class="success-mark">✓</span><span><strong>模拟完成</strong>{{ lastAdvance.result.summary }}</span><router-link :to="`/worlds/${worldId}/timeline`">打开变化记录 ↗</router-link></div>
  </section>
  <section v-else-if="loading" class="loading-state">正在唤醒世界…</section><section v-else class="error-state">{{ error }}</section>
</template>
