from django.contrib.gis.db import models
from cities.models import City


class Hotel(models.Model):
    STAR_CHOICES = [
        (1, '1 Star'),
        (2, '2 Stars'),
        (3, '3 Stars'),
        (4, '4 Stars'),
        (5, '5 Stars'),
    ]
    
    PRICE_CHOICES = [
        ('budget', '€ Budget'),
        ('moderate', '€€ Moderate'),
        ('luxury', '€€€ Luxury'),
    ]

    name = models.CharField(max_length=200)
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='hotels')
    latitude = models.FloatField()
    longitude = models.FloatField()
    location = models.PointField(srid=4326)
    star_rating = models.IntegerField(choices=STAR_CHOICES)
    price_range = models.CharField(max_length=20, choices=PRICE_CHOICES)
    amenities = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.latitude is not None and self.longitude is not None:
            from django.contrib.gis.geos import Point
            self.location = Point(float(self.longitude), float(self.latitude), srid=4326)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.star_rating}★) - {self.city.name}"

    class Meta:
        db_table = 'hotels_hotel'
        indexes = [
            models.Index(fields=['city']),
            models.Index(fields=['star_rating']),
            models.Index(fields=['price_range']),
        ]




