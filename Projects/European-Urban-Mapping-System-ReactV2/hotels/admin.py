from django.contrib import admin
from django.contrib.gis import admin as gis_admin
from .models import Hotel


@admin.register(Hotel)
class HotelAdmin(gis_admin.GISModelAdmin):
    list_display = ['name', 'city', 'star_rating', 'price_range', 'latitude', 'longitude']
    list_filter = ['star_rating', 'price_range', 'city__country']
    search_fields = ['name', 'city__name']
    ordering = ['city', 'name']




