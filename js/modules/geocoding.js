/**
 * MÃ³dulo de Geocoding (Netlify Functions + ciudades hardcodeadas + cachÃ© LocalStorage)
 */
import { getFromCache, setInCache } from './cache.js';

const GEOCACHE_PREFIX = 'geocode_';
const RATE_LIMIT_DELAY = 2000; // 2s para reintentos

/**
 * Ciudades principales de EspaÃ±a pre-cachÃ©adas
 * Coordenadas aproximadas del centro
 */
const CIUDADES_CACHE = {
    'madrid': { lat: 40.4167, lng: -3.7037 },
    'barcelona': { lat: 41.3888, lng: 2.159 },
    'valencia': { lat: 39.4699, lng: -0.3763 },
    'sevilla': { lat: 37.3891, lng: -5.9845 },
    'zaragoza': { lat: 41.6488, lng: -0.8891 },
    'mÃ¡laga': { lat: 36.7213, lng: -4.4214 },
    'murcia': { lat: 37.9922, lng: -1.1307 },
    'palma': { lat: 39.5696, lng: 2.6502 },
    'bilbao': { lat: 43.263, lng: -2.935 },
    'alicante': { lat: 38.3452, lng: -0.4815 },
    'cÃ³rdoba': { lat: 37.8882, lng: -4.7794 },
    'valladolid': { lat: 41.6528, lng: -4.7245 },
    'vigo': { lat: 42.2328, lng: -8.7226 },
    'gijÃ³n': { lat: 43.5322, lng: -5.6611 },
    'hospitalet': { lat: 41.3598, lng: 2.0998 },
    'coruÃ±a': { lat: 43.3623, lng: -8.4115 },
    'vitoria': { lat: 42.8467, lng: -2.6716 },
    'granada': { lat: 37.1773, lng: -3.5986 },
    'elche': { lat: 38.2622, lng: -0.7011 },
    'oviedo': { lat: 43.3614, lng: -5.8493 },
    'santa coloma': { lat: 41.4515, lng: 2.2085 },
    'badalona': { lat: 41.4502, lng: 2.2452 },
    'cartagena': { lat: 37.6, lng: -0.9833 },
    'terrassa': { lat: 41.5633, lng: 2.0087 },
    'jerez': { lat: 36.6868, lng: -6.1362 },
    'sabadell': { lat: 41.5433, lng: 2.1081 },
    'mÃ³stoles': { lat: 40.3231, lng: -3.7996 },
    'alcalÃ¡': { lat: 40.4818, lng: -3.3643 },
    'pamplona': { lat: 42.8169, lng: -1.6433 },
    'almerÃ­a': { lat: 36.8381, lng: -2.4597 },
    'fuenlabrada': { lat: 40.2842, lng: -3.7996 },
    'burgos': { lat: 42.3439, lng: -3.6969 },
    'albacete': { lat: 38.9943, lng: -1.8585 },
    'santander': { lat: 43.4605, lng: -3.8076 },
    'castellÃ³n': { lat: 39.9864, lng: -0.0513 },
    'alcorcÃ³n': { lat: 40.3458, lng: -3.8242 },
    'logroÃ±o': { lat: 42.4627, lng: -2.4449 },
    'badajoz': { lat: 38.8794, lng: -6.9706 },
    'salamanca': { lat: 40.9701, lng: -5.6635 },
    'huelva': { lat: 37.2614, lng: -6.9447 },
    'marbella': { lat: 36.5101, lng: -4.8851 },
    'tarragona': { lat: 41.1189, lng: 1.2445 },
    'lÃ©rida': { lat: 41.6176, lng: 0.62 },
    'girona': { lat: 41.9794, lng: 2.8214 },
    'cÃ¡diz': { lat: 36.5297, lng: -6.2929 },
    'jaÃ©n': { lat: 37.7796, lng: -3.7849 },
    'toledo': { lat: 39.8628, lng: -4.0273 },
    'segovia': { lat: 40.9429, lng: -4.1088 },
    'cuenca': { lat: 40.0704, lng: -2.1374 },
    'guadalajara': { lat: 40.6327, lng: -3.1601 },
    'cÃ¡ceres': { lat: 39.4753, lng: -6.3724 },
    'trujillo': { lat: 39.4569, lng: -5.8801 },
    'mÃ©rida': { lat: 38.9171, lng: -6.3434 },
    'plasencia': { lat: 40.0306, lng: -6.0869 },
    'navalmoral': { lat: 39.8833, lng: -5.5333 },
    'don benito': { lat: 38.9667, lng: -5.8667 },
    'villanueva': { lat: 38.9833, lng: -6.0167 }
};

/**
 * Normaliza un nombre de ciudad para bÃºsqueda
 */
function normalizeQuery(query) {
    return query
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/\s+/g, ' ');
}

/**
 * Busca una ciudad en el cachÃ© local
 * @param {string} query - Nombre de la ciudad
 * @returns {{lat: number, lng: number, display_name: string}|null}
 */
function searchFromCache(query) {
    const normalized = normalizeQuery(query);

    // BÃºsqueda exacta
    if (CIUDADES_CACHE[normalized]) {
        return {
            lat: CIUDADES_CACHE[normalized].lat,
            lng: CIUDADES_CACHE[normalized].lng,
            display_name: query
        };
    }

    // BÃºsqueda parcial desactivada para evitar el fallo del centro de ciudad
    return null;
}

/**
 * Geocodifica una direcciÃ³n usando la funciÃ³n Netlify
 * con cachÃ© LocalStorage y reintentos con backoff
 * @param {string} query - DirecciÃ³n o ciudad a buscar
 * @param {number} retryCount - NÃºmero de reintentos (interno)
 * @returns {Promise<{lat: number, lng: number, display_name: string}|null>}
 */
export async function geocode(query, retryCount = 0) {
    if (!query || query.trim().length < 2) {
        return null;
    }

    // 1. Intentar cachÃ© de ciudades hardcodeadas
    const cached = searchFromCache(query);
    if (cached) {
        console.log(`âœ“ Geocoding (cachÃ© local): ${query}`);
        return cached;
    }

    // 2. Intentar cachÃ© LocalStorage
    const cacheKey = `${GEOCACHE_PREFIX}${normalizeQuery(query)}`;
    const cachedLS = getFromCache(cacheKey);
    if (cachedLS) {
        console.log(`âœ“ Geocoding (LocalStorage): ${query}`);
        return cachedLS;
    }

    // 3. Fallback a la funciÃ³n Netlify
    try {
        const searchQuery = `${query}, Spain`;
        const url = `/api/geocode?q=${encodeURIComponent(searchQuery)}&limit=1`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        // Manejar rate limiting (429)
        if (response.status === 429) {
            if (retryCount < 3) {
                const waitTime = RATE_LIMIT_DELAY * Math.pow(2, retryCount); // Backoff exponencial
                console.warn(`âš ï¸ Rate limit (429), esperando ${waitTime}ms... (intento ${retryCount + 1}/3)`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return geocode(query, retryCount + 1);
            } else {
                throw new Error('Demasiadas peticiones. Espera unos segundos e intenta de nuevo.');
            }
        }

        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.length > 0) {
            const result = {
                lat: data[0].lat,
                lng: data[0].lng,
                display_name: data[0].nombre || query
            };

            // Guardar en cachÃ©
            setInCache(cacheKey, result);
            console.log(`âœ“ Geocoding (Netlify Function + cachÃ©): ${query} â†’ ${result.display_name}`);
            return result;
        }

        console.warn(`âš ï¸ Geocoding: no se encontrÃ³ "${query}"`);
        return null;

    } catch (error) {
        // Error amigable para rate limit
        if (error.message.includes('Demasiadas peticiones')) {
            throw error;
        }
        console.error(`âœ— Geocoding error para "${query}":`, error);
        return null;
    }
}

/**
 * Geocodifica mÃºltiples direcciones en paralelo con rate limiting
 * @param {string[]} queries - Lista de direcciones
 * @returns {Promise<Array<{lat: number, lng: number, display_name: string}|null>>}
 */
export async function geocodeBatch(queries) {
    const results = [];

    // PequeÃ±o delay entre peticiones para no saturar
    for (let i = 0; i < queries.length; i++) {
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        results.push(await geocode(queries[i]));
    }

    return results;
}
/**
 * Obtiene el nombre de una ubicación a partir de sus coordenadas
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>}
 */
export async function reverseGeocode(lat, lng) {
    const cacheKey = 'reverse_' + lat.toFixed(4) + '_' + lng.toFixed(4);
    const cached = typeof getFromCache !== 'undefined' ? getFromCache(cacheKey) : null;
    if (cached) return cached;

    try {
        const response = await fetch('/api/reverse-geocode?lat=' + lat + '&lon=' + lng);
        if (!response.ok) return null;
        
        const data = await response.json();
        const address = data.display_name;
        
        if (typeof setInCache !== 'undefined') setInCache(cacheKey, address);
        return address;
    } catch (e) {
        console.error('Error in reverseGeocode:', e);
        return null;
    }
}
