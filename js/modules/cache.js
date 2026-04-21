/**
 * Módulo de Caché con LocalStorage
 * Reduce llamadas a APIs externas (Photon, OSRM) cacheando resultados
 */

const CACHE_PREFIX = 'hrb_cache_';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

/**
 * Obtiene una clave única para el caché
 * @param {string} type - Tipo de caché ('geocode', 'route')
 * @param {string|string[]} key - Clave o array de claves
 * @returns {string} Clave normalizada
 */
function getCacheKey(type, key) {
    const normalized = typeof key === 'string' 
        ? key.toLowerCase().trim() 
        : JSON.stringify(key.map(k => k.toLowerCase().trim()).sort());
    return `${CACHE_PREFIX}${type}_${normalized}`;
}

/**
 * Obtiene un item del caché
 * @param {string} key - Clave del caché
 * @returns {*} Datos almacenados o null si expiró/no existe
 */
export function getFromCache(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const { data, timestamp } = JSON.parse(item);
        const now = Date.now();

        // Verificar si expiró
        if (timestamp && (now - timestamp) > DEFAULT_TTL) {
            localStorage.removeItem(key);
            return null;
        }

        return data;
    } catch (error) {
        console.warn('Error leyendo caché:', error);
        return null;
    }
}

/**
 * Guarda un item en el caché
 * @param {string} key - Clave del caché
 * @param {*} data - Datos a guardar
 */
export function setInCache(key, data) {
    try {
        const item = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
        // LocalStorage lleno, limpiar caché viejo
        console.warn('LocalStorage lleno, limpiando caché viejo:', error);
        clearExpiredCache();
        
        // Intentar de nuevo
        try {
            localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (e) {
            console.error('No se pudo guardar en caché:', e);
        }
    }
}

/**
 * Elimina un item del caché
 * @param {string} key - Clave del caché
 */
export function removeFromCache(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('Error eliminando caché:', error);
    }
}

/**
 * Limpia entries expirados del caché
 */
export function clearExpiredCache() {
    try {
        const now = Date.now();
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item.timestamp && (now - item.timestamp) > DEFAULT_TTL) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    keysToRemove.push(key);
                }
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`✓ Caché limpiada: ${keysToRemove.length} entries eliminados`);
    } catch (error) {
        console.warn('Error limpiando caché:', error);
    }
}

/**
 * Obtiene estadísticas del caché
 * @returns {{count: number, size: number}}
 */
export function getCacheStats() {
    let count = 0;
    let size = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            count++;
            size += localStorage.getItem(key).length;
        }
    }

    return { count, size: Math.round(size / 1024) }; // KB
}

/**
 * Limpia todo el caché
 */
export function clearAllCache() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`✓ Caché completamente limpiada: ${keysToRemove.length} entries`);
}

// Auto-limpieza al cargar (una vez cada 24h)
const LAST_CLEAN_KEY = 'hrb_last_clean';
const CLEAN_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas

export function initCache() {
    const now = Date.now();
    const lastClean = parseInt(localStorage.getItem(LAST_CLEAN_KEY) || '0');
    
    if (now - lastClean > CLEAN_INTERVAL) {
        clearExpiredCache();
        localStorage.setItem(LAST_CLEAN_KEY, now.toString());
    }
    
    const stats = getCacheStats();
    console.log(`📦 Caché inicializada: ${stats.count} entries (${stats.size} KB)`);
}

// Exponer funciones globales para debugging desde consola
if (typeof window !== 'undefined') {
    window.HRBCache = {
        clear: clearAllCache,
        stats: getCacheStats,
        clean: clearExpiredCache
    };
    console.log('💡 Usa window.HRBCache para gestionar el caché desde consola');
}
