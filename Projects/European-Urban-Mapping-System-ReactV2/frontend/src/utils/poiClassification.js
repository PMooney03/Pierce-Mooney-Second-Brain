export const HOTEL_CATEGORIES = ['hotel', 'hostel', 'motel', 'guest_house', 'apartment']
export const RESTAURANT_CATEGORIES = ['restaurant', 'fast_food', 'food_court']
export const CAFE_PUB_BAR_CATEGORIES = ['cafe', 'pub', 'bar']
export const HEALTHCARE_CATEGORIES = ['hospital', 'pharmacy', 'clinic', 'doctors']
export const LANDMARK_POI_TYPES = ['tourism', 'historic', 'leisure']

export function isHotelPoi(props) {
  return props.type === 'tourism' && HOTEL_CATEGORIES.includes(props.category)
}

export function getPoiGroups(props) {
  const { type, category } = props
  const groups = []

  if (isHotelPoi(props)) groups.push('hotels')
  if (type === 'amenity' && RESTAURANT_CATEGORIES.includes(category)) {
    groups.push('restaurants')
  }
  if (type === 'amenity' && CAFE_PUB_BAR_CATEGORIES.includes(category)) {
    groups.push('cafesPubsBars')
  }
  if (type === 'shop') groups.push('shops')
  if (LANDMARK_POI_TYPES.includes(type) && !isHotelPoi(props)) {
    groups.push('landmarks')
  }
  if (type === 'amenity' && HEALTHCARE_CATEGORIES.includes(category)) {
    groups.push('healthcare')
  }
  if (type === 'shop' && category === 'pharmacy') groups.push('healthcare')
  if (type === 'transport') groups.push('transport')
  if (type === 'amenity' && category === 'fuel') groups.push('petrol')

  return groups
}

export function categorizeFeatures(features) {
  const cats = {
    hotels: [],
    restaurants: [],
    cafesPubsBars: [],
    shops: [],
    landmarks: [],
    healthcare: [],
    transport: [],
    petrol: [],
    all: features,
  }

  features.forEach((feature, index) => {
    feature._poiIndex = index
    const groups = getPoiGroups(feature.properties)
    groups.forEach((group) => {
      if (cats[group]) cats[group].push(feature)
    })
  })

  return cats
}

export function poiMatchesQuickFilter(groups, props, activeQuickFilter) {
  if (activeQuickFilter === 'all') return null
  switch (activeQuickFilter) {
    case 'hotels':
      return groups.includes('hotels')
    case 'food':
      return groups.includes('restaurants')
    case 'coffee':
      return props.type === 'amenity' && props.category === 'cafe'
    case 'pubs':
      return props.type === 'amenity' && ['pub', 'bar'].includes(props.category)
    case 'attractions':
      return groups.includes('landmarks')
    case 'shops':
      return groups.includes('shops')
    case 'transport':
      return groups.includes('transport')
    case 'healthcare':
      return groups.includes('healthcare')
    default:
      return true
  }
}
