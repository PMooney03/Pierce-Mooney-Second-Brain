from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Load all seed data from data/*.json (cities, regions, hotels)'

    def handle(self, *args, **options):
        call_command('seed_cities')
        call_command('seed_regions')
        call_command('seed_hotels')
        self.stdout.write(self.style.SUCCESS('Database seed complete.'))
