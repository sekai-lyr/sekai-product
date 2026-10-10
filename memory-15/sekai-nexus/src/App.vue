<script setup lang="ts">
import { computed, ref } from 'vue'
import NexusCorridor from './components/NexusCorridor.vue'

const settingsOpen = ref(false)
const language = ref<'中文' | 'EN'>('中文')
const settingsCopy = computed(() => language.value === 'EN'
  ? { title: 'Settings', body: 'Motion follows your system preference.', close: 'Close' }
  : { title: '设置', body: '动画会遵循系统的动态效果偏好。', close: '关闭' })

function toggleLanguage() {
  language.value = language.value === '中文' ? 'EN' : '中文'
}
</script>

<template>
  <div class="nexus-app">
    <header class="nexus-header">
      <a class="nexus-brand" href="/" aria-label="Sekai Nexus home">
        <span class="nexus-mark">N</span>
        <span>
          <small>SEKAI</small>
          <strong>NEXUS</strong>
        </span>
      </a>
      <div class="nexus-header-actions">
        <button class="header-action" type="button" @click="toggleLanguage">{{ language }}</button>
        <button class="header-action" type="button" :aria-expanded="settingsOpen" @click="settingsOpen = !settingsOpen">设置</button>
      </div>
    </header>
    <aside v-if="settingsOpen" class="settings-panel" aria-label="Settings">
      <p class="settings-title">{{ settingsCopy.title }}</p>
      <p>{{ settingsCopy.body }}</p>
      <button class="settings-close" type="button" @click="settingsOpen = false">{{ settingsCopy.close }}</button>
    </aside>
    <main class="nexus-main">
      <NexusCorridor :language="language" />
    </main>
  </div>
</template>
