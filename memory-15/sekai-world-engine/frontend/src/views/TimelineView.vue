<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { worldApi } from '../api/world'
import type { TimelineEvent, WorldOverview } from '../types'
const route = useRoute(); const worldId = Number(route.params.worldId); const overview = ref<WorldOverview | null>(null); const timeline = ref<TimelineEvent[]>([])
onMounted(async () => { overview.value = (await worldApi.overview(worldId)).data; timeline.value = (await worldApi.timeline(worldId, overview.value.branches[0].id)).data })
</script>
<template><section class="page" v-if="overview"><div class="page-heading"><div><p class="eyebrow">HISTORY / IMMUTABLE RECORD</p><h1>世界时间线</h1><p class="lede">每一条记录，都是世界回答你的方式。</p></div></div><div class="timeline"><article v-for="event in timeline" :key="event.id"><div class="timeline-node"></div><div class="timeline-date">{{ event.occurredOn }}<span>#{{ event.id }}</span></div><div class="timeline-card"><span class="card-index">{{ event.eventType }}</span><h3>{{ event.summary }}</h3><router-link v-if="event.eventId" :to="`/worlds/${worldId}/events/${event.eventId}?branchId=${event.branchId}`">查看事件 →</router-link></div></article><div v-if="!timeline.length" class="empty-state">时间线尚未开始。回到总览推进第一天。</div></div></section><section v-else class="loading-state">正在展开历史…</section></template>
