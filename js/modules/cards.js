/**
 * Módulo de Renderizado de Tarjetas
 */
import { CONFIG } from './config.js';
import { state } from './state.js';
import { filterParadas } from './filters.js';

/**
 * Renderiza las tarjetas de paradas filtradas
 */
export function renderCards() {
    const container = document.getElementById(CONFIG.SELECTORS.LIST_CONTAINER.replace('#', ''));
    const resultsCount = document.getElementById(CONFIG.SELECTORS.RESULTS_COUNT.replace('#', ''));
    const filtered = filterParadas();

    // Actualizar contador
    if (!filtered.length) {
        resultsCount.textContent = '';
    } else {
        resultsCount.textContent = `${filtered.length} área${filtered.length !== 1 ? 's' : ''} encontrada${filtered.length !== 1 ? 's' : ''}`;
    }

    // Caso: sin resultados
    if (!filtered.length) {
        container.innerHTML = createEmptyState();
        return;
    }

    // Renderizar tarjetas
    container.innerHTML = filtered.map((p) => {
        const originalIndex = state.paradas.indexOf(p);
        return createCard(p, originalIndex);
    }).join('');
}

/**
 * Crea el HTML de una tarjeta
 */
function createCard(p, index) {
    return `
        <article class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm card-hover overflow-hidden" data-index="${index}">
            <div class="flex flex-col sm:flex-row">
                ${p.imagen ? `
                <div class="sm:flex-shrink-0 sm:w-48 h-48 sm:h-auto relative">
                    <img src="${p.imagen}" alt="${p.nombre}" class="w-full h-full object-cover" loading="lazy">
                    ${p.street_view ? `
                    <button onclick="window.toggleStreetView(${index})" class="absolute bottom-2 right-2 bg-gray-900/80 hover:bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 backdrop-blur-sm">
                        🗺️ Street View
                    </button>
                    ` : ''}
                </div>
                ` : ''}
                <div class="p-4 sm:p-5 flex-1">
                <div class="flex justify-between items-start gap-3 mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 class="font-bold text-lg text-gray-800 dark:text-white">${p.nombre}</h3>
                            ${p.esFounder ? '<span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full font-medium flex items-center gap-1">✓ Validada por Julio</span>' : ''}
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${p.autovia} · km ${p.km}</p>
                        <p class="text-xs text-gray-400 dark:text-gray-500">📍 ${p.comunidad}</p>
                    </div>
                    <div class="flex flex-col gap-1 items-end">
                        ${p.apto15m ? '<span class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full font-medium whitespace-nowrap">🚌 Bus Friendly</span>' : ''}
                    </div>
                </div>

                ${createBenefitsSection(p.ventajas)}

                <button onclick="window.toggleDetail(${index})" class="text-bus-yellow text-sm font-semibold hover:underline flex items-center gap-1">
                    Ver más <span class="transform transition-transform">▼</span>
                </button>

                <div id="detail-${index}" class="card-detail">
                    <div class="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                        <p class="text-sm text-gray-700 dark:text-gray-300 italic mb-3">💡 "${p.detalle_oro}"</p>
                        <div class="flex flex-wrap gap-2">
                            <a href="https://maps.google.com/?q=${p.lat},${p.lng}" target="_blank" rel="noopener" class="bg-bus-yellow text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-400 transition-colors flex items-center gap-1">
                                📍 Abrir GPS
                            </a>
                            ${p.sugerido_por ? `<span class="text-xs text-gray-500 dark:text-gray-400 self-center">Sugerido por: <strong>${p.sugerido_por}</strong></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}

/**
 * Crea la sección de beneficios
 */
function createBenefitsSection(ventajas) {
    if (!ventajas || !ventajas.length) return '';
    
    return `
        <div class="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
            <p class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Beneficios:</p>
            <div class="flex flex-wrap gap-2">
                ${ventajas.map(v => `
                    <span class="text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-lg font-medium border border-yellow-200 dark:border-yellow-800">
                        ${v}
                    </span>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Crea el estado vacío (sin resultados)
 */
function createEmptyState() {
    return `
        <div class="text-center py-12">
            <div class="text-6xl mb-4">🔍</div>
            <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No se encontraron paradas</h3>
            <p class="text-gray-500 dark:text-gray-400">Prueba con otro filtro o término de búsqueda</p>
        </div>
    `;
}

/**
 * Expone toggleDetail globalmente para los event listeners inline
 */
window.toggleDetail = (id) => {
    const detail = document.getElementById(`detail-${id}`);
    const isOpen = detail?.classList.contains(CONFIG.CLASSES.ACTIVE);

    document.querySelectorAll('.card-detail').forEach(el => {
        el.classList.remove(CONFIG.CLASSES.ACTIVE);
        el.style.maxHeight = '0';
    });

    if (!isOpen && detail) {
        detail.classList.add(CONFIG.CLASSES.ACTIVE);
        detail.style.maxHeight = detail.scrollHeight + 'px';
    }
};

/**
 * Expone toggleStreetView globalmente para mostrar la imagen street view
 */
window.toggleStreetView = (id) => {
    const parada = state.paradas[id];
    if (!parada || !parada.street_view) return;
    
    // Crear modal si no existe
    let modal = document.getElementById('streetViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'streetViewModal';
        modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="relative max-w-4xl w-full">
                <button onclick="window.closeStreetView()" class="absolute -top-12 right-0 text-white hover:text-gray-300 text-2xl font-bold transition-colors">✕ Cerrar</button>
                <img id="streetViewImage" src="" alt="Street View" class="w-full h-auto rounded-lg">
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const img = modal.querySelector('#streetViewImage');
    img.src = parada.street_view;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

/**
 * Cierra el modal de street view
 */
window.closeStreetView = () => {
    const modal = document.getElementById('streetViewModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
};

// Cerrar modal con tecla Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeStreetView();
    }
});
