/**
 * Controlador de la UI del Planificador de Rutas
 * Refactorizado bajo el Principio de Responsabilidades Única (SRP)
 */
import { state } from './state.js';
import { getStopsOnRoute } from './route-service.js';
import { AutocompleteWidget } from './autocomplete-widget.js';
import { reverseGeocode } from './geocoding.js';

// Estado local para capturar las coordenadas exactas del autocompletado
let selectedOrigin = null;
let selectedDest = null;

/**
 * Inicializa el planificador de rutas
 */
export function initRoutePlanner() {
    const findBtn = document.getElementById('findRouteBtn');
    if (!findBtn) return;

    findBtn.addEventListener('click', handleFindRoute);
    setupInputs();
    setupGpsButton();
    
    console.log('✓ Planificador de rutas inicializado (Precisión GPS + Geo)');
}

/**
 * Configura el botón para obtener la ubicación actual por GPS
 */
function setupGpsButton() {
    const gpsBtn = document.getElementById('useCurrentLocation');
    const originInput = document.getElementById('routeOrigin');
    
    if (!gpsBtn || !originInput) return;

    gpsBtn.addEventListener('click', async () => {
        if (!navigator.geolocation) {
            alert('Tu navegador no soporta geolocalización');
            return;
        }

        gpsBtn.classList.add('animate-pulse');
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            
            // 1. Guardar coordenadas exactas
            selectedOrigin = {
                nombre: "Mi ubicación actual",
                lat: latitude,
                lng: longitude,
                tipo: 'gps'
            };

            // 2. Rellenar input temporalmente
            originInput.value = "📍 Obteniendo dirección...";

            // 3. Reverse geocode para un acabado profesional
            try {
                const address = await reverseGeocode(latitude, longitude);
                if (address) {
                    originInput.value = address;
                    selectedOrigin.nombre = address;
                } else {
                    originInput.value = "📍 Ubicación actual";
                }
            } catch (err) {
                originInput.value = "📍 Ubicación actual";
            } finally {
                gpsBtn.classList.remove('animate-pulse');
            }

        }, (error) => {
            gpsBtn.classList.remove('animate-pulse');
            alert('Error al obtener ubicación: ' + error.message);
        }, { enableHighAccuracy: true });
    });
}

/**
 * Configura los inputs con autocompletado y captura de coordenadas
 */
function setupInputs() {
    const originInput = document.getElementById('routeOrigin');
    const destInput = document.getElementById('routeDest');

    if (!originInput || !destInput) return;

    const fetchSuggestions = async (query) => {
        try {
            const response = await fetch(`/api/autocomplete?q=${encodeURIComponent(query)}&limit=8`);
            if (!response.ok) return [];
            return await response.json();
        } catch (e) {
            return [];
        }
    };

    // Vincular widgets con umbral de 4 caracteres para ahorrar tokens
    new AutocompleteWidget(originInput, { 
        fetchData: fetchSuggestions,
        minLength: 4,
        onSelect: (item) => {
            selectedOrigin = item;
            console.log('📍 Origen fijado:', item.nombre, item.lat, item.lng);
        }
    });

    new AutocompleteWidget(destInput, { 
        fetchData: fetchSuggestions,
        minLength: 4,
        onSelect: (item) => {
            selectedDest = item;
            console.log('🏁 Destino fijado:', item.nombre, item.lat, item.lng);
            handleFindRoute();
        } 
    });

    // Resetear selección si el usuario borra el campo
    [originInput, destInput].forEach(input => {
        input.addEventListener('input', (e) => {
            if (e.target.value === '') {
                if (input === originInput) selectedOrigin = null;
                if (input === destInput) selectedDest = null;
            }
        });
    });
}

/**
 * Maneja el click en el botón de buscar ruta
 */
async function handleFindRoute() {
    const originVal = document.getElementById('routeOrigin')?.value.trim();
    const destVal = document.getElementById('routeDest')?.value.trim();

    if (!originVal || !destVal) {
        alert('Por favor, escribe origen y destino');
        return;
    }

    setLoading(true);

    try {
        // Priorizar el objeto seleccionado (coordenadas exactas) sobre el texto
        const originSource = selectedOrigin && selectedOrigin.nombre === originVal ? selectedOrigin : originVal;
        const destSource = selectedDest && selectedDest.nombre === destVal ? selectedDest : destVal;

        const result = await getStopsOnRoute(originSource, destSource, state.paradas, 15);
        showRouteResults(result);
    } catch (error) {
        handleError(error);
    } finally {
        setLoading(false);
    }
}

/**
 * Renderiza los resultados en la UI
 */
function showRouteResults(result) {
    const resultsContainer = document.getElementById('routeResults');
    const summaryEl = document.getElementById('routeSummary');
    const googleMapsLink = document.getElementById('googleMapsLink');

    if (!resultsContainer || !summaryEl) return;

    summaryEl.textContent = `${result.stops.length} paradas encontradas en ruta (${result.distance} km)`;
    
    // Link a Google Maps con waypoints
    const waypoints = result.stops.map(s => `${s.lat},${s.lng}`).join('|');
    googleMapsLink.href = `https://www.google.com/maps/dir/?api=1&origin=${result.origin.lat},${result.origin.lng}&destination=${result.destination.lat},${result.destination.lng}&waypoints=${waypoints}`;

    renderStopsList(result.stops);
    resultsContainer.classList.remove('hidden');

    if (state.map) drawRoute(result);
}

/**
 * Lista de paradas renderizada
 */
function renderStopsList(stops) {
    const container = document.getElementById('routeStopsList');
    if (!container) return;

    if (stops.length === 0) {
        container.innerHTML = '<p class="text-center py-4 text-gray-500">No hay paradas cercanas a esta ruta.</p>';
        return;
    }

    container.innerHTML = stops.map((parada, idx) => `
        <div class="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-bus-blue transition-colors shadow-sm">
            <div class="shrink-0 w-6 h-6 rounded-full bg-bus-blue text-white flex items-center justify-center text-xs font-bold">${idx + 1}</div>
            <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-900 dark:text-white truncate text-sm">${parada.nombre}</h4>
                <p class="text-xs text-gray-500">${parada.autovia} · km ${parada.km}</p>
            </div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${parada.lat},${parada.lng}" target="_blank" class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg">📍</a>
        </div>
    `).join('');
}

/**
 * Dibuja en el mapa de Leaflet con marcadores diferenciados
 */
function drawRoute(result) {
    if (state.map._routeLayer) state.map.removeLayer(state.map._routeLayer);
    
    const layerGroup = L.featureGroup().addTo(state.map);
    state.map._routeLayer = layerGroup;

    // Estilo de la línea de ruta
    L.polyline(result.routeLine, { 
        color: '#3B82F6', 
        weight: 6, 
        opacity: 0.6,
        lineCap: 'round'
    }).addTo(layerGroup);
    
    // Iconos personalizados
    const iconBase = (color) => L.divIcon({
        className: 'custom-route-icon',
        html: `<div class="w-4 h-4 rounded-full bg-${color}-500 border-2 border-white shadow-lg"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    L.marker(result.routeLine[0], { icon: iconBase('orange') })
        .bindPopup('<b>🟢 Origen:</b><br>' + result.origin.display_name)
        .addTo(layerGroup);

    L.marker(result.routeLine[result.routeLine.length-1], { icon: iconBase('red') })
        .bindPopup('<b>🔴 Destino:</b><br>' + result.destination.display_name)
        .addTo(layerGroup);

    state.map.fitBounds(layerGroup.getBounds(), { padding: [80, 80] });
}

function setLoading(isLoading) {
    const btn = document.getElementById('findRouteBtn');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? '<span class="flex items-center gap-2"><div class="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>Buscando...</span>' : '<span>Buscar</span>';
}

function handleError(error) {
    console.error('✗ Error en ruta:', error);
    alert('No se pudo encontrar la ruta: ' + error.message);
}
