from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.db.models import Count, Avg, Min, Max, Sum
import math

from cities.models import City
from regions.models import Region
from hotels.models import Hotel
from landmarks.models import Landmark
from landmarks.services import get_landmarks_in_bbox, fetch_and_save_landmarks, get_all_pois_in_bbox
from .serializers import CitySerializer, RegionSerializer, HotelSerializer, LandmarkSerializer


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer

    def get_queryset(self):
        queryset = City.objects.all()

        population_min = self.request.query_params.get('population_min')
        population_max = self.request.query_params.get('population_max')
        if population_min:
            queryset = queryset.filter(population__gte=population_min)
        if population_max:
            queryset = queryset.filter(population__lte=population_max)

        country = self.request.query_params.get('country')
        if country:
            queryset = queryset.filter(country__icontains=country)

        city_type = self.request.query_params.get('city_type')
        if city_type:
            queryset = queryset.filter(city_type=city_type)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        features = []
        for item in serializer.data:
            if item.get('geometry'):
                features.append({
                    "type": "Feature",
                    "geometry": item['geometry'],
                    "properties": {k: v for k, v in item.items() if k != 'geometry'}
                })

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        return Response(geojson)

    @action(detail=False, methods=['get'])
    def nearby(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        distance_km = request.query_params.get('distance', 50)

        if not lat or not lng:
            return Response(
                {'error': 'lat and lng parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            point = Point(float(lng), float(lat), srid=4326)
            distance_m = float(distance_km) * 1000

            nearby_cities = City.objects.filter(
                location__distance_lte=(point, distance_m)
            ).annotate(
                distance=Distance('location', point)
            ).order_by('distance')

            serializer = self.get_serializer(nearby_cities, many=True)
            
            features = []
            for item in serializer.data:
                if item.get('geometry'):
                    features.append({
                        "type": "Feature",
                        "geometry": item['geometry'],
                        "properties": {k: v for k, v in item.items() if k != 'geometry'}
                    })

            geojson = {
                "type": "FeatureCollection",
                "features": features
            }
            return Response(geojson)

        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid coordinates or distance'},
                status=status.HTTP_400_BAD_REQUEST
            )


class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer

    def get_queryset(self):
        queryset = Region.objects.all()

        area_min = self.request.query_params.get('area_min')
        area_max = self.request.query_params.get('area_max')
        if area_min:
            queryset = queryset.filter(area_km2__gte=area_min)
        if area_max:
            queryset = queryset.filter(area_km2__lte=area_max)

        population_min = self.request.query_params.get('population_min')
        population_max = self.request.query_params.get('population_max')
        if population_min:
            queryset = queryset.filter(total_population__gte=population_min)
        if population_max:
            queryset = queryset.filter(total_population__lte=population_max)

        country = self.request.query_params.get('country')
        if country:
            queryset = queryset.filter(country__icontains=country)

        region_type = self.request.query_params.get('region_type')
        if region_type:
            queryset = queryset.filter(region_type=region_type)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        features = []
        for item in serializer.data:
            if item.get('geometry'):
                features.append({
                    "type": "Feature",
                    "geometry": item['geometry'],
                    "properties": {k: v for k, v in item.items() if k != 'geometry'}
                })

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        return Response(geojson)

    @action(detail=True, methods=['get'])
    def cities(self, request, pk=None):
        """Get all cities within a region using PostGIS ST_Within spatial query"""
        region = self.get_object()
        cities_in_region = City.objects.filter(location__within=region.geometry)
        
        serializer = CitySerializer(cities_in_region, many=True)
        
        features = []
        for item in serializer.data:
            if item.get('geometry'):
                features.append({
                    "type": "Feature",
                    "geometry": item['geometry'],
                    "properties": {k: v for k, v in item.items() if k != 'geometry'}
                })

        return Response({
            "type": "FeatureCollection",
            "features": features,
            "region_info": {
                "name": region.name,
                "country": region.country,
                "total_cities": len(features)
            }
        })


class HotelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Hotel.objects.all()
    serializer_class = HotelSerializer

    def get_queryset(self):
        queryset = Hotel.objects.all()

        city_name = self.request.query_params.get('city')
        if city_name:
            queryset = queryset.filter(city__name__icontains=city_name)

        star_rating = self.request.query_params.get('star_rating')
        if star_rating:
            queryset = queryset.filter(star_rating=star_rating)

        price_range = self.request.query_params.get('price_range')
        if price_range:
            queryset = queryset.filter(price_range=price_range)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        features = []
        for item in serializer.data:
            if item.get('geometry'):
                features.append({
                    "type": "Feature",
                    "geometry": item['geometry'],
                    "properties": {k: v for k, v in item.items() if k != 'geometry'}
                })

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        return Response(geojson)
    
    @action(detail=False, methods=['get'])
    def nearby(self, request):
        """Find hotels near a location"""
        try:
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
            radius = float(request.query_params.get('radius', 50))  # km
            
            point = Point(lng, lat, srid=4326)
            
            # Convert radius to meters
            radius_m = radius * 1000
            
            hotels = Hotel.objects.annotate(
                distance=Distance('location', point)
            ).filter(
                distance__lte=radius_m
            ).order_by('distance')
            
            serializer = self.get_serializer(hotels, many=True)
            
            features = []
            for item in serializer.data:
                if item.get('geometry'):
                    features.append({
                        "type": "Feature",
                        "geometry": item['geometry'],
                        "properties": {k: v for k, v in item.items() if k != 'geometry'}
                    })
            
            return Response({
                "type": "FeatureCollection",
                "features": features
            })
        except (ValueError, TypeError) as e:
            return Response(
                {"error": "Invalid parameters. Provide lat, lng, and radius (optional)"},
                status=400
            )


@api_view(['GET'])
def landmarks_nearby(request):
    """Get landmarks near a location using Overpass API"""
    try:
        lat = float(request.query_params.get('lat'))
        lng = float(request.query_params.get('lng'))
        radius = float(request.query_params.get('radius', 10))  # km
        
        # Calculate bounding box
        # Rough approximation: 1 degree ≈ 111 km
        lat_offset = radius / 111.0
        lng_offset = radius / (111.0 * abs(math.cos(math.radians(lat))))
        
        bbox = (
            lat - lat_offset,  # min_lat
            lng - lng_offset,  # min_lng
            lat + lat_offset,  # max_lat
            lng + lng_offset   # max_lng
        )
        
        # Fetch from Overpass API
        landmarks_data = get_landmarks_in_bbox(*bbox)
        
        # Convert to GeoJSON
        features = []
        point = Point(lng, lat, srid=4326)
        
        for landmark in landmarks_data:
            landmark_point = Point(landmark['longitude'], landmark['latitude'], srid=4326)
            distance_km = point.distance(landmark_point) * 111  # Rough conversion
            
            if distance_km <= radius:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [landmark['longitude'], landmark['latitude']]
                    },
                    "properties": {
                        "name": landmark['name'],
                        "type": landmark['landmark_type'],
                        "category": landmark['category'],
                        "description": landmark['description'],
                        "distance_km": round(distance_km, 2)
                    }
                })
        
        return Response({
            "type": "FeatureCollection",
            "features": features
        })
        
    except (ValueError, TypeError) as e:
        return Response(
            {"error": "Invalid parameters. Provide lat, lng, and radius (optional)"},
            status=400
        )


@api_view(['POST'])
def fetch_landmarks_bbox(request):
    """Fetch and save landmarks in a bounding box"""
    try:
        bbox = [
            float(request.data.get('min_lat')),
            float(request.data.get('min_lng')),
            float(request.data.get('max_lat')),
            float(request.data.get('max_lng'))
        ]
        
        saved, total = fetch_and_save_landmarks(bbox)
        
        return Response({
            "message": f"Fetched {total} landmarks, saved {saved} new ones",
            "saved": saved,
            "total": total
        })
    except (ValueError, TypeError, KeyError) as e:
        return Response(
            {"error": "Invalid bbox. Provide min_lat, min_lng, max_lat, max_lng"},
            status=400
        )


@api_view(['GET'])
def all_pois_nearby(request):
    """Get ALL types of POIs near a location using Overpass API"""
    try:
        lat = float(request.query_params.get('lat'))
        lng = float(request.query_params.get('lng'))
        radius = float(request.query_params.get('radius', 5))  # km, default smaller for all POIs
        
        # Filter by type if specified
        poi_type_filter = request.query_params.get('type', None)  # e.g., 'shop', 'amenity', 'tourism'
        category_filter = request.query_params.get('category', None)  # e.g., 'restaurant', 'pub'
        
        # Calculate bounding box
        lat_offset = radius / 111.0
        lng_offset = radius / (111.0 * abs(math.cos(math.radians(lat))))
        
        # Ensure correct bbox order (min_lng < max_lng, even for negative longitudes)
        min_lat = lat - lat_offset
        max_lat = lat + lat_offset
        min_lng = lng - lng_offset
        max_lng = lng + lng_offset
        
        # For negative longitudes, ensure min_lng is more negative
        if min_lng > max_lng:
            min_lng, max_lng = max_lng, min_lng
        
        bbox = (min_lat, min_lng, max_lat, max_lng)
        
        # Fetch all POIs from Overpass API
        try:
            pois_data = get_all_pois_in_bbox(*bbox)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error fetching POIs: {e}")
            return Response(
                {"error": f"Error fetching POIs from Overpass API: {str(e)}"},
                status=500
            )
        
        # Convert to GeoJSON
        features = []
        point = Point(lng, lat, srid=4326)
        
        for poi in pois_data:
            # Apply filters
            if poi_type_filter and poi['poi_type'] != poi_type_filter:
                continue
            if category_filter and poi['category'] != category_filter:
                continue
            
            poi_point = Point(poi['longitude'], poi['latitude'], srid=4326)
            distance_km = point.distance(poi_point) * 111
            
            if distance_km <= radius:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [poi['longitude'], poi['latitude']]
                    },
                    "properties": {
                        "name": poi['name'],
                        "type": poi['poi_type'],
                        "category": poi['category'],
                        "icon": poi['icon'],
                        "description": poi['description'],
                        "address": poi['address'],
                        "phone": poi['phone'],
                        "website": poi['website'],
                        "distance_km": round(distance_km, 2)
                    }
                })
        
        # Sort by distance
        features.sort(key=lambda x: x['properties']['distance_km'])
        
        return Response({
            "type": "FeatureCollection",
            "features": features,
            "total": len(features)
        })
        
    except (ValueError, TypeError) as e:
        return Response(
            {"error": "Invalid parameters. Provide lat, lng, and radius (optional)"},
            status=400
        )
