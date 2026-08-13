import requests
import math
from django.contrib.gis.geos import Point
from .models import Landmark

OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"

# Category icons mapping
CATEGORY_ICONS = {
    'shop': '🛍️',
    'supermarket': '🏪',
    'restaurant': '🍽️',
    'cafe': '☕',
    'pub': '🍺',
    'bar': '🍸',
    'fast_food': '🍔',
    'hairdresser': '✂️',
    'pharmacy': '💊',
    'hospital': '🏥',
    'school': '🏫',
    'university': '🎓',
    'museum': '🏛️',
    'attraction': '🎯',
    'monument': '🗿',
    'castle': '🏰',
    'church': '⛪',
    'park': '🌳',
    'hotel': '🏨',
    'city': '🏙️',
    'town': '🏘️',
    'village': '🏡',
    'default': '📍'
}

def query_overpass(query):
    """Execute an Overpass QL query"""
    try:
        response = requests.post(
            OVERPASS_API_URL,
            data={'data': query},
            timeout=60  # Increased timeout for complex queries
        )
        response.raise_for_status()
        result = response.json()
        
        # Check for Overpass API errors
        if 'remark' in result:
            print(f"Overpass API remark: {result['remark']}")
        if 'elements' not in result:
            print(f"Overpass API response missing 'elements': {result}")
            return None
            
        return result
    except requests.RequestException as e:
        print(f"Overpass API error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_text = e.response.text
                print(f"Overpass API error response: {error_text}")
            except:
                pass
        return None
    except Exception as e:
        print(f"Unexpected error querying Overpass API: {e}")
        return None

def get_landmarks_in_bbox(min_lat, min_lng, max_lat, max_lng, landmark_types=None):
    """
    Fetch landmarks from Overpass API within a bounding box
    
    Args:
        min_lat, min_lng, max_lat, max_lng: Bounding box coordinates
        landmark_types: List of types to fetch (e.g., ['tourism', 'historic'])
    """
    
    if landmark_types is None:
        landmark_types = ['tourism', 'historic', 'amenity']
    
    # Build Overpass QL query
    query = f"""
    [out:json][timeout:25];
    (
      // Tourism attractions
      node["tourism"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["tourism"]({min_lat},{min_lng},{max_lat},{max_lng});
      relation["tourism"]({min_lat},{min_lng},{max_lat},{max_lng});
      
      // Historic sites
      node["historic"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["historic"]({min_lat},{min_lng},{max_lat},{max_lng});
      relation["historic"]({min_lat},{min_lng},{max_lat},{max_lng});
      
      // Important amenities
      node["amenity"~"^(museum|theatre|cinema|library|university|hospital)$"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["amenity"~"^(museum|theatre|cinema|library|university|hospital)$"]({min_lat},{min_lng},{max_lat},{max_lng});
    );
    out body;
    >;
    out skel qt;
    """
    
    data = query_overpass(query)
    if not data or 'elements' not in data:
        return []
    
    landmarks = []
    for element in data['elements']:
        if 'tags' not in element:
            continue
        
        tags = element['tags']
        name = tags.get('name', tags.get('name:en', 'Unnamed'))
        
        # Get coordinates
        if element['type'] == 'node':
            lat = element.get('lat')
            lng = element.get('lon')
        elif element['type'] == 'way' and 'center' in element:
            lat = element['center'].get('lat')
            lng = element['center'].get('lon')
        else:
            continue
        
        if not lat or not lng:
            continue
        
        # Determine landmark type and category
        landmark_type = 'tourism'
        category = 'attraction'
        
        if 'tourism' in tags:
            landmark_type = 'tourism'
            category = tags['tourism']
        elif 'historic' in tags:
            landmark_type = 'historic'
            category = tags['historic']
        elif 'amenity' in tags:
            landmark_type = 'amenity'
            category = tags['amenity']
        
        landmarks.append({
            'name': name,
            'osm_id': element.get('id'),
            'landmark_type': landmark_type,
            'category': category,
            'latitude': lat,
            'longitude': lng,
            'description': tags.get('description', tags.get('description:en', '')),
            'osm_tags': tags
        })
    
    return landmarks

def fetch_and_save_landmarks(bbox, landmark_types=None):
    """Fetch landmarks from Overpass and save to database"""
    min_lat, min_lng, max_lat, max_lng = bbox
    landmarks_data = get_landmarks_in_bbox(min_lat, min_lng, max_lat, max_lng, landmark_types)
    
    saved_count = 0
    for landmark_data in landmarks_data:
        landmark, created = Landmark.objects.update_or_create(
            osm_id=landmark_data['osm_id'],
            defaults={
                'name': landmark_data['name'],
                'landmark_type': landmark_data['landmark_type'],
                'category': landmark_data['category'],
                'latitude': landmark_data['latitude'],
                'longitude': landmark_data['longitude'],
                'description': landmark_data['description'],
                'osm_tags': landmark_data['osm_tags']
            }
        )
        if created:
            saved_count += 1
    
    return saved_count, len(landmarks_data)


def get_all_pois_in_bbox(min_lat, min_lng, max_lat, max_lng):
    """
    Fetch ALL types of POIs from Overpass API within a bounding box
    Includes: shops, amenities, tourism, historic, leisure, healthcare, education, transport, places
    
    Note: For negative longitudes (like Dublin), min_lng should be more negative than max_lng
    """
    
    # Ensure bbox is correct (min_lng < max_lng, even for negative values)
    if min_lng > max_lng:
        min_lng, max_lng = max_lng, min_lng
    
    print(f"Querying Overpass API for bbox: {min_lat}, {min_lng}, {max_lat}, {max_lng}")
    
    # Simplified and more efficient Overpass QL query
    # Using union to combine all queries
    query = f"""
    [out:json][timeout:60];
    (
      // All shops
      node["shop"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["shop"]({min_lat},{min_lng},{max_lat},{max_lng});
      
      // All amenities (pubs, restaurants, cafes, hairdressers, etc.)
      node["amenity"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["amenity"]({min_lat},{min_lng},{max_lat},{max_lng});
      
      // Tourism
      node["tourism"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["tourism"]({min_lat},{min_lng},{max_lat},{max_lng});
      
      // Historic sites
      node["historic"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["historic"]({min_lat},{min_lng},{max_lat},{max_lng});
      
      // Leisure (parks, sports, etc.)
      node["leisure"]({min_lat},{min_lng},{max_lat},{max_lng});
      way["leisure"]({min_lat},{min_lng},{max_lat},{max_lng});
      
      // Transport
      node["public_transport"]({min_lat},{min_lng},{max_lat},{max_lng});
      node["railway"~"^(station|halt)$"]({min_lat},{min_lng},{max_lat},{max_lng});
    );
    out center;
    """
    
    data = query_overpass(query)
    if not data:
        print("Overpass API returned no data")
        return []
    
    if 'elements' not in data:
        print(f"Overpass API response missing 'elements' key. Response: {data}")
        return []
    
    print(f"Overpass API returned {len(data['elements'])} elements")
    
    pois = []
    for element in data['elements']:
        # Skip elements without tags (they're just geometry nodes)
        if 'tags' not in element or not element['tags']:
            continue
        
        tags = element['tags']
        name = tags.get('name', tags.get('name:en', tags.get('name:ga', '')))
        
        # Get coordinates
        lat = None
        lng = None
        
        if element['type'] == 'node':
            lat = element.get('lat')
            lng = element.get('lon')
        elif element['type'] == 'way':
            # For ways, use center if available
            if 'center' in element:
                lat = element['center'].get('lat')
                lng = element['center'].get('lon')
            elif 'lat' in element and 'lon' in element:
                lat = element.get('lat')
                lng = element.get('lon')
            else:
                # Skip ways without coordinates
                continue
        else:
            continue
        
        if lat is None or lng is None:
            continue
        
        # Skip if no useful tags (no shop, amenity, tourism, etc.)
        if not any(key in tags for key in ['shop', 'amenity', 'tourism', 'historic', 'leisure', 'public_transport', 'railway']):
            continue
        
        # Get category values for filtering
        amenity = tags.get('amenity', '')
        shop = tags.get('shop', '')
        tourism = tags.get('tourism', '')
        historic = tags.get('historic', '')
        leisure = tags.get('leisure', '')
        
        # Filter out low-value categories (too many, not useful)
        excluded_categories = [
            'bench', 'parking', 'waste_basket', 'post_box', 'telephone',
            'boundary_stone', 'hunting_stand', 'picnic_table', 'shelter',
            'garden', 'picnic_site', 'information',  # Too many information boards
            'place_of_worship'  # Too many churches without names
        ]
        
        # Skip excluded categories
        if (amenity in excluded_categories or 
            shop in excluded_categories or 
            tourism in excluded_categories or
            historic in excluded_categories or
            leisure in excluded_categories):
            continue
        
        # Filter out low-value unnamed POIs
        # Only show unnamed POIs if they're important types
        if not name or name.strip() == '' or name == 'Unnamed':
            # List of amenity types that are useful even without names
            useful_unnamed_amenities = [
                'restaurant', 'cafe', 'pub', 'bar', 'fast_food', 'food_court',
                'hospital', 'clinic', 'pharmacy', 'dentist', 'doctors',
                'school', 'university', 'college', 'library',
                'theatre', 'cinema', 'museum', 'gallery',
                'bank', 'atm', 'post_office',
                'fire_station', 'police', 'courthouse'
            ]
            
            # List of shop types that are useful even without names
            useful_unnamed_shops = [
                'supermarket', 'convenience', 'mall', 'department_store',
                'bakery', 'butcher', 'seafood', 'greengrocer',
                'clothes', 'shoes', 'jewelry', 'electronics',
                'hardware', 'furniture', 'bookshop', 'pharmacy'
            ]
            
            # List of tourism types that are useful even without names
            useful_unnamed_tourism = [
                'hotel', 'hostel', 'motel', 'apartment',
                'attraction', 'museum', 'gallery', 'zoo', 'aquarium',
                'theme_park', 'viewpoint'
            ]
            
            # Check if this is a useful unnamed POI (use values already extracted above)
            is_useful = (
                amenity in useful_unnamed_amenities or
                shop in useful_unnamed_shops or
                tourism in useful_unnamed_tourism
            )
            
            # Skip if not useful
            if not is_useful:
                continue
            
            # Use a default name based on type
            if amenity:
                name = f"{amenity.replace('_', ' ').title()}"
            elif shop:
                name = f"{shop.replace('_', ' ').title()} Shop"
            elif tourism:
                name = f"{tourism.replace('_', ' ').title()}"
            else:
                name = "POI"
        
        # Determine POI type and category
        poi_type = 'other'
        category = 'unknown'
        icon = CATEGORY_ICONS.get('default', '📍')
        
        if 'place' in tags:
            poi_type = 'place'
            category = tags['place']
            if category == 'city':
                icon = CATEGORY_ICONS.get('city', '🏙️')
            elif category == 'town':
                icon = CATEGORY_ICONS.get('town', '🏘️')
            elif category == 'village':
                icon = CATEGORY_ICONS.get('village', '🏡')
        elif 'shop' in tags:
            poi_type = 'shop'
            category = tags['shop']
            if category == 'supermarket':
                icon = CATEGORY_ICONS.get('supermarket', '🏪')
            else:
                icon = CATEGORY_ICONS.get('shop', '🛍️')
        elif 'amenity' in tags:
            poi_type = 'amenity'
            category = tags['amenity']
            icon = CATEGORY_ICONS.get(category, CATEGORY_ICONS.get('default', '📍'))
        elif 'tourism' in tags:
            poi_type = 'tourism'
            category = tags['tourism']
            if category == 'museum':
                icon = CATEGORY_ICONS.get('museum', '🏛️')
            elif category == 'attraction':
                icon = CATEGORY_ICONS.get('attraction', '🎯')
            elif category == 'hotel':
                icon = CATEGORY_ICONS.get('hotel', '🏨')
            else:
                icon = CATEGORY_ICONS.get('default', '📍')
        elif 'historic' in tags:
            poi_type = 'historic'
            category = tags['historic']
            if category == 'monument':
                icon = CATEGORY_ICONS.get('monument', '🗿')
            elif category == 'castle':
                icon = CATEGORY_ICONS.get('castle', '🏰')
            elif category == 'church':
                icon = CATEGORY_ICONS.get('church', '⛪')
            else:
                icon = CATEGORY_ICONS.get('default', '📍')
        elif 'leisure' in tags:
            poi_type = 'leisure'
            category = tags['leisure']
            if category == 'park':
                icon = CATEGORY_ICONS.get('park', '🌳')
            else:
                icon = CATEGORY_ICONS.get('default', '📍')
        elif 'public_transport' in tags or 'railway' in tags:
            poi_type = 'transport'
            category = tags.get('public_transport') or tags.get('railway', 'station')
            icon = '🚉'
        elif 'aeroway' in tags:
            poi_type = 'transport'
            category = tags['aeroway']
            icon = '✈️'
        
        pois.append({
            'name': name,
            'osm_id': element.get('id'),
            'poi_type': poi_type,
            'category': category,
            'latitude': lat,
            'longitude': lng,
            'icon': icon,
            'description': tags.get('description', tags.get('description:en', '')),
            'address': tags.get('addr:street', ''),
            'phone': tags.get('phone', ''),
            'website': tags.get('website', ''),
            'osm_tags': tags
        })
    
    return pois

