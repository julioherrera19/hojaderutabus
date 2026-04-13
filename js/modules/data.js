/**
 * Módulo de Carga de Datos
 */
import { CONFIG } from './config.js';
import { state } from './state.js';

/**
 * Carga las paradas desde el JSON
 */
export async function loadParadas() {
    try {
        // Añadimos timestamp para evitar caché del navegador
        const response = await fetch(`${CONFIG.PARADAS_JSON}?t=${Date.now()}`);
        state.paradas = await response.json();
        
        console.log(`✓ ${state.paradas.length} paradas cargadas desde ${CONFIG.PARADAS_JSON}`);
        state.paradas.forEach(p => {
            console.log(`  - ${p.nombre} (${p.autovia})`);
        });
        
        return state.paradas;
    } catch (error) {
        console.error('Error cargando paradas:', error);
        const container = document.getElementById(CONFIG.SELECTORS.LIST_CONTAINER.replace('#', ''));
        if (container) {
            container.innerHTML = `
                <div class="text-center text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    Error al cargar las paradas. Inténtalo de nuevo.
                </div>
            `;
        }
        return [];
    }
}

/**
 * Obtiene una parada por su ID
 */
export function getParadaById(id) {
    return state.paradas.find(p => p.id === id);
}

/**
 * Obtiene el número total de paradas
 */
export function getParadasCount() {
    return state.paradas.length;
}

/**
 * Obtiene las paradas de un eje específico
 */
export function getParadasByEje(eje) {
    return state.paradas.filter(p => {
        const normalized = p.autovia.replace(/^AP-/, 'A-').replace(/^A-31/, 'A-3');
        return normalized === eje;
    });
}
