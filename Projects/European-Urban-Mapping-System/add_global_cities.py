"""
Script to add cities from America, Middle East, and other regions to the database
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'european_mapping.settings')
django.setup()

from cities.models import City
from django.contrib.gis.geos import Point

# American cities (USA, Canada, Mexico, South America)
american_cities = [
    # USA Major Cities
    {"name": "New York", "country": "United States", "population": 8336817, "latitude": 40.7128, "longitude": -74.0060, "city_type": "major", "gdp_per_capita": 75000},
    {"name": "Los Angeles", "country": "United States", "population": 3971883, "latitude": 34.0522, "longitude": -118.2437, "city_type": "major", "gdp_per_capita": 65000},
    {"name": "Chicago", "country": "United States", "population": 2693976, "latitude": 41.8781, "longitude": -87.6298, "city_type": "major", "gdp_per_capita": 60000},
    {"name": "Houston", "country": "United States", "population": 2320268, "latitude": 29.7604, "longitude": -95.3698, "city_type": "major", "gdp_per_capita": 55000},
    {"name": "Phoenix", "country": "United States", "population": 1680992, "latitude": 33.4484, "longitude": -112.0740, "city_type": "major", "gdp_per_capita": 50000},
    {"name": "Philadelphia", "country": "United States", "population": 1584064, "latitude": 39.9526, "longitude": -75.1652, "city_type": "major", "gdp_per_capita": 58000},
    {"name": "San Antonio", "country": "United States", "population": 1547253, "latitude": 29.4241, "longitude": -98.4936, "city_type": "regional", "gdp_per_capita": 48000},
    {"name": "San Diego", "country": "United States", "population": 1423851, "latitude": 32.7157, "longitude": -117.1611, "city_type": "major", "gdp_per_capita": 62000},
    {"name": "Dallas", "country": "United States", "population": 1343573, "latitude": 32.7767, "longitude": -96.7970, "city_type": "major", "gdp_per_capita": 56000},
    {"name": "San Jose", "country": "United States", "population": 1021795, "latitude": 37.3382, "longitude": -121.8863, "city_type": "regional", "gdp_per_capita": 85000},
    {"name": "Washington", "country": "United States", "population": 705749, "latitude": 38.9072, "longitude": -77.0369, "city_type": "capital", "gdp_per_capita": 78000},
    
    # Canada
    {"name": "Toronto", "country": "Canada", "population": 2930000, "latitude": 43.6532, "longitude": -79.3832, "city_type": "major", "gdp_per_capita": 52000},
    {"name": "Montreal", "country": "Canada", "population": 1780000, "latitude": 45.5017, "longitude": -73.5673, "city_type": "major", "gdp_per_capita": 48000},
    {"name": "Vancouver", "country": "Canada", "population": 675218, "latitude": 49.2827, "longitude": -123.1207, "city_type": "major", "gdp_per_capita": 55000},
    {"name": "Ottawa", "country": "Canada", "population": 1017449, "latitude": 45.4215, "longitude": -75.6972, "city_type": "capital", "gdp_per_capita": 50000},
    {"name": "Calgary", "country": "Canada", "population": 1306784, "latitude": 51.0447, "longitude": -114.0719, "city_type": "regional", "gdp_per_capita": 58000},
    
    # Mexico
    {"name": "Mexico City", "country": "Mexico", "population": 9209944, "latitude": 19.4326, "longitude": -99.1332, "city_type": "capital", "gdp_per_capita": 18000},
    {"name": "Guadalajara", "country": "Mexico", "population": 1495182, "latitude": 20.6597, "longitude": -103.3496, "city_type": "major", "gdp_per_capita": 15000},
    {"name": "Monterrey", "country": "Mexico", "population": 1135512, "latitude": 25.6866, "longitude": -100.3161, "city_type": "major", "gdp_per_capita": 20000},
    
    # South America
    {"name": "São Paulo", "country": "Brazil", "population": 12325232, "latitude": -23.5505, "longitude": -46.6333, "city_type": "major", "gdp_per_capita": 12000},
    {"name": "Rio de Janeiro", "country": "Brazil", "population": 6747815, "latitude": -22.9068, "longitude": -43.1729, "city_type": "major", "gdp_per_capita": 11000},
    {"name": "Brasília", "country": "Brazil", "population": 3055149, "latitude": -15.7942, "longitude": -47.8822, "city_type": "capital", "gdp_per_capita": 15000},
    {"name": "Buenos Aires", "country": "Argentina", "population": 3075646, "latitude": -34.6118, "longitude": -58.3960, "city_type": "capital", "gdp_per_capita": 14000},
    {"name": "Lima", "country": "Peru", "population": 9759046, "latitude": -12.0464, "longitude": -77.0428, "city_type": "capital", "gdp_per_capita": 8000},
    {"name": "Bogotá", "country": "Colombia", "population": 7743955, "latitude": 4.7110, "longitude": -74.0721, "city_type": "capital", "gdp_per_capita": 7000},
    {"name": "Santiago", "country": "Chile", "population": 6310000, "latitude": -33.4489, "longitude": -70.6693, "city_type": "capital", "gdp_per_capita": 16000},
]

# Middle Eastern cities
middle_east_cities = [
    # UAE
    {"name": "Dubai", "country": "United Arab Emirates", "population": 3400000, "latitude": 25.2048, "longitude": 55.2708, "city_type": "major", "gdp_per_capita": 45000},
    {"name": "Abu Dhabi", "country": "United Arab Emirates", "population": 1450000, "latitude": 24.4539, "longitude": 54.3773, "city_type": "capital", "gdp_per_capita": 50000},
    {"name": "Sharjah", "country": "United Arab Emirates", "population": 1800000, "latitude": 25.3573, "longitude": 55.4033, "city_type": "regional", "gdp_per_capita": 40000},
    
    # Saudi Arabia
    {"name": "Riyadh", "country": "Saudi Arabia", "population": 7700000, "latitude": 24.7136, "longitude": 46.6753, "city_type": "capital", "gdp_per_capita": 25000},
    {"name": "Jeddah", "country": "Saudi Arabia", "population": 4700000, "latitude": 21.4858, "longitude": 39.1925, "city_type": "major", "gdp_per_capita": 22000},
    {"name": "Mecca", "country": "Saudi Arabia", "population": 2400000, "latitude": 21.3891, "longitude": 39.8579, "city_type": "major", "gdp_per_capita": 20000},
    {"name": "Medina", "country": "Saudi Arabia", "population": 1500000, "latitude": 24.5247, "longitude": 39.5692, "city_type": "regional", "gdp_per_capita": 18000},
    
    # Israel
    {"name": "Jerusalem", "country": "Israel", "population": 936425, "latitude": 31.7683, "longitude": 35.2137, "city_type": "capital", "gdp_per_capita": 35000},
    {"name": "Tel Aviv", "country": "Israel", "population": 460613, "latitude": 32.0853, "longitude": 34.7818, "city_type": "major", "gdp_per_capita": 42000},
    {"name": "Haifa", "country": "Israel", "population": 285316, "latitude": 32.7940, "longitude": 34.9896, "city_type": "regional", "gdp_per_capita": 38000},
    
    # Turkey (partially in Middle East)
    {"name": "Istanbul", "country": "Turkey", "population": 15519267, "latitude": 41.0082, "longitude": 28.9784, "city_type": "major", "gdp_per_capita": 15000},
    {"name": "Ankara", "country": "Turkey", "population": 5663322, "latitude": 39.9334, "longitude": 32.8597, "city_type": "capital", "gdp_per_capita": 14000},
    
    # Egypt
    {"name": "Cairo", "country": "Egypt", "population": 10230350, "latitude": 30.0444, "longitude": 31.2357, "city_type": "capital", "gdp_per_capita": 4000},
    {"name": "Alexandria", "country": "Egypt", "population": 5200000, "latitude": 31.2001, "longitude": 29.9187, "city_type": "major", "gdp_per_capita": 3500},
    
    # Iran
    {"name": "Tehran", "country": "Iran", "population": 8693706, "latitude": 35.6892, "longitude": 51.3890, "city_type": "capital", "gdp_per_capita": 5000},
    {"name": "Isfahan", "country": "Iran", "population": 1961260, "latitude": 32.6546, "longitude": 51.6680, "city_type": "major", "gdp_per_capita": 4500},
    
    # Iraq
    {"name": "Baghdad", "country": "Iraq", "population": 8160400, "latitude": 33.3152, "longitude": 44.3661, "city_type": "capital", "gdp_per_capita": 6000},
    {"name": "Basra", "country": "Iraq", "population": 2600000, "latitude": 30.5081, "longitude": 47.7804, "city_type": "major", "gdp_per_capita": 5500},
    
    # Jordan
    {"name": "Amman", "country": "Jordan", "population": 4007526, "latitude": 31.9539, "longitude": 35.9106, "city_type": "capital", "gdp_per_capita": 4500},
    
    # Lebanon
    {"name": "Beirut", "country": "Lebanon", "population": 2400000, "latitude": 33.8938, "longitude": 35.5018, "city_type": "capital", "gdp_per_capita": 8000},
    
    # Qatar
    {"name": "Doha", "country": "Qatar", "population": 956457, "latitude": 25.2854, "longitude": 51.5310, "city_type": "capital", "gdp_per_capita": 70000},
    
    # Kuwait
    {"name": "Kuwait City", "country": "Kuwait", "population": 3000000, "latitude": 29.3759, "longitude": 47.9774, "city_type": "capital", "gdp_per_capita": 35000},
    
    # Oman
    {"name": "Muscat", "country": "Oman", "population": 1421409, "latitude": 23.5859, "longitude": 58.4059, "city_type": "capital", "gdp_per_capita": 20000},
]

# Irish cities
irish_cities = [
    {"name": "Dublin", "country": "Ireland", "population": 592713, "latitude": 53.3498, "longitude": -6.2603, "city_type": "capital", "gdp_per_capita": 85000},
    {"name": "Cork", "country": "Ireland", "population": 222333, "latitude": 51.8985, "longitude": -8.4756, "city_type": "major", "gdp_per_capita": 45000},
    {"name": "Limerick", "country": "Ireland", "population": 102287, "latitude": 52.6638, "longitude": -8.6267, "city_type": "regional", "gdp_per_capita": 40000},
    {"name": "Galway", "country": "Ireland", "population": 83552, "latitude": 53.2707, "longitude": -9.0568, "city_type": "regional", "gdp_per_capita": 42000},
    {"name": "Waterford", "country": "Ireland", "population": 53504, "latitude": 52.2593, "longitude": -7.1101, "city_type": "regional", "gdp_per_capita": 38000},
    {"name": "Drogheda", "country": "Ireland", "population": 41020, "latitude": 53.7179, "longitude": -6.3478, "city_type": "town", "gdp_per_capita": 35000},
    {"name": "Dundalk", "country": "Ireland", "population": 39404, "latitude": 54.0060, "longitude": -6.4033, "city_type": "town", "gdp_per_capita": 34000},
    {"name": "Swords", "country": "Ireland", "population": 40504, "latitude": 53.4597, "longitude": -6.2181, "city_type": "town", "gdp_per_capita": 50000},
    {"name": "Bray", "country": "Ireland", "population": 32995, "latitude": 53.2028, "longitude": -6.0983, "city_type": "town", "gdp_per_capita": 45000},
    {"name": "Navan", "country": "Ireland", "population": 30973, "latitude": 53.6528, "longitude": -6.6814, "city_type": "town", "gdp_per_capita": 36000},
    {"name": "Ennis", "country": "Ireland", "population": 25612, "latitude": 52.8436, "longitude": -8.9864, "city_type": "town", "gdp_per_capita": 33000},
    {"name": "Kilkenny", "country": "Ireland", "population": 26512, "latitude": 52.6541, "longitude": -7.2522, "city_type": "town", "gdp_per_capita": 37000},
    {"name": "Carlow", "country": "Ireland", "population": 24581, "latitude": 52.8369, "longitude": -6.9264, "city_type": "town", "gdp_per_capita": 35000},
    {"name": "Tralee", "country": "Ireland", "population": 23891, "latitude": 52.2700, "longitude": -9.7026, "city_type": "town", "gdp_per_capita": 32000},
    {"name": "Newbridge", "country": "Ireland", "population": 23154, "latitude": 53.1819, "longitude": -6.7967, "city_type": "town", "gdp_per_capita": 40000},
    {"name": "Naas", "country": "Ireland", "population": 22242, "latitude": 53.2158, "longitude": -6.6669, "city_type": "town", "gdp_per_capita": 48000},
    {"name": "Athlone", "country": "Ireland", "population": 21935, "latitude": 53.4239, "longitude": -7.9406, "city_type": "town", "gdp_per_capita": 36000},
    {"name": "Portlaoise", "country": "Ireland", "population": 22150, "latitude": 53.0344, "longitude": -7.3000, "city_type": "town", "gdp_per_capita": 38000},
    {"name": "Mullingar", "country": "Ireland", "population": 20428, "latitude": 53.5244, "longitude": -7.3383, "city_type": "town", "gdp_per_capita": 35000},
    {"name": "Wexford", "country": "Ireland", "population": 20472, "latitude": 52.3369, "longitude": -6.4633, "city_type": "town", "gdp_per_capita": 34000},
    {"name": "Sligo", "country": "Ireland", "population": 19999, "latitude": 54.2761, "longitude": -8.4764, "city_type": "town", "gdp_per_capita": 33000},
    {"name": "Clonmel", "country": "Ireland", "population": 17908, "latitude": 52.3547, "longitude": -7.7031, "city_type": "town", "gdp_per_capita": 36000},
    {"name": "Tullamore", "country": "Ireland", "population": 14737, "latitude": 53.2739, "longitude": -7.4889, "city_type": "town", "gdp_per_capita": 35000},
    {"name": "Killarney", "country": "Ireland", "population": 14504, "latitude": 52.0594, "longitude": -9.5081, "city_type": "town", "gdp_per_capita": 40000},
    {"name": "Arklow", "country": "Ireland", "population": 14259, "latitude": 52.7944, "longitude": -6.1614, "city_type": "town", "gdp_per_capita": 32000},
]

# African cities
african_cities = [
    # Nigeria
    {"name": "Lagos", "country": "Nigeria", "population": 15388000, "latitude": 6.5244, "longitude": 3.3792, "city_type": "major", "gdp_per_capita": 2500},
    {"name": "Kano", "country": "Nigeria", "population": 4180000, "latitude": 12.0022, "longitude": 8.5920, "city_type": "major", "gdp_per_capita": 2000},
    {"name": "Ibadan", "country": "Nigeria", "population": 3560000, "latitude": 7.3775, "longitude": 3.9470, "city_type": "major", "gdp_per_capita": 2200},
    {"name": "Abuja", "country": "Nigeria", "population": 1235880, "latitude": 9.0765, "longitude": 7.3986, "city_type": "capital", "gdp_per_capita": 3000},
    {"name": "Port Harcourt", "country": "Nigeria", "population": 1865000, "latitude": 4.8156, "longitude": 7.0498, "city_type": "regional", "gdp_per_capita": 2500},
    {"name": "Benin City", "country": "Nigeria", "population": 1495000, "latitude": 6.3350, "longitude": 5.6037, "city_type": "regional", "gdp_per_capita": 2000},
    {"name": "Kaduna", "country": "Nigeria", "population": 1640000, "latitude": 10.5105, "longitude": 7.4165, "city_type": "regional", "gdp_per_capita": 2100},
    
    # South Africa
    {"name": "Johannesburg", "country": "South Africa", "population": 5634800, "latitude": -26.2041, "longitude": 28.0473, "city_type": "major", "gdp_per_capita": 7000},
    {"name": "Cape Town", "country": "South Africa", "population": 4618000, "latitude": -33.9249, "longitude": 18.4241, "city_type": "major", "gdp_per_capita": 8000},
    {"name": "Durban", "country": "South Africa", "population": 3442361, "latitude": -29.8587, "longitude": 31.0218, "city_type": "major", "gdp_per_capita": 6500},
    {"name": "Pretoria", "country": "South Africa", "population": 2921488, "latitude": -25.7479, "longitude": 28.2293, "city_type": "capital", "gdp_per_capita": 7500},
    {"name": "Port Elizabeth", "country": "South Africa", "population": 1152115, "latitude": -33.9608, "longitude": 25.6022, "city_type": "regional", "gdp_per_capita": 6000},
    {"name": "Bloemfontein", "country": "South Africa", "population": 556000, "latitude": -29.0852, "longitude": 26.1596, "city_type": "regional", "gdp_per_capita": 5500},
    
    # Niger
    {"name": "Niamey", "country": "Niger", "population": 1296000, "latitude": 13.5137, "longitude": 2.1098, "city_type": "capital", "gdp_per_capita": 500},
    {"name": "Zinder", "country": "Niger", "population": 322935, "latitude": 13.8017, "longitude": 8.9881, "city_type": "regional", "gdp_per_capita": 450},
    {"name": "Maradi", "country": "Niger", "population": 267249, "latitude": 13.4833, "longitude": 7.1000, "city_type": "town", "gdp_per_capita": 400},
    
    # Kenya
    {"name": "Nairobi", "country": "Kenya", "population": 5545000, "latitude": -1.2921, "longitude": 36.8219, "city_type": "capital", "gdp_per_capita": 2000},
    {"name": "Mombasa", "country": "Kenya", "population": 1200000, "latitude": -4.0435, "longitude": 39.6682, "city_type": "major", "gdp_per_capita": 1800},
    {"name": "Kisumu", "country": "Kenya", "population": 409928, "latitude": -0.0917, "longitude": 34.7680, "city_type": "regional", "gdp_per_capita": 1500},
    
    # Egypt (already added, but adding more)
    {"name": "Giza", "country": "Egypt", "population": 3240000, "latitude": 30.0131, "longitude": 31.2089, "city_type": "major", "gdp_per_capita": 4000},
    
    # Ethiopia
    {"name": "Addis Ababa", "country": "Ethiopia", "population": 3385000, "latitude": 9.1450, "longitude": 38.7617, "city_type": "capital", "gdp_per_capita": 900},
    {"name": "Dire Dawa", "country": "Ethiopia", "population": 493000, "latitude": 9.6009, "longitude": 41.8501, "city_type": "regional", "gdp_per_capita": 800},
    
    # Ghana
    {"name": "Accra", "country": "Ghana", "population": 2388000, "latitude": 5.6037, "longitude": -0.1870, "city_type": "capital", "gdp_per_capita": 2200},
    {"name": "Kumasi", "country": "Ghana", "population": 2069350, "latitude": 6.6885, "longitude": -1.6244, "city_type": "major", "gdp_per_capita": 2000},
    
    # Tanzania
    {"name": "Dar es Salaam", "country": "Tanzania", "population": 6096000, "latitude": -6.7924, "longitude": 39.2083, "city_type": "major", "gdp_per_capita": 1200},
    {"name": "Dodoma", "country": "Tanzania", "population": 410956, "latitude": -6.1630, "longitude": 35.7516, "city_type": "capital", "gdp_per_capita": 1100},
    
    # Uganda
    {"name": "Kampala", "country": "Uganda", "population": 1680000, "latitude": 0.3476, "longitude": 32.5825, "city_type": "capital", "gdp_per_capita": 800},
    
    # Morocco
    {"name": "Casablanca", "country": "Morocco", "population": 3359818, "latitude": 33.5731, "longitude": -7.5898, "city_type": "major", "gdp_per_capita": 3500},
    {"name": "Rabat", "country": "Morocco", "population": 577827, "latitude": 34.0209, "longitude": -6.8416, "city_type": "capital", "gdp_per_capita": 4000},
    {"name": "Marrakech", "country": "Morocco", "population": 928850, "latitude": 31.6295, "longitude": -7.9811, "city_type": "major", "gdp_per_capita": 3000},
    
    # Algeria
    {"name": "Algiers", "country": "Algeria", "population": 3415811, "latitude": 36.7538, "longitude": 3.0588, "city_type": "capital", "gdp_per_capita": 4000},
    {"name": "Oran", "country": "Algeria", "population": 1600000, "latitude": 35.6971, "longitude": -0.6337, "city_type": "major", "gdp_per_capita": 3500},
    
    # Tunisia
    {"name": "Tunis", "country": "Tunisia", "population": 1056247, "latitude": 36.8065, "longitude": 10.1815, "city_type": "capital", "gdp_per_capita": 3500},
    
    # Senegal
    {"name": "Dakar", "country": "Senegal", "population": 1438725, "latitude": 14.7167, "longitude": -17.4677, "city_type": "capital", "gdp_per_capita": 1500},
    
    # Ivory Coast
    {"name": "Abidjan", "country": "Ivory Coast", "population": 4765000, "latitude": 5.3600, "longitude": -4.0083, "city_type": "major", "gdp_per_capita": 1800},
    {"name": "Yamoussoukro", "country": "Ivory Coast", "population": 355573, "latitude": 6.8276, "longitude": -5.2893, "city_type": "capital", "gdp_per_capita": 1600},
    
    # Cameroon
    {"name": "Douala", "country": "Cameroon", "population": 2768000, "latitude": 4.0511, "longitude": 9.7679, "city_type": "major", "gdp_per_capita": 1500},
    {"name": "Yaoundé", "country": "Cameroon", "population": 3520000, "latitude": 3.8480, "longitude": 11.5021, "city_type": "capital", "gdp_per_capita": 1600},
    
    # Democratic Republic of Congo
    {"name": "Kinshasa", "country": "Democratic Republic of Congo", "population": 17071000, "latitude": -4.4419, "longitude": 15.2663, "city_type": "capital", "gdp_per_capita": 600},
    {"name": "Lubumbashi", "country": "Democratic Republic of Congo", "population": 1786000, "latitude": -11.6642, "longitude": 27.4826, "city_type": "major", "gdp_per_capita": 550},
    
    # Angola
    {"name": "Luanda", "country": "Angola", "population": 8417000, "latitude": -8.8383, "longitude": 13.2344, "city_type": "capital", "gdp_per_capita": 3500},
    
    # Sudan
    {"name": "Khartoum", "country": "Sudan", "population": 5274321, "latitude": 15.5007, "longitude": 32.5599, "city_type": "capital", "gdp_per_capita": 800},
    
    # Mozambique
    {"name": "Maputo", "country": "Mozambique", "population": 1191613, "latitude": -25.9692, "longitude": 32.5732, "city_type": "capital", "gdp_per_capita": 500},
    
    # Zimbabwe
    {"name": "Harare", "country": "Zimbabwe", "population": 1485231, "latitude": -17.8292, "longitude": 31.0522, "city_type": "capital", "gdp_per_capita": 1200},
    
    # Zambia
    {"name": "Lusaka", "country": "Zambia", "population": 2467563, "latitude": -15.3875, "longitude": 28.3228, "city_type": "capital", "gdp_per_capita": 1300},
]

# Combine all cities
all_cities = american_cities + middle_east_cities + irish_cities + african_cities

def add_cities():
    """Add cities to the database"""
    added = 0
    skipped = 0
    
    for city_data in all_cities:
        # Check if city already exists
        if City.objects.filter(name=city_data['name'], country=city_data['country']).exists():
            print(f"Skipping {city_data['name']}, {city_data['country']} (already exists)")
            skipped += 1
            continue
        
        # Create city
        city = City(
            name=city_data['name'],
            country=city_data['country'],
            population=city_data['population'],
            latitude=city_data['latitude'],
            longitude=city_data['longitude'],
            city_type=city_data['city_type'],
            gdp_per_capita=city_data.get('gdp_per_capita'),
            population_year=2023,
            data_source='Manual entry'
        )
        city.save()
        print(f"Added {city_data['name']}, {city_data['country']} (Population: {city_data['population']:,})")
        added += 1
    
    print(f"\nSummary:")
    print(f"   Added: {added} cities")
    print(f"   Skipped: {skipped} cities (already exist)")
    print(f"   Total cities in database: {City.objects.count()}")

if __name__ == '__main__':
    print("Adding cities from America, Middle East, and Africa...\n")
    add_cities()

