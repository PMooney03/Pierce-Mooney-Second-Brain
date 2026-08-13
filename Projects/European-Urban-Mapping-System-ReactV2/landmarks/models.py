from django.contrib.gis.db import models
from django.contrib.gis.geos import Point


class Landmark(models.Model):
    """Landmarks/POIs from OpenStreetMap"""
    
    LANDMARK_TYPES = [
        ('tourism', 'Tourism'),
        ('historic', 'Historic'),
        ('amenity', 'Amenity'),
        ('leisure', 'Leisure'),
        ('shop', 'Shop'),
        ('restaurant', 'Restaurant'),
    ]
    
    name = models.CharField(max_length=200)
    osm_id = models.BigIntegerField(unique=True, null=True, blank=True)
    landmark_type = models.CharField(max_length=50, choices=LANDMARK_TYPES)
    category = models.CharField(max_length=100)  # e.g., "monument", "museum", "restaurant"
    location = models.PointField(srid=4326)
    latitude = models.FloatField()
    longitude = models.FloatField()
    description = models.TextField(blank=True)
    osm_tags = models.JSONField(default=dict, blank=True)  # Store raw OSM tags
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        if self.latitude and self.longitude:
            self.location = Point(float(self.longitude), float(self.latitude), srid=4326)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.name} ({self.category})"
    
    class Meta:
        db_table = 'landmarks_landmark'
        indexes = [
            models.Index(fields=['landmark_type']),
            models.Index(fields=['category']),
            # Spatial index on location is automatically created by PostGIS
        ]
