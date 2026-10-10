<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { worldApi } from '../api/world'
import type { Actor, WorldOverview } from '../types'
const route = useRoute(); const worldId = Number(route.params.worldId); const overview = ref<WorldOverview | null>(null); const actors = ref<Actor[]>([])
onMounted(async () => { overview.value = (await worldApi.overview(worldId)).data; actors.value = (await worldApi.actors(worldId, overview.value.branches[0].id)).data })
</script>
<template><section class="page" v-if="overview"><div class="page-heading"><div><p class="eyebrow">LIVING CAST / 12 ACTORS</p><h1>角色群像</h1><p class="lede">他们拥有自己的状态、目标和不会等待你的日程。</p></div></div><div class="actor-grid"><router-link v-for="(actor, index) in actors" :key="actor.id" class="actor-card" :to="`/worlds/${worldId}/actors/${actor.id}?branchId=${overview.branches[0].id}`"><span class="portrait-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="avatar large-avatar">{{ actor.name.slice(0, 1) }}</span><h3>{{ actor.name }}</h3><p>{{ actor.role }}</p><div class="stat-line"><span>MOOD</span><strong>{{ actor.mood }}</strong><i><b :style="{ width: `${actor.mood}%` }"></b></i></div><div class="stat-line"><span>ENERGY</span><strong>{{ actor.energy }}</strong><i><b :style="{ width: `${actor.energy}%` }"></b></i></div><em>{{ actor.status }}</em></router-link></div></section><section v-else class="loading-state">正在召集角色…</section></template>
