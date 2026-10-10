<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import type { DoorManifestEntry } from '../types'

const props = withDefaults(defineProps<{
  door: DoorManifestEntry
  variant: 'corridor' | 'hero'
  state: 'idle' | 'selected' | 'opening' | 'opened' | 'left'
  /** hero only: ring position -2..2 */
  offset?: number
  /** corridor only: inline geometry */
  geometryStyle?: CSSProperties
  /** corridor only: deep rows keep plaques veiled until chosen */
  plaqueVeiled?: boolean
}>(), { offset: 0, geometryStyle: undefined, plaqueVeiled: false })

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const classes = computed(() => [
  'gate',
  `gate-${props.variant}`,
  `gate-state-${props.state}`,
  { 'gate-veiled': props.plaqueVeiled },
])

const ariaLabel = computed(() => `${props.door.projectNumber} · ${props.door.name}`)

function handleClick() {
  emit('select', props.door.id)
}
</script>

<template>
  <button
    :class="classes"
    :data-door-id="door.id"
    :data-offset="variant === 'hero' ? offset : undefined"
    :style="variant === 'corridor' ? geometryStyle : undefined"
    type="button"
    :aria-label="ariaLabel"
    :aria-pressed="state === 'selected' || state === 'opening' || state === 'opened'"
    @click="handleClick"
    @mouseenter="variant === 'corridor' ? emit('select', door.id) : undefined"
    @focus="variant === 'corridor' ? emit('select', door.id) : undefined"
  >
    <span class="gate-glow" aria-hidden="true"></span>
    <span class="gate-frame" aria-hidden="true">
      <span class="gate-portal">
        <span class="gate-core"></span>
        <span class="gate-leaf gate-leaf-l"></span>
        <span class="gate-leaf gate-leaf-r"></span>
        <span class="gate-shimmer"></span>
      </span>
    </span>
    <span class="gate-plaque" aria-hidden="true">
      <b class="gate-plaque-no">{{ door.projectNumber }}</b>
      <span class="gate-plaque-name">{{ door.name }}</span>
    </span>
  </button>
</template>
