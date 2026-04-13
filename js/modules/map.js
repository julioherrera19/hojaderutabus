/**
 * Módulo de Mapa (Leaflet)
 */
import { CONFIG } from './config.js';
import { state } from './state.js';

/**
 * Inicializa el mapa de Leaflet
 */
export function initMap() {
    if (state.map) {
        // Mapa ya inicializado, solo actualizar marcadores
        updateMapMarkers();
        return;
    }

    // Crear mapa centrado en España
    state.map = L.map(CONFIG.SELECTORS.MAP.replace('#', ''), {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true
    }).setView([40.4637, -3.7492], 6);

    // Capa base (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(state.map);

    // Añadir marcadores
    updateMapMarkers();
}

/**
 * Actualiza los marcadores del mapa
 */
export function updateMapMarkers() {
    if (!state.map) return;

    // Limpiar marcadores existentes
    state.mapMarkers.forEach(marker => state.map.removeLayer(marker));
    state.mapMarkers = [];

    const validCoords = [];

    state.paradas.forEach((p, index) => {
        // Validar coordenadas
        if (!isValidCoordinates(p)) {
            console.warn(`⚠️ Parada sin coordenadas válidas: "${p.nombre}" (id: ${p.id})`);
            return;
        }

        validCoords.push([p.lat, p.lng]);

        // Crear popup content
        const popupContent = createPopupContent(p, index);

        // Crear marcador
        const marker = L.marker([p.lat, p.lng])
            .addTo(state.map)
            .bindPopup(popupContent);

        // Event listener para "Ver detalles"
        marker.on('popupopen', () => {
            attachPopupEventListeners(marker, index);
        });

        state.mapMarkers.push(marker);
    });

    // Ajustar zoom para mostrar todos los marcadores
    if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        state.map.fitBounds(bounds, { padding: [50, 50] });
    }

    console.log(`✓ ${state.mapMarkers.length} marcadores añadidos al mapa`);
}

/**
 * Valida las coordenadas de una parada
 */
function isValidCoordinates(p) {
    if (!p.lat || !p.lng || isNaN(p.lat) || isNaN(p.lng)) return false;
    // Verificar que estén dentro de España (aproximadamente)
    if (p.lat < 27 || p.lat > 44 || p.lng < -18 || p.lng > 4) return false;
    return true;
}

/**
 * Crea el contenido del popup
 */
function createPopupContent(p, index) {
    const isDark = document.documentElement.classList.contains(CONFIG.CLASSES.DARK);
    const beneficiosHtml = p.ventajas?.length ? `
        <div class="mb-2">
            <p class="text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1">Beneficios:</p>
            <div class="flex flex-wrap gap-1">
                ${p.ventajas.map(v => `<span class="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">${v}</span>`).join('')}
            </div>
        </div>
    ` : '';

    return `
        <div class="${isDark ? 'dark' : ''}">
            <h3 class="text-gray-900 dark:text-white font-bold mb-1">${p.nombre}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">${p.autovia} · km ${p.km}</p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mb-2">${p.comunidad}</p>
            ${beneficiosHtml}
            <div class="flex gap-1 flex-wrap mb-2">
                ${p.esFounder ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">✓ Julio</span>' : ''}
                ${p.apto15m ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">🚌 Friendly</span>' : ''}
            </div>
            <a href="#" class="inline-block text-sm text-bus-yellow font-semibold" data-index="${index}">Ver detalles →</a>
        </div>
    `;
}

/**
 * Adjunta event listeners al popup
 */
function attachPopupEventListeners(marker, index) {
    const detailLink = document.querySelector(`.leaflet-popup-content a[data-index="${index}"]`);
    if (detailLink) {
        detailLink.addEventListener('click', (e) => {
            e.preventDefault();
            // El evento se maneja globalmente
            window.dispatchEvent(new CustomEvent('map:navigateToDetail', { 
                detail: { index } 
            }));
        });
    }
}

/**
 * Destruye el mapa (limpia memoria)
 */
export function destroyMap() {
    if (state.map) {
        state.map.remove();
        state.map = null;
        state.mapMarkers = [];
    }
}
