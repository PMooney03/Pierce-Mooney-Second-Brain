from django.shortcuts import render
from cities.models import City
from regions.models import Region


def index(request):
    context = {
        'total_cities': City.objects.count(),
        'total_regions': Region.objects.count(),
    }
    return render(request, 'dashboard/index.html', context)
