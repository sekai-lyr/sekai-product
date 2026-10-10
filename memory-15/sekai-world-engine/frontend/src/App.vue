<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const currentUser = computed(() => auth.user.value)
const worldId = computed(() => Number(route.params.worldId))
const inWorld = computed(() => Number.isFinite(worldId.value) && worldId.value > 0)

function signOut() {
  auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <div class="ambient-field" aria-hidden="true"><span></span><span></span><i></i></div>
    <header class="topbar">
      <router-link class="brand" to="/worlds"><span class="brand-mark">S</span><span>Sekai <em>World Engine</em></span></router-link>
      <div v-if="auth.isAuthenticated" class="topbar-actions"><span class="user-chip">{{ currentUser?.displayName || '观察者' }}</span><button class="ghost-button" @click="signOut">退出</button></div>
    </header>
    <div v-if="inWorld && auth.isAuthenticated" class="world-shell">
      <aside class="sidebar">
        <p class="eyebrow">CURRENT WORLD</p>
        <p class="sidebar-world">世界 #{{ worldId }}</p>
        <nav>
          <router-link :to="`/worlds/${worldId}`">总览 <span>01</span></router-link>
          <router-link :to="`/worlds/${worldId}/map`">城市地图 <span>02</span></router-link>
          <router-link :to="`/worlds/${worldId}/actors`">角色群像 <span>03</span></router-link>
          <router-link :to="`/worlds/${worldId}/timeline`">世界时间线 <span>04</span></router-link>
          <router-link :to="`/worlds/${worldId}/branches`">分支管理 <span>05</span></router-link>
        </nav>
        <div class="sidebar-note">世界不会等待你。<br />每一次选择都会留下痕迹。</div>
      </aside>
      <main class="main-content"><router-view /></main>
    </div>
    <main v-else class="main-content standalone"><router-view /></main>
  </div>
</template>
