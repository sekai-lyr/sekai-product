<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { worldApi } from '../api/world'
import type { Location, WorldOverview } from '../types'
const worldId = Number(useRoute().params.worldId); const overview = ref<WorldOverview | null>(null); const locations = ref<Location[]>([])
onMounted(async () => { overview.value = (await worldApi.overview(worldId)).data; locations.value = (await worldApi.locations(worldId)).data })
</script>
<template><section class="page" v-if="overview"><div class="page-heading"><div><p class="eyebrow">{{ overview.city.name }} / CARTOGRAPHY</p><h1>城市地图</h1><p class="lede">五个地点，五种不同的城市脉搏。</p></div></div><div class="map-layout"><div class="map-canvas"><div class="map-grid"></div><div v-for="(location, index) in locations" :key="location.id" class="map-pin" :class="`pin-${index + 1}`"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ location.name }}</strong></div></div><div class="location-list"><article v-for="location in locations" :key="location.id"><span class="card-index">{{ location.kind }}</span><h3>{{ location.name }}</h3><p>{{ location.description }}</p><small>容量 {{ location.capacity }}</small></article></div></div></section><section v-else class="loading-state">正在绘制城市…</section>
</template>
