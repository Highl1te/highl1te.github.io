<template>
  <div ref="popupElement" class="ol-popup" style="display: none; position: absolute;">
    <div class="popup-content enhanced-popup">
      <div class="popup-header">
        <div :class="['popup-type-indicator', popupTypeClass]">
          {{ popupIcon }}
        </div>
        <div class="popup-info">
          <a 
            :href="wikiUrl" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="popup-link"
          >
            {{ content }}
          </a>
          <div class="popup-coords">
            <span class="coord-group">
              <span class="coord-label">X:</span> 
              <span class="coord-value">{{ displayCoords.x }}</span>
            </span>
            <span class="coord-group">
              <span class="coord-label">Y:</span> 
              <span class="coord-value">{{ displayCoords.y }}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="popup-actions">
        <button class="popup-action-btn center-btn" @click="centerMap">
          📍 Center
        </button>
        <button 
          v-if="isHighliteMode"
          class="popup-action-btn pin-btn" 
          @click="pinLocation"
        >
          📌 Pin
        </button>
        <button class="popup-close" type="button" @click="closePopup">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'

// Props
interface Props {
  map: maplibregl.Map | undefined
  content: string
  position: [number, number] | null
  visible: boolean
  selectedLayer: string
  isHighliteMode: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
  pinLocation: [x: number, y: number]
}>()

// Refs
const popupElement = ref<HTMLDivElement>()

// State
let popupMarker: maplibregl.Marker | null = null



// Computed
const displayCoords = computed(() => {
  if (!props.position) return { x: 0, y: 0 }
  return {
    x: Math.round(props.position[0] - 512.5),
    y: Math.round(props.position[1] - 512.5)
  }
})

const wikiUrl = computed(() => {
  const wikiName = props.content.replace(/\s+/g, '_').replace(/[()]/g, '').replace(/Lvl\._\d+/g, '').trim()
  return `https://highspell.wiki/w/${wikiName}`
})

const isNPC = computed(() => props.content.includes('(Lvl.'))
const isShop = computed(() => 
  props.content.toLowerCase().includes('shop') || 
  props.content.toLowerCase().includes('store')
)
const isLocation = computed(() => 
  !props.content.includes('🌳') && 
  !props.content.includes('🪨') && 
  !isNPC.value && 
  !isShop.value
)

const popupTypeClass = computed(() => {
  if (isNPC.value) return 'npc'
  if (isShop.value) return 'shop'
  if (isLocation.value) return 'location'
  return 'resource'
})

const popupIcon = computed(() => {
  if (isNPC.value) return '👤'
  if (isShop.value) return '🏪'
  if (isLocation.value) return '📍'
  return '🔧'
})

// Methods
const centerMap = () => {
  if (props.map && props.position) {
    props.map.flyTo({
      center: props.position,
      zoom: Math.max(props.map.getZoom(), 6),
      duration: 500
    })
  }
}

const closePopup = () => {
  emit('close')
}

const pinLocation = () => {
  if (props.position) {
    const x = Math.round(props.position[0] - 512.5)
    const y = Math.round(props.position[1] - 512.5)
    emit('pinLocation', x, y)
  }
}

const showPopup = () => {
  if (!popupElement.value || !props.position || !props.map) return
  
  // Remove existing popup marker if any
  if (popupMarker) {
    popupMarker.remove()
  }
  
  // Create new popup marker
  popupMarker = new maplibregl.Marker({
    element: popupElement.value,
    offset: [0, -100]
  }).setLngLat(props.position).addTo(props.map)
  
  popupElement.value.style.display = 'block'
  popupElement.value.style.opacity = '0'
  popupElement.value.style.transform = 'translate(-50%, -100%) translateY(20px) scale(0.8)'
  
  // Enhanced popup appearance animation
  requestAnimationFrame(() => {
    if (popupElement.value) {
      popupElement.value.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      popupElement.value.style.opacity = '1'
      popupElement.value.style.transform = 'translate(-50%, -100%) translateY(0) scale(1)'
    }
  })
}

const hidePopup = () => {
  if (!popupElement.value) return
  
  if (popupElement.value.style.display !== 'none') {
    popupElement.value.style.transition = 'all 0.15s ease-in'
    popupElement.value.style.opacity = '0'
    popupElement.value.style.transform = 'translate(-50%, -100%) translateY(-10px) scale(0.9)'
    
    setTimeout(() => {
      if (popupMarker) {
        popupMarker.remove()
        popupMarker = null
      }
      if (popupElement.value) {
        popupElement.value.style.display = 'none'
      }
    }, 150)
  }
}

// Watch for visibility changes
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    showPopup()
  } else {
    hidePopup()
  }
})

// Watch for position changes when popup is already visible
watch(() => props.position, (newPosition) => {
  if (props.visible && newPosition && popupMarker) {
    popupMarker.setLngLat(newPosition)
  }
})



// Setup popup when map is available
watch(() => props.map, (newMap) => {
  if (newMap && popupElement.value && props.visible) {
    showPopup()
    

  }
})

onMounted(() => {
  // Setup popup if map is already available
  if (props.map && popupElement.value && props.visible) {
    showPopup()
  }
})

onUnmounted(() => {
  if (popupMarker) {
    popupMarker.remove()
  }
})


</script>

<style>
/* Enhanced popup styles with rich content */
.ol-popup {
  position: absolute;
  background: var(--theme-background-soft);
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 0;
  min-width: 280px;
  max-width: 400px;
  font-size: 14px;
  pointer-events: auto;
  z-index: 2000;
  border: 2px solid var(--theme-border);
  backdrop-filter: blur(16px);
  overflow: visible;
  margin-bottom: 0;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ol-popup::after {
  content: '';
  position: absolute;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 16px solid transparent;
  border-right: 16px solid transparent;
  border-top: 16px solid var(--theme-background-soft);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

.ol-popup::before {
  content: '';
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 18px solid transparent;
  border-right: 18px solid transparent;
  border-top: 18px solid var(--theme-border);
  z-index: -1;
}

.enhanced-popup {
  background: var(--theme-background-soft);
  color: var(--theme-text-primary);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.popup-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 20px 16px;
  background: linear-gradient(135deg, var(--theme-background-soft) 0%, var(--theme-background-mute) 100%);
  border-bottom: 1px solid var(--theme-border-light);
}

.popup-type-indicator {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: var(--theme-accent-transparent-20);
  border: 2px solid var(--theme-accent-transparent-40);
  transition: all 0.2s ease;
}

.popup-type-indicator.npc {
  background: #3b82f6;
  border-color: #60a5fa;
  color: white;
}

.popup-type-indicator.shop {
  background: #10b981;
  border-color: #34d399;
  color: white;
}

.popup-type-indicator.location {
  background: #f59e0b;
  border-color: #fbbf24;
  color: white;
}

.popup-type-indicator.resource {
  background: #8b5cf6;
  border-color: #a78bfa;
  color: white;
}

.popup-info {
  flex: 1;
  min-width: 0;
}

.popup-link {
  color: var(--theme-accent);
  font-weight: 700;
  font-size: 16px;
  line-height: 1.3;
  text-decoration: none;
  display: block;
  margin-bottom: 8px;
  word-break: break-word;
  transition: all 0.2s ease;
}

.popup-link:hover {
  color: var(--theme-accent-light);
  text-decoration: underline;
  transform: translateX(2px);
}

.popup-coords {
  display: flex;
  gap: 16px;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', 'Courier New', monospace;
  background: var(--theme-background-mute);
  padding: 6px 10px;
  border-radius: 6px;
  margin-top: 4px;
}

.coord-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.coord-label {
  color: var(--theme-text-muted);
  font-weight: 600;
}

.coord-value {
  color: var(--theme-accent);
  font-weight: 700;
}

.popup-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px 20px;
  gap: 8px;
  background: var(--theme-background-mute);
}

.popup-action-btn {
  background: var(--theme-accent-transparent-20);
  border: 2px solid var(--theme-accent-transparent-40);
  border-radius: 8px;
  color: var(--theme-text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.popup-action-btn:hover {
  background: var(--theme-accent-transparent-40);
  border-color: var(--theme-accent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.popup-close {
  background: var(--theme-background-mute);
  border: 2px solid var(--theme-border);
  font-size: 18px;
  color: var(--theme-text-muted);
  cursor: pointer;
  padding: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-weight: normal;
  line-height: 1;
}

.popup-close:hover {
  background: #ef4444;
  border-color: #f87171;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

/* Responsive design */
@media (max-width: 768px) {
  .ol-popup {
    min-width: 260px;
    max-width: 320px;
  }
  
  .popup-header {
    padding: 16px 16px 12px;
    gap: 10px;
  }
  
  .popup-type-indicator {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
  
  .popup-link {
    font-size: 14px;
  }
  
  .popup-coords {
    gap: 12px;
    font-size: 11px;
  }
  
  .popup-actions {
    padding: 10px 16px 16px;
    gap: 8px;
  }
  
  .popup-action-btn {
    font-size: 12px;
    padding: 8px 12px;
    min-height: 36px; /* Touch-friendly size */
  }

  .popup-close {
    font-size: 16px;
    width: 24px;
    height: 24px;
  }
}

@media (max-width: 480px) {
  .ol-popup {
    min-width: 240px;
    max-width: calc(100vw - 32px);
    margin: 0 8px;
  }
  
  .popup-header {
    padding: 12px 12px 8px;
    gap: 8px;
  }
  
  .popup-type-indicator {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
  
  .popup-link {
    font-size: 13px;
    line-height: 1.3;
  }
  
  .popup-coords {
    gap: 8px;
    font-size: 10px;
    flex-wrap: wrap;
  }
  
  .popup-actions {
    padding: 8px 12px 12px;
    gap: 6px;
    flex-wrap: wrap;
  }
  
  .popup-action-btn {
    font-size: 11px;
    padding: 10px 12px;
    min-height: 44px; /* More touch-friendly */
    flex: 1;
    min-width: 80px;
  }

  .popup-close {
    font-size: 18px;
    width: 28px;
    height: 28px;
    top: 8px;
    right: 8px;
  }
}

/* Landscape orientation adjustments */
@media (max-width: 768px) and (orientation: landscape) and (max-height: 500px) {
  .ol-popup {
    max-width: 280px;
  }
  
  .popup-header {
    padding: 10px 12px 8px;
  }
  
  .popup-actions {
    padding: 6px 12px 10px;
    gap: 4px;
  }
  
  .popup-action-btn {
    padding: 6px 10px;
    min-height: 32px;
    font-size: 11px;
  }
}

/* Dark theme popup styles */
@media (prefers-color-scheme: dark) {
  .ol-popup {
    background: var(--dark-grey, rgba(26, 26, 26, 0.95)) !important;
    border-color: rgba(245, 158, 11, 0.3) !important;
  }
  
  .ol-popup::after {
    border-top-color: var(--dark-grey, rgba(26, 26, 26, 0.95)) !important;
  }
  
  .ol-popup::before {
    border-top-color: rgba(245, 158, 11, 0.3) !important;
  }
  
  .popup-content {
    background: var(--dark-grey, rgba(26, 26, 26, 0.95)) !important;
    color: var(--white, #ffffff) !important;
  }
  
  .popup-link {
    color: var(--map-primary-light, #fbbf24) !important;
  }
}
</style>
