from django.contrib.gis import admin
from .models import Landmark

@admin.register(Landmark)
class LandmarkAdmin(admin.GISModelAdmin):
    list_display = ('name', 'landmark_type', 'category', 'latitude', 'longitude', 'created_at')
    list_filter = ('landmark_type', 'category', 'created_at')
    search_fields = ('name', 'category', 'description')
    readonly_fields = ('osm_id', 'osm_tags', 'created_at')
