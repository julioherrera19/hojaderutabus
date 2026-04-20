/**
 * Aplicación Principal - Hoja de Ruta Bus
 * Punto de entrada que inicializa todos los módulos
 */
import { CONFIG } from './modules/config.js';
import { state } from './modules/state.js';
import { initCarousel, showSlide, resetCarousel } from './modules/carousel.js';
import { initTheme } from './modules/theme.js';
import { initNavigation, showSection } from './modules/navigation.js';
import { initFilters, filterParadas } from './modules/filters.js';
import { renderCards } from './modules/cards.js';
import { initMap, updateMapMarkers } from './modules/map.js';
import { initSubmissions, initSocialLinks } from './modules/submissions.js';
import { initFoodGallery } from './modules/food-gallery.js';
import { loadParadas } from './modules/data.js';

/**
 * Inicializa la aplicación
 */
async function initApp() {
    console.log('🚌 Iniciando Hoja de Ruta Bus...');
    
    // 1. Inicializar tema (antes de renderizar)
    initTheme();
    
    // 2. Cargar datos
    await loadParadas();
    
    // 3. Inicializar módulos UI
    initCarousel();
    initNavigation();
    initFilters(() => {
        renderCards();
    });
    initSubmissions();
    initSocialLinks();
    initFoodGallery();
    
    // 4. Renderizar contenido inicial
    renderCards();
    
    // 5. Configurar evento para el mapa
    window.addEventListener('map:visible', () => {
        initMap();
        if (state.map) {
            state.map.invalidateSize();
        }
    });
    
    // 6. Configurar evento para navegación desde mapa
    window.addEventListener('map:navigateToDetail', (e) => {
        const { index } = e.detail;
        showSection('areas');
        setTimeout(() => {
            const detailElement = document.getElementById(`detail-${index}`);
            if (detailElement && !detailElement.classList.contains(CONFIG.CLASSES.ACTIVE)) {
                detailElement.classList.add(CONFIG.CLASSES.ACTIVE);
                detailElement.style.maxHeight = detailElement.scrollHeight + 'px';
                detailElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    });
    
    // 7. Efecto navbar scroll
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 10) {
            navbar?.classList.add(CONFIG.CLASSES.SCROLLED);
        } else {
            navbar?.classList.remove(CONFIG.CLASSES.SCROLLED);
        }
    });
    
    // 8. Detectar cambio de tema para actualizar mapa
    const observer = new MutationObserver(() => {
        if (state.map && state.mapMarkers.length > 0) {
            updateMapMarkers();
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // 9. Animación del contador de paradas (11 → 38)
    const contadorEl = document.getElementById('contador-paradas');
    console.log('Contador el:', contadorEl);
    if (contadorEl) {
        const fin = parseInt(contadorEl.dataset.fin) || 38;
        console.log('Valor final:', fin);
        let actual = 11;
        const duracion = 1500;
        const pasos = 30;
        const incremento = (fin - 11) / pasos;
        const intervalo = duracion / pasos;

        const animacion = setInterval(() => {
            actual += incremento;
            if (actual >= fin) {
                actual = fin;
                clearInterval(animacion);
            }
            contadorEl.textContent = Math.floor(actual);
        }, intervalo);
    }

    console.log('✅ Aplicación inicializada correctamente');
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);

// Exportar funciones globales necesarias
window.showSection = showSection;
window.showSlide = showSlide;
window.resetCarousel = resetCarousel;
