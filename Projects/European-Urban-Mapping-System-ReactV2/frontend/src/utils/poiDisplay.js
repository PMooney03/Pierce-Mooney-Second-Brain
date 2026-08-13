const RESTAURANT_CATEGORIES = [
  'restaurant',
  'fast_food',
  'cafe',
  'pub',
  'bar',
  'food_court',
]

export const FOOD_CATEGORIES = [...RESTAURANT_CATEGORIES]

const HOTEL_CATEGORIES = ['hotel', 'hostel', 'motel', 'guest_house', 'apartment']

export const DB_PRICE_LABELS = {
  budget: '€ Budget',
  moderate: '€€ Moderate',
  luxury: '€€€ Luxury',
}

export function isHotelCategory(category) {
  return HOTEL_CATEGORIES.includes(category)
}

export function formatStars(props) {
  if (props.star_rating) {
    return `${'★'.repeat(props.star_rating)} (${props.star_rating} star${props.star_rating === 1 ? '' : 's'})`
  }
  if (props.stars) {
    return `${'★'.repeat(Math.min(props.stars, 5))} (${props.stars} star${props.stars === 1 ? '' : 's'})`
  }
  if (props.stars_label) {
    return `${props.stars_label} stars`
  }
  return null
}

export function formatPrice(props) {
  if (props.price_range && DB_PRICE_LABELS[props.price_range]) {
    return DB_PRICE_LABELS[props.price_range]
  }
  if (props.price_range) {
    return String(props.price_range)
  }
  if (props.price_hint) {
    return String(props.price_hint)
  }
  return null
}

export function isRestaurantCategory(category) {
  return RESTAURANT_CATEGORIES.includes(category)
}

export function getPlaceTypeLabel(props) {
  if (props.source === 'database' || props.star_rating) return '🏨 Hotel'
  if (isHotelCategory(props.category)) return '🏨 Hotel'
  if (isRestaurantCategory(props.category)) {
    const labels = {
      restaurant: '🍽️ Restaurant',
      cafe: '☕ Café',
      pub: '🍺 Pub',
      bar: '🍸 Bar',
      fast_food: '🍔 Fast food',
      food_court: '🍱 Food court',
    }
    return labels[props.category] || '🍽️ Restaurant'
  }
  return `${props.icon || '📍'} ${(props.category || props.type || 'Place').replace(/_/g, ' ')}`
}

function buildHotelLines(props) {
  const lines = []
  const stars = formatStars(props)
  if (stars) lines.push(stars)
  const price = formatPrice(props)
  if (price) lines.push(`Price: ${price}`)
  if (props.operator) lines.push(`Operator: ${props.operator}`)
  if (props.brand) lines.push(`Brand: ${props.brand}`)
  if (props.rooms) lines.push(`Rooms: ${props.rooms}`)
  if (props.beds) lines.push(`Beds: ${props.beds}`)
  if (props.facilities) lines.push(`Facilities: ${props.facilities}`)
  if (props.internet_access && props.internet_access !== 'no') {
    lines.push(`Wi‑Fi: ${props.internet_access}`)
  }
  if (props.amenities) lines.push(`Amenities: ${props.amenities}`)
  if (props.wheelchair && props.wheelchair !== 'no') {
    lines.push(`Wheelchair: ${props.wheelchair}`)
  }
  if (props.smoking) lines.push(`Smoking: ${props.smoking}`)
  if (props.reservation) lines.push('Reservations accepted')
  if (props.city_name) lines.push(`City: ${props.city_name}`)
  if (!stars && !price && props.source === 'openstreetmap') {
    lines.push('Star/price not tagged in OpenStreetMap for this hotel')
  }
  if (props.source === 'database') lines.push('Curated hotel database entry')
  return lines
}

function buildRestaurantLines(props) {
  const lines = []
  const price = formatPrice(props)
  if (price) lines.push(`Price: ${price}`)
  if (props.cuisine) lines.push(`Cuisine: ${props.cuisine}`)
  if (props.opening_hours) lines.push(`Hours: ${props.opening_hours}`)
  const perks = []
  if (props.takeaway) perks.push('Takeaway')
  if (props.delivery) perks.push('Delivery')
  if (props.outdoor_seating) perks.push('Outdoor seating')
  if (props.reservation) perks.push('Reservations')
  if (perks.length) lines.push(perks.join(' • '))
  if (props.brand) lines.push(`Brand: ${props.brand}`)
  if (!price && !props.cuisine && props.source === 'openstreetmap') {
    lines.push('Price/cuisine not tagged in OpenStreetMap')
  }
  return lines
}

export function buildPoiDetailLines(props) {
  const lines = []

  if (isHotelCategory(props.category) || props.star_rating) {
    lines.push(...buildHotelLines(props))
  } else if (isRestaurantCategory(props.category)) {
    lines.push(...buildRestaurantLines(props))
  } else {
    const stars = formatStars(props)
    if (stars) lines.push(stars)
    const price = formatPrice(props)
    if (price) lines.push(`Price: ${price}`)
    if (props.brand) lines.push(`Brand: ${props.brand}`)
    if (props.operator) lines.push(`Operator: ${props.operator}`)
  }

  if (props.description) lines.push(props.description)

  return lines
}

export function buildListSubtitle(props) {
  const parts = []
  const stars = formatStars(props)
  if (stars) parts.push(stars)
  const price = formatPrice(props)
  if (price) parts.push(price)
  if (props.operator) parts.push(props.operator)
  if (props.brand) parts.push(props.brand)
  if (props.rooms) parts.push(`${props.rooms} rooms`)
  if (props.facilities) parts.push(props.facilities)
  if (isRestaurantCategory(props.category) && props.cuisine) {
    parts.push(props.cuisine)
  }
  if (props.city_name) parts.push(props.city_name)
  if (props.address) {
    const short = props.address.split(',')[0].trim()
    if (short) parts.push(short)
  }
  if (props.source === 'database') parts.push('Database')
  if (!parts.length) {
    return (props.category || 'place').replace(/_/g, ' ')
  }
  return parts.join(' • ')
}

export function filterOsmHotels(features, { starRating, priceRange } = {}) {
  return features.filter((feature) => {
    const p = feature.properties || {}
    if (starRating && String(p.stars || '') !== String(starRating)) {
      return false
    }
    if (priceRange && p.price_range !== priceRange) {
      return false
    }
    return true
  })
}

export function isFoodPoi(props) {
  return props?.type === 'amenity' && FOOD_CATEGORIES.includes(props.category)
}

export function filterOsmRestaurants(
  features,
  { category, cuisine, priceRange } = {},
) {
  return features.filter((feature) => {
    const p = feature.properties || {}
    if (!isFoodPoi(p)) return false
    if (category && p.category !== category) return false
    if (cuisine) {
      const haystack = (p.cuisine || '').toLowerCase()
      if (!haystack.includes(cuisine.toLowerCase())) return false
    }
    if (priceRange && p.price_range !== priceRange) return false
    return true
  })
}

export function isCoffeePoi(props) {
  if (!props) return false
  if (props.type === 'amenity' && props.category === 'cafe') return true
  if (
    props.type === 'shop' &&
    ['coffee', 'bakery', 'pastry', 'tea', 'chocolate'].includes(props.category)
  ) {
    return true
  }
  if (
    props.type === 'amenity' &&
    ['restaurant', 'fast_food', 'food_court', 'bar'].includes(props.category)
  ) {
    if (matchesCoffeeCuisine(props.cuisine)) return true
    if (matchesCoffeeBrand(props.brand)) return true
  }
  return false
}

export function matchesCoffeeCuisine(cuisine) {
  if (!cuisine) return false
  const value = cuisine.toLowerCase().replace(/;/g, ' ')
  return /\bcoffee|cafe|café|espresso|tea_room|bubble_tea|coffee_shop|bakery\b/.test(
    value,
  )
}

function matchesCoffeeBrand(brand) {
  if (!brand) return false
  return /starbucks|costa|nero|pret|dunkin|tim hortons|lavazza|coffee#1|gail|paul\b/i.test(
    brand,
  )
}

function matchesCoffeePlaceType(props, placeType) {
  if (!placeType) return true
  if (placeType === 'cafe') {
    return (
      (props.type === 'amenity' && props.category === 'cafe') ||
      (props.type === 'amenity' &&
        ['restaurant', 'fast_food', 'bar'].includes(props.category) &&
        (matchesCoffeeCuisine(props.cuisine) || matchesCoffeeBrand(props.brand)))
    )
  }
  if (placeType === 'coffee_shop') {
    return (
      (props.type === 'shop' && props.category === 'coffee') ||
      (props.cuisine || '').toLowerCase().includes('coffee_shop')
    )
  }
  if (placeType === 'bakery') {
    return (
      (props.type === 'shop' && ['bakery', 'pastry'].includes(props.category)) ||
      (props.cuisine || '').toLowerCase().includes('bakery')
    )
  }
  return true
}

function matchesOsmPriceRange(props, priceRange) {
  if (!priceRange) return true
  const raw = String(props.price_range || props.price_hint || '').toLowerCase()
  if (!raw) return false
  const aliases = {
    budget: ['budget', 'inexpensive', 'cheap', 'low', '€', '$', '1'],
    moderate: ['moderate', 'medium', 'mid', '€€', '$$', '2'],
    luxury: ['luxury', 'expensive', 'high', '€€€', '$$$', '3'],
  }
  return (aliases[priceRange] || [priceRange]).some((token) => raw.includes(token))
}

export function collectCoffeeFromOsmResult(osmResult) {
  const seen = new Set()
  const results = []

  ;(osmResult?.features || []).forEach((feature) => {
    if (!feature?.geometry?.coordinates || !isCoffeePoi(feature.properties)) {
      return
    }
    const [lng, lat] = feature.geometry.coordinates
    const name = feature.properties?.name || ''
    const key = `${lng.toFixed(5)}|${lat.toFixed(5)}|${name}`
    if (seen.has(key)) return
    seen.add(key)
    results.push(feature)
  })

  return results
}

export function filterOsmCoffee(
  features,
  { placeType, priceRange, outdoorSeating } = {},
) {
  return features.filter((feature) => {
    const p = feature.properties || {}
    if (!isCoffeePoi(p)) return false
    if (!matchesCoffeePlaceType(p, placeType)) return false
    if (!matchesOsmPriceRange(p, priceRange)) return false
    if (outdoorSeating && !p.outdoor_seating) return false
    return true
  })
}

export function wikipediaUrl(tag) {
  if (!tag) return null
  if (tag.startsWith('http')) return tag
  const [lang, title] = tag.includes(':') ? tag.split(':', 2) : ['en', tag]
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}
