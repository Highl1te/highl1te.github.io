<script setup lang="ts">
import { onMounted, render } from 'vue'
import locations from '@/assets/markerInformation/Locations.json'
import entities from '@/assets/markerInformation/worldEntities.json'
import npcs from '@/assets/markerInformation/NPCs.json'
import npcDefinitions from '@/assets/markerInformation/NPCDefs.json'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster/dist/leaflet.markercluster.js'

L.Control.Layers.include({
  getOverlays: function () {
    // create hash to hold all layers
    let control, layers
    layers = {}
    control = this

    // loop thru all layers in control
    control._layers.forEach(function (obj) {
      let layerName

      // check if layer is an overlay
      if (obj.overlay) {
        // get name of overlay
        layerName = obj.name
        // store whether it's present on the map or not
        return (layers[layerName] = control._map.hasLayer(obj.layer))
      }
    })

    return layers
  },
})

function layerAdd(layer, levelMarkers, layerControls, performSearch) {
  // Get currently active layers
  const activatedLayers = layerControls.getOverlays()

  // Update the overlay layers based on the available level markers
  for (const key in levelMarkers) {
    if (key == layer.name) {
      for (const subKey in levelMarkers[key]) {
        if (levelMarkers[key][subKey]) {
          layerControls.addOverlay(levelMarkers[key][subKey], subKey)
          if (activatedLayers != {}) {
            if (activatedLayers[subKey]) {
              levelMarkers[key][subKey].addTo(layerControls._map)
            }
          }
        }
      }
    } else {
      for (const subKey in levelMarkers[key]) {
        levelMarkers[key][subKey].remove()
        layerControls.removeLayer(levelMarkers[key][subKey])
      }
    }
  }

  if (layer.name == 'Overworld') {
    document.getElementById('map').style.backgroundColor = '#3b85b9'
  } else {
    document.getElementById('map').style.backgroundColor = '#000000'
  }
}

onMounted(() => {
  const bounds = [
    [0, 0],
    [1024, 1024],
  ]

  let searchMarkers: L.Marker[] = []

  const levelMarkers = {
    Overworld: {},
    Underworld: {},
    Sky: {},
  }

  const treeMarkersSearch = {
    Overworld: {},
    Underworld: {},
    Sky: {},
  }

  // Initialize the map
  const map: L.Map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 20,
    maxBoundsViscosity: 0.5,
    preferCanvas: true,
    renderer: L.canvas(),
  }).fitBounds(bounds)

  const overworldLayers = L.layerGroup()
  const underworldLayers = L.layerGroup()
  const skyLayers = L.layerGroup()
  L.imageOverlay('./mapImages/earthoverworldtexture.png', bounds).addTo(overworldLayers)
  L.imageOverlay('./mapImages/earthoverworldmap.png', bounds).addTo(overworldLayers)

  L.imageOverlay('./mapImages/earthskytexture.png', bounds).addTo(skyLayers)
  L.imageOverlay('./mapImages/earthskymap.png', bounds).addTo(skyLayers)

  L.imageOverlay('./mapImages/earthundergroundtexture.png', bounds).addTo(underworldLayers)
  L.imageOverlay('./mapImages/earthundergroundmap.png', bounds).addTo(underworldLayers)

  const baseMaps = {
    Sky: skyLayers,
    Overworld: overworldLayers,
    Underworld: underworldLayers,
  }

  function addItem(marker: L.Marker, level: string, group: string) {
    if (!levelMarkers[level][group]) {
      levelMarkers[level][group] = L.layerGroup()
    }

    marker.addTo(levelMarkers[level][group])
  }

  function addTree(marker: L.Marker, level: string, group: string) {
    if (!treeMarkersSearch[level][group]) {
      treeMarkersSearch[level][group] = L.layerGroup()
    }

    marker.addTo(treeMarkersSearch[level][group])
  }

  overworldLayers.addTo(map)

  locations.locations.forEach((location) => {
    // Text Marker
    const marker = new L.Marker([location.y + 512.5, location.x + 512.5], {
      icon: L.divIcon({
        className: 'text-label',
        html: `<div style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;color:white;white-space:nowrap;position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);">${location.name}</div>`,
      }),
      title: location.name,
    })
    switch (location.labelType) {
      case 0:
        addItem(marker, 'Underworld', 'Locations')
        break
      case 1:
        addItem(marker, 'Overworld', 'Locations')
        break
      case 2:
        addItem(marker, 'Sky', 'Locations')
        break
    }
  })
  const treeClusters = {}
  entities.worldEntities.forEach((entity) => {
    if (
      (entity.type.includes('tree') || entity.type.includes('cherryblossom')) &&
      entity.type != 'treestump'
    ) {
      let name = entity.type.replace('tree', ' Tree')
      name = name.replace('blossom', ' Blossom')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        title: nameWithSpacesCapitalized,
        // Use Leaflet Default Icon
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker">🌳</div>`,
        }),
      })
      if (!treeClusters[entity.lvl]) {
        treeClusters[entity.lvl] = {}
      }

      if (!treeClusters[entity.lvl][entity.type]) {
        treeClusters[entity.lvl][entity.type] = L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          disableClusteringAtZoom: 2,
        })
      }

      // Add the marker to the cluster group
      treeClusters[entity.lvl][entity.type].addLayer(marker)

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addTree(marker, 'Overworld', 'Trees')
          break
        case 0:
          addTree(marker, 'Underworld', 'Trees')
          break
        case 2:
          addTree(marker, 'Sky', 'Trees')
          break
      }
    }

    if (entity.type.includes('obelisk')) {
      const name = entity.type.replace('obelisk', ' Obelisk')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Obelisk is Unicode: 🗿
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;">🗿</div>`,
        }),

        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"

      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Obelisks')
          break
        case 0:
          addItem(marker, 'Underworld', 'Obelisks')
          break
        case 2:
          addItem(marker, 'Sky', 'Obelisks')
          break
      }
    }

    if (entity.type.includes('rocks')) {
      const name = entity.type.replace('rocks', ' Rock')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Rocks is Unicode: 🪨
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🪨</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"

      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Ores')
          break
        case 0:
          addItem(marker, 'Underworld', 'Ores')
          break
        case 2:
          addItem(marker, 'Sky', 'Ores')
          break
      }
    }

    if (entity.type.includes('bank')) {
      const name = entity.type.replace('bank', ' Bank')
      const nameWithSpaces = name.replace('chest', ' Chest')
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Bank is Unicode: 💰
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">💰</div>`,
        }),
        title: nameWithSpaces,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"

      marker.bindPopup(nameWithSpaces)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Banks')
          break
        case 0:
          addItem(marker, 'Underworld', 'Banks')
          break
        case 2:
          addItem(marker, 'Sky', 'Banks')
          break
      }
    }

    if (entity.type.includes('fire')) {
      const name = entity.type.replace('fire', ' Fire')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Fire is Unicode: 🔥
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🔥</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Fires')
          break
        case 0:
          addItem(marker, 'Underworld', 'Fires')
          break
        case 2:
          addItem(marker, 'Sky', 'Fires')
          break
      }
    }

    if (entity.type.includes('smithingsource')) {
      const name = 'Anvil'

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Anvil is Unicode: 🔨
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🔨</div>`,
        }),
        title: name,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Anvils')
          break
        case 0:
          addItem(marker, 'Underworld', 'Anvils')
          break
        case 2:
          addItem(marker, 'Sky', 'Anvils')
          break
      }
    }

    if (entity.type.includes('smeltingsource')) {
      const name = 'Furnace'
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Smelting is Unicode: 🏭
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🏭</div>`,
        }),
        title: name,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Furnaces')
          break
        case 0:
          addItem(marker, 'Underworld', 'Furnaces')
          break
        case 2:
          addItem(marker, 'Sky', 'Furnaces')
          break
      }
    }

    if (entity.type.includes('kiln')) {
      const name = 'Kiln'
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Kiln is Unicode: ⚱️
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">⚱️</div>`,
        }),
        title: name,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Kilns')
          break
        case 0:
          addItem(marker, 'Underworld', 'Kilns')
          break
        case 2:
          addItem(marker, 'Sky', 'Kilns')
          break
      }
    }

    if (entity.type.includes('heatsource')) {
      const name = 'Stove'

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Heat Source is Unicode: 🍳
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🍳</div>`,
        }),
        title: name,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Stoves')
          break
        case 0:
          addItem(marker, 'Underworld', 'Stoves')
          break
        case 2:
          addItem(marker, 'Sky', 'Stoves')
          break
      }
    }

    if (entity.type.includes('fishing')) {
      const name = entity.type.replace('fishing', ' Fishing')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Fishing is Unicode: 🎣
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1.5rem;;color:white;text-shadow: 0px 0px 8px black;">🎣</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Fishing Spots')
          break
        case 0:
          addItem(marker, 'Underworld', 'Fishing Spots')
          break
        case 2:
          addItem(marker, 'Sky', 'Fishing Spots')
          break
      }
    }

    if (entity.type.includes('pumpkin')) {
      const name = entity.type.replace('pumpkin', ' Pumpkin')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Pumpkin is Unicode: 🎃
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🎃</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('corn')) {
      const name = entity.type.replace('corn', ' Corn')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Corn is Unicode: 🌽
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🌽</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('potatoes')) {
      const name = entity.type.replace('potatoes', ' Potatoes')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Potatoes is Unicode: 🥔
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🥔</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('onion')) {
      const name = entity.type.replace('onion', ' Onion')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Onion is Unicode: 🧅
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🧅</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('flax')) {
      const name = entity.type.replace('flax', ' Flax')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Flax is Unicode: 🌾
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🌾</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"

      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('carrot')) {
      const name = entity.type.replace('carrot', ' Carrot')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Carrot is Unicode: 🥕
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🥕</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('redmushroom')) {
      const name = entity.type.replace('redmushroom', 'Red Mushroom')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Red Mushroom is Unicode: 🍄
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🍄</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('plant') && entity.type != 'plant') {
      const name = entity.type.replace('plant', ' Plant')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Plant is Unicode: 🌱
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🌱</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('strawberries')) {
      const name = entity.type.replace('strawberries', 'Strawberries')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)
      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Strawberries is Unicode: 🍓
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🍓</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }

    if (entity.type.includes('watermelon')) {
      const name = entity.type.replace('watermelon', 'Watermelon')
      const nameWithSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
      const nameWithSpacesCapitalized =
        nameWithSpaces.charAt(0).toUpperCase() + nameWithSpaces.slice(1)

      const marker = L.marker([entity.z + 512.5, entity.x + 512.5], {
        // Icon for Watermelon is Unicode: 🍉
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🍉</div>`,
        }),
        title: nameWithSpacesCapitalized,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(nameWithSpacesCapitalized)
      switch (entity.lvl) {
        case 1:
          addItem(marker, 'Overworld', 'Harvestables')
          break
        case 0:
          addItem(marker, 'Underworld', 'Harvestables')
          break
        case 2:
          addItem(marker, 'Sky', 'Harvestables')
          break
      }
    }
  })

  // Add the tree clusters to the map
  for (let i = 0; i < 3; i++) {
    switch (i) {
      case 0:
        for (const type in treeClusters[0]) {
          addItem(treeClusters[0][type], 'Underworld', 'Trees')
        }
        break
      case 1:
        for (const type in treeClusters[1]) {
          addItem(treeClusters[1][type], 'Overworld', 'Trees')
        }
        break
      case 2:
        for (const type in treeClusters[2]) {
          addItem(treeClusters[2][type], 'Sky', 'Trees')
        }
        break
    }
  }

  npcs.npcs.forEach((npc) => {
    // Find the item in the npcDefinitions.npcDefs JSON array where npc._id == npcDef._id
    const npcDef = npcDefinitions.npcDefs.find((npcDef) => npc.npcdef_id === npcDef._id)

    // Check if NPC has a value for "shopdef_id"
    if (npc.shopdef_id) {
      // Capitalize characters after spaces
      const name = npcDef.name.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
      const marker = L.marker([npc.y + 512.5, npc.x + 512.5], {
        // Icon for NPC is Unicode: 🏪
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">🏪</div>`,
        }),
        title: name,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (npc.mapLevel) {
        case 1:
          addItem(marker, 'Overworld', 'Shops')
          break
        case 0:
          addItem(marker, 'Underworld', 'Shops')
          break
        case 2:
          addItem(marker, 'Sky', 'Shops')
          break
      }
      return
    }

    if (npc.isAlwaysAggroOverride) {
      // Capitalize characters after spaces
      const name =
        npcDef.name.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase()) +
        ' (Lvl. ' +
        npcDef.combat.level +
        ')'
      const marker = L.marker([npc.y + 512.5, npc.x + 512.5], {
        // Icon for Aggro NPC is Devil: 😈
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">😈</div>`,
        }),
        title: name,
      })

      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (npc.mapLevel) {
        case 1:
          addItem(marker, 'Overworld', 'Aggro NPCs')
          break
        case 0:
          addItem(marker, 'Underworld', 'Aggro NPCs')
          break
        case 2:
          addItem(marker, 'Sky', 'Aggro NPCs')
          break
      }
      return
    }

    // Check if npcDef has a definition for "combat"
    if (!npcDef) {
      // Add Regular NPC
      // Capitalize characters after spaces
      const name = npcDef.name.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
      const marker = L.marker([npc.y + 512.5, npc.x + 512.5], {
        // Icon for NPC is Unicode: 👤
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">👤</div>`,
        }),
        title: name,
      })
      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (npc.mapLevel) {
        case 1:
          addItem(marker, 'Overworld', 'NPCs')
          break
        case 0:
          addItem(marker, 'Underworld', 'NPCs')
          break
        case 2:
          addItem(marker, 'Sky', 'NPCs')
          break
      }
      return
    }
    // Check if npcDef has a value for "combat"
    if (!npcDef.combat) {
      // Add Regular NPC
      // Capitalize characters after spaces
      const name = npcDef.name.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
      const marker = L.marker([npc.y + 512.5, npc.x + 512.5], {
        // Icon for NPC is Unicode: 👤
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">👤</div>`,
        }),
        title: name,
      })
      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (npc.mapLevel) {
        case 1:
          addItem(marker, 'Overworld', 'NPCs')
          break
        case 0:
          addItem(marker, 'Underworld', 'NPCs')
          break
        case 2:
          addItem(marker, 'Sky', 'NPCs')
          break
      }
      return
    }
    if (npcDef.combat) {
      // Add Attackable NPC
      // Capitalize characters after spaces
      const name =
        npcDef.name.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase()) +
        ' (Lvl. ' +
        npcDef.combat.level +
        ')'
      const marker = L.marker([npc.y + 512.5, npc.x + 512.5], {
        // Icon for NPC is Unicode: ⚔️
        icon: L.divIcon({
          className: 'text-label',
          iconSize: [20, 24],
          iconAnchor: [10, 24],
          popupAnchor: [0, -20],
          html: `<div class="marker" style="font-size:1rem;color:white;text-shadow: 0px 0px 8px black;;">⚔️</div>`,
        }),
        title: name,
      })
      // Bind Type to Marker Tooltip
      // Example type: polartree
      // Example Popup: "Polar Tree"
      marker.bindPopup(name)
      switch (npc.mapLevel) {
        case 1:
          addItem(marker, 'Overworld', 'Attackable NPCs')
          break
        case 0:
          addItem(marker, 'Underworld', 'Attackable NPCs')
          break
        case 2:
          addItem(marker, 'Sky', 'Attackable NPCs')
          break
      }
      return
    }
  })

  const layerControls = L.control.layers(baseMaps, {}, { collapsed: true }).addTo(map)

  // Add Search Functionality via DOM
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.placeholder = 'Search...'
  searchInput.style.position = 'absolute'
  searchInput.style.top = '10px'
  searchInput.style.left = '50%'
  searchInput.style.transform = 'translateX(-50%)'
  searchInput.style.zIndex = '1000'
  searchInput.style.padding = '5px'
  searchInput.style.backgroundColor = '#0d0d0d'
  searchInput.style.border = '1px solid black'
  searchInput.style.borderRadius = '5px'
  searchInput.style.width = '60%'
  searchInput.style.maxWidth = '350px'
  searchInput.style.boxShadow = '0px 0px 5px black'
  searchInput.style.fontSize = '1rem'
  searchInput.style.color = 'white'
  searchInput.style.textAlign = 'center'
  searchInput.style.fontFamily = 'Arial, sans-serif'
  searchInput.style.fontWeight = 'bold'
  searchInput.style.transition = 'all 0.3s ease'
  searchInput.style.outline = 'none'
  searchInput.style.cursor = 'pointer'
  searchInput.style.opacity = '1'
  searchInput.style.transition = 'opacity 0.3s ease'
  document.getElementById('map').appendChild(searchInput)

  searchInput.addEventListener('input', (e) => {
    clearTimeout(performSearchFilter.timeout)

    // Wait for user to stop typing for 500ms before performing search
    performSearchFilter.timeout = setTimeout(() => {
      performSearchFilter(e.target.value.toLowerCase())
    }, 500)
  })

  async function performSearchFilter(searchTerm) {
    for (const marker in searchMarkers) {
      map.removeLayer(searchMarkers[marker])
    }
    searchMarkers = []

    if (!searchTerm || searchTerm.trim() === '') {
      return
    }

    // Get current layer
    const mapLayer = map.hasLayer(overworldLayers)
      ? 'Overworld'
      : map.hasLayer(underworldLayers)
        ? 'Underworld'
        : 'Sky'

    for (const key in levelMarkers) {
      if (key == mapLayer) {
        for (const subKey in levelMarkers[key]) {
          // Check if the levelMarkers[key][subKey] is a layer group
          if (levelMarkers[key][subKey] instanceof L.LayerGroup) {
            levelMarkers[key][subKey].remove()
            levelMarkers[key][subKey].eachLayer((layer) => {
              // Remove the layer from the map
              if (layer instanceof L.Marker) {
                const markerTitle = layer.options.title || ''
                if (markerTitle.toLowerCase().includes(searchTerm)) {
                  layer.addTo(map)
                  const layerMarker = layer._icon.children[0]

                  // Add yellow text shadow to the marker
                  layerMarker.style.textShadow = '0px 0px 16px yellow'
                  // layerMarker.style.transform = 'translate(-0.70rem, -1rem)';
                  layerMarker.style.transition = 'all 0.5s ease'
                  layerMarker.style.fontSize = '1.25rem'

                  // Wait for 0.3s before removing the text shadow
                  setTimeout(() => {
                    layerMarker.style.textShadow = '0px 0px 8px black'
                    layerMarker.style.fontSize = '1rem'
                    layerMarker.style.transform = 'translate(-0.35rem, -0.5rem)'
                  }, 200)

                  searchMarkers.push(layer)

                  // map.setView(layer.getLatLng(), 2)
                } else {
                  map.removeLayer(layer)
                  searchMarkers = searchMarkers.filter((marker) => marker !== layer)
                }
              }
            })
          }
        }
      }
    }

    for (const key in treeMarkersSearch) {
      if (key == mapLayer) {
        for (const subKey in treeMarkersSearch[key]) {
          // Check if the treeMarkersSearch[key][subKey] is a layer group
          if (treeMarkersSearch[key][subKey] instanceof L.LayerGroup) {
            treeMarkersSearch[key][subKey].remove()
            treeMarkersSearch[key][subKey].eachLayer((layer) => {
              // Remove the layer from the map
              if (layer instanceof L.Marker) {
                const markerTitle = layer.options.title || ''
                if (markerTitle.toLowerCase().includes(searchTerm)) {
                  layer.addTo(map)
                  const layerMarker = layer._icon.children[0]

                  // Add yellow text shadow to the marker
                  layerMarker.style.textShadow = '0px 0px 16px yellow'
                  layerMarker.style.transition = 'all 0.5s ease'
                  layerMarker.style.fontSize = '1.25rem'

                  // Wait for 0.3s before removing the text shadow
                  setTimeout(() => {
                    layerMarker.style.textShadow = '0px 0px 8px black'
                    layerMarker.style.fontSize = '1rem'
                  }, 200)

                  searchMarkers.push(layer)

                  // map.setView(layer.getLatLng(), 2)
                } else {
                  map.removeLayer(layer)
                  searchMarkers = searchMarkers.filter((marker) => marker !== layer)
                }
              }
            })
          }
        }
      }
    }
  }

  map.on('baselayerchange', (e) => {
    layerAdd(e, levelMarkers, layerControls)
    performSearchFilter(searchInput.value.toLowerCase())
  })

  layerAdd({ name: 'Overworld' }, levelMarkers, layerControls) // Initialize
  // Load Locations by default
  levelMarkers.Overworld.Locations.addTo(map)

  map.fitBounds(bounds)

  // Check URL for parameters
  const urlParams = new URLSearchParams(window.location.search)

  // If the URL contains a parameter "lvl", set the map to that level
  const level = urlParams.get('lvl')

  // If the URL contains a parameter 'pos_x', set the map to that position
  const posX = urlParams.get('pos_x')

  // If the URL contains a parameter 'pos_y', set the map to that position
  const posY = urlParams.get('pos_y')

  const hideDecor = urlParams.get('hide_decor')

  let playPositionMarker = null
  if (posX && posY) {
    // Set the map to the position
    map.setView([posY, posX], 4)

    // Draw a red x marker at the position

    playPositionMarker = L.marker([posY, posX], {
      icon: L.divIcon({
        className: 'text-label',
        iconSize: [30, 36],
        iconAnchor: [15, 18],
        popupAnchor: [0, 0],
        html: `<div class="marker playerPosition" style="font-size:1.5rem;color:white;text-shadow: 0px 0px 8px black;">❌</div>`,
      }),
      title: 'You are here',
    })
    playPositionMarker.bindPopup('You are here')

    playPositionMarker.addTo(map)
  }

  window.addEventListener('message', (event) => {
    // Check if the message is a command to set the map position
    if (event.data.X && event.data.Y && event.data.lvl) {
      // Change map layer based on the level
      switch (event.data.lvl) {
        case 'Overworld':
          map.addLayer(overworldLayers)
          break
        case 'Underworld':
          map.addLayer(underworldLayers)
          break
        case 'Sky':
          map.addLayer(skyLayers)
          break
      }

      animateMarker(playPositionMarker, {lat: event.data.Y, lng: event.data.X});

      /*
          // Remove the previous player position marker if it exists
          if (playPositionMarker) {
            map.removeLayer(playPositionMarker);
          }

          // Draw a red x marker at the position
          playPositionMarker = L.marker([event.data.Y, event.data.X], {
            icon: L.divIcon({
              className: 'text-label',
              iconSize: [30, 36],
              iconAnchor: [15, 18],
              popupAnchor: [0, 0],
              html: `<div class="marker playerPosition" style="font-size:1.5rem;color:white;text-shadow: 0px 0px 8px black;">❌</div>`,
            }),
            title: 'You are here',
          })
          playPositionMarker.bindPopup('You are here');
          playPositionMarker.addTo(map);
          */
    }
  })

  if (hideDecor) {
    // Hide class footer and tag header
    const footer = document.querySelector('.footer')
    const header = document.querySelector('header')
    const joinUs = document.querySelector('.joinUs')
    if (footer) {
      footer.style.display = 'none'
    }
    if (header) {
      header.style.display = 'none'
    }
    if (joinUs) {
      joinUs.style.display = 'none'
    }

    // Update map height to fill the screen
    const main = document.querySelector('main')
    if (main) {
      main.style.height = '100vh'
    }
  }

  // Change layer based on URL parameter
  if (level) {
    switch (level) {
      case 'Overworld':
        map.addLayer(overworldLayers)
        break
      case 'Underworld':
        map.addLayer(underworldLayers)
        break
      case 'Sky':
        map.addLayer(skyLayers)
        break
    }
  } else {
    // Default to Overworld
    map.addLayer(overworldLayers)
  }
})

function animateMarker(marker, toLatLng, duration = 1000) {
  const fromLatLng = marker.getLatLng()
  const startTime = performance.now()

  function animate(time) {
    const elapsed = time - startTime
    const t = Math.min(elapsed / duration, 1)

    const lat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * t
    const lng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * t

    marker.setLatLng([lat, lng])

    if (t < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}
</script>

<template>
  <main>
    <!-- Leaflet Map -->
    <div id="map"></div>
  </main>
</template>

<style scoped>
/* Main should take up the rest of the screen not taken up by the header */
main {
  text-align: center;
  height: calc(100vh - 75px); /* Adjust based on header height */
}
#map {
  height: 100%;
  width: 100%;
  position: relative;
  z-index: 1; /* Ensure the map is above the background */
  background-color: #3b85b9; /* Default color for overworld */
}
.joinUs {
  position: fixed;
  right: 5px;
  bottom: 25px;
  z-index: 1000;
}

button {
  background-color: #222121;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
}
button:hover {
  background-color: #444343;
}
button:active {
  background-color: #373737;
}
</style>
