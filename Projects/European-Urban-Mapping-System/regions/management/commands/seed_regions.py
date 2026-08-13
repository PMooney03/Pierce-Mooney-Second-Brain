"""
Management command to seed the database with region data
Creates basic country/state regions with bounding box polygons
"""
from django.core.management.base import BaseCommand
from regions.models import Region
from django.contrib.gis.geos import MultiPolygon, Polygon, Point


class Command(BaseCommand):
    help = 'Seed the database with basic region data (countries and states)'

    def handle(self, *args, **options):
        # Regions data with bounding box coordinates [min_lng, min_lat, max_lng, max_lat]
        # These are simplified bounding boxes for major regions
        regions_data = [
            # Ireland
            {
                "name": "Ireland",
                "country": "Ireland",
                "region_code": "IE",
                "region_type": "country",
                "bbox": [-10.5, 51.4, -5.9, 55.4],  # [min_lng, min_lat, max_lng, max_lat]
                "total_population": 5033000,
                "area_km2": 70273,
            },
            # United Kingdom
            {
                "name": "United Kingdom",
                "country": "United Kingdom",
                "region_code": "GB",
                "region_type": "country",
                "bbox": [-8.2, 49.8, 1.8, 60.9],
                "total_population": 67081000,
                "area_km2": 243610,
            },
            # France
            {
                "name": "France",
                "country": "France",
                "region_code": "FR",
                "region_type": "country",
                "bbox": [-5.1, 41.3, 9.6, 51.1],
                "total_population": 67897000,
                "area_km2": 643801,
            },
            # Germany
            {
                "name": "Germany",
                "country": "Germany",
                "region_code": "DE",
                "region_type": "country",
                "bbox": [5.9, 47.3, 15.0, 55.1],
                "total_population": 83200000,
                "area_km2": 357022,
            },
            # Spain
            {
                "name": "Spain",
                "country": "Spain",
                "region_code": "ES",
                "region_type": "country",
                "bbox": [-9.3, 35.2, 4.3, 43.8],
                "total_population": 47431000,
                "area_km2": 505990,
            },
            # Italy
            {
                "name": "Italy",
                "country": "Italy",
                "region_code": "IT",
                "region_type": "country",
                "bbox": [6.6, 36.6, 18.5, 47.1],
                "total_population": 58850000,
                "area_km2": 301340,
            },
            # United States (simplified - just mainland)
            {
                "name": "United States",
                "country": "United States",
                "region_code": "US",
                "region_type": "country",
                "bbox": [-125.0, 24.5, -66.9, 49.4],
                "total_population": 331900000,
                "area_km2": 9833517,
            },
            # Canada (simplified)
            {
                "name": "Canada",
                "country": "Canada",
                "region_code": "CA",
                "region_type": "country",
                "bbox": [-141.0, 41.7, -52.6, 83.1],
                "total_population": 38246000,
                "area_km2": 9984670,
            },
            # Australia
            {
                "name": "Australia",
                "country": "Australia",
                "region_code": "AU",
                "region_type": "country",
                "bbox": [113.3, -43.6, 153.6, -10.7],
                "total_population": 25788000,
                "area_km2": 7692024,
            },
            # Brazil
            {
                "name": "Brazil",
                "country": "Brazil",
                "region_code": "BR",
                "region_type": "country",
                "bbox": [-73.9, -33.7, -28.8, 5.3],
                "total_population": 215300000,
                "area_km2": 8515770,
            },
            # India
            {
                "name": "India",
                "country": "India",
                "region_code": "IN",
                "region_type": "country",
                "bbox": [68.1, 6.8, 97.4, 35.7],
                "total_population": 1408000000,
                "area_km2": 3287263,
            },
            # China (simplified)
            {
                "name": "China",
                "country": "China",
                "region_code": "CN",
                "region_type": "country",
                "bbox": [73.5, 18.2, 135.0, 53.6],
                "total_population": 1412000000,
                "area_km2": 9596961,
            },
        ]
        
        created_count = 0
        skipped_count = 0
        
        for region_data in regions_data:
            # Create a simple bounding box polygon from the bbox coordinates
            min_lng, min_lat, max_lng, max_lat = region_data['bbox']
            
            # Create a rectangle polygon (bounding box)
            polygon = Polygon((
                (min_lng, min_lat),  # Bottom-left
                (max_lng, min_lat),  # Bottom-right
                (max_lng, max_lat),  # Top-right
                (min_lng, max_lat),  # Top-left
                (min_lng, min_lat),  # Close the polygon
            ), srid=4326)
            
            # Convert to MultiPolygon (required by the model)
            multipolygon = MultiPolygon(polygon, srid=4326)
            
            # Calculate centroid
            centroid = multipolygon.centroid
            
            region, created = Region.objects.get_or_create(
                region_code=region_data['region_code'],
                defaults={
                    'name': region_data['name'],
                    'country': region_data['country'],
                    'region_type': region_data['region_type'],
                    'geometry': multipolygon,
                    'centroid': centroid,
                    'area_km2': region_data['area_km2'],
                    'total_population': region_data['total_population'],
                    'population_year': 2023,
                    'data_source': 'Management command seed (bounding boxes)',
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Added {region_data["name"]}, {region_data["country"]}')
                )
            else:
                skipped_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully seeded {created_count} regions. {skipped_count} already existed.'
            )
        )
        self.stdout.write(f'Total regions in database: {Region.objects.count()}')

