from django.contrib import admin
from django.contrib.gis import admin as gis_admin
from .models import Region


@admin.register(Region)
class RegionAdmin(gis_admin.GISModelAdmin):
    list_display = ['name', 'country', 'region_type', 'total_population', 'area_km2']
    list_filter = ['country', 'region_type']
    search_fields = ['name', 'country']
    ordering = ['name']
