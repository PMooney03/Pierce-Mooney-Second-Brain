FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create staticfiles directory
RUN mkdir -p /app/staticfiles

EXPOSE 8000

# Railway sets PORT automatically - use shell form to expand variable
# Run migrations, seed database (idempotent - only adds missing cities/regions), collectstatic, then start gunicorn
CMD sh -c "python manage.py migrate --noinput && python manage.py seed_cities && python manage.py seed_regions && python manage.py collectstatic --noinput && gunicorn european_mapping.wsgi:application --bind 0.0.0.0:\${PORT:-8000} --workers 2"




