from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CityViewSet, RegionViewSet, HotelViewSet, landmarks_nearby, fetch_landmarks_bbox, all_pois_nearby

router = DefaultRouter()
router.register(r'cities', CityViewSet)
router.register(r'regions', RegionViewSet)
router.register(r'hotels', HotelViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('landmarks/nearby/', landmarks_nearby, name='landmarks-nearby'),
    path('landmarks/fetch/', fetch_landmarks_bbox, name='fetch-landmarks'),
    path('overpass/all/', all_pois_nearby, name='all-pois-nearby'),
]

