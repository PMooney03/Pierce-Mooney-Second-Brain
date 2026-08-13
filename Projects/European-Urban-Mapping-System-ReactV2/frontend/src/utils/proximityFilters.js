import {
  createColoredMarker,
  createHotelMarker,
} from './leafletMarkers'
import { buildListSubtitle } from './poiDisplay'
import { getPoiGroups, poiMatchesQuickFilter } from './poiClassification'

const DEFAULT_FILTERS = {
  cities: true,
  hotels: true,
  tourism: true,
  restaurants: true,
  shops: true,
  coffee: true,
  petrol: true,
  healthcare: true,
}

export function buildProximityDisplay(
  poiFeatures,
  { filters = DEFAULT_FILTERS, activeQuickFilter = 'all' } = {},
) {
  const markers = []
  const cityItems = []
  const hotelItems = []
  const otherByType = {}
  let poiCount = 0
  let hotelPOICount = 0

  poiFeatures.forEach((feature) => {
    if (!feature.geometry?.coordinates) return

    const [lng, lat] = feature.geometry.coordinates
    const props = feature.properties
    const groups = getPoiGroups(props)

    let shouldShow = false
    let isHotel = false

    const quickMatch = poiMatchesQuickFilter(groups, props, activeQuickFilter)
    if (quickMatch !== null) {
      if (!quickMatch) return
      shouldShow = true
      isHotel = groups.includes('hotels')
    } else {
      if (groups.includes('hotels') && filters.hotels) {
        shouldShow = true
        isHotel = true
        hotelPOICount += 1
      }
      if (groups.includes('landmarks') && filters.tourism) shouldShow = true
      if (groups.includes('restaurants') && filters.restaurants) {
        shouldShow = true
      }
      if (groups.includes('shops') && filters.shops) shouldShow = true
      if (groups.includes('cafesPubsBars') && filters.coffee) shouldShow = true
      if (groups.includes('petrol') && filters.petrol) shouldShow = true
      if (groups.includes('healthcare') && filters.healthcare) shouldShow = true
      if (groups.includes('transport') && filters.tourism) shouldShow = true
    }

    if (quickMatch !== null && isHotel) hotelPOICount += 1
    if (!shouldShow) return

    const marker = isHotel
      ? createHotelMarker(lat, lng, props)
      : createColoredMarker(lat, lng, props)

    const markerIndex = markers.length
    markers.push(marker)
    poiCount += 1

    const listItem = {
      name: props.name || 'Unnamed POI',
      icon: props.icon || (isHotel ? '🏨' : '📍'),
      category: props.category,
      subtitle: buildListSubtitle(props),
      distance: props.distance_km || 0,
      lat,
      lng,
      markerIndex,
      isHotel,
    }

    const displayType = isHotel ? 'hotel' : props.type
    if (isHotel) {
      hotelItems.push(listItem)
    } else {
      if (!otherByType[displayType]) otherByType[displayType] = []
      otherByType[displayType].push(listItem)
    }
  })

  const otherGroups = Object.keys(otherByType)
    .sort()
    .map((type) => ({ type, items: otherByType[type] }))

  return {
    markers,
    hotelItems,
    otherGroups,
    poiCount,
    hotelPOICount,
    nonHotelPoiCount: poiCount - hotelPOICount,
  }
}

export function buildCityListItems(geojson) {
  return (geojson.features || [])
    .filter((f) => f.geometry?.coordinates)
    .map((feature, index) => {
      const [lng, lat] = feature.geometry.coordinates
      const props = feature.properties
      return {
        name: props.name,
        country: props.country,
        population: props.population,
        lat,
        lng,
        markerIndex: index,
        props,
      }
    })
}
