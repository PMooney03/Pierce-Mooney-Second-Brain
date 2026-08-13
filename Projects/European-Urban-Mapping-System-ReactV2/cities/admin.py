from django.contrib import admin
from django.contrib.gis import admin as gis_admin
from .models import City


@admin.register(City)
class CityAdmin(gis_admin.GISModelAdmin):
    list_display = ['name', 'country', 'population', 'city_type', 'latitude', 'longitude']
    list_filter = ['country', 'city_type']
    search_fields = ['name', 'country']
    ordering = ['name']
