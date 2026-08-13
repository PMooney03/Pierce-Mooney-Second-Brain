"""
Management command to seed the database with city data
"""
from django.core.management.base import BaseCommand
from cities.models import City
from django.contrib.gis.geos import Point

class Command(BaseCommand):
    help = 'Seed the database with city data from various regions'

    def handle(self, *args, **options):
        # Sample cities from various regions
        cities_data = [
            # European Capitals
            {"name": "Dublin", "country": "Ireland", "population": 592713, "latitude": 53.3498, "longitude": -6.2603, "city_type": "capital", "gdp_per_capita": 85000},
            {"name": "London", "country": "United Kingdom", "population": 9002488, "latitude": 51.5074, "longitude": -0.1278, "city_type": "capital", "gdp_per_capita": 55000},
            {"name": "Paris", "country": "France", "population": 2161000, "latitude": 48.8566, "longitude": 2.3522, "city_type": "capital", "gdp_per_capita": 50000},
            {"name": "Berlin", "country": "Germany", "population": 3669491, "latitude": 52.5200, "longitude": 13.4050, "city_type": "capital", "gdp_per_capita": 48000},
            {"name": "Madrid", "country": "Spain", "population": 3223334, "latitude": 40.4168, "longitude": -3.7038, "city_type": "capital", "gdp_per_capita": 35000},
            {"name": "Rome", "country": "Italy", "population": 2873000, "latitude": 41.9028, "longitude": 12.4964, "city_type": "capital", "gdp_per_capita": 38000},
            {"name": "Amsterdam", "country": "Netherlands", "population": 872680, "latitude": 52.3676, "longitude": 4.9041, "city_type": "capital", "gdp_per_capita": 52000},
            {"name": "Brussels", "country": "Belgium", "population": 1218255, "latitude": 50.8503, "longitude": 4.3517, "city_type": "capital", "gdp_per_capita": 48000},
            {"name": "Vienna", "country": "Austria", "population": 1897491, "latitude": 48.2082, "longitude": 16.3738, "city_type": "capital", "gdp_per_capita": 50000},
            {"name": "Stockholm", "country": "Sweden", "population": 975551, "latitude": 59.3293, "longitude": 18.0686, "city_type": "capital", "gdp_per_capita": 55000},
            
            # American Cities
            {"name": "New York", "country": "United States", "population": 8336817, "latitude": 40.7128, "longitude": -74.0060, "city_type": "major", "gdp_per_capita": 75000},
            {"name": "Los Angeles", "country": "United States", "population": 3971883, "latitude": 34.0522, "longitude": -118.2437, "city_type": "major", "gdp_per_capita": 65000},
            {"name": "Chicago", "country": "United States", "population": 2693976, "latitude": 41.8781, "longitude": -87.6298, "city_type": "major", "gdp_per_capita": 60000},
            {"name": "Toronto", "country": "Canada", "population": 2930000, "latitude": 43.6532, "longitude": -79.3832, "city_type": "major", "gdp_per_capita": 52000},
            {"name": "Mexico City", "country": "Mexico", "population": 9209944, "latitude": 19.4326, "longitude": -99.1332, "city_type": "capital", "gdp_per_capita": 18000},
            
            # Middle East
            {"name": "Dubai", "country": "United Arab Emirates", "population": 3400000, "latitude": 25.2048, "longitude": 55.2708, "city_type": "major", "gdp_per_capita": 45000},
            {"name": "Riyadh", "country": "Saudi Arabia", "population": 7700000, "latitude": 24.7136, "longitude": 46.6753, "city_type": "capital", "gdp_per_capita": 25000},
            {"name": "Tel Aviv", "country": "Israel", "population": 460613, "latitude": 32.0853, "longitude": 34.7818, "city_type": "major", "gdp_per_capita": 42000},
            
            # Africa
            {"name": "Cairo", "country": "Egypt", "population": 10230350, "latitude": 30.0444, "longitude": 31.2357, "city_type": "capital", "gdp_per_capita": 4000},
            {"name": "Lagos", "country": "Nigeria", "population": 15388000, "latitude": 6.5244, "longitude": 3.3792, "city_type": "major", "gdp_per_capita": 2500},
            {"name": "Johannesburg", "country": "South Africa", "population": 5634800, "latitude": -26.2041, "longitude": 28.0473, "city_type": "major", "gdp_per_capita": 7000},
            {"name": "Nairobi", "country": "Kenya", "population": 5545000, "latitude": -1.2921, "longitude": 36.8219, "city_type": "capital", "gdp_per_capita": 2000},
            {"name": "Niamey", "country": "Niger", "population": 1296000, "latitude": 13.5137, "longitude": 2.1098, "city_type": "capital", "gdp_per_capita": 500},
        ]
        
        created_count = 0
        skipped_count = 0
        
        for city_data in cities_data:
            city, created = City.objects.get_or_create(
                name=city_data['name'],
                country=city_data['country'],
                defaults={
                    'population': city_data['population'],
                    'latitude': city_data['latitude'],
                    'longitude': city_data['longitude'],
                    'city_type': city_data['city_type'],
                    'gdp_per_capita': city_data.get('gdp_per_capita'),
                    'population_year': 2023,
                    'data_source': 'Management command seed',
                    'location': Point(city_data['longitude'], city_data['latitude'], srid=4326)
                }
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Added {city_data["name"]}, {city_data["country"]}')
                )
            else:
                skipped_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully seeded {created_count} cities. {skipped_count} already existed.'
            )
        )
        self.stdout.write(f'Total cities in database: {City.objects.count()}')

