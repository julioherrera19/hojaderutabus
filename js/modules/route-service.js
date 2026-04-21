/**
 * Servicio de Rutas y Geocoding
 */
import { geocode } from './geocoding.js';
import { getFromCache, setInCache } from './cache.js';
import { calculateHaversine, distanceToLine } from './distance-utils.js';

const CACHE_PREFIX = 'route_';

/**
 * Busca paradas en una ruta real (vía OSRM)
 * @param {string|Object} originSource - Dirección o objeto {lat, lng}
 * @param {string|Object} destSource - Dirección o objeto {lat, lng}
 * @param {Array} allStops - Listado completo de paradas para filtrar
 * @param {number} [radiusKm=15] - Radio de búsqueda en kilómetros
 * @returns {Promise<Object>} Datos de origen, destino, paradas en ruta y polilínea
 */
export async function getStopsOnRoute(originSource, destSource, allStops, radiusKm = 15) {
    // Si ya es un objeto con coordenadas (proviene de autocompletado), lo usamos directamente
    const origin = (typeof originSource === 'object') ? originSource : await geocode(originSource);
    const destination = (typeof destSource === 'object') ? destSource : await geocode(destSource);

    if (!origin || !destination) throw new Error('Ubicación no encontrada');
    
    // Asegurar que tengan display_name para los popups (LocationIQ usa display_name o nombre)
    if (!origin.display_name) origin.display_name = origin.nombre || origin.display_name || originSource;
    if (!destination.display_name) destination.display_name = destination.nombre || destination.display_name || destSource;

    const routeData = await fetchOSRMRoute(origin, destination);
    
    // Filtrar paradas cercanas a la polilínea de la ruta
    const stopsOnRoute = allStops.filter(stop => {
        for (let i = 0; i < routeData.points.length - 1; i++) {
            const [lat1, lng1] = routeData.points[i];
            const [lat2, lng2] = routeData.points[i + 1];
            if (distanceToLine(stop.lng, stop.lat, lng1, lat1, lng2, lat2) <= radiusKm) return true;
        }
        return false;
    });

    // Ordenar por distancia al origen
    stopsOnRoute.sort((a, b) => 
        calculateHaversine(origin.lat, origin.lng, a.lat, a.lng) - 
        calculateHaversine(origin.lat, origin.lng, b.lat, b.lng)
    );

    return {
        origin, destination,
        stops: stopsOnRoute,
        distance: routeData.distance,
        duration: routeData.duration,
        routeLine: routeData.points
    };
}

async function fetchOSRMRoute(start, end) {
    const cacheKey = `${CACHE_PREFIX}${start.lat},${start.lng}_${end.lat},${end.lng}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 'Ok') throw new Error('Ruta no encontrada');

        const result = {
            points: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
            distance: (data.routes[0].distance / 1000).toFixed(1),
            duration: Math.round(data.routes[0].duration / 60)
        };

        setInCache(cacheKey, result);
        return result;
    } catch (e) {
        return {
            points: [[start.lat, start.lng], [end.lat, end.lng]],
            distance: calculateHaversine(start.lat, start.lng, end.lat, end.lng).toFixed(1),
            duration: 0
        };
    }
}
