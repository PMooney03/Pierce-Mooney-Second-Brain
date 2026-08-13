from rest_framework import serializers
from cities.models import City
from regions.models import Region
from hotels.models import Hotel
from landmarks.models import Landmark


class CitySerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = '__all__'

    def get_geometry(self, obj):
        if obj.location:
            return {
                "type": "Point",
                "coordinates": [obj.location.x, obj.location.y]
            }
        return None


class RegionSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = '__all__'

    def get_geometry(self, obj):
        if obj.geometry:
            try:
                import json
                return json.loads(obj.geometry.geojson)
            except:
                return obj.geometry.geojson
        return None


class HotelSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = Hotel
        fields = '__all__'

    def get_geometry(self, obj):
        if obj.location:
            return {
                "type": "Point",
                "coordinates": [obj.location.x, obj.location.y]
            }
        return None


class LandmarkSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()

    class Meta:
        model = Landmark
        fields = '__all__'

    def get_geometry(self, obj):
        if obj.location:
            return {
                "type": "Point",
                "coordinates": [obj.location.x, obj.location.y]
            }
        return None

