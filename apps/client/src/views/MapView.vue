<script setup lang="ts">
const levelMarkers: Record<string, Record<string, Feature[]>> = {
  Overworld: {},
  Underworld: {},
  Sky: {},
}

// Removed unused treeFeaturesStorage variable

// Vector layers for markers
const markerLayers: Record<string, VectorLayer<VectorSource>> = {
  Overworld: new VectorLayer({ source: new VectorSource() }),
  Underworld: new VectorLayer({ source: new VectorSource() }),
  Sky: new VectorLayer({ source: new VectorSource() })
}

// Clustering layers specifically for trees
const treeClusterLayers: Record<string, VectorLayer<Cluster>> = {
  Overworld: new VectorLayer({
    source: new Cluster({
      distance: 80, // Distance in pixels within which features will be clustered
      minDistance: 20, // Minimum distance in pixels between clusters
      source: new VectorSource()
    })
  }),
  Underworld: new VectorLayer({
    source: new Cluster({
      distance: 80,
      minDistance: 20,
      source: new VectorSource()
    })
  }),
  Sky: new VectorLayer({
    source: new Cluster({
      distance: 80,
      minDistance: 20,
      source: new VectorSource()
    })
  })
}

// Separate layers for location labels to ensure they're always on top
const locationLabelLayers: Record<string, VectorLayer<VectorSource>> = {
  Overworld: new VectorLayer({ 
    source: new VectorSource(),
    zIndex: 1000 // High z-index to ensure labels are on top
  }),
  Underworld: new VectorLayer({ 
    source: new VectorSource(),
    zIndex: 1000
  }),
  Sky: new VectorLayer({ 
    source: new VectorSource(),
    zIndex: 1000
  })
}

import { ref, onMounted, onUnmounted, watch, computed, reactive } from 'vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import MapControls from '@/components/map/MapControls.vue'
import MapPositionIndicator from '@/components/map/MapPositionIndicator.vue'
import MapPopup from '@/components/map/MapPopup.vue'
import locations from '@/assets/map/Locations.json'
import entitiesData from '@/assets/map/worldEntities.json'
import npcs from '@/assets/map/NPCs.json'
import npcDefinitions from '@/assets/map/NPCDefs.json'
import Map from 'ol/Map'
import View from 'ol/View'
import Overlay from 'ol/Overlay'
import Group from 'ol/layer/Group'
import ImageLayer from 'ol/layer/Image'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Cluster from 'ol/source/Cluster'
import ImageStatic from 'ol/source/ImageStatic'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { Style, Text, Fill, Stroke, Circle } from 'ol/style'
import { defaults as defaultInteractions } from 'ol/interaction'
import type { FeatureLike } from 'ol/Feature'

let map: Map
let overworldLayers: Group
let underworldLayers: Group
let skyLayers: Group

// Enhanced reactive state
const selectedLayer = ref('Overworld')
const isLoading = ref(true)
const mouseCoords = reactive({ x: 0, y: 0 })

// Highlite Map Plugin state
const isHighliteMode = ref(false)
const playerMarker = reactive({ x: 0, y: 0 })
const pinnedMarker = reactive({ x: 0, y: 0, isPinned: false })
let pinnedFeature: Feature | null = null
let arrowOverlay: Overlay | null = null

// Popup state
const popupVisible = ref(false)
const popupContent = ref('')
const popupPosition = ref<[number, number] | null>(null)

// Search filtering state
const activeSearchQuery = ref('')
const filteredMarkerIds = ref<Set<string>>(new Set())
const originalCategoryStates = ref<Record<string, boolean>>({})
const isLayerSwitchFromSearch = ref(false)

// Performance optimization variables
let hoverTimeout: number | null = null
let lastHoverFeature: Feature | null = null
let performanceMode = navigator.userAgent.toLowerCase().indexOf('firefox') > -1 ? 'low' : 'high' // Auto-detect Firefox and use low performance mode

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
  { name: 'Trees', icon: '🌳', visible: true, count: 0 },
  { name: 'Obelisks', icon: '🗿', visible: true, count: 0 },
  { name: 'Ores', icon: '🪨', visible: true, count: 0 },
  { name: 'Banks', icon: '💰', visible: true, count: 0 },
  { name: 'Fires', icon: '🔥', visible: true, count: 0 },
  { name: 'Anvils', icon: '🔨', visible: true, count: 0 },
  { name: 'Furnaces', icon: '🏭', visible: true, count: 0 },
  { name: 'Kilns', icon: '⚱️', visible: true, count: 0 },
  { name: 'Stoves', icon: '🍳', visible: true, count: 0 },
  { name: 'Fishing Spots', icon: '🎣', visible: true, count: 0 },
  { name: 'Harvestables', icon: '🌾', visible: true, count: 0 },
  { name: 'Shops', icon: '🏪', visible: true, count: 0 },
  { name: 'NPCs', icon: '👤', visible: true, count: 0 },
  { name: 'Attackable NPCs', icon: '😐', visible: true, count: 0 },
  { name: 'Semi-Aggressive NPCs', icon: '😠', visible: true, count: 0 },
  { name: 'Aggressive NPCs', icon: '😈', visible: true, count: 0 }
])

// All searchable items - moved to component

const getCurrentLayerInfo = () => {
  return layers.value.find(layer => layer.id === selectedLayer.value) || layers.value[0]
}

// Computed property to return either player marker or mouse coordinates
const displayCoordinates = computed(() => {
  return isHighliteMode.value ? playerMarker : mouseCoords
})

const updateMarkerCounts = () => {
  // Firefox optimization: Throttle marker count updates
  if (performanceMode === 'low') {
    setTimeout(() => {
      markerCategories.value.forEach(category => {
        const currentLayerMarkers = levelMarkers[selectedLayer.value]
        category.count = currentLayerMarkers[category.name]?.length || 0
      })
    }, 0)
  } else {
    markerCategories.value.forEach(category => {
      const currentLayerMarkers = levelMarkers[selectedLayer.value]
      category.count = currentLayerMarkers[category.name]?.length || 0
    })
  }
}

  const applyFilterStatesToLayer = () => {
  // Firefox optimization: Batch operations to reduce redraws
  const currentLayerMarkers = levelMarkers[selectedLayer.value]
  const markerSource = markerLayers[selectedLayer.value].getSource()
  const locationSource = locationLabelLayers[selectedLayer.value].getSource()
  const treeClusterSource = treeClusterLayers[selectedLayer.value].getSource()
  
  if (!markerSource || !locationSource || !treeClusterSource) return
  
  // Batch clear operations
  if (performanceMode === 'low') {
    // Firefox: Clear and rebuild in batches
    markerSource.clear()
    locationSource.clear()
    const treeClusterSourceInner = treeClusterSource.getSource()
    if (treeClusterSourceInner) {
      treeClusterSourceInner.clear()
    }
    
    // Add visible features in one go
    markerCategories.value.forEach(category => {
      if (category.visible && currentLayerMarkers[category.name]) {
        const features = currentLayerMarkers[category.name]
        if (category.name === 'Locations') {
          locationSource.addFeatures(features)
        } else if (category.name === 'Trees') {
          // Add trees to clustering source
          const treeClusterSourceInner = treeClusterSource.getSource()
          if (treeClusterSourceInner) {
            treeClusterSourceInner.addFeatures(features)
          }
        } else {
          markerSource.addFeatures(features)
        }
      }
    })
  } else {
    // Other browsers: Batch operations for better performance
    // Collect features to add/remove by category
    const featuresToAdd = {
      locations: [] as Feature[],
      trees: [] as Feature[],
      regular: [] as Feature[]
    }
    const featuresToRemove = {
      locations: [] as Feature[],
      trees: [] as Feature[],
      regular: [] as Feature[]
    }
    
    markerCategories.value.forEach(category => {
      const currentLayerMarkers = levelMarkers[selectedLayer.value]
      if (currentLayerMarkers[category.name]) {
        const features = currentLayerMarkers[category.name]
        
        if (category.name === 'Locations') {
          if (category.visible) {
            featuresToAdd.locations.push(...features)
          } else {
            featuresToRemove.locations.push(...features.filter(f => f !== pinnedFeature))
          }
        } else if (category.name === 'Trees') {
          if (category.visible) {
            featuresToAdd.trees.push(...features)
          } else {
            featuresToRemove.trees.push(...features.filter(f => f !== pinnedFeature))
          }
        } else {
          if (category.visible) {
            featuresToAdd.regular.push(...features)
          } else {
            featuresToRemove.regular.push(...features.filter(f => f !== pinnedFeature))
          }
        }
      }
    })
    
    // Batch remove features
    if (featuresToRemove.locations.length > 0) {
      const source = locationLabelLayers[selectedLayer.value].getSource()
      if (source) {
        featuresToRemove.locations.forEach(feature => {
          if (source.hasFeature(feature)) {
            source.removeFeature(feature)
          }
        })
      }
    }
    
    if (featuresToRemove.trees.length > 0) {
      const clusterSource = treeClusterLayers[selectedLayer.value].getSource()
      const treeSource = clusterSource?.getSource()
      if (treeSource) {
        featuresToRemove.trees.forEach(feature => {
          if (treeSource.hasFeature(feature)) {
            treeSource.removeFeature(feature)
          }
        })
      }
    }
    
    if (featuresToRemove.regular.length > 0) {
      const source = markerLayers[selectedLayer.value].getSource()
      if (source) {
        featuresToRemove.regular.forEach(feature => {
          if (source.hasFeature(feature)) {
            source.removeFeature(feature)
          }
        })
      }
    }
    
    // Batch add features
    if (featuresToAdd.locations.length > 0) {
      const source = locationLabelLayers[selectedLayer.value].getSource()
      if (source) {
        const newFeatures = featuresToAdd.locations.filter(f => !source.hasFeature(f))
        if (newFeatures.length > 0) {
          source.addFeatures(newFeatures)
        }
      }
    }
    
    if (featuresToAdd.trees.length > 0) {
      const clusterSource = treeClusterLayers[selectedLayer.value].getSource()
      const treeSource = clusterSource?.getSource()
      if (treeSource) {
        const newFeatures = featuresToAdd.trees.filter(f => !treeSource.hasFeature(f))
        if (newFeatures.length > 0) {
          treeSource.addFeatures(newFeatures)
        }
      }
    }
    
    if (featuresToAdd.regular.length > 0) {
      const source = markerLayers[selectedLayer.value].getSource()
      if (source) {
        const newFeatures = featuresToAdd.regular.filter(f => !source.hasFeature(f))
        if (newFeatures.length > 0) {
          source.addFeatures(newFeatures)
        }
      }
    }
  }
}

// Helper functions for pinned feature visuals
const updatePinnedFeatureVisuals = (mapX: number, mapY: number) => {
  // Clear previous pinned feature styling
  clearPinnedFeatureVisuals()
  
  // Find the feature at the pinned coordinates
  const pixel = map.getPixelFromCoordinate([mapX, mapY])
  if (pixel) {
    const features = map.getFeaturesAtPixel(pixel)
    if (features.length > 0) {
      // Find the first non-location feature (same logic as click handler)
      const targetFeature = features.find(feature => 
        'get' in feature && !feature.get('isLocation')
      )
      
      if (targetFeature && 'setStyle' in targetFeature && 'get' in targetFeature) {
        pinnedFeature = targetFeature as Feature
        // Create an enhanced style for the pinned feature
        const originalStyle = pinnedFeature.get('defaultStyle')
        if (originalStyle) {
          const enhancedStyle = originalStyle.clone()
          const textStyle = enhancedStyle.getText()
          if (textStyle) {
            // Scale up the feature - get original font and increase size
            const originalFont = textStyle.getFont() || 'bold 1rem "Inter", sans-serif'
            const scaledFont = originalFont.replace(/(\d+(?:\.\d+)?)(\w+)/, (_match: string, size: string, unit: string) => {
              const newSize = parseFloat(size) * 1.8 // Scale up by 1.8x
              return `${newSize}${unit}`
            })
            textStyle.setFont(scaledFont)
            textStyle.setStroke(new Stroke({ 
              color: '#ff6b35', 
              width: 4 
            }))
            textStyle.setFill(new Fill({ color: '#ffeb3b' }))
          }
          pinnedFeature.setStyle(enhancedStyle)
        }
        
        // Create an arrow pointing to the pinned feature
        createArrowOverlay(mapX, mapY)
      }
    }
  }
}

// Function to create cluster style for trees
const createClusterStyle = (feature: FeatureLike): Style | Style[] => {
  const features = feature.get('features')
  const size = features.length
  
  if (size === 1) {
    // Single feature - use the original tree style but slightly larger
    const originalFeature = features[0]
    return originalFeature.get('defaultStyle') || new Style({
      text: new Text({
        text: '🌳',
        font: 'bold 1.2rem "Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
        fill: new Fill({ color: '#90ee90' }),
        stroke: new Stroke({ color: '#228b22', width: 1.5 }),
        textAlign: 'center',
        textBaseline: 'middle'
      })
    })
  } else {
    // Cluster style - multiple styles for tree + badge
    // Note: Styles are rendered in array order, so tree icon first (behind), then badge elements (in front)
    return [
      // Main tree icon (rendered first, appears behind)
      new Style({
        text: new Text({
          text: '🌳',
          font: 'bold 1.5rem "Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
          fill: new Fill({ color: '#228b22' }), // Darker green for clusters
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
          textAlign: 'center',
          textBaseline: 'middle'
        })
      }),
      // Red circle badge positioned at top-right (rendered second, appears in front)
      new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: '#ff0000' }),
          stroke: new Stroke({ color: '#ffffff', width: 1 }),
          displacement: [10, -10] // Positive X (right), negative Y (up) for top-right positioning
        })
      }),
      // Count text on the red circle (rendered last, appears on top)
      new Style({
        text: new Text({
          text: size.toString(),
          font: 'bold 10px "Inter", sans-serif',
          fill: new Fill({ color: '#ffffff' }),
          textAlign: 'center',
          textBaseline: 'middle',
          offsetX: 10, // Align with the red circle
          offsetY: 10 // Align with the red circle
        })
      })
    ]
  }
}

const clearPinnedFeatureVisuals = () => {
  // Reset pinned feature style to default
  if (pinnedFeature && 'setStyle' in pinnedFeature && 'get' in pinnedFeature) {
    const defaultStyle = pinnedFeature.get('defaultStyle')
    if (defaultStyle) {
      pinnedFeature.setStyle(defaultStyle)
    }
    
    // Check if the feature's category is currently hidden, and if so, remove it from the layer
    const featureCategory = pinnedFeature.get('category')
    const category = markerCategories.value.find(cat => cat.name === featureCategory)
    if (category && !category.visible) {
      // Feature's category is hidden, so remove it from the layer
      const isLocation = pinnedFeature.get('isLocation')
      const layer = isLocation ? locationLabelLayers[selectedLayer.value] : markerLayers[selectedLayer.value]
      const source = layer.getSource()
      if (source && source.hasFeature(pinnedFeature)) {
        source.removeFeature(pinnedFeature)
      }
    }
  }
  pinnedFeature = null
  
  // Remove arrow overlay
  if (arrowOverlay && map) {
    map.removeOverlay(arrowOverlay)
    arrowOverlay = null
  }
}

// Function to reapply pinned feature styling (used when layer changes)
const reapplyPinnedFeatureStyle = () => {
  if (isHighliteMode.value && pinnedMarker.isPinned) {
    // If we have a pinned feature reference and it's still valid, reapply styling directly
    if (pinnedFeature && 'setStyle' in pinnedFeature && 'get' in pinnedFeature) {
      const originalStyle = pinnedFeature.get('defaultStyle')
      if (originalStyle) {
        const enhancedStyle = originalStyle.clone()
        const textStyle = enhancedStyle.getText()
        if (textStyle) {
          // Scale up the feature - get original font and increase size
          const originalFont = textStyle.getFont() || 'bold 1rem "Inter", sans-serif'
          const scaledFont = originalFont.replace(/(\d+(?:\.\d+)?)(\w+)/, (_match: string, size: string, unit: string) => {
            const newSize = parseFloat(size) * 1.8 // Scale up by 1.8x
            return `${newSize}${unit}`
          })
          textStyle.setFont(scaledFont)
          textStyle.setStroke(new Stroke({ 
            color: '#ff6b35', 
            width: 4 
          }))
          textStyle.setFill(new Fill({ color: '#ffeb3b' }))
        }
        pinnedFeature.setStyle(enhancedStyle)
      }
      
      // Recreate arrow if it was removed
      if (!arrowOverlay) {
        createArrowOverlay(pinnedMarker.x + 512.5, pinnedMarker.y + 512.5)
      }
    } else {
      // Feature reference was lost, re-find and re-apply
      updatePinnedFeatureVisuals(pinnedMarker.x + 512.5, pinnedMarker.y + 512.5)
    }
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
  
  // Create overlay positioned relative to the map coordinate system
  arrowOverlay = new Overlay({
    element: arrowElement,
    position: [mapX, mapY], // Position at the exact coordinate
    positioning: 'bottom-center', // Position arrow bottom-center relative to the coordinate
    offset: [0, -15], // Offset upward by 15 pixels to position above the marker
    stopEvent: false,
    insertFirst: false
  })
  
  map.addOverlay(arrowOverlay)
}

// Search filtering functions
const filterMarkersBasedOnSearch = (searchQuery: string) => {
  activeSearchQuery.value = searchQuery.toLowerCase().trim()
  
  if (!activeSearchQuery.value) {
    // No search query, restore original category states
    restoreOriginalCategoryStates()
    showAllMarkersBasedOnCategories()
    return
  }
  
  // Save original category states before search filtering
  saveOriginalCategoryStates()
  
  // Hide all markers first
  hideAllMarkers()
  
  // Find matching features and batch them by category for efficient addition
  const matchingIds = new Set<string>()
  const categoriesWithResults = new Set<string>()
  const featuresToAdd = {
    locations: [] as Feature[],
    trees: [] as Feature[],
    regular: [] as Feature[]
  }
  
  // Search through current layer only for visibility
  const currentLayerMarkers = levelMarkers[selectedLayer.value] || {}
  Object.entries(currentLayerMarkers).forEach(([category, features]) => {
    features.forEach((feature: Feature) => {
      const name = feature.get('name')?.toLowerCase() || ''
      const featureCategory = feature.get('category')?.toLowerCase() || ''
      
      // Check if feature matches search query or is the pinned feature
      if (name.includes(activeSearchQuery.value) || 
          featureCategory.includes(activeSearchQuery.value) ||
          category.toLowerCase().includes(activeSearchQuery.value) ||
          feature === pinnedFeature) {
        matchingIds.add(feature.getId() as string || `${feature.get('name')}-${category}`)
        categoriesWithResults.add(category)
        
        // Batch features by type for efficient addition
        const isLocation = feature.get('isLocation')
        const isTree = feature.get('category') === 'Trees'
        
        if (isLocation) {
          featuresToAdd.locations.push(feature)
        } else if (isTree) {
          featuresToAdd.trees.push(feature)
        } else {
          featuresToAdd.regular.push(feature)
        }
      }
    })
  })
  
  // Batch add features to their respective layers
  if (featuresToAdd.locations.length > 0) {
    const layer = locationLabelLayers[selectedLayer.value]
    const source = layer.getSource()
    if (source) {
      const newFeatures = featuresToAdd.locations.filter(f => !source.hasFeature(f))
      if (newFeatures.length > 0) {
        source.addFeatures(newFeatures)
      }
    }
  }
  
  if (featuresToAdd.trees.length > 0) {
    const clusterLayer = treeClusterLayers[selectedLayer.value]
    const clusterSource = clusterLayer.getSource()
    const treeSource = clusterSource?.getSource()
    if (treeSource) {
      const newFeatures = featuresToAdd.trees.filter(f => !treeSource.hasFeature(f))
      if (newFeatures.length > 0) {
        treeSource.addFeatures(newFeatures)
      }
    }
  }
  
  if (featuresToAdd.regular.length > 0) {
    const layer = markerLayers[selectedLayer.value]
    const source = layer.getSource()
    if (source) {
      const newFeatures = featuresToAdd.regular.filter(f => !source.hasFeature(f))
      if (newFeatures.length > 0) {
        source.addFeatures(newFeatures)
      }
    }
  }
  
  // Update filter categories based on search results
  updateFilterCategoriesBasedOnSearch(categoriesWithResults)
  
  filteredMarkerIds.value = matchingIds
}

const hideAllMarkers = () => {
  // Hide all regular markers
  Object.values(markerLayers).forEach(layer => {
    const source = layer.getSource()
    if (source) {
      source.clear()
    }
  })
  
  // Hide all location labels
  Object.values(locationLabelLayers).forEach(layer => {
    const source = layer.getSource()
    if (source) {
      source.clear()
    }
  })
  
  // Hide all tree clusters
  Object.values(treeClusterLayers).forEach(layer => {
    const clusterSource = layer.getSource()
    const treeSource = clusterSource?.getSource()
    if (treeSource) {
      treeSource.clear()
    }
  })
}

const showAllMarkersBasedOnCategories = () => {
  // Apply filter states to show markers based on category visibility settings
  applyFilterStatesToLayer()
}

// Function to pin a location (used in highlite mode)
const pinLocation = (x: number, y: number) => {
  if (isHighliteMode.value) {
    pinnedMarker.x = x
    pinnedMarker.y = y
    pinnedMarker.isPinned = true
    
    // Find and highlight the pinned feature
    updatePinnedFeatureVisuals(x + 512.5, y + 512.5)
  }
}

// Function to remove pin
const removePin = () => {
  if (isHighliteMode.value) {
    pinnedMarker.isPinned = false
    pinnedMarker.x = 0
    pinnedMarker.y = 0
    
    // Remove visual enhancements
    clearPinnedFeatureVisuals()
  }
}

// Event handlers for the MapSearchFilter component
const handleLayerChanged = (layerId: string) => {
  selectedLayer.value = layerId
  
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
  
  // Center map on the location with smooth animation
  setTimeout(() => {
    map?.getView().animate({
      center: [result.x, result.y],
      zoom: Math.max(map?.getView().getZoom() || 4, 24), // Zoom to at least level 7
      duration: 800 // Smooth 0.8 second animation
    })
  }, 100)
}

const handleMarkerCategoryToggled = (categoryName: string, visible: boolean) => {
  const category = markerCategories.value.find(cat => cat.name === categoryName)
  if (!category) return
  
  category.visible = visible
  
  const currentLayerMarkers = levelMarkers[selectedLayer.value]
  if (currentLayerMarkers[categoryName]) {
    // Firefox optimization: Batch operations
    if (performanceMode === 'low' && !visible) {
      // For hiding categories in Firefox, use batch clear and rebuild
      setTimeout(() => {
        applyFilterStatesToLayer()
      }, 0)
      return
    }
    
    const features = currentLayerMarkers[categoryName]
    const featuresToProcess = features.filter(f => f !== pinnedFeature) // Don't remove pinned features
    
    // Handle locations separately (they use location label layers)
    if (categoryName === 'Locations') {
      const layer = locationLabelLayers[selectedLayer.value]
      const source = layer.getSource()
      if (source) {
        if (visible) {
          // Batch add for all browsers
          const newFeatures = featuresToProcess.filter(f => !source.hasFeature(f))
          if (newFeatures.length > 0) {
            source.addFeatures(newFeatures)
          }
        } else {
          // Batch remove
          featuresToProcess.forEach((feature: Feature) => {
            if (source.hasFeature(feature)) {
              source.removeFeature(feature)
            }
          })
        }
      }
    } else if (categoryName === 'Trees') {
      // Handle trees with clustering
      const clusterLayer = treeClusterLayers[selectedLayer.value]
      const clusterSource = clusterLayer.getSource()
      const treeSource = clusterSource?.getSource()
      if (treeSource) {
        if (visible) {
          // Batch add for all browsers
          const newFeatures = featuresToProcess.filter(f => !treeSource.hasFeature(f))
          if (newFeatures.length > 0) {
            treeSource.addFeatures(newFeatures)
          }
        } else {
          // Batch remove
          featuresToProcess.forEach((feature: Feature) => {
            if (treeSource.hasFeature(feature)) {
              treeSource.removeFeature(feature)
            }
          })
        }
      }
    } else {
      // Handle other markers (they use regular marker layers)
      const layer = markerLayers[selectedLayer.value]
      const source = layer.getSource()
      if (source) {
        if (visible) {
          // Batch add for all browsers
          const newFeatures = featuresToProcess.filter(f => !source.hasFeature(f))
          if (newFeatures.length > 0) {
            source.addFeatures(newFeatures)
          }
        } else {
          // Batch remove
          featuresToProcess.forEach((feature: Feature) => {
            if (source.hasFeature(feature)) {
              source.removeFeature(feature)
            }
          })
        }
      }
    }
  }
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
// Event handlers for the MapSearchFilter component

onMounted(() => {
  // Check for highliteMapPlugin URL parameter
  const searchParams = new URLSearchParams(window.location.search)
  isHighliteMode.value = searchParams.get('highliteMapPlugin') === 'true'
  
  // Set bounds for a 1024x1024 map
  const bounds = [0, 0, 1024, 1024]
  const center = [512, 512]
  // Extended bounds to allow comfortable zoom-out
  const extendedBounds = [-512, -512, 1536, 1536]

  // Map initialization with Firefox optimizations
  map = new Map({
    target: 'map',
    layers: [],
    controls: [], // Remove default OpenLayers controls
    interactions: defaultInteractions(),
    view: new View({
      projection: 'EPSG:3857',
      center: center,
      zoom: 2,
      minZoom: 0, // Allow zooming out more
      maxZoom: performanceMode === 'low' ? 24 : 28, // Reduced max zoom for Firefox
      extent: extendedBounds, // Use extended bounds for more comfortable navigation
      constrainResolution: performanceMode === 'low' ? true : false, // Snap to zoom levels in Firefox for better performance
      multiWorld: false, // Disable multi-world for better performance
      smoothResolutionConstraint: performanceMode === 'high', // Disable smooth zooming in Firefox
      enableRotation: false // Disable rotation for better performance
    }),
  })

  // Enhanced mouse interaction with Firefox-optimized hover detection
  map.on('pointermove', (evt) => {
    const coordinate = evt.coordinate
    mouseCoords.x = Math.round(coordinate[0] - 512.5)
    mouseCoords.y = Math.round(coordinate[1] - 512.5)
    
    // Different hover handling based on performance mode
    if (performanceMode === 'low') {
      // Firefox optimization: Much more throttled hover detection
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
      
      hoverTimeout = window.setTimeout(() => {
        handleHoverOptimized(evt)
      }, 100) // Increased to 100ms for Firefox
    } else {
      // Chrome/other browsers: Normal throttling
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
      
      hoverTimeout = window.setTimeout(() => {
        handleHoverNormal(evt)
      }, 16) // 60fps for other browsers
    }
  })


  // Add feature click handling
  map.on('singleclick', function (evt) {
    const features = map.getFeaturesAtPixel(evt.pixel)
    if (features.length > 0) {
      // Find the first clickable feature (not a location text marker)
      const clickableFeature = features.find(feature => {
        // Skip location text markers - they should not be clickable
        return !feature.get('isLocation')
      })
      
      if (clickableFeature) {
        // Check if this is a cluster feature
        const clusteredFeatures = clickableFeature.get('features')
        if (clusteredFeatures && clusteredFeatures.length > 1) {
          // This is a cluster with multiple features - zoom in to expand it
          const extent = clickableFeature.getGeometry()?.getExtent()
          if (extent) {
            map.getView().fit(extent, {
              duration: 500,
              padding: [50, 50, 50, 50],
              maxZoom: map.getView().getZoom() ? map.getView().getZoom()! + 2 : 6
            })
          }
        } else {
          // Single feature or individual tree - show popup
          let targetFeature = clickableFeature
          if (clusteredFeatures && clusteredFeatures.length === 1) {
            // Single feature in cluster
            targetFeature = clusteredFeatures[0]
          }
          
          const name = targetFeature.get('name')
          if (name) {
            const geometry = targetFeature.get('geometry')
            if (geometry && geometry.getType() === 'Point') {
              const coordinates = (geometry as Point).getCoordinates()
              showPopup(name, coordinates as [number, number])
              
              // Center the map on the clicked marker
              map.getView().animate({
                center: coordinates,
                duration: 500,
                zoom: Math.max(map.getView().getZoom() || 4, 5)
              })
            }
          }
        }
      }
    } else {
      // Click on empty area - hide popup
      hidePopup()
    }
  })

  // Layer groups for each level
  overworldLayers = new Group({
    layers: [
      new ImageLayer({
        source: new ImageStatic({
          url: '/mapImages/earthoverworldtexture.png',
          projection: 'EPSG:3857',
          imageExtent: bounds,
        }),
      }),
      new ImageLayer({
        source: new ImageStatic({
          url: '/mapImages/earthoverworldmap.png',
          projection: 'EPSG:3857',
          imageExtent: bounds,
        }),
      }),
    ],
  })
  underworldLayers = new Group({
    layers: [
      new ImageLayer({
        source: new ImageStatic({
          url: '/mapImages/earthundergroundtexture.png',
          projection: 'EPSG:3857',
          imageExtent: bounds,
        }),
      }),
      new ImageLayer({
        source: new ImageStatic({
          url: '/mapImages/earthundergroundmap.png',
          projection: 'EPSG:3857',
          imageExtent: bounds,
        }),
      }),
    ],
  })
  skyLayers = new Group({
    layers: [
      new ImageLayer({
        source: new ImageStatic({
          url: '/mapImages/earthskytexture.png',
          projection: 'EPSG:3857',
          imageExtent: bounds,
        }),
      }),
      new ImageLayer({
        source: new ImageStatic({
          url: '/mapImages/earthskymap.png',
          projection: 'EPSG:3857',
          imageExtent: bounds,
        }),
      }),
    ],
  })
  function addItem(feature: Feature, level: string, group: string) {
    if (!levelMarkers[level][group]) levelMarkers[level][group] = []
    levelMarkers[level][group].push(feature)
    
    // Don't automatically add to layer - let filter states control visibility
  }

  function addLocationItem(feature: Feature, level: string, group: string) {
    if (!levelMarkers[level][group]) levelMarkers[level][group] = []
    levelMarkers[level][group].push(feature)
    
    // Don't automatically add to layer - let filter states control visibility
  }

  // Enhanced marker creation with Firefox-specific optimizations
  function createMarkerFeature(position: [number, number], icon: string, name: string, category?: string): Feature {
    const feature = new Feature({
      geometry: new Point(position),
      name: name,
      icon: icon,
      category: category || 'unknown'
    })
    
    // Define category-based styling for better contrast and UX
    const categoryStyles = {
      'Banks': { color: '#ffd700', strokeColor: '#b8860b', fontSize: '1rem', priority: 'high' },
      'Shops': { color: '#00ff7f', strokeColor: '#008b4b', fontSize: '1rem', priority: 'high' },
      'NPCs': { color: '#87ceeb', strokeColor: '#4682b4', fontSize: '1rem', priority: 'medium' },
      'Attackable NPCs': { color: '#ff6347', strokeColor: '#cd4a38', fontSize: '1rem', priority: 'high' },
      'Aggro NPCs': { color: '#ff1493', strokeColor: '#8b0040', fontSize: '1rem', priority: 'high' },
      'Trees': { color: '#90ee90', strokeColor: '#228b22', fontSize: '1rem', priority: 'low' },
      'Obelisks': { color: '#dda0dd', strokeColor: '#9370db', fontSize: '1rem', priority: 'medium' },
      'Ores': { color: '#d2691e', strokeColor: '#8b4513', fontSize: '1rem', priority: 'low' },
      'Fires': { color: '#ff4500', strokeColor: '#cc3700', fontSize: '1rem', priority: 'low' },
      'Anvils': { color: '#e6e6fa', strokeColor: '#2f4f4f', fontSize: '1rem', priority: 'medium' },
      'Furnaces': { color: '#ff8c00', strokeColor: '#cc7000', fontSize: '1rem', priority: 'medium' },
      'Kilns': { color: '#cd853f', strokeColor: '#8b5a2b', fontSize: '1rem', priority: 'low' },
      'Stoves': { color: '#ffa500', strokeColor: '#cc8400', fontSize: '1rem', priority: 'low' },
      'Fishing Spots': { color: '#00bfff', strokeColor: '#0080cc', fontSize: '1rem', priority: 'low' },
      'Harvestables': { color: '#adff2f', strokeColor: '#7acc00', fontSize: '1rem', priority: 'low' },
      'Locations': { color: '#ffffff', strokeColor: '#1a1a1a', fontSize: '1rem', priority: 'highest' }
    }
    
    const style = categoryStyles[category as keyof typeof categoryStyles] || 
                  { color: '#ffffff', strokeColor: '#000000', fontSize: '1rem', priority: 'low' }
    
    const strokeWidth = style.priority === 'highest' ? 3 : 
                       style.priority === 'high' ? 2.5 : 
                       style.priority === 'medium' ? 2 : 1.5
    
    // Create default style with category-specific colors
    const defaultStyle = new Style({
      text: new Text({
        text: icon,
        font: `bold ${style.fontSize} "Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`,
        fill: new Fill({ color: style.color }),
        stroke: new Stroke({ 
          color: style.strokeColor, 
          width: strokeWidth 
        }),
        textAlign: 'center',
        textBaseline: 'middle'
      })
    })
    
    // Firefox optimization: Create simpler hover styles to reduce rendering overhead
    let hoverStyle: Style
    if (performanceMode === 'low') {
      // Simplified hover style for Firefox - just change color, no size change
      hoverStyle = new Style({
        text: new Text({
          text: icon,
          font: `bold ${style.fontSize} "Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ 
            color: style.color, 
            width: strokeWidth + 0.5 // Minimal stroke increase
          }),
          textAlign: 'center',
          textBaseline: 'middle'
        })
      })
    } else {
      // Full hover style for other browsers
      hoverStyle = new Style({
        text: new Text({
          text: icon,
          font: `bold 1.2rem "Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ 
            color: style.color, 
            width: strokeWidth + 1.5 
          }),
          textAlign: 'center',
          textBaseline: 'middle'
        })
      })
    }
    
    // Create selection/active style for better feedback (slightly larger)
    const activeStyle = new Style({
      text: new Text({
        text: icon,
        font: `bold 1.1rem "Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`,
        fill: new Fill({ color: '#ffeb3b' }),
        stroke: new Stroke({ 
          color: '#1a1a1a', 
          width: strokeWidth + 1 
        }),
        textAlign: 'center',
        textBaseline: 'middle'
      })
    })
    
    // Set simple styles (no shadows)
    feature.setStyle(defaultStyle)
    feature.set('defaultStyle', defaultStyle)
    feature.set('hoverStyle', hoverStyle)
    feature.set('activeStyle', activeStyle)
    feature.set('categoryStyle', style)
    feature.set('isImportant', style.priority === 'high' || style.priority === 'highest')
    
    return feature
  }

  // Enhanced location label creation with better styling
  function createLocationLabelFeature(position: [number, number], name: string): Feature {
    const feature = new Feature({
      geometry: new Point(position),
      name: name,
      icon: '', // No icon for labels
      isLocation: true // Flag to identify location features
    })
    
    // Enhanced default style with better typography and size
    const defaultStyle = new Style({
      text: new Text({
        text: name,
        font: 'bold 14px "Inter", "Segoe UI", sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#1a1a1a', width: 3 }),
        textAlign: 'center',
        textBaseline: 'middle',
        maxAngle: 0,
        overflow: true,
        placement: 'point'
      })
    })
    
    // Enhanced hover style
    const hoverStyle = new Style({
      text: new Text({
        text: name,
        font: 'bold 16px "Inter", "Segoe UI", sans-serif',
        fill: new Fill({ color: '#ffeb3b' }), // Bright yellow on hover
        stroke: new Stroke({ color: '#1a1a1a', width: 4 }),
        textAlign: 'center',
        textBaseline: 'middle',
        maxAngle: 0,
        overflow: true,
        placement: 'point'
      })
    })
    
    // Active/selected style
    const activeStyle = new Style({
      text: new Text({
        text: name,
        font: 'bold 15px "Inter", "Segoe UI", sans-serif',
        fill: new Fill({ color: '#f59e0b' }), // Orange when active
        stroke: new Stroke({ color: '#1a1a1a', width: 3.5 }),
        textAlign: 'center',
        textBaseline: 'middle',
        maxAngle: 0,
        overflow: true,
        placement: 'point'
      })
    })
    
    // Set simple styles (no shadows)
    feature.setStyle(defaultStyle)
    feature.set('defaultStyle', defaultStyle)
    feature.set('hoverStyle', hoverStyle)
    feature.set('activeStyle', activeStyle)
    
    return feature
  }

  // Track the current base layer
  let currentBaseLayer: Group | null = null

  function setBaseLayer(newLayer: Group) {
    if (currentBaseLayer && map.getLayers().getArray().includes(currentBaseLayer)) {
      map.removeLayer(currentBaseLayer)
    }
    if (!map.getLayers().getArray().includes(newLayer)) {
      map.addLayer(newLayer)
    }
    currentBaseLayer = newLayer
    
    // Remove all marker layers
    Object.values(markerLayers).forEach(layer => {
      if (map.getLayers().getArray().includes(layer)) {
        map.removeLayer(layer)
      }
    })
    
    // Remove all location label layers
    Object.values(locationLabelLayers).forEach(layer => {
      if (map.getLayers().getArray().includes(layer)) {
        map.removeLayer(layer)
      }
    })
    
    // Remove all tree cluster layers
    Object.values(treeClusterLayers).forEach(layer => {
      if (map.getLayers().getArray().includes(layer)) {
        map.removeLayer(layer)
      }
    })
    
    // Add the appropriate marker layer for the selected level
    const layerName =
      newLayer === overworldLayers ? 'Overworld' :
      newLayer === underworldLayers ? 'Underworld' :
      'Sky'
    
    // Set background color based on layer
    const mapElement = document.getElementById('map')
    if (mapElement) {
      if (layerName === 'Overworld') {
        mapElement.style.backgroundColor = '#3b85b9'
      } else {
        mapElement.style.backgroundColor = 'black'
      }
    }
    
    const markerLayer = markerLayers[layerName]
    if (markerLayer && !map.getLayers().getArray().includes(markerLayer)) {
      map.addLayer(markerLayer)
    }
    
    // Add the appropriate tree cluster layer
    const treeClusterLayer = treeClusterLayers[layerName]
    if (treeClusterLayer && !map.getLayers().getArray().includes(treeClusterLayer)) {
      // Set cluster style
      treeClusterLayer.setStyle(createClusterStyle)
      map.addLayer(treeClusterLayer)
    }
    
    // Add the appropriate location label layer (always on top)
    const locationLayer = locationLabelLayers[layerName]
    if (locationLayer && !map.getLayers().getArray().includes(locationLayer)) {
      map.addLayer(locationLayer)
    }
    
    // Update marker counts
    updateMarkerCounts()
    
    // Apply current filter states to the new layer (this ensures only visible categories show markers)
    applyFilterStatesToLayer()
    
    // Reapply pinned feature styling if there's a pinned item
    reapplyPinnedFeatureStyle()
  }

  // Add base layer
  setBaseLayer(overworldLayers)
  map.getView().fit(bounds)

  // Add location markers as features
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
  function addEntityToLayer(feature: Feature, entityLevel: number, category: string) {
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
  function addNPCToLayer(feature: Feature, mapLevel: number, category: string) {
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

  // Animate marker movement (for player position)
  function animateMarker(marker: Overlay, toCoords: [number, number], duration = 1000) {
    const from = marker.getPosition()
    // Convert coordinates to map coordinates (same as other markers)
    const to = [toCoords[0], toCoords[1]]
    const startTime = performance.now()
    function animate(time: number) {
      const elapsed = time - startTime
      const t = Math.min(elapsed / duration, 1)
      const newPos = [
        (from![0] as number) + ((to[0] as number) - (from![0] as number)) * t,
        (from![1] as number) + ((to[1] as number) - (from![1] as number)) * t,
      ]
      marker.setPosition(newPos)
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }

  // Create player position marker (reusable function)
  function createPlayerMarker(x: number, y: number): Overlay {
    // Convert coordinates to map coordinates
    const mapX = x
    const mapY = y
    
    // Create player position marker element with spinning animation
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
    
    // Add CSS keyframes for spinning animation if not already present
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
    
    // Create and return overlay
    return new Overlay({
      position: [mapX, mapY],
      element: markerElement,
      positioning: 'center-center'
    })
  }

  // Handle URL params for initial view/marker
  const urlParams = new URLSearchParams(window.location.search)
  const level = urlParams.get('lvl')
  const posX = urlParams.get('pos_x')
  const posY = urlParams.get('pos_y')
  const hideDecor = urlParams.get('hide_decor')
  let playPositionMarker: Overlay | null = null
  
  if (posX && posY) {
    // Create player marker using the reusable function
    playPositionMarker = createPlayerMarker(+posX, +posY)
    
    // Set map center to the player position with higher zoom and smooth animation
    map.getView().animate({
      center: [+posX, +posY],
      zoom: 20, // Increased zoom level for better visibility
      duration: 1500 // Smooth zoom animation
    })
    
    // Add overlay to map
    map.addOverlay(playPositionMarker)
    
    // Set layer if specified in URL
    if (level && ['Overworld', 'Underworld', 'Sky'].includes(level)) {
      selectedLayer.value = level
    }
  }

  // Watch for layer changes
  watch(selectedLayer, (newVal) => {
    setBaseLayer(
      newVal === 'Overworld' ? overworldLayers :
      newVal === 'Underworld' ? underworldLayers :
      skyLayers
    )
    
    // If layer switch was initiated by search result selection, re-apply search filter
    if (isLayerSwitchFromSearch.value && activeSearchQuery.value) {
      setTimeout(() => {
        filterMarkersBasedOnSearch(activeSearchQuery.value)
        isLayerSwitchFromSearch.value = false // Reset the flag
      }, 100) // Short delay to ensure layer switch is complete
    }
  })

  // Set initial layer based on URL param
  if (level) {
    switch (level) {
      case 'Overworld':
        setBaseLayer(overworldLayers)
        break
      case 'Underworld':
        setBaseLayer(underworldLayers)
        break
      case 'Sky':
        setBaseLayer(skyLayers)
        break
    }
  } else {
    setBaseLayer(overworldLayers)
  }

  // Handle real-time player movement messages
  window.addEventListener('message', (event: any) => {
    if (event.data.X && event.data.Y && event.data.lvl) {
      // Switch to the appropriate layer
      const layerName = event.data.lvl
      if (['Overworld', 'Underworld', 'Sky'].includes(layerName)) {
        selectedLayer.value = layerName
        switch (layerName) {
          case 'Overworld':
            setBaseLayer(overworldLayers)
            break
          case 'Underworld':
            setBaseLayer(underworldLayers)
            break
          case 'Sky':
            setBaseLayer(skyLayers)
            break
        }
      }
      
      // Handle player marker
      if (playPositionMarker) {
        // Animate existing marker to new position
        animateMarker(playPositionMarker, [event.data.X, event.data.Y])
      } else {
        // Create new player marker if it doesn't exist and zoom in
        playPositionMarker = createPlayerMarker(event.data.X, event.data.Y)
        map.addOverlay(playPositionMarker)
        
        // Zoom into the player's position when marker is first created
        map.getView().animate({
          center: [event.data.X + 512.5, event.data.Y + 512.5],
          zoom: 8, // Zoom in for better visibility
          duration: 1500 // Smooth zoom animation
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
    // Set map height to full viewport
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
  }, 500)
})

// Cleanup on component unmount
onUnmounted(() => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
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

const updateFilterCategoriesBasedOnSearch = (categoriesWithResults: Set<string>) => {
  // During search, update filter categories to show only those with results
  markerCategories.value.forEach(category => {
    category.visible = categoriesWithResults.has(category.name)
  })
}

// Firefox-optimized hover handler - minimal feature detection and style changes
const handleHoverOptimized = (evt: any) => {
  const features = map.getFeaturesAtPixel(evt.pixel)
  
  // Reset only the last hovered feature to avoid iterating through all features
  if (lastHoverFeature && lastHoverFeature !== pinnedFeature) {
    const defaultStyle = lastHoverFeature.get('defaultStyle')
    if (defaultStyle) {
      lastHoverFeature.setStyle(defaultStyle)
    }
  }
  
  if (features.length > 0) {
    // Only process the first feature to minimize performance impact
    const firstFeature = features[0]
    if ('setStyle' in firstFeature && 'get' in firstFeature && firstFeature !== pinnedFeature) {
      const feature = firstFeature as Feature
      
      // Check if this is a cluster
      const clusteredFeatures = feature.get('features')
      if (clusteredFeatures) {
        // This is a cluster - don't change style, just show cursor
        map.getViewport().style.cursor = 'pointer'
        if (clusteredFeatures.length > 1) {
          map.getViewport().title = `${clusteredFeatures.length} trees`
        } else {
          map.getViewport().title = clusteredFeatures[0].get('name') || ''
        }
        return
      }
      
      // Regular feature hover handling
      const hoverStyle = feature.get('hoverStyle')
      if (hoverStyle) {
        feature.setStyle(hoverStyle)
        lastHoverFeature = feature
      }
    }
    
    map.getViewport().style.cursor = 'pointer'
    
    // Simplified tooltip - only show first feature name
    if ('get' in firstFeature) {
      map.getViewport().title = (firstFeature as Feature).get('name') || ''
    }
  } else {
    map.getViewport().style.cursor = 'default'
    map.getViewport().title = ''
    lastHoverFeature = null
  }
}

// Normal hover handler for Chrome and other browsers
const handleHoverNormal = (evt: any) => {
  const features = map.getFeaturesAtPixel(evt.pixel)
  
  // Reset all features to default style first (except pinned feature)
  Object.values(locationLabelLayers).forEach(layer => {
    layer.getSource()?.getFeatures().forEach(feature => {
      if (feature.get('isLocation') && feature !== pinnedFeature) {
        const defaultStyle = feature.get('defaultStyle')
        if (defaultStyle) {
          feature.setStyle(defaultStyle)
        }
      }
    })
  })
  
  Object.values(markerLayers).forEach(layer => {
    layer.getSource()?.getFeatures().forEach(feature => {
      if (!feature.get('isLocation') && feature !== pinnedFeature) {
        const defaultStyle = feature.get('defaultStyle')
        if (defaultStyle) {
          feature.setStyle(defaultStyle)
        }
      }
    })
  })
  
  // Apply hover effects to features under cursor
  if (features.length > 0) {
    const hoveredFeatures = features.slice(0, 3) // Limit to top 3 features to avoid performance issues
    
    hoveredFeatures.forEach(featureLike => {
      // Check if it's an actual Feature (not RenderFeature) and not the pinned feature
      if ('setStyle' in featureLike && 'get' in featureLike && featureLike !== pinnedFeature) {
        const feature = featureLike as Feature
        
        // Check if this is a cluster
        const clusteredFeatures = feature.get('features')
        if (clusteredFeatures) {
          // This is a cluster - show appropriate tooltip
          if (clusteredFeatures.length > 1) {
            map.getViewport().title = `${clusteredFeatures.length} trees (click to expand)`
          } else {
            map.getViewport().title = clusteredFeatures[0].get('name') || ''
          }
          return
        }
        
        // Regular feature hover handling
        const hoverStyle = feature.get('hoverStyle')
        if (hoverStyle) {
          feature.setStyle(hoverStyle)
        }
      }
    })
    
    map.getViewport().style.cursor = 'pointer'
    
    // Show tooltip for multiple features if clustered
    if (features.length > 1) {
      const featureNames = features.slice(0, 5)
        .filter(f => 'get' in f)
        .map(f => {
          const feature = f as Feature
          const clusteredFeatures = feature.get('features')
          if (clusteredFeatures && clusteredFeatures.length > 1) {
            return `${clusteredFeatures.length} trees`
          }
          return feature.get('name')
        })
        .filter(name => name)
      if (featureNames.length > 1) {
        map.getViewport().title = `Multiple items: ${featureNames.join(', ')}`
      }
    } else if ('get' in features[0]) {
      const feature = features[0] as Feature
      const clusteredFeatures = feature.get('features')
      if (clusteredFeatures && clusteredFeatures.length > 1) {
        map.getViewport().title = `${clusteredFeatures.length} trees (click to expand)`
      } else {
        map.getViewport().title = feature.get('name') || ''
      }
    }
  } else {
    map.getViewport().style.cursor = 'default'
    map.getViewport().title = ''
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
</style>
