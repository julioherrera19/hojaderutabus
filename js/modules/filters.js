/**
 * Módulo de Filtros y Búsqueda
 */
import { CONFIG } from './config.js';
import { state } from './state.js';

/**
 * Inicializa los event listeners de filtros y búsqueda
 */
export function initFilters(onFilterChange) {
    // Filtros por eje
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.dataset.axis, onFilterChange);
        });
    });

    // Buscador
    const searchInput = document.getElementById(CONFIG.SELECTORS.SEARCH_INPUT.replace('#', ''));
    const clearSearch = document.getElementById(CONFIG.SELECTORS.CLEAR_SEARCH.replace('#', ''));

    searchInput?.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        clearSearch?.classList.toggle('hidden', state.searchQuery === '');
        onFilterChange();
    });

    clearSearch?.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearch.classList.add('hidden');
        onFilterChange();
    });
}

/**
 * Establece un filtro de autovía
 */
function setFilter(axis, onFilterChange) {
    state.currentFilter = axis;
    
    // Actualizar estado visual de botones
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove(CONFIG.CLASSES.FILTER_ACTIVE, 'bg-bus-yellow', 'text-gray-900', 'border-bus-yellow');
        btn.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300', 'border-gray-200', 'dark:border-gray-700');
    });
    
    const activeBtn = document.querySelector(`.filter-btn[data-axis="${axis}"]`);
    if (activeBtn) {
        activeBtn.classList.add(CONFIG.CLASSES.FILTER_ACTIVE, 'bg-bus-yellow', 'text-gray-900', 'border-bus-yellow');
        activeBtn.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300', 'border-gray-200', 'dark:border-gray-700');
    }
    
    onFilterChange();
}

/**
 * Normaliza una autovía (AP-1 -> A-1, A-31 -> A-3)
 */
export function normalizeAutovia(autovia) {
    let normalized = autovia.replace(/^AP-/, 'A-');
    normalized = normalized.replace(/^A-31/, 'A-3');
    return normalized;
}

/**
 * Comprueba si una autovía coincide con el filtro actual
 */
export function autoviaMatchesFilter(autovia, filter) {
    if (filter === 'all') return true;
    const normalized = normalizeAutovia(autovia);
    return normalized === filter;
}

/**
 * Función de búsqueda mejorada
 */
export function matchesSearch(parada, query) {
    const q = query.toLowerCase().trim();
    
    // Normalizar query: "A2" -> "a-2", "a 2" -> "a-2", "ap2" -> "ap-2"
    const normalizedQuery = q
        .replace(/\s+/g, '-')
        .replace(/^a(\d)/, 'a-$1')
        .replace(/^ap(\d)/, 'ap-$1');
    
    // Campos a buscar
    const searchableFields = [
        parada.nombre,
        parada.autovia,
        parada.corredor,
        parada.comunidad,
        parada.km.toString()
    ];
    
    // Buscar coincidencia en todos los campos
    for (const field of searchableFields) {
        const fieldLower = field.toLowerCase();
        if (fieldLower.includes(q)) return true;
        if (fieldLower.includes(normalizedQuery)) return true;
        
        // También buscar sin guiones: "A-2" -> "a2"
        const noHyphenQuery = q.replace(/-/g, '');
        const noHyphenField = fieldLower.replace(/-/g, '');
        if (noHyphenQuery.length >= 2 && noHyphenField.includes(noHyphenQuery)) return true;
    }
    
    return false;
}

/**
 * Filtra las paradas según filtro y búsqueda actuales
 */
export function filterParadas() {
    return state.paradas.filter(p => {
        const axisMatch = autoviaMatchesFilter(p.autovia, state.currentFilter);
        const searchMatch = state.searchQuery === '' || matchesSearch(p, state.searchQuery);
        return axisMatch && searchMatch;
    });
}
