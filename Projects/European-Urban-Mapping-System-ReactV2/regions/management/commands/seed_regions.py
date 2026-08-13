"""
Management command to seed region data from data/regions.json
"""
from django.contrib.gis.geos import MultiPolygon, Polygon
from django.core.management.base import BaseCommand

from european_mapping.seed_data import load_seed_json
from regions.models import Region


class Command(BaseCommand):
    help = 'Seed the database with region data from data/regions.json'

    def handle(self, *args, **options):
        regions_data = load_seed_json('regions.json')
        created_count = 0
        skipped_count = 0

        for region_data in regions_data:
            min_lng, min_lat, max_lng, max_lat = region_data['bbox']
            polygon = Polygon(
                (
                    (min_lng, min_lat),
                    (max_lng, min_lat),
                    (max_lng, max_lat),
                    (min_lng, max_lat),
                    (min_lng, min_lat),
                ),
                srid=4326,
            )
            multipolygon = MultiPolygon(polygon, srid=4326)

            region, created = Region.objects.get_or_create(
                region_code=region_data['region_code'],
                defaults={
                    'name': region_data['name'],
                    'country': region_data['country'],
                    'region_type': region_data['region_type'],
                    'geometry': multipolygon,
                    'centroid': multipolygon.centroid,
                    'area_km2': region_data['area_km2'],
                    'total_population': region_data['total_population'],
                    'population_year': 2023,
                    'data_source': 'data/regions.json',
                },
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Added {region_data["name"]}, {region_data["country"]}'
                    )
                )
            else:
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded {created_count} regions ({skipped_count} already existed). '
                f'Total: {Region.objects.count()}'
            )
        )
