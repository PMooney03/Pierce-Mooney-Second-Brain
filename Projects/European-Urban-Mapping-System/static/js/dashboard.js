// Constants
const MAX_MARKERS_PER_CATEGORY = 200;
const MAX_TOTAL_POIS = 500;

// Map initialization
let map = L.map('map').setView([20.0, 0.0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Marker arrays
let markers = [];
let hotelMarkers = [];
let landmarkMarkers = [];
let allPoiMarkers = [];
let proximityCityMarkers = [];
let proximityHotelMarkers = [];
let proximityPoiMarkers = [];
let searchMarker = null;
let searchCircle = null;
let mapClickEnabled = false;
let regionLayers = [];
let regionsVisible = false; // Regions hidden by default
let regionDataMap = {}; // Store region data for quick lookup by region_code

// Clustering
let cityCluster = null;
let hotelCluster = null;
let landmarkCluster = null;
let allPoiCluster = null;
let poiCluster = null;

// Data storage
let proximityPoiData = [];
let landmarkData = [];
let allPoiData = [];

// Feature toggle state
let activeFeatures = {
    filter: true,
    proximity: false,
    regions: false,
    hotels: false,
    landmarks: false,
    allpois: false,
    stats: false
};

// Toggle feature panels
function toggleFeature(featureName) {
    const tab = document.getElementById(featureName + '-tab');
    const btn = document.getElementById('toggle-' + featureName);
    
    if (!tab || !btn) return;
    
    // Toggle active state
    activeFeatures[featureName] = !activeFeatures[featureName];
    
    if (activeFeatures[featureName]) {
        tab.classList.add('active');
        btn.classList.add('active');
        btn.querySelector('.toggle-icon').textContent = '✓';
    } else {
        tab.classList.remove('active');
        btn.classList.remove('active');
        btn.querySelector('.toggle-icon').textContent = '';
    }
}

// Clear all markers
function clearMarkers() {
    markers.forEach(marker => {
        if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    markers = [];
    updateStats();
}

// Update statistics
function updateStats() {
    const cityCount = markers.length + proximityCityMarkers.length;
    const landmarkCount = landmarkMarkers.length;
    const allPoiCount = allPoiMarkers.length + proximityPoiMarkers.length;
    
    const statVisible = document.getElementById('stat-visible');
    const statLandmarks = document.getElementById('stat-landmarks');
    const statAllpois = document.getElementById('stat-allpois');
    
    if (statVisible) statVisible.textContent = cityCount;
    if (statLandmarks) statLandmarks.textContent = landmarkCount;
    if (statAllpois) statAllpois.textContent = allPoiCount;
}

// Load cities with filters
function loadCities() {
    const popMin = document.getElementById('pop-min').value;
    const popMax = document.getElementById('pop-max').value;
    const country = document.getElementById('country').value;
    const cityType = document.getElementById('city-type').value;

    let url = '/api/cities/?';
    if (popMin) url += `population_min=${popMin}&`;
    if (popMax) url += `population_max=${popMax}&`;
    if (country) url += `country=${encodeURIComponent(country)}&`;
    if (cityType) url += `city_type=${cityType}&`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            clearMarkers();
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const [lng, lat] = feature.geometry.coordinates;
                    const props = feature.properties;
                    const marker = L.marker([lat, lng]).addTo(map);
                    marker.bindPopup(`
                        <strong>${props.name}</strong><br>
                        ${props.country}<br>
                        Population: ${props.population?.toLocaleString() || 'N/A'}<br>
                        Type: ${props.city_type || 'N/A'}<br>
                        GDP per capita: €${props.gdp_per_capita?.toLocaleString() || 'N/A'}
                    `);
                    markers.push(marker);
                }
            });
            updateStats();
        })
        .catch(error => console.error('Error:', error));
}

// Quick search cities
function quickSearchCities() {
    const query = document.getElementById('quick-search').value.trim();
    if (!query) {
        alert('Please enter a city or country name');
        return;
    }

    // Map common search terms to database country names
    const countryAliases = {
        'america': 'United States',
        'usa': 'United States',
        'us': 'United States',
        'united states': 'United States',
        'united states of america': 'United States',
        'uk': 'United Kingdom',
        'united kingdom': 'United Kingdom',
        'england': 'United Kingdom',  // England is part of UK
        'britain': 'United Kingdom',
        'great britain': 'United Kingdom',
        'gb': 'United Kingdom',
    };
    
    const normalizedQuery = query.toLowerCase().trim();
    const searchCountry = countryAliases[normalizedQuery] || query;

    let url = '/api/cities/?';
    // Try as country first
    url += `country=${encodeURIComponent(searchCountry)}&`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                clearMarkers();
                data.features.forEach(feature => {
                    if (feature.geometry && feature.geometry.coordinates) {
                        const [lng, lat] = feature.geometry.coordinates;
                        const props = feature.properties;
                        const marker = L.marker([lat, lng]).addTo(map);
                        marker.bindPopup(`
                            <strong>${props.name}</strong><br>
                            ${props.country}<br>
                            Population: ${props.population?.toLocaleString() || 'N/A'}
                        `);
                        markers.push(marker);
                    }
                });
                if (markers.length > 0) {
                    const group = new L.featureGroup(markers);
                    map.fitBounds(group.getBounds().pad(0.1));
                }
                updateStats();
            } else {
                // Try as city name
                url = `/api/cities/?name=${encodeURIComponent(query)}&`;
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        if (data.features && data.features.length > 0) {
                            clearMarkers();
                            data.features.forEach(feature => {
                                if (feature.geometry && feature.geometry.coordinates) {
                                    const [lng, lat] = feature.geometry.coordinates;
                                    const props = feature.properties;
                                    const marker = L.marker([lat, lng]).addTo(map);
                                    marker.bindPopup(`
                                        <strong>${props.name}</strong><br>
                                        ${props.country}<br>
                                        Population: ${props.population?.toLocaleString() || 'N/A'}
                                    `);
                                    markers.push(marker);
                                }
                            });
                            if (markers.length > 0) {
                                const group = new L.featureGroup(markers);
                                map.fitBounds(group.getBounds().pad(0.1));
                            }
                            updateStats();
                        } else {
                            alert('No cities found matching "' + query + '"');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Error searching cities. Check console for details.');
                    });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error searching cities. Check console for details.');
        });
}

// Enable map click for location selection
function enableMapClick() {
    mapClickEnabled = !mapClickEnabled;
    const btn = document.getElementById('map-click-btn');
    const status = document.getElementById('click-status');
    
    if (mapClickEnabled) {
        map.getContainer().style.cursor = 'crosshair';
        btn.textContent = '❌ Disable Map Click Mode';
        btn.style.background = '#e74c3c';
        if (status) status.style.display = 'block';
    } else {
        map.getContainer().style.cursor = '';
        btn.textContent = '📍 Click Map to Set Location';
        btn.style.background = '#95a5a6';
        if (status) status.style.display = 'none';
    }
}

// Map click handler
map.on('click', function(e) {
    if (mapClickEnabled) {
        document.getElementById('search-lat').value = e.latlng.lat.toFixed(4);
        document.getElementById('search-lng').value = e.latlng.lng.toFixed(4);
        
        mapClickEnabled = false;
        map.getContainer().style.cursor = '';
        const btn = document.getElementById('map-click-btn');
        if (btn) {
            btn.textContent = '📍 Click Map to Set Location';
            btn.style.background = '#95a5a6';
        }
        const status = document.getElementById('click-status');
        if (status) status.style.display = 'none';
        
        if (searchMarker) map.removeLayer(searchMarker);
        if (searchCircle) map.removeLayer(searchCircle);
        
        searchMarker = L.marker(e.latlng, {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map);
        searchMarker.bindPopup('📍 Search Location<br>Click "Search Everything Nearby"').openPopup();
    }
});

// Get marker color for category
function getMarkerColorForCategory(category, type) {
    const colorMap = {
        'restaurant': 'red',
        'pub': 'orange',
        'bar': 'orange',
        'cafe': 'yellow',
        'fast_food': 'red',
        'fuel': 'grey',  // Petrol stations
        'hairdresser': 'violet',
        'pharmacy': 'green',
        'hospital': 'red',
        'clinic': 'green',
        'doctors': 'green',
        'supermarket': 'blue',
        'museum': 'purple',
        'hotel': 'gold',
        'shop': 'blue',
        'tourism': 'purple',
        'historic': 'purple',
        'leisure': 'green',
        'transport': 'grey',
        'amenity': 'green'
    };
    return colorMap[category] || colorMap[type] || 'blue';
}

// Search nearby (cities, hotels, POIs)
function searchNearby() {
    const lat = parseFloat(document.getElementById('search-lat').value);
    const lng = parseFloat(document.getElementById('search-lng').value);
    const radius = parseFloat(document.getElementById('radius').value);

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        alert('Please set a location (click "Click Map to Set Location" button)');
        return;
    }

    // Clear previous proximity markers
    proximityCityMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    proximityHotelMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    proximityPoiMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    proximityCityMarkers = [];
    proximityHotelMarkers = [];
    proximityPoiMarkers = [];
    
    if (poiCluster && map.hasLayer(poiCluster)) {
        map.removeLayer(poiCluster);
        poiCluster = null;
    }

    // Add search marker and circle
    if (searchMarker) map.removeLayer(searchMarker);
    if (searchCircle) map.removeLayer(searchCircle);
    
    searchMarker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
    searchMarker.bindPopup('<strong>Search Location</strong>').openPopup();

    searchCircle = L.circle([lat, lng], {
        radius: radius * 1000,
        color: '#3498db',
        fillColor: '#3498db',
        fillOpacity: 0.1
    }).addTo(map);

    // Fetch cities
    const cityUrl = `/api/cities/nearby/?lat=${lat}&lng=${lng}&distance=${radius}`;
    fetch(cityUrl)
        .then(response => response.json())
        .then(data => {
            let foundCount = 0;
            let resultsList = '';
            
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const [lng, lat] = feature.geometry.coordinates;
                    const props = feature.properties;
                    const marker = L.marker([lat, lng]).addTo(map);
                    marker.bindPopup(`
                        <strong>${props.name}</strong><br>
                        ${props.country}<br>
                        Population: ${props.population?.toLocaleString() || 'N/A'}
                    `);
                    proximityCityMarkers.push(marker);
                    foundCount++;
                    
                    resultsList += `
                        <div class="result-item" onclick="map.setView([${lat}, ${lng}], 10); proximityCityMarkers[${foundCount-1}].openPopup();">
                            <strong>${props.name}</strong>, ${props.country}<br>
                            <small style="color: #7f8c8d;">
                                Population: ${props.population?.toLocaleString() || 'N/A'}
                            </small>
                        </div>
                    `;
                }
            });

            document.getElementById('results-count').textContent = foundCount;
            document.getElementById('results-list').innerHTML = resultsList || '<p style="color: #999;">No cities found</p>';
            
            // Fetch hotels
            return fetch(`/api/hotels/nearby/?lat=${lat}&lng=${lng}&radius=${radius}`);
        })
        .then(response => response.json())
        .then(hotelData => {
            let hotelCount = 0;
            let hotelsList = '';
            
            hotelData.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const [lng, lat] = feature.geometry.coordinates;
                    const props = feature.properties;
                    
                    const hotelIcon = L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    });
                    
                    const marker = L.marker([lat, lng], {icon: hotelIcon}).addTo(map);
                    const stars = '⭐'.repeat(props.star_rating || 0);
                    const priceDisplay = props.price_range === 'luxury' ? '€€€' : 
                                        props.price_range === 'moderate' ? '€€' : '€';
                    
                    marker.bindPopup(`
                        <strong>🏨 ${props.name}</strong><br>
                        ${stars}<br>
                        Price: ${priceDisplay}<br>
                        City: ${props.city_name}
                    `);
                    proximityHotelMarkers.push(marker);
                    hotelCount++;
                    
                    hotelsList += `
                        <div class="result-item" onclick="map.setView([${lat}, ${lng}], 12); proximityHotelMarkers[${hotelCount-1}].openPopup();">
                            <strong>🏨 ${props.name}</strong><br>
                            <small style="color: #7f8c8d;">
                                ${stars} • ${priceDisplay} • ${props.city_name}
                            </small>
                        </div>
                    `;
                }
            });
            
            document.getElementById('hotels-count').textContent = hotelCount;
            document.getElementById('hotels-list').innerHTML = hotelsList || '<p style="color: #999;">No hotels found</p>';
            
            // Fetch POIs
            return fetch(`/api/overpass/all/?lat=${lat}&lng=${lng}&radius=${radius}`);
        })
        .then(response => response.json())
        .then(poiData => {
            proximityPoiData = poiData.features || [];
            applyProximityFilters();
            
            // Show results panel
            const resultsPanel = document.getElementById('proximity-results');
            if (resultsPanel) {
                resultsPanel.style.display = 'block';
            }
            
            if (searchCircle) {
                map.fitBounds(searchCircle.getBounds());
            }
            updateStats();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error searching nearby. Check console for details.');
        });
}

// Apply proximity filters
function applyProximityFilters() {
    const showCities = document.getElementById('filter-cities')?.checked ?? true;
    const showHotels = document.getElementById('filter-hotels')?.checked ?? true;
    const showTourism = document.getElementById('filter-tourism')?.checked ?? true;
    const showRestaurants = document.getElementById('filter-restaurants')?.checked ?? true;
    const showShops = document.getElementById('filter-shops')?.checked ?? true;
    const showCoffee = document.getElementById('filter-coffee')?.checked ?? true;
    const showPetrol = document.getElementById('filter-petrol')?.checked ?? true;
    const showHealthcare = document.getElementById('filter-healthcare')?.checked ?? true;

    // Toggle city markers
    proximityCityMarkers.forEach(marker => {
        if (showCities) {
            if (!map.hasLayer(marker)) marker.addTo(map);
        } else {
            if (map.hasLayer(marker)) map.removeLayer(marker);
        }
    });

    // Toggle hotel markers
    proximityHotelMarkers.forEach(marker => {
        if (showHotels) {
            if (!map.hasLayer(marker)) marker.addTo(map);
        } else {
            if (map.hasLayer(marker)) map.removeLayer(marker);
        }
    });

    // Remove existing POI markers
    proximityPoiMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    proximityPoiMarkers = [];
    
    if (poiCluster && map.hasLayer(poiCluster)) {
        map.removeLayer(poiCluster);
        poiCluster = null;
    }

    // Process POIs - show ALL within radius (no limit)
    let poiCount = 0;
    let hotelPOICount = 0;  // Count hotels from POI data separately
    const groupedByType = {};
    // Remove the limit - show all POIs within the radius
    const limitedPoiData = proximityPoiData;  // Use all data, not sliced
    
    limitedPoiData.forEach(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) return;
        
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;
        const poiType = props.type;
        const category = props.category;
        
        // Check if this POI should be shown
        let shouldShow = false;
        let isHotel = false;  // Track if this is a hotel
        
        // Hotels (from POI data - tourism=hotel) - check this FIRST before tourism
        if (poiType === 'tourism' && category === 'hotel' && showHotels) {
            shouldShow = true;
            isHotel = true;
            hotelPOICount++;
        }
        // Tourism & Activities (museums, attractions, historic sites, leisure) - but NOT hotels
        else if (poiType === 'tourism' && category !== 'hotel' && showTourism) {
            shouldShow = true;
        }
        else if ((poiType === 'historic' || poiType === 'leisure') && showTourism) {
            shouldShow = true;
        }
        // Restaurants
        else if (poiType === 'amenity' && category === 'restaurant' && showRestaurants) {
            shouldShow = true;
        }
        // Shops
        else if (poiType === 'shop' && showShops) {
            shouldShow = true;
        }
        // Coffee Shops
        else if (poiType === 'amenity' && category === 'cafe' && showCoffee) {
            shouldShow = true;
        }
        // Petrol Stations
        else if (poiType === 'amenity' && category === 'fuel' && showPetrol) {
            shouldShow = true;
        }
        // Hospitals & Chemists
        else if (poiType === 'amenity' && (category === 'hospital' || category === 'pharmacy' || category === 'clinic' || category === 'doctors') && showHealthcare) {
            shouldShow = true;
        }
        // Also check shop=pharmacy for chemists
        else if (poiType === 'shop' && category === 'pharmacy' && showHealthcare) {
            shouldShow = true;
        }
        
        if (shouldShow) {
            const markerColor = getMarkerColorForCategory(category, poiType);
            const poiIcon = L.icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [20, 34],
                iconAnchor: [10, 34],
                popupAnchor: [1, -30],
                shadowSize: [34, 34]
            });
            
            const marker = L.marker([lat, lng], {
                icon: poiIcon,
                poiData: { type: poiType, category: category, isHotel: isHotel }
            });
            
            let popupContent = `<strong>${props.icon || '📍'} ${props.name || 'Unnamed POI'}</strong><br>`;
            popupContent += `Type: ${props.type}<br>`;
            popupContent += `Category: ${props.category}<br>`;
            if (props.distance_km) popupContent += `Distance: ${props.distance_km} km<br>`;
            if (props.address) popupContent += `Address: ${props.address}<br>`;
            if (props.phone) popupContent += `Phone: ${props.phone}<br>`;
            if (props.website) popupContent += `<a href="${props.website}" target="_blank">Website</a><br>`;
            
            marker.bindPopup(popupContent);
            proximityPoiMarkers.push(marker);
            poiCount++;
            
            // Group by type for display - use 'hotel' type for hotels to separate them
            const displayType = isHotel ? 'hotel' : poiType;
            if (!groupedByType[displayType]) {
                groupedByType[displayType] = [];
            }
            groupedByType[displayType].push({
                name: props.name || 'Unnamed POI',
                icon: props.icon || '📍',
                category: props.category,
                distance: props.distance_km || 0,
                lat: lat,
                lng: lng,
                index: proximityPoiMarkers.length - 1,
                isHotel: isHotel
            });
        }
    });
    
    // Build grouped list - separate hotels from other POIs
    let poiListHTML = '';
    let hotelPOIs = [];
    let otherPOIs = {};
    
    // Separate hotels from other POIs
    Object.keys(groupedByType).forEach(type => {
        groupedByType[type].forEach(poi => {
            if (type === 'hotel' || poi.isHotel) {
                hotelPOIs.push(poi);
            } else {
                if (!otherPOIs[type]) {
                    otherPOIs[type] = [];
                }
                otherPOIs[type].push(poi);
            }
        });
    });
    
    // Build HTML - show hotels first if any
    if (hotelPOIs.length > 0) {
        poiListHTML += `<div style="margin-bottom: 0.75rem;"><strong style="color: #2c3e50; text-transform: capitalize; font-size: 0.9rem;">🏨 Hotels</strong>`;
        hotelPOIs.forEach(poi => {
            poiListHTML += `
                <div class="result-item" onclick="map.setView([${poi.lat}, ${poi.lng}], 16); proximityPoiMarkers[${poi.index}].openPopup();">
                    <strong style="color: #2c3e50; font-size: 0.9rem;">${poi.icon} ${poi.name}</strong><br>
                    <small style="color: #7f8c8d; font-size: 0.8rem;">
                        ${poi.category} • <span style="color: #667eea; font-weight: 600;">${poi.distance.toFixed(2)} km</span> away
                    </small>
                </div>
            `;
        });
        poiListHTML += `</div>`;
    }
    
    // Then show other POIs grouped by type
    Object.keys(otherPOIs).sort().forEach(type => {
        if (otherPOIs[type].length > 0) {
            poiListHTML += `<div style="margin-bottom: 0.75rem;"><strong style="color: #2c3e50; text-transform: capitalize; font-size: 0.9rem;">${type}</strong>`;
            otherPOIs[type].forEach(poi => {
                poiListHTML += `
                    <div class="result-item" onclick="map.setView([${poi.lat}, ${poi.lng}], 16); proximityPoiMarkers[${poi.index}].openPopup();">
                        <strong style="color: #2c3e50; font-size: 0.9rem;">${poi.icon} ${poi.name}</strong><br>
                        <small style="color: #7f8c8d; font-size: 0.8rem;">
                            ${poi.category} • <span style="color: #667eea; font-weight: 600;">${poi.distance.toFixed(2)} km</span> away
                        </small>
                    </div>
                `;
            });
            poiListHTML += `</div>`;
        }
    });
    
    const poisCountEl = document.getElementById('pois-count');
    const poisListEl = document.getElementById('pois-list');
    const hotelsCountEl = document.getElementById('hotels-count');
    const hotelsListEl = document.getElementById('hotels-list');
    
    if (poisCountEl) {
        const totalPois = proximityPoiData.length;
        // Exclude hotels from POI count since they're shown separately
        const nonHotelPoiCount = poiCount - hotelPOICount;
        // Show actual count without limitation message
        poisCountEl.textContent = nonHotelPoiCount;
    }
    if (poisListEl) poisListEl.innerHTML = poiListHTML || '<p style="color: #999; font-size: 0.85rem;">No POIs match the selected filters</p>';
    
    // Update hotels count and list to include hotels from POI data
    if (hotelsCountEl) {
        const dbHotelCount = proximityHotelMarkers.length;
        const totalHotelCount = dbHotelCount + hotelPOICount;
        hotelsCountEl.textContent = totalHotelCount;
    }
    
    // Update hotels list to include POI hotels
    if (hotelsListEl) {
        let hotelsListHTML = '';
        
        // Add database hotels first
        proximityHotelMarkers.forEach((marker, index) => {
            const latlng = marker.getLatLng();
            const popup = marker.getPopup();
            const content = popup ? popup.getContent() : '';
            // Extract name from popup content if possible
            const nameMatch = content.match(/<strong>.*?<\/strong>/);
            const name = nameMatch ? nameMatch[0].replace(/<[^>]*>/g, '') : `Hotel ${index + 1}`;
            
            hotelsListHTML += `
                <div class="result-item" onclick="map.setView([${latlng.lat}, ${latlng.lng}], 12); proximityHotelMarkers[${index}].openPopup();">
                    <strong>🏨 ${name}</strong>
                </div>
            `;
        });
        
        // Add POI hotels
        hotelPOIs.forEach(poi => {
            hotelsListHTML += `
                <div class="result-item" onclick="map.setView([${poi.lat}, ${poi.lng}], 16); proximityPoiMarkers[${poi.index}].openPopup();">
                    <strong>🏨 ${poi.name}</strong><br>
                    <small style="color: #7f8c8d;">
                        <span style="color: #667eea; font-weight: 600;">${poi.distance.toFixed(2)} km</span> away
                    </small>
                </div>
            `;
        });
        
        hotelsListEl.innerHTML = hotelsListHTML || '<p style="color: #999;">No hotels found</p>';
    }
    
    // Add POIs to cluster
    if (proximityPoiMarkers.length > 0) {
        if (!poiCluster) {
            poiCluster = L.markerClusterGroup({
                chunkedLoading: true,
                chunkInterval: 200,
                chunkDelay: 50,
                maxClusterRadius: 60
            });
        }
        poiCluster.clearLayers();
        proximityPoiMarkers.forEach(marker => poiCluster.addLayer(marker));
        map.addLayer(poiCluster);
    }
    
    updateStats();
}

// Regions functions
function loadRegions() {
    const country = document.getElementById('region-country')?.value || '';
    let url = '/api/regions/';
    if (country) {
        url += `?country=${encodeURIComponent(country)}`;
    }

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            clearRegions();
            regionDataMap = {}; // Reset region data map
            
            if (!data.features || data.features.length === 0) {
                console.warn('No regions found');
                return;
            }
            
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const props = feature.properties;
                    
                    // Store region data for quick lookup by region_code
                    if (props.region_code) {
                        regionDataMap[props.region_code] = {
                            id: props.id || feature.id,
                            name: props.name,
                            region_code: props.region_code
                        };
                    }
                    
                    const polygon = L.geoJSON(feature.geometry, {
                        style: {
                            color: '#3498db',
                            weight: 2,
                            fillColor: '#3498db',
                            fillOpacity: 0.2
                        }
                    });
                    
                    if (regionsVisible) {
                        polygon.addTo(map);
                    }
                    
                    polygon.bindPopup(`
                        <strong>${props.name}</strong><br>
                        ${props.country}<br>
                        Population: ${props.total_population?.toLocaleString() || 'N/A'}<br>
                        Area: ${props.area_km2?.toLocaleString() || 'N/A'} km²<br>
                        Type: ${props.region_type || 'N/A'}<br>
                        <button onclick="showCitiesInRegion('${props.region_code}', '${props.name}')" style="margin-top: 5px; padding: 5px 10px; cursor: pointer; background: #3498db; color: white; border: none; border-radius: 3px;">
                            Show Cities in Region
                        </button>
                    `);
                    
                    polygon.on('click', function() {
                        showCitiesInRegion(props.region_code, props.name);
                    });
                    
                    regionLayers.push(polygon);
                }
            });
            
            // Fit map to show all regions if any were loaded and visible
            if (regionLayers.length > 0 && regionsVisible) {
                const group = new L.featureGroup(regionLayers);
                map.fitBounds(group.getBounds().pad(0.1));
            }
        })
        .catch(error => {
            console.error('Error loading regions:', error);
            alert(`Error loading regions: ${error.message}`);
        });
}

function clearRegions() {
    regionLayers.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    regionLayers = [];
    const info = document.getElementById('selected-region-info');
    if (info) info.style.display = 'none';
}

function toggleRegions() {
    regionsVisible = document.getElementById('show-regions')?.checked ?? false;
    regionLayers.forEach(layer => {
        if (regionsVisible) {
            if (!map.hasLayer(layer)) layer.addTo(map);
        } else {
            if (map.hasLayer(layer)) map.removeLayer(layer);
        }
    });
}

function showCitiesInRegion(regionCode, regionName) {
    // Find region ID from stored data or fetch it
    let regionId = null;
    
    if (regionDataMap[regionCode]) {
        regionId = regionDataMap[regionCode].id;
    } else {
        // If not in cache, fetch regions to find the ID
        fetch('/api/regions/')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch regions');
                }
                return response.json();
            })
            .then(data => {
                const region = data.features.find(f => f.properties.region_code === regionCode);
                if (!region) {
                    throw new Error(`Region with code ${regionCode} not found`);
                }
                regionId = region.properties.id || region.id;
                fetchCitiesInRegion(regionId, regionName);
            })
            .catch(error => {
                console.error('Error finding region:', error);
                alert(`Error: ${error.message}`);
            });
        return;
    }
    
    fetchCitiesInRegion(regionId, regionName);
}

function fetchCitiesInRegion(regionId, regionName) {
    // Use the spatial endpoint for accurate PostGIS ST_Within query
    fetch(`/api/regions/${regionId}/cities/`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            clearMarkers();
            
            if (!data.features || data.features.length === 0) {
                const info = document.getElementById('selected-region-info');
                const nameEl = document.getElementById('region-name');
                const citiesEl = document.getElementById('region-cities');
                if (info) info.style.display = 'block';
                if (nameEl) nameEl.textContent = regionName;
                if (citiesEl) citiesEl.textContent = 'No cities found in this region';
                updateStats();
                return;
            }
            
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const [lng, lat] = feature.geometry.coordinates;
                    const props = feature.properties;
                    const marker = L.marker([lat, lng]).addTo(map);
                    marker.bindPopup(`
                        <strong>${props.name}</strong><br>
                        ${props.country}<br>
                        Population: ${props.population?.toLocaleString() || 'N/A'}<br>
                        Type: ${props.city_type || 'N/A'}
                    `);
                    markers.push(marker);
                }
            });
            
            // Fit map to show all cities
            if (markers.length > 0) {
                const group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.1));
            }
            
            const info = document.getElementById('selected-region-info');
            const nameEl = document.getElementById('region-name');
            const citiesEl = document.getElementById('region-cities');
            if (info) info.style.display = 'block';
            if (nameEl) nameEl.textContent = regionName;
            if (citiesEl) citiesEl.textContent = `${markers.length} cities found in ${regionName}`;
            
            updateStats();
        })
        .catch(error => {
            console.error('Error loading cities in region:', error);
            alert(`Error loading cities: ${error.message}`);
        });
}

// Hotel functions
function filterHotels() {
    clearHotels();
    
    const stars = document.getElementById('hotel-stars').value;
    const price = document.getElementById('hotel-price').value;
    
    let url = '/api/hotels/?';
    if (stars) url += `star_rating=${stars}&`;
    if (price) url += `price_range=${price}&`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            let count = 0;
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const [lng, lat] = feature.geometry.coordinates;
                    const props = feature.properties;
                    
                    const hotelIcon = L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    });
                    
                    const marker = L.marker([lat, lng], {icon: hotelIcon}).addTo(map);
                    
                    const stars = '⭐'.repeat(props.star_rating || 0);
                    const priceDisplay = props.price_range === 'luxury' ? '€€€' : 
                                        props.price_range === 'moderate' ? '€€' : '€';
                    
                    marker.bindPopup(`
                        <strong>🏨 ${props.name}</strong><br>
                        ${stars} (${props.star_rating || 0} stars)<br>
                        Price: ${priceDisplay}<br>
                        City: ${props.city_name}<br>
                        <small>${props.amenities || ''}</small>
                    `);
                    hotelMarkers.push(marker);
                    count++;
                }
            });
            
            const countEl = document.getElementById('hotel-count');
            if (countEl) countEl.textContent = count;
            
            if (count === 0) {
                alert('No hotels found with the selected filters.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error loading hotels. Check console for details.');
        });
}

function clearHotels() {
    hotelMarkers.forEach(marker => {
        if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    hotelMarkers = [];
    const countEl = document.getElementById('hotel-count');
    if (countEl) countEl.textContent = '0';
}

function toggleHotels() {
    const visible = document.getElementById('hotels-visible')?.checked ?? false;
    if (visible) {
        filterHotels();
    } else {
        clearHotels();
    }
}

// Landmark functions
function fetchLandmarks() {
    const center = map.getCenter();
    const radius = parseFloat(document.getElementById('landmark-radius').value) || 10;
    const type = document.getElementById('landmark-type').value;
    
    fetch(`/api/overpass/all/?lat=${center.lat}&lng=${center.lng}&radius=${radius}`)
        .then(response => response.json())
        .then(data => {
            clearLandmarks();
            landmarkData = data.features || [];
            filterLandmarks();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error fetching landmarks. Check console for details.');
        });
}

function filterLandmarks() {
    const type = document.getElementById('landmark-type').value;
    const visible = document.getElementById('landmarks-visible')?.checked ?? false;
    
    // Remove existing markers
    landmarkMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    landmarkMarkers = [];
    
    if (landmarkCluster && map.hasLayer(landmarkCluster)) {
        map.removeLayer(landmarkCluster);
        landmarkCluster = null;
    }
    
    if (!visible) {
        const countEl = document.getElementById('landmark-count');
        if (countEl) countEl.textContent = '0';
        return;
    }
    
    let count = 0;
    const filtered = landmarkData.filter(feature => {
        if (!type) return true;
        return feature.properties.type === type;
    });
    
    filtered.slice(0, MAX_MARKERS_PER_CATEGORY).forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            const [lng, lat] = feature.geometry.coordinates;
            const props = feature.properties;
            
            const markerColor = getMarkerColorForCategory(props.category, props.type);
            const icon = L.icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [20, 34],
                iconAnchor: [10, 34],
                popupAnchor: [1, -30],
                shadowSize: [34, 34]
            });
            
            const marker = L.marker([lat, lng], {icon: icon});
            marker.bindPopup(`
                <strong>${props.icon || '📍'} ${props.name || 'Unnamed Landmark'}</strong><br>
                Type: ${props.type}<br>
                Category: ${props.category}
            `);
            landmarkMarkers.push(marker);
            count++;
        }
    });
    
    if (landmarkMarkers.length > 0) {
        if (!landmarkCluster) {
            landmarkCluster = L.markerClusterGroup({
                chunkedLoading: true,
                chunkInterval: 200,
                chunkDelay: 50
            });
        }
        landmarkMarkers.forEach(m => landmarkCluster.addLayer(m));
        map.addLayer(landmarkCluster);
    }
    
    const countEl = document.getElementById('landmark-count');
    if (countEl) countEl.textContent = count;
    updateStats();
}

function clearLandmarks() {
    landmarkMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    landmarkMarkers = [];
    if (landmarkCluster && map.hasLayer(landmarkCluster)) {
        map.removeLayer(landmarkCluster);
        landmarkCluster = null;
    }
    landmarkData = [];
    const countEl = document.getElementById('landmark-count');
    if (countEl) countEl.textContent = '0';
    updateStats();
}

function toggleLandmarks() {
    filterLandmarks();
}

// All POIs functions
function fetchAllPOIs() {
    const center = map.getCenter();
    const radius = parseFloat(document.getElementById('allpois-radius').value) || 2;
    
    fetch(`/api/overpass/all/?lat=${center.lat}&lng=${center.lng}&radius=${radius}`)
        .then(response => response.json())
        .then(data => {
            clearAllPOIs();
            allPoiData = data.features || [];
            filterAllPOIs();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error fetching POIs. Check console for details.');
        });
}

function filterAllPOIs() {
    const type = document.getElementById('allpois-type').value;
    const category = document.getElementById('allpois-category').value;
    const visible = document.getElementById('allpois-visible')?.checked ?? false;
    
    // Remove existing markers
    allPoiMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    allPoiMarkers = [];
    
    if (allPoiCluster && map.hasLayer(allPoiCluster)) {
        map.removeLayer(allPoiCluster);
        allPoiCluster = null;
    }
    
    if (!visible) {
        const countEl = document.getElementById('allpois-count');
        if (countEl) countEl.textContent = '0';
        return;
    }
    
    let count = 0;
    const filtered = allPoiData.filter(feature => {
        const props = feature.properties;
        if (type && props.type !== type) return false;
        if (category && props.category !== category) return false;
        return true;
    });
    
    filtered.slice(0, MAX_TOTAL_POIS).forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            const [lng, lat] = feature.geometry.coordinates;
            const props = feature.properties;
            
            const markerColor = getMarkerColorForCategory(props.category, props.type);
            const icon = L.icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [20, 34],
                iconAnchor: [10, 34],
                popupAnchor: [1, -30],
                shadowSize: [34, 34]
            });
            
            const marker = L.marker([lat, lng], {icon: icon});
            let popupContent = `<strong>${props.icon || '📍'} ${props.name || 'Unnamed POI'}</strong><br>`;
            popupContent += `Type: ${props.type}<br>`;
            popupContent += `Category: ${props.category}<br>`;
            if (props.address) popupContent += `Address: ${props.address}<br>`;
            marker.bindPopup(popupContent);
            allPoiMarkers.push(marker);
            count++;
        }
    });
    
    if (allPoiMarkers.length > 0) {
        if (!allPoiCluster) {
            allPoiCluster = L.markerClusterGroup({
                chunkedLoading: true,
                chunkInterval: 200,
                chunkDelay: 50
            });
        }
        allPoiMarkers.forEach(m => allPoiCluster.addLayer(m));
        map.addLayer(allPoiCluster);
    }
    
    const countEl = document.getElementById('allpois-count');
    if (countEl) countEl.textContent = count;
    updateStats();
}

function clearAllPOIs() {
    allPoiMarkers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    allPoiMarkers = [];
    if (allPoiCluster && map.hasLayer(allPoiCluster)) {
        map.removeLayer(allPoiCluster);
        allPoiCluster = null;
    }
    allPoiData = [];
    const countEl = document.getElementById('allpois-count');
    if (countEl) countEl.textContent = '0';
    updateStats();
}

function toggleAllPOIs() {
    filterAllPOIs();
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// PWA Install Button
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', () => {
            installBtn.style.display = 'none';
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                deferredPrompt = null;
            });
        });
    }
});

// Initialize - regions hidden by default
document.addEventListener('DOMContentLoaded', function() {
    // Regions are hidden by default
    const showRegionsCheckbox = document.getElementById('show-regions');
    if (showRegionsCheckbox) {
        showRegionsCheckbox.checked = false;
    }
    regionsVisible = false;
    
    // Load a small sample of major cities on page load
    // This gives users something to see immediately
    fetch('/api/cities/?city_type=capital&population_min=500000')
        .then(response => {
            if (!response.ok) {
                console.error('Failed to fetch cities:', response.status);
                return { features: [] };
            }
            return response.json();
        })
        .then(data => {
            if (data.features && data.features.length > 0) {
                // Limit to first 30 cities to not overwhelm
                const limitedFeatures = data.features.slice(0, 30);
                limitedFeatures.forEach(feature => {
                    if (feature.geometry && feature.geometry.coordinates) {
                        const [lng, lat] = feature.geometry.coordinates;
                        const props = feature.properties;
                        const marker = L.marker([lat, lng]).addTo(map);
                        marker.bindPopup(`
                            <strong>${props.name}</strong><br>
                            ${props.country}<br>
                            Population: ${props.population?.toLocaleString() || 'N/A'}<br>
                            Type: ${props.city_type || 'N/A'}
                        `);
                        markers.push(marker);
                    }
                });
                updateStats();
                
                // Fit map to show all markers if we have any
                if (markers.length > 0) {
                    const group = new L.featureGroup(markers);
                    map.fitBounds(group.getBounds().pad(0.1));
                }
            } else {
                console.warn('No cities found in database. Database may need to be seeded.');
            }
        })
        .catch(error => {
            console.error('Error loading initial cities:', error);
            // Fail silently - user can still use the search
        });
});

