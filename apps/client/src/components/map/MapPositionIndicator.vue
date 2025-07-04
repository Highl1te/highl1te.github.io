<template>
  <div class="coordinates-display enhanced-coords" :class="{ 'collapsed': !isVisible }">
    <!-- Toggle Button -->
    <button class="toggle-btn" @click="toggleVisibility" :title="isVisible ? 'Hide Position Indicator' : 'Show Position Indicator'">
      {{ isVisible ? '◀' : '▶' }}
    </button>
    
    <!-- Content Container -->
    <div v-if="isVisible" class="coords-content">
      <!-- Layer Tab -->
      <div class="layer-tab">
        <span class="layer-icon">{{ currentLayer.icon }}</span>
        <span class="layer-name">{{ currentLayer.name }}</span>
      </div>
      
      <!-- Single Horizontal Position Row -->
      <div class="position-row">
        <div class="position-group">
          <span class="position-icon">📍</span>
          <span class="position-label">{{ isHighliteMode ? 'Player' : 'Position' }}:</span>
          <div class="coord-pair">
            <span class="coord-value">X: {{ coordinates.x }}</span>
            <span class="coord-separator">|</span>
            <span class="coord-value">Y: {{ coordinates.y }}</span>
          </div>
        </div>
        
        <!-- Pinned Position (inline when pinned) -->
        <div v-if="isHighliteMode && pinnedMarker?.isPinned" class="position-group pinned-group">
          <span class="position-icon pinned-icon">📌</span>
          <span class="position-label pinned-label">Pinned:</span>
          <div class="coord-pair pinned-coords">
            <span class="coord-value pinned-value">X: {{ pinnedMarker.x + 512.5 }}</span>
            <span class="coord-separator">|</span>
            <span class="coord-value pinned-value">Y: {{ pinnedMarker.y + 512.5 }}</span>
          </div>
          <button class="remove-pin-btn" @click="emit('removePin')" title="Remove Pin">
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Props
interface Props {
  coordinates: {
    x: number
    y: number
  }
  currentLayer: {
    id: string
    name: string
    icon: string
    color: string
    description: string
  }
  isHighliteMode?: boolean
  pinnedMarker?: {
    x: number
    y: number
    isPinned: boolean
  }
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  removePin: []
}>()

// Reactive state
const isVisible = ref(true)

// Methods
const toggleVisibility = () => {
  isVisible.value = !isVisible.value
}
</script>

<style scoped>
/* Enhanced coordinates display - Horizontal Layout */
.enhanced-coords {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(26, 26, 26, 0.95);
  color: var(--theme-text-primary);
  border-radius: 10px 10px 10px 10px;
  font-family: 'Inter', sans-serif;
  z-index: 1001;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  display: flex;
  align-items: stretch;
  min-height: 74px;
}

/* When collapsed (content hidden) */
.enhanced-coords.collapsed {
  min-height: 74px;
  height: 74px;
  border: none;
  border-radius: 10px;
}

/* Toggle Button */
.toggle-btn {
  background: rgba(60, 60, 60, 0.9);
  border: none;
  color: #e0e0e0;
  padding: 0;
  width: 24px;
  cursor: pointer;
  border-radius: 10px 0 0 10px;
  font-size: 12px;
  font-weight: bold;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 2px solid var(--theme-border);
  min-height: 74px;
}

.enhanced-coords.collapsed .toggle-btn {
  border-radius: 10px;
  border-right: none;
}

/* Toggle button when collapsed */
.enhanced-coords.collapsed .toggle-btn {
  min-height: 74px;
  height: 74px;
}

/* Content Container */
.coords-content {
  flex: 1;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Layer Tab - Folder Style - Full Width */
.layer-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  padding: 2px 8px;
  border-radius: 6px 6px 0 0;
  border-bottom: 2px solid white;
  margin: -2px -2px 2px -2px;
  position: relative;
  width: calc(100% + 4px);
  left: -2px;
}

.layer-tab::before {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: white;
}

.layer-icon {
  font-size: 12px;
}

.layer-name {
  font-size: 10px;
  color: white;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Position Rows */
.position-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.position-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.position-icon {
  font-size: 12px;
}

.position-label {
  font-size: 10px;
  color: var(--theme-text-muted);
  font-weight: 600;
  min-width: 40px;
}

.coord-pair {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--theme-accent-transparent-10);
  padding: 2px 8px;
  border-radius: 4px;
}

.coord-value {
  font-weight: 700;
  font-size: 12px;
  color: var(--theme-accent-light);
  font-family: 'Inter', 'Courier New', monospace;
}

.coord-separator {
  color: var(--theme-text-muted);
  font-weight: normal;
}

/* Pinned Position Styling */
.pinned-group {
  border-left: 2px solid var(--theme-border-light);
  padding-left: 12px;
  margin-left: 8px;
}

.pinned-icon {
  color: #ff6b35;
}

.pinned-label {
  color: #ff6b35;
}

.pinned-value {
  color: #ff6b35 !important;
}

.pinned-coords {
  background: rgba(255, 107, 53, 0.1);
}

.remove-pin-btn {
  background: rgba(239, 68, 68, 0.8);
  border: none;
  border-radius: 3px;
  color: white;
  font-size: 9px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: bold;
  margin-left: 4px;
}

/* Responsive design */
@media (max-width: 768px) {
  .enhanced-coords {
    left: 8px;
    bottom: 8px;
    border-radius: 8px 0px 0px 8px;
    max-width: calc(100vw - 16px);
    box-sizing: border-box;
    min-height: 32px;
  }

  .enhanced-coords.collapsed {
    border: none;
    border-radius: 8px;
    min-height: 28px;
    height: 28px;
  }

  .toggle-btn {
    width: 20px;
    font-size: 11px;
    border-radius: 8px 0 0 8px;
    background: rgba(60, 60, 60, 0.9);
    color: #e0e0e0;
    min-height: 32px;
  }

  .enhanced-coords.collapsed .toggle-btn {
    border-radius: 8px;
    border-right: none;
  }

  .coords-content {
    padding: 4px 6px;
    gap: 3px;
  }

  .layer-tab {
    padding: 1px 6px;
    border-radius: 4px 4px 0 0;
    width: calc(100% + 4px);
    left: -2px;
    background: transparent;
    border-bottom: 2px solid white;
  }

  .position-row {
    gap: 8px;
  }

  .pinned-group {
    padding-left: 8px;
    margin-left: 4px;
  }

  .layer-name {
    font-size: 9px;
    color: white;
  }

  .layer-icon {
    font-size: 10px;
  }

  .position-icon {
    font-size: 10px;
  }

  .position-label {
    font-size: 9px;
    min-width: 35px;
  }

  .coord-value {
    font-size: 10px;
  }

  .coord-pair {
    padding: 1px 6px;
    gap: 4px;
  }

  .remove-pin-btn {
    width: 14px;
    height: 14px;
    font-size: 8px;
  }
}

@media (max-width: 480px) {
  .enhanced-coords {
    left: 4px;
    bottom: 4px;
    border-radius: 6px 0px 0px 6px;
    max-width: calc(100vw - 8px);
    box-sizing: border-box;
    min-height: 28px;
  }

  .enhanced-coords.collapsed {
    border: none;
    border-radius: 6px;
    min-height: 24px;
    height: 24px;
  }

  .toggle-btn {
    width: 18px;
    font-size: 10px;
    border-radius: 6px 0 0 6px;
    background: rgba(60, 60, 60, 0.9);
    color: #e0e0e0;
    min-height: 28px;
  }

  .enhanced-coords.collapsed .toggle-btn {
    border-radius: 6px;
    border-right: none;
  }

  .coords-content {
    padding: 3px 4px;
    gap: 2px;
  }

  .layer-tab {
    padding: 1px 4px;
    border-radius: 3px 3px 0 0;
    width: calc(100% + 4px);
    left: -2px;
    background: transparent;
    border-bottom: 2px solid white;
  }

  .position-row {
    gap: 6px;
    flex-wrap: wrap;
  }

  .pinned-group {
    padding-left: 6px;
    margin-left: 2px;
    border-left-width: 1px;
  }

  .layer-name {
    font-size: 8px;
    color: white;
  }

  .layer-icon {
    font-size: 9px;
  }

  .position-icon {
    font-size: 9px;
  }

  .position-label {
    font-size: 8px;
    min-width: 30px;
  }

  .coord-value {
    font-size: 9px;
  }

  .coord-pair {
    padding: 1px 4px;
    gap: 3px;
  }

  .remove-pin-btn {
    width: 12px;
    height: 12px;
    font-size: 7px;
  }
}

/* Hide position indicator on very small screens */
@media (max-width: 504px) {
  .enhanced-coords {
    display: none;
  }
}

/* Landscape orientation on mobile - move to top */
@media (max-width: 768px) and (orientation: landscape) and (max-height: 500px) {
  .enhanced-coords {
    bottom: auto;
    top: 8px;
    left: 8px;
    max-width: calc(60vw - 16px);
  }
}

/* Very small screens - ensure it doesn't overlap with controls */
@media (max-width: 480px) and (max-height: 600px) {
  .enhanced-coords {
    bottom: 8px;
    left: 4px;
    right: auto;
    max-width: calc(100vw - 8px);
    transform: none;
  }
}
</style>
