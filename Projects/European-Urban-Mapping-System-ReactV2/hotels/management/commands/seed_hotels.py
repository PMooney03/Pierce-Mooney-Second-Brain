"""
Seed hotels from data/hotels.json (run seed_cities first).
"""
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand

from cities.models import City
from european_mapping.seed_data import load_seed_json
from hotels.models import Hotel


class Command(BaseCommand):
    help = 'Seed hotels from data/hotels.json'

    def handle(self, *args, **options):
        hotels_data = load_seed_json('hotels.json')
        created_count = 0
        skipped_count = 0
        missing_cities = 0

        for hotel_data in hotels_data:
            city = City.objects.filter(
                name=hotel_data['city_name'],
                country=hotel_data['city_country'],
            ).first()
            if not city:
                missing_cities += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipped {hotel_data["name"]}: city '
                        f'{hotel_data["city_name"]} not found (run seed_cities first)'
                    )
                )
                continue

            hotel, created = Hotel.objects.get_or_create(
                name=hotel_data['name'],
                city=city,
                defaults={
                    'latitude': hotel_data['latitude'],
                    'longitude': hotel_data['longitude'],
                    'location': Point(
                        hotel_data['longitude'],
                        hotel_data['latitude'],
                        srid=4326,
                    ),
                    'star_rating': hotel_data['star_rating'],
                    'price_range': hotel_data['price_range'],
                    'amenities': hotel_data.get('amenities', ''),
                },
            )
            if created:
                created_count += 1
            else:
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded {created_count} hotels ({skipped_count} already existed). '
                f'Total: {Hotel.objects.count()}'
            )
        )
        if missing_cities:
            self.stdout.write(
                self.style.WARNING(f'{missing_cities} hotels skipped (city missing).')
            )
