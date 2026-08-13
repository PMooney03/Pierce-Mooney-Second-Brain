"""
Management command to seed the database with city data from data/cities.json
"""
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point

from cities.models import City
from european_mapping.seed_data import load_seed_json


class Command(BaseCommand):
    help = 'Seed the database with city data from data/cities.json'

    def handle(self, *args, **options):
        cities_data = load_seed_json('cities.json')
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
                    'data_source': 'data/cities.json',
                    'location': Point(
                        city_data['longitude'],
                        city_data['latitude'],
                        srid=4326,
                    ),
                },
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Added {city_data["name"]}, {city_data["country"]}'
                    )
                )
            else:
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded {created_count} cities ({skipped_count} already existed). '
                f'Total: {City.objects.count()}'
            )
        )
