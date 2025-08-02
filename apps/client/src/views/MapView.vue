<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, reactive } from 'vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import MapControls from '@/components/map/MapControls.vue'
import MapPositionIndicator from '@/components/map/MapPositionIndicator.vue'
import MapPopup from '@/components/map/MapPopup.vue'
import locations from '@/assets/map/Locations.json'
import entitiesData from '@/assets/map/worldEntities.json'
import npcs from '@/assets/map/NPCs.json'
import npcDefinitions from '@/assets/map/NPCDefs.json'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre map instance
let map: maplibregl.Map

// Data storage for markers
const levelMarkers: Record<string, Record<string, any[]>> = {
  Overworld: {},
  Underworld: {},
  Sky: {},
}

// Enhanced reactive state
const selectedLayer = ref('Overworld')
const isLoading = ref(true)
const mouseCoords = reactive({ x: 0, y: 0 })

// Highlite Map Plugin state
const isHighliteMode = ref(false)
const playerMarker = reactive({ x: 0, y: 0 })
const pinnedMarker = reactive({ x: 0, y: 0, isPinned: false })
let pinnedFeature: any = null
let arrowOverlay: any = null

// Popup state
const popupVisible = ref(false)
const popupContent = ref('')
const popupPosition = ref<[number, number] | null>(null)

// Search filtering state
const activeSearchQuery = ref('')
const filteredMarkerIds = ref<Set<string>>(new Set())
const originalCategoryStates = ref<Record<string, boolean>>({})
const isLayerSwitchFromSearch = ref(false)



// Layer definitions with enhanced styling
const layers = ref([
  { 
    id: 'Overworld', 
    name: 'Overworld', 
    icon: '🌍', 
    color: '#F9F449',
    description: 'The main world layer'
  },
  { 
    id: 'Underworld', 
    name: 'Underworld', 
    icon: '🕳️', 
    color: '#e6e03a',
    description: 'Underground areas and caves'
  },
  { 
    id: 'Sky', 
    name: 'Sky', 
    icon: '☁️', 
    color: '#fbf65c',
    description: 'Floating islands and sky areas'
  }
])

// Marker categories for filtering
const markerCategories = ref([
  { name: 'Locations', icon: '📍', visible: true, count: 0 },
  { name: 'Trees', icon: '🌳', visible: false, count: 0 },
  { name: 'Obelisks', icon: '🗿', visible: false, count: 0 },
  { name: 'Ores', icon: '🪨', visible: false, count: 0 },
  { name: 'Banks', icon: '💰', visible: false, count: 0 },
  { name: 'Fires', icon: '🔥', visible: false, count: 0 },
  { name: 'Anvils', icon: '🔨', visible: false, count: 0 },
  { name: 'Furnaces', icon: '🏭', visible: false, count: 0 },
  { name: 'Kilns', icon: '⚱️', visible: false, count: 0 },
  { name: 'Stoves', icon: '🍳', visible: false, count: 0 },
  { name: 'Fishing Spots', icon: '🎣', visible: false, count: 0 },
  { name: 'Harvestables', icon: '🌾', visible: false, count: 0 },
  { name: 'Shops', icon: '🏪', visible: false, count: 0 },
  { name: 'NPCs', icon: '👤', visible: false, count: 0 },
  { name: 'Attackable NPCs', icon: '😐', visible: false, count: 0 },
  { name: 'Semi-Aggressive NPCs', icon: '😠', visible: false, count: 0 },
  { name: 'Aggressive NPCs', icon: '😈', visible: false, count: 0 }
])

const getCurrentLayerInfo = () => {
  return layers.value.find(layer => layer.id === selectedLayer.value) || layers.value[0]
}

// Computed property to return either player marker or mouse coordinates
const displayCoordinates = computed(() => {
  return isHighliteMode.value ? playerMarker : mouseCoords
})

const updateMarkerCounts = () => {
  markerCategories.value.forEach(category => {
    const currentLayerMarkers = levelMarkers[selectedLayer.value]
    category.count = currentLayerMarkers[category.name]?.length || 0
  })
}

// Add this at the top with other state variables
const activeMarkersByLayer: Record<string, maplibregl.Marker[]> = {
  Overworld: [],
  Underworld: [],
  Sky: []
}

// --- Marker Management Helpers ---

// Helper to remove all custom markers for a given layer or category
function removeMarkers({ layer, category }: { layer: string, category?: string }) {
  if (!activeMarkersByLayer[layer]) return
  activeMarkersByLayer[layer] = activeMarkersByLayer[layer].filter(marker => {
    const el = marker.getElement()
    if (!category || (el && el.getAttribute('data-category') === category)) {
      marker.remove()
      return false
    }
    return true
  })
}

// Helper to create a custom marker element
function createCustomMarkerElement(feature: any, categoryName: string) {
  const markerElement = document.createElement('div')
  markerElement.className = 'custom-marker'
  markerElement.setAttribute('data-category', categoryName)
  markerElement.style.cursor = 'pointer'
  if (feature.isLocation) {
    markerElement.innerHTML = `
      <div class="location-label">
        ${feature.name}
      </div>
    `
    
    // Apply styles directly to the location label
    const labelElement = markerElement.querySelector('.location-label') as HTMLElement
    if (labelElement) {
      labelElement.style.fontSize = '13px'
      labelElement.style.fontWeight = '900'
      labelElement.style.color = '#ffffff'
      labelElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(255, 255, 255, 0.3), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
      labelElement.style.whiteSpace = 'nowrap'
      labelElement.style.cursor = 'pointer'
      labelElement.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }
    
    markerElement.addEventListener('mouseenter', () => {
      if (labelElement) {
        labelElement.style.transform = 'scale(1.05)'
        labelElement.style.color = '#ffff00'
        labelElement.style.borderColor = 'rgba(255, 255, 0, 0.4)'
        labelElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 12px rgba(255, 255, 0, 0.5), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
      }
    })
    markerElement.addEventListener('mouseleave', () => {
      if (labelElement) {
        labelElement.style.transform = 'scale(1)'
        labelElement.style.color = '#ffffff'
        labelElement.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        labelElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(255, 255, 255, 0.3), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
      }
    })
  } else {
    markerElement.innerHTML = `
      <div class="marker-icon" style="
        color: ${getCategoryColor(feature.category)};
        text-shadow: 2px 2px 2px ${getCategoryStrokeColor(feature.category)};">
        ${feature.icon || '📍'}
      </div>
    `
    markerElement.addEventListener('mouseenter', () => {
      const iconElement = markerElement.querySelector('.marker-icon') as HTMLElement
      if (iconElement) iconElement.style.transform = 'scale(1.2)'
    })
    markerElement.addEventListener('mouseleave', () => {
      const iconElement = markerElement.querySelector('.marker-icon') as HTMLElement
      if (iconElement) iconElement.style.transform = 'scale(1)'
    })
    markerElement.addEventListener('click', () => {
      const name = feature.name
      if (name) {
        showPopup(name, feature.coordinates)
        map.flyTo({
          center: feature.coordinates,
          duration: 500,
          zoom: Math.max(map.getZoom(), 5)
        })
      }
    })
  }
  return markerElement
}

// Helper to add markers for a category in a layer
function addMarkersForCategory(layer: string, categoryName: string, features: any[]) {
  features.forEach((feature: any) => {
    const markerElement = createCustomMarkerElement(feature, categoryName)
    const marker = new maplibregl.Marker({ element: markerElement })
      .setLngLat(feature.coordinates)
      .addTo(map)
    activeMarkersByLayer[layer].push(marker)
  })
}

// --- Main Layer/Filter Logic ---

const applyFilterStatesToLayer = () => {
  const currentLayerMarkers = levelMarkers[selectedLayer.value]
  // Remove all existing custom markers for all layers
  Object.keys(activeMarkersByLayer).forEach(layer => removeMarkers({ layer }))
  // Remove all existing layers and sources
  markerCategories.value.forEach(category => {
    const layerId = `${selectedLayer.value}-${category.name}`
    if (map.getLayer(layerId)) map.removeLayer(layerId)
    if (map.getSource(layerId)) map.removeSource(layerId)
  })
  // Add visible markers for the current layer only
  markerCategories.value.forEach(category => {
    if (category.visible && currentLayerMarkers[category.name]) {
      let features = currentLayerMarkers[category.name]
      
      // If there's an active search, filter the features
      if (activeSearchQuery.value) {
        features = features.filter((feature: any) => {
          const name = feature.name?.toLowerCase() || ''
          const featureCategory = feature.category?.toLowerCase() || ''
          return name.includes(activeSearchQuery.value) || 
                 featureCategory.includes(activeSearchQuery.value) ||
                 category.name.toLowerCase().includes(activeSearchQuery.value)
        })
      }
      
      if (features.length > 0) {
        const layerId = `${selectedLayer.value}-${category.name}`
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: features.map((feature: any) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: feature.coordinates },
            properties: {
              name: feature.name,
              icon: feature.icon,
              category: feature.category,
              isLocation: feature.isLocation || false
            }
          }))
        }
        map.addSource(layerId, { type: 'geojson', data: geojson })
        map.addLayer({
          id: layerId,
          type: 'symbol',
          source: layerId,
          layout: {
            'icon-image': 'marker-icon',
            'icon-size': 1,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        })
        addMarkersForCategory(selectedLayer.value, category.name, features)
      }
    }
  })
}

const handleMarkerCategoryToggled = (categoryName: string, visible: boolean) => {
  const category = markerCategories.value.find(cat => cat.name === categoryName)
  if (!category) return
  category.visible = visible
  const currentLayerMarkers = levelMarkers[selectedLayer.value]
  if (currentLayerMarkers[categoryName]) {
    const layerId = `${selectedLayer.value}-${categoryName}`
    if (visible) {
      if (!map.getLayer(layerId)) {
        let features = currentLayerMarkers[categoryName]
        
        // If there's an active search, filter the features
        if (activeSearchQuery.value) {
          features = features.filter((feature: any) => {
            const name = feature.name?.toLowerCase() || ''
            const featureCategory = feature.category?.toLowerCase() || ''
            return name.includes(activeSearchQuery.value) || 
                   featureCategory.includes(activeSearchQuery.value) ||
                   categoryName.toLowerCase().includes(activeSearchQuery.value)
          })
        }
        
        if (features.length > 0) {
          const geojson = {
            type: 'FeatureCollection' as const,
            features: features.map((feature: any) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: feature.coordinates },
              properties: {
                name: feature.name,
                icon: feature.icon,
                category: feature.category,
                isLocation: feature.isLocation || false
              }
            }))
          }
          map.addSource(layerId, { type: 'geojson', data: geojson })
          map.addLayer({
            id: layerId,
            type: 'symbol',
            source: layerId,
            layout: {
              'icon-image': 'marker-icon',
              'icon-size': 1,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true
            }
          })
          removeMarkers({ layer: selectedLayer.value, category: categoryName })
          addMarkersForCategory(selectedLayer.value, categoryName, features)
        }
      }
    } else {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(layerId)) map.removeSource(layerId)
      removeMarkers({ layer: selectedLayer.value, category: categoryName })
    }
  }
}

// Helper functions for category styling
const getCategoryColor = (categoryName: string): string => {
  const colors: Record<string, string> = {
    'Banks': '#ffd700',
    'Shops': '#00ff7f',
    'NPCs': '#87ceeb',
    'Attackable NPCs': '#ff6347',
    'Aggressive NPCs': '#ff1493',
    'Semi-Aggressive NPCs': '#ff6347',
    'Trees': '#90ee90',
    'Obelisks': '#dda0dd',
    'Ores': '#d2691e',
    'Fires': '#ff4500',
    'Anvils': '#e6e6fa',
    'Furnaces': '#ff8c00',
    'Kilns': '#cd853f',
    'Stoves': '#ffa500',
    'Fishing Spots': '#00bfff',
    'Harvestables': '#adff2f'
  }
  return colors[categoryName] || '#ffffff'
}

const getCategoryStrokeColor = (_categoryName: string): string => {
  return '#000000'
}

const getCategoryStrokeWidth = (categoryName: string): number => {
  const priorities: Record<string, string> = {
    'Banks': 'high',
    'Shops': 'high',
    'NPCs': 'medium',
    'Attackable NPCs': 'high',
    'Aggressive NPCs': 'high',
    'Semi-Aggressive NPCs': 'high',
    'Trees': 'low',
    'Obelisks': 'medium',
    'Ores': 'low',
    'Fires': 'low',
    'Anvils': 'medium',
    'Furnaces': 'medium',
    'Kilns': 'low',
    'Stoves': 'low',
    'Fishing Spots': 'low',
    'Harvestables': 'low'
  }
  
  const priority = priorities[categoryName] || 'low'
  return priority === 'high' ? 2.5 : priority === 'medium' ? 2 : 1.5
}

// Helper functions for pinned feature visuals
const updatePinnedFeatureVisuals = (mapX: number, mapY: number) => {
  clearPinnedFeatureVisuals()
  
  // Find feature at coordinates
  const features = map.queryRenderedFeatures([mapX, mapY])
  if (features.length > 0) {
    const targetFeature = features.find(f => !f.properties?.isLocation)
    if (targetFeature) {
      pinnedFeature = targetFeature
      // Highlight the pinned feature by updating its layer style
      const layerId = targetFeature.layer.id
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'text-color', '#ffeb3b')
        map.setPaintProperty(layerId, 'text-halo-color', '#ff6b35')
        map.setPaintProperty(layerId, 'text-halo-width', 4)
      }
      createArrowOverlay(mapX, mapY)
    }
  }
}

const clearPinnedFeatureVisuals = () => {
  if (pinnedFeature) {
    const layerId = pinnedFeature.layer.id
    if (map.getLayer(layerId)) {
      // Reset to default style
      const category = markerCategories.value.find(cat => layerId.includes(cat.name))
      if (category) {
        map.setPaintProperty(layerId, 'text-color', getCategoryColor(category.name))
        map.setPaintProperty(layerId, 'text-halo-color', getCategoryStrokeColor(category.name))
        map.setPaintProperty(layerId, 'text-halo-width', getCategoryStrokeWidth(category.name))
      }
    }
  }
  pinnedFeature = null
  
  if (arrowOverlay) {
    map.removeImage('arrow')
    arrowOverlay = null
  }
}

const createArrowOverlay = (mapX: number, mapY: number) => {
  // Create arrow element
  const arrowElement = document.createElement('div')
  arrowElement.style.cssText = `
    width: 12px;
    height: 12px;
    background: #ff0000;
    clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
    position: absolute;
    animation: pulse 2s infinite;
    pointer-events: none;
    z-index: 1000;
  `
  
  // Add pulse animation if it doesn't exist
  if (!document.getElementById('arrow-pulse-animation')) {
    const style = document.createElement('style')
    style.id = 'arrow-pulse-animation'
    style.textContent = `
      @keyframes pulse {
        0% { transform: translate(-50%, -100%) scale(1); opacity: 1; }
        50% { transform: translate(-50%, -100%) scale(1.2); opacity: 0.7; }
        100% { transform: translate(-50%, -100%) scale(1); opacity: 1; }
      }
    `
    document.head.appendChild(style)
  }
  
  // Add arrow as a marker
  arrowOverlay = new maplibregl.Marker({
    element: arrowElement,
    offset: [0, -15]
  }).setLngLat([mapX, mapY]).addTo(map)
}

// Search filtering functions
const filterMarkersBasedOnSearch = (searchQuery: string) => {
  activeSearchQuery.value = searchQuery.toLowerCase().trim()
  
  if (!activeSearchQuery.value) {
    restoreOriginalCategoryStates()
    showAllMarkersBasedOnCategories()
    return
  }
  
  saveOriginalCategoryStates()
  
  const matchingIds = new Set<string>()
  const categoriesWithResults = new Set<string>()
  
  const currentLayerMarkers = levelMarkers[selectedLayer.value] || {}
  Object.entries(currentLayerMarkers).forEach(([category, features]) => {
    let hasMatchingFeatures = false
    
    features.forEach((feature: any) => {
      const name = feature.name?.toLowerCase() || ''
      const featureCategory = feature.category?.toLowerCase() || ''
      
      if (name.includes(activeSearchQuery.value) || 
          featureCategory.includes(activeSearchQuery.value) ||
          category.toLowerCase().includes(activeSearchQuery.value)) {
        matchingIds.add(feature.id || `${feature.name}-${category}`)
        hasMatchingFeatures = true
      }
    })
    
    if (hasMatchingFeatures) {
      categoriesWithResults.add(category)
    }
  })
  
  // Show only matching categories
  markerCategories.value.forEach(category => {
    category.visible = categoriesWithResults.has(category.name)
  })
  
  // Remove all existing markers and sources first
  hideAllMarkers()
  
  // Apply filter states to show only matching categories
  applyFilterStatesToLayer()
  filteredMarkerIds.value = matchingIds
}

const hideAllMarkers = () => {
  // Remove all custom markers for the current layer
  if (activeMarkersByLayer[selectedLayer.value]) {
    activeMarkersByLayer[selectedLayer.value].forEach(marker => {
      marker.remove()
    })
    activeMarkersByLayer[selectedLayer.value] = []
  }
  
  // Remove all layers and sources for the current layer
  markerCategories.value.forEach(category => {
    const layerId = `${selectedLayer.value}-${category.name}`
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId)
    }
  })
}

const showAllMarkersBasedOnCategories = () => {
  applyFilterStatesToLayer()
}

// Function to pin a location (used in highlite mode)
const pinLocation = (x: number, y: number) => {
  if (isHighliteMode.value) {
    pinnedMarker.x = x
    pinnedMarker.y = y
    pinnedMarker.isPinned = true
    
    updatePinnedFeatureVisuals(x + 512.5, y + 512.5)
  }
}

// Function to remove pin
const removePin = () => {
  if (isHighliteMode.value) {
    pinnedMarker.isPinned = false
    pinnedMarker.x = 0
    pinnedMarker.y = 0
    
    clearPinnedFeatureVisuals()
  }
}

// Event handlers for the MapSearchFilter component
const handleLayerChanged = (layerId: string) => {
  selectedLayer.value = layerId
  
  // Hide popup when changing layers
  hidePopup()
  
  // Clear pinned feature visuals when changing layers
  if (isHighliteMode.value && pinnedMarker.isPinned) {
    clearPinnedFeatureVisuals()
    // Re-apply visuals if the pinned marker is on the new layer
    setTimeout(() => {
      if (pinnedMarker.isPinned) {
        updatePinnedFeatureVisuals(pinnedMarker.x + 512.5, pinnedMarker.y + 512.5)
      }
    }, 100)
  }
  
  // If we have an active search, re-apply the search state
  if (activeSearchQuery.value) {
    filterMarkersBasedOnSearch(activeSearchQuery.value)
  } else {
    // If no search is active, apply current filter states to the new layer
    setTimeout(() => {
      applyFilterStatesToLayer()
    }, 50)
  }
}

const handleSearchLocationSelected = (result: any) => {
  if (result.layer !== selectedLayer.value) {
    isLayerSwitchFromSearch.value = true
    selectedLayer.value = result.layer
  }
  
  // Convert game coordinates to longitude/latitude for the map
  const gameToLngLat = (x: number, y: number): [number, number] => {
    // Map from [0,1024] x [0,1024] to [-10,10] x [-10,10]
    const lng = (x / 1024) * 20 - 10
    const lat = (y / 1024) * 20 - 10
    return [lng, lat]
  }

  console.log(map?.getZoom());
  
  // Center map on the location with smooth animation
  setTimeout(() => {
    const mapCoords = gameToLngLat(result.x, result.y)
    map?.flyTo({
      center: mapCoords,
      zoom: (map?.getZoom() ?? 7.5) < 7.5 ? 7.5 : (map?.getZoom() ?? 7.5), // Default to zoom 7.5 if map doesn't exist or is zoomed out further than 7.5
      duration: 800
    })
  }, 100)
}

// Popup event handlers
const showPopup = (content: string, position: [number, number]) => {
  popupContent.value = content
  popupPosition.value = position
  popupVisible.value = true
}

const hidePopup = () => {
  popupVisible.value = false
  popupContent.value = ''
  popupPosition.value = null
}

onMounted(() => {
  // Check for highliteMapPlugin URL parameter
  const searchParams = new URLSearchParams(window.location.search)
  isHighliteMode.value = searchParams.get('highliteMapPlugin') === 'true'
  
  // MapLibre initialization with proper coordinate system
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {},
      layers: []
    },
    center: [0, 0] as [number, number],
    zoom: 2,
    minZoom: 0,
    maxZoom: 28,
    pitch: 0,
    bearing: 0,
    pitchWithRotate: false,
    dragRotate: false
  })

  // Wait for style to load before adding custom layers
  map.on('load', () => {
    // Add base layers for each level with proper coordinate conversion
    const addBaseLayer = (level: string, textureUrl: string, mapUrl: string) => {
      const textureSourceId = `${level}-texture`
      const mapSourceId = `${level}-map`
      
      // Use a smaller coordinate area that works better with MapLibre
      // Map the 1024x1024 game world to a smaller geographic area
      // Fix the upside-down issue by adjusting the coordinate order
      const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
        [-10, 10],   // bottom-left (was top-left)
        [10, 10],    // bottom-right (was top-right)
        [10, -10],   // top-right (was bottom-right)
        [-10, -10]   // top-left (was bottom-left)
      ]
      
      map.addSource(textureSourceId, {
        type: 'image',
        url: textureUrl,
        coordinates: coordinates
      })
      
      map.addSource(mapSourceId, {
        type: 'image',
        url: mapUrl,
        coordinates: coordinates
      })
      
      map.addLayer({
        id: `${level}-texture-layer`,
        type: 'raster',
        source: textureSourceId,
        paint: {
          'raster-opacity': 1
        }
      })
      
      map.addLayer({
        id: `${level}-map-layer`,
        type: 'raster',
        source: mapSourceId,
        paint: {
          'raster-opacity': 1
        }
      })
    }

    // Add base layers
    addBaseLayer('overworld', '/mapImages/earthoverworldtexture.png', '/mapImages/earthoverworldmap.png')
    addBaseLayer('underworld', '/mapImages/earthundergroundtexture.png', '/mapImages/earthundergroundmap.png')
    addBaseLayer('sky', '/mapImages/earthskytexture.png', '/mapImages/earthskymap.png')

    // Set initial layer visibility
    const setLayerVisibility = (level: string, visible: boolean) => {
      map.setLayoutProperty(`${level}-texture-layer`, 'visibility', visible ? 'visible' : 'none')
      map.setLayoutProperty(`${level}-map-layer`, 'visibility', visible ? 'visible' : 'none')
    }

    // Initially show overworld
    setLayerVisibility('overworld', true)
    setLayerVisibility('underworld', false)
    setLayerVisibility('sky', false)
    
    // Set initial background color for overworld
    const mapElement = document.getElementById('map')
    if (mapElement) {
      mapElement.style.backgroundColor = '#3b85b9'
    }
    
    // Set map bounds to constrain navigation with some padding around the map layers
    const bounds = new maplibregl.LngLatBounds()
    
    // Add bounds for the map layers with some padding to allow slight panning outside
    // The layer coordinates are: [-10, 10], [10, 10], [10, -10], [-10, -10]
    // So the full extent is from [-10, -10] to [10, 10]
    // Adding 6 units of padding on top/bottom and 8 units on left/right
    bounds.extend([-36, -36]) // southwest corner with padding (horizontal/2, vertical same as horizontal)
    bounds.extend([36, 36])   // northeast corner with padding (horizontal/2, vertical same as horizontal)
    
    // Set the map bounds to constrain navigation with generous limits
    map.setMaxBounds(bounds)
    
    // Allow rendering beyond the bounds for smoother panning
    map.setRenderWorldCopies(true)

    // Mouse interaction with coordinate conversion
    map.on('mousemove', (evt) => {
      const coordinate = evt.lngLat
      // Convert longitude/latitude back to game coordinates
      // Map from [-10,10] x [-10,10] to [0,1024] x [0,1024]
      const gameX = ((coordinate.lng + 10) / 20) * 1024
      const gameY = ((coordinate.lat + 10) / 20) * 1024
      mouseCoords.x = Math.round(gameX - 512.5)
      mouseCoords.y = Math.round(gameY - 512.5)
    })

    // Helper functions for marker creation with coordinate conversion
    function addItem(feature: any, level: string, group: string) {
      if (!levelMarkers[level][group]) levelMarkers[level][group] = []
      levelMarkers[level][group].push(feature)
    }

    function addLocationItem(feature: any, level: string, group: string) {
      if (!levelMarkers[level][group]) levelMarkers[level][group] = []
      levelMarkers[level][group].push(feature)
    }

    // Convert game coordinates to longitude/latitude
    const gameToLngLat = (x: number, y: number): [number, number] => {
      // Map from [0,1024] x [0,1024] to [-10,10] x [-10,10]
      const lng = (x / 1024) * 20 - 10
      const lat = (y / 1024) * 20 - 10
      return [lng, lat]
    }

    function createMarkerFeature(position: [number, number], icon: string, name: string, category?: string): any {
      return {
        coordinates: gameToLngLat(position[0], position[1]),
        name: name,
        icon: icon,
        category: category || 'unknown',
        id: `${name}-${category}-${Date.now()}`
      }
    }

    function createLocationLabelFeature(position: [number, number], name: string): any {
      return {
        coordinates: gameToLngLat(position[0], position[1]),
        name: name,
        icon: '',
        isLocation: true,
        id: `${name}-location-${Date.now()}`
      }
    }

    // Add location markers
    locations.locations.forEach((location: any) => {
      const feature = createLocationLabelFeature([location.x + 512.5, location.y + 512.5], location.name)
      
      switch (location.labelType) {
        case 0:
          addLocationItem(feature, 'Underworld', 'Locations')
          break
        case 1:
          addLocationItem(feature, 'Overworld', 'Locations')
          break
        case 2:
          addLocationItem(feature, 'Sky', 'Locations')
          break
      }
    })

    // Entity type mapping configuration for cleaner code
    const entityTypeConfig = [
      {
        match: (type: string) => (type.includes('tree') || type.includes('cherryblossom')) && type !== 'treestump',
        icon: '🌳',
        category: 'Trees',
        nameFormatter: (type: string) => {
          let name = type.replace('tree', ' Tree').replace('blossom', ' Blossom')
          return formatEntityName(name)
        }
      },
      {
        match: (type: string) => type.includes('obelisk'),
        icon: '🗿',
        category: 'Obelisks',
        nameFormatter: (type: string) => formatEntityName(type.replace('obelisk', ' Obelisk'))
      },
      {
        match: (type: string) => type.includes('rocks'),
        icon: '🪨',
        category: 'Ores',
        nameFormatter: (type: string) => formatEntityName(type.replace('rocks', ' Rock'))
      },
      {
        match: (type: string) => type.includes('bank'),
        icon: '💰',
        category: 'Banks',
        nameFormatter: (type: string) => type.replace('bank', ' Bank').replace('chest', ' Chest')
      },
      {
        match: (type: string) => type.includes('fire'),
        icon: '🔥',
        category: 'Fires',
        nameFormatter: (type: string) => formatEntityName(type.replace('fire', ' Fire'))
      },
      {
        match: (type: string) => type.includes('smithingsource'),
        icon: '🔨',
        category: 'Anvils',
        nameFormatter: () => 'Anvil'
      },
      {
        match: (type: string) => type.includes('smeltingsource'),
        icon: '🏭',
        category: 'Furnaces',
        nameFormatter: () => 'Furnace'
      },
      {
        match: (type: string) => type.includes('kiln'),
        icon: '⚱️',
        category: 'Kilns',
        nameFormatter: () => 'Kiln'
      },
      {
        match: (type: string) => type.includes('heatsource'),
        icon: '🍳',
        category: 'Stoves',
        nameFormatter: () => 'Stove'
      },
      {
        match: (type: string) => type.includes('fishing'),
        icon: '🎣',
        category: 'Fishing Spots',
        nameFormatter: (type: string) => formatEntityName(type.replace('fishing', ' Fishing'))
      },
      // Harvestables - each with appropriate emoji
      {
        match: (type: string) => type.includes('pumpkin'),
        icon: '🎃',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('pumpkin', ' Pumpkin'))
      },
      {
        match: (type: string) => type.includes('corn'),
        icon: '🌽',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('corn', ' Corn'))
      },
      {
        match: (type: string) => type.includes('potatoes'),
        icon: '🥔',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('potatoes', ' Potatoes'))
      },
      {
        match: (type: string) => type.includes('onion'),
        icon: '🧅',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('onion', ' Onion'))
      },
      {
        match: (type: string) => type.includes('flax'),
        icon: '🌾',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('flax', ' Flax'))
      },
      {
        match: (type: string) => type.includes('carrot'),
        icon: '🥕',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('carrot', ' Carrot'))
      },
      {
        match: (type: string) => type.includes('redmushroom'),
        icon: '🍄',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('redmushroom', 'Red Mushroom'))
      },
      {
        match: (type: string) => type.includes('plant') && type !== 'plant',
        icon: '🌿',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('plant', ' Plant'))
      },
      {
        match: (type: string) => type.includes('strawberries'),
        icon: '🍓',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('strawberries', 'Strawberries'))
      },
      {
        match: (type: string) => type.includes('watermelon'),
        icon: '🍉',
        category: 'Harvestables',
        nameFormatter: (type: string) => formatEntityName(type.replace('watermelon', 'Watermelon'))
      }
    ]

    // Helper function to format entity names consistently
    function formatEntityName(name: string): string {
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      return nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)
    }

    // Helper function to add entity to appropriate layer based on level
    function addEntityToLayer(feature: any, entityLevel: number, category: string) {
      const layerMap = {
        0: 'Underworld',
        1: 'Overworld', 
        2: 'Sky'
      }
      const layerName = layerMap[entityLevel as keyof typeof layerMap]
      if (layerName) {
        addItem(feature, layerName, category)
      }
    }

    // Process entities with the new streamlined approach
    const worldEntities = (entitiesData as any).worldEntities || []
    worldEntities.forEach((entity: any) => {
      // Find matching configuration for this entity type
      const config = entityTypeConfig.find(cfg => cfg.match(entity.type))
      
      if (config) {
        const name = config.nameFormatter(entity.type)
        const feature = createMarkerFeature(
          [entity.x + 512.5, entity.z + 512.5], 
          config.icon, 
          name, 
          config.category
        )
        addEntityToLayer(feature, entity.lvl, config.category)
      }
    })

    // NPC type configuration for cleaner processing
    const npcTypeConfig = [
      {
        condition: (npc: any) => Boolean(npc.shopdef_id),
        icon: '🏪',
        category: 'Shops',
        nameFormatter: (npcDef: any) => 
          typeof npcDef.name === 'string' ? 
          npcDef.name.replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase()) : ''
      },
      {
        condition: (_npc: any, npcDef: any) => Boolean(npcDef?.combat) && Boolean(npcDef.combat.isAlwaysAggro),
        icon: '😈', 
        category: 'Aggressive NPCs',
        nameFormatter: (npcDef: any) => {
          const name = typeof npcDef.name === 'string' ? 
            npcDef.name.replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase()) : ''
          const level = npcDef.combat?.level ? ` (Lvl. ${npcDef.combat.level})` : ''
          return name + level
        }
      },
      {
        condition: (_npc: any, npcDef: any) => Boolean(npcDef?.combat) && !Boolean(npcDef.combat.isAlwaysAggro) && (npcDef.combat.aggroRadius || 0) >= 1,
        icon: '😠',
        category: 'Semi-Aggressive NPCs', 
        nameFormatter: (npcDef: any) => {
          const name = typeof npcDef.name === 'string' ? 
            npcDef.name.replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase()) : ''
          const level = npcDef.combat?.level ? ` (Lvl. ${npcDef.combat.level})` : ''
          return name + level
        }
      },
      {
        condition: (_npc: any, npcDef: any) => Boolean(npcDef?.combat) && !Boolean(npcDef.combat.isAlwaysAggro) && (npcDef.combat.aggroRadius || 0) === 0,
        icon: '😐',
        category: 'Attackable NPCs', 
        nameFormatter: (npcDef: any) => {
          const name = typeof npcDef.name === 'string' ? 
            npcDef.name.replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase()) : ''
          const level = npcDef.combat?.level ? ` (Lvl. ${npcDef.combat.level})` : ''
          return name + level
        }
      },
      {
        condition: () => true, // Default case - regular NPC
        icon: '👤',
        category: 'NPCs',
        nameFormatter: (npcDef: any) => 
          typeof npcDef.name === 'string' ? 
          npcDef.name.replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase()) : ''
      }
    ]

    // Helper function to add NPC to appropriate layer based on map level
    function addNPCToLayer(feature: any, mapLevel: number, category: string) {
      const layerMap = {
        0: 'Underworld',
        1: 'Overworld',
        2: 'Sky'
      }
      const layerName = layerMap[mapLevel as keyof typeof layerMap]
      if (layerName) {
        addItem(feature, layerName, category)
      }
    }

    // Process NPCs with streamlined approach
    npcs.npcs.forEach((npc: any) => {
      const npcDef = npcDefinitions.npcDefs.find((def: any) => npc.npcdef_id === def._id) as any
      if (!npcDef) return

      // Find the first matching configuration (order matters - more specific conditions first)
      const config = npcTypeConfig.find(cfg => cfg.condition(npc, npcDef))
      
      if (config) {
        const name = config.nameFormatter(npcDef)
        if (name) { // Only create marker if name is valid
          const feature = createMarkerFeature(
            [npc.x + 512.5, npc.y + 512.5], 
            config.icon, 
            name, 
            config.category
          )
          addNPCToLayer(feature, npc.mapLevel, config.category)
        }
      }
    })

    // Handle URL params for initial view/marker with coordinate conversion
    const urlParams = new URLSearchParams(window.location.search)
    const level = urlParams.get('lvl')
    const posX = urlParams.get('pos_x')
    const posY = urlParams.get('pos_y')
    const zoomParam = urlParams.get('zoom') ?? '7.5' // Default zoom level if not specified
    const zoom = Math.max(0, Math.min(28, parseFloat(zoomParam))) // Convert to number and clamp between 0-28 for map.flyTo()
    const hideDecor = urlParams.get('hide_decor')
    let playPositionMarker: maplibregl.Marker | null = null
    
    if (posX && posY) {
      // Convert game coordinates to longitude/latitude
      // Ensure coordinates are valid numbers
      const x = parseFloat(posX)
      const y = parseFloat(posY)
      
      if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
        const mapCoords = gameToLngLat(x, y)
        
        // Validate that the converted coordinates are within map bounds
        const [lng, lat] = mapCoords
        if (lng >= -36 && lng <= 36 && lat >= -36 && lat <= 36) {
        
        // Create player marker
        const markerElement = document.createElement('div')
        markerElement.className = 'text-label'
        markerElement.innerHTML = `<div class="marker playerPosition">
          <span style="
            display: inline-block;
            font-size:1.5rem;
            color:red;
            text-shadow: 0px 0px 8px black;
            animation: spin 10s linear infinite;
            transform-origin: center;
          ">❌</span>
        </div>`
        markerElement.title = 'You are here'
        
        // Add CSS keyframes for spinning animation
        if (!document.querySelector('#player-marker-styles')) {
          const style = document.createElement('style')
          style.id = 'player-marker-styles'
          style.textContent = `
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `
          document.head.appendChild(style)
        }
        
        playPositionMarker = new maplibregl.Marker({
          element: markerElement
        }).setLngLat(mapCoords).addTo(map)
        
        // Set map center to the player position
        map.flyTo({
          center: mapCoords,
          zoom: zoom,
          duration: 1500
        })
        
        // Set layer if specified in URL
        if (level && ['Overworld', 'Underworld', 'Sky'].includes(level)) {
          selectedLayer.value = level
        }
        } else {
          console.warn('Invalid coordinates provided in URL parameters - coordinates out of bounds')
        }
      } else {
        console.warn('Invalid coordinates provided in URL parameters - not valid numbers')
      }
    } else {
      // Only fit bounds if no URL position parameters are present
      // Fit the map to show the full map area with generous padding
      const fitBounds = new maplibregl.LngLatBounds()
      fitBounds.extend([-50, -50]) // southwest corner with extra padding
      fitBounds.extend([50, 50])   // northeast corner with extra padding
      
      map.fitBounds(fitBounds, {
        padding: 100,
        duration: 1000,
        maxZoom: 4
      })
    }

    // Watch for layer changes
    watch(selectedLayer, (newVal) => {
      // Update layer visibility
      setLayerVisibility('overworld', newVal === 'Overworld')
      setLayerVisibility('underworld', newVal === 'Underworld')
      setLayerVisibility('sky', newVal === 'Sky')
      
      // Set background color based on layer
      const mapElement = document.getElementById('map')
      if (mapElement) {
        if (newVal === 'Overworld') {
          mapElement.style.backgroundColor = '#3b85b9'
        } else {
          mapElement.style.backgroundColor = 'black'
        }
      }
      
      // If layer switch was initiated by search result selection, re-apply search filter
      if (isLayerSwitchFromSearch.value && activeSearchQuery.value) {
        setTimeout(() => {
          filterMarkersBasedOnSearch(activeSearchQuery.value)
          isLayerSwitchFromSearch.value = false
        }, 100)
      }
    })

    // Set initial layer based on URL param
    if (level) {
      const mapElement = document.getElementById('map')
      switch (level) {
        case 'Overworld':
          selectedLayer.value = 'Overworld'
          setLayerVisibility('overworld', true)
          setLayerVisibility('underworld', false)
          setLayerVisibility('sky', false)
          if (mapElement) mapElement.style.backgroundColor = '#3b85b9'
          break
        case 'Underworld':
          selectedLayer.value = 'Underworld'
          setLayerVisibility('overworld', false)
          setLayerVisibility('underworld', true)
          setLayerVisibility('sky', false)
          if (mapElement) mapElement.style.backgroundColor = 'black'
          break
        case 'Sky':
          selectedLayer.value = 'Sky'
          setLayerVisibility('overworld', false)
          setLayerVisibility('underworld', false)
          setLayerVisibility('sky', true)
          if (mapElement) mapElement.style.backgroundColor = 'black'
          break
      }
    } else {
      selectedLayer.value = 'Overworld'
    }

    // Handle real-time player movement messages with coordinate conversion
    window.addEventListener('message', (event: any) => {
      if (event.data.X && event.data.Y && event.data.lvl) {
        const layerName = event.data.lvl
        if (['Overworld', 'Underworld', 'Sky'].includes(layerName)) {
          selectedLayer.value = layerName
        }
        
        // Convert game coordinates to longitude/latitude
        const mapCoords = gameToLngLat(event.data.X, event.data.Y)
        
        // Handle player marker
        if (playPositionMarker) {
          playPositionMarker.setLngLat(mapCoords)
        } else {
          // Create new player marker
          const markerElement = document.createElement('div')
          markerElement.className = 'text-label'
          markerElement.innerHTML = `<div class="marker playerPosition">
            <span style="
              display: inline-block;
              font-size:1.5rem;
              color:red;
              text-shadow: 0px 0px 8px black;
              animation: spin 10s linear infinite;
              transform-origin: center;
            ">❌</span>
          </div>`
          markerElement.title = 'You are here'
          
          playPositionMarker = new maplibregl.Marker({
            element: markerElement
          }).setLngLat(mapCoords).addTo(map)
          
          map.flyTo({
            center: mapCoords,
            zoom: 8,
            duration: 1500
          })
        }
        
        // Update player coordinates for highlite mode
        if (isHighliteMode.value) {
          playerMarker.x = event.data.X
          playerMarker.y = event.data.Y
        }
      }
    })

    if (hideDecor) {
      const footer = document.querySelector('.footer') as HTMLElement | null
      const header = document.querySelector('header') as HTMLElement | null
      const joinUs = document.querySelector('.joinUs') as HTMLElement | null
      if (footer) footer.style.display = 'none'
      if (header) header.style.display = 'none'
      if (joinUs) joinUs.style.display = 'none'
      
      const mapElement = document.getElementById('map')
      if (mapElement) {
        mapElement.style.height = '100vh'
        mapElement.style.width = '100vw'
      }
    }

    // Initialize marker counts
    updateMarkerCounts()
    
    // Apply initial filter states to show only visible categories
    applyFilterStatesToLayer()
    
    // Set loading to false after everything is initialized
    setTimeout(() => {
      isLoading.value = false
      
      // Ensure map is properly sized
      map.resize()
    }, 500)
  })
})

// Cleanup on component unmount
onUnmounted(() => {
  if (map) {
    map.remove()
  }
})

const saveOriginalCategoryStates = () => {
  if (Object.keys(originalCategoryStates.value).length === 0) {
    markerCategories.value.forEach(category => {
      originalCategoryStates.value[category.name] = category.visible
    })
  }
}

const restoreOriginalCategoryStates = () => {
  if (Object.keys(originalCategoryStates.value).length > 0) {
    markerCategories.value.forEach(category => {
      const originalState = originalCategoryStates.value[category.name]
      if (originalState !== undefined) {
        category.visible = originalState
      }
    })
    originalCategoryStates.value = {}
  }
}


</script>

<template>
  <!-- Loading overlay -->
  <LoadingSpinner :visible="isLoading" message="Loading map..." />

  <!-- Map container with UI elements inside -->
  <div id="map">
    <!-- UI Controls positioned inside the map -->
    <!-- Enhanced Layer Controls -->
    <div class="map-controls-container">
      <!-- Search and Filter Component -->
      <MapControls 
        :selected-layer="selectedLayer"
        :layers="layers"
        :marker-categories="markerCategories"
        @layer-changed="handleLayerChanged"
        @search-location-selected="handleSearchLocationSelected"
        @marker-category-toggled="handleMarkerCategoryToggled"
        @search-query-changed="filterMarkersBasedOnSearch"
      />
    </div>

    <!-- Position Indicator Component -->
    <MapPositionIndicator 
      :coordinates="displayCoordinates"
      :current-layer="getCurrentLayerInfo()"
      :is-highlite-mode="isHighliteMode"
      :pinned-marker="pinnedMarker"
      @remove-pin="removePin"
    />

    <!-- Popup Component -->
    <MapPopup
      :map="map"
      :content="popupContent"
      :position="popupPosition"
      :visible="popupVisible"
      :selected-layer="selectedLayer"
      :is-highlite-mode="isHighliteMode"
      @close="hidePopup"
      @pin-location="pinLocation"
    />
  </div>
</template>

<style scoped>
#map {
  height: calc(100vh - 76px);
  width: 100%;
  position: relative;
  z-index: 1;
}

.map-controls-container {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 300px;
  max-width: 300px;
  max-height: calc(100vh - 120px);
  z-index: 1001;
}

@media (max-width: 768px) {
  #map {
    height: calc(100vh - 60px);
  }

  .map-controls-container {
    position: absolute;
    top: 8px;
    right: 8px;
    left: 8px;
    width: auto;
    max-height: calc(100vh - 100px);
    max-width: calc(100vw - 16px);
    z-index: 1001;
    overflow: hidden;
  }
}

@media (max-width: 480px) {
  #map {
    height: calc(100vh - 50px);
  }

  .map-controls-container {
    top: 4px;
    right: 4px;
    left: 4px;
    max-height: calc(100vh - 80px);
    max-width: calc(100vw - 8px);
    overflow: hidden;
  }
}

/* Landscape orientation on mobile */
@media (max-width: 768px) and (orientation: landscape) {
  .map-controls-container {
    right: 8px;
    left: auto;
    max-height: calc(100vh - 60px);
  }
}

/* Custom marker styles */
.custom-marker {
  position: relative;
  z-index: 1000;
  cursor: pointer;
}

.custom-marker:hover {
  cursor: pointer;
}

.custom-marker .marker-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.custom-marker:hover .marker-icon {
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8));
  transform: scale(1.15);
}

.location-label {
  font-size: 13px;
  font-weight: 900;
  color: #ffffff;
  text-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.9),
    0 0 8px rgba(255, 255, 255, 0.3),
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.6));
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}

.location-label:hover {
  transform: scale(1.05);
  color: #ffff00;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.7));
  border-color: rgba(255, 255, 0, 0.4);
  text-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.9),
    0 0 12px rgba(255, 255, 0, 0.5),
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
}

.marker-icon {
  font-size: 18px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 70%, rgba(255, 255, 255, 0.8) 100%);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;
}

.marker-icon::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.marker-icon:hover {
  transform: scale(1.1);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 1);
}

/* Special styling for different marker categories */
.custom-marker[data-category="Banks"] .marker-icon {
  background: radial-gradient(circle, rgba(255, 215, 0, 0.95) 0%, rgba(255, 215, 0, 0.9) 70%, rgba(255, 215, 0, 0.8) 100%);
  border-color: rgba(255, 215, 0, 0.8);
}

.custom-marker[data-category="Shops"] .marker-icon {
  background: radial-gradient(circle, rgba(0, 255, 127, 0.95) 0%, rgba(0, 255, 127, 0.9) 70%, rgba(0, 255, 127, 0.8) 100%);
  border-color: rgba(0, 255, 127, 0.8);
}

.custom-marker[data-category="NPCs"] .marker-icon {
  background: radial-gradient(circle, rgba(135, 206, 235, 0.95) 0%, rgba(135, 206, 235, 0.9) 70%, rgba(135, 206, 235, 0.8) 100%);
  border-color: rgba(135, 206, 235, 0.8);
}

.custom-marker[data-category="Attackable NPCs"] .marker-icon,
.custom-marker[data-category="Semi-Aggressive NPCs"] .marker-icon {
  background: radial-gradient(circle, rgba(255, 99, 71, 0.95) 0%, rgba(255, 99, 71, 0.9) 70%, rgba(255, 99, 71, 0.8) 100%);
  border-color: rgba(255, 99, 71, 0.8);
}

.custom-marker[data-category="Aggressive NPCs"] .marker-icon {
  background: radial-gradient(circle, rgba(255, 20, 147, 0.95) 0%, rgba(255, 20, 147, 0.9) 70%, rgba(255, 20, 147, 0.8) 100%);
  border-color: rgba(255, 20, 147, 0.8);
}

.custom-marker[data-category="Trees"] .marker-icon {
  background: radial-gradient(circle, rgba(144, 238, 144, 0.95) 0%, rgba(144, 238, 144, 0.9) 70%, rgba(144, 238, 144, 0.8) 100%);
  border-color: rgba(144, 238, 144, 0.8);
}

.custom-marker[data-category="Obelisks"] .marker-icon {
  background: radial-gradient(circle, rgba(221, 160, 221, 0.95) 0%, rgba(221, 160, 221, 0.9) 70%, rgba(221, 160, 221, 0.8) 100%);
  border-color: rgba(221, 160, 221, 0.8);
}

.custom-marker[data-category="Ores"] .marker-icon {
  background: radial-gradient(circle, rgba(210, 105, 30, 0.95) 0%, rgba(210, 105, 30, 0.9) 70%, rgba(210, 105, 30, 0.8) 100%);
  border-color: rgba(210, 105, 30, 0.8);
}

.custom-marker[data-category="Fires"] .marker-icon {
  background: radial-gradient(circle, rgba(255, 69, 0, 0.95) 0%, rgba(255, 69, 0, 0.9) 70%, rgba(255, 69, 0, 0.8) 100%);
  border-color: rgba(255, 69, 0, 0.8);
}

.custom-marker[data-category="Anvils"] .marker-icon {
  background: radial-gradient(circle, rgba(230, 230, 250, 0.95) 0%, rgba(230, 230, 250, 0.9) 70%, rgba(230, 230, 250, 0.8) 100%);
  border-color: rgba(230, 230, 250, 0.8);
}

.custom-marker[data-category="Furnaces"] .marker-icon {
  background: radial-gradient(circle, rgba(255, 140, 0, 0.95) 0%, rgba(255, 140, 0, 0.9) 70%, rgba(255, 140, 0, 0.8) 100%);
  border-color: rgba(255, 140, 0, 0.8);
}

.custom-marker[data-category="Kilns"] .marker-icon {
  background: radial-gradient(circle, rgba(205, 133, 63, 0.95) 0%, rgba(205, 133, 63, 0.9) 70%, rgba(205, 133, 63, 0.8) 100%);
  border-color: rgba(205, 133, 63, 0.8);
}

.custom-marker[data-category="Stoves"] .marker-icon {
  background: radial-gradient(circle, rgba(255, 165, 0, 0.95) 0%, rgba(255, 165, 0, 0.9) 70%, rgba(255, 165, 0, 0.8) 100%);
  border-color: rgba(255, 165, 0, 0.8);
}

.custom-marker[data-category="Fishing Spots"] .marker-icon {
  background: radial-gradient(circle, rgba(0, 191, 255, 0.95) 0%, rgba(0, 191, 255, 0.9) 70%, rgba(0, 191, 255, 0.8) 100%);
  border-color: rgba(0, 191, 255, 0.8);
}

.custom-marker[data-category="Harvestables"] .marker-icon {
  background: radial-gradient(circle, rgba(173, 255, 47, 0.95) 0%, rgba(173, 255, 47, 0.9) 70%, rgba(173, 255, 47, 0.8) 100%);
  border-color: rgba(173, 255, 47, 0.8);
}
</style>

