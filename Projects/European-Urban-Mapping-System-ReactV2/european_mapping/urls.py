from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]

if getattr(settings, 'USE_REACT_FRONTEND', False):
    from dashboard.spa_views import serve_spa

    urlpatterns.append(re_path(r'^(?P<path>.*)$', serve_spa, name='spa'))
