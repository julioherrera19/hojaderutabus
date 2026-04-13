/**
 * Módulo de Navegación entre secciones
 */
import { CONFIG } from './config.js';

/**
 * Muestra una sección específica y oculta las demás
 */
export function showSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section-content').forEach(section => {
        section.classList.remove(CONFIG.CLASSES.ACTIVE);
    });

    // Referencias a secciones
    const sections = {
        hero: document.getElementById('hero'),
        intro: document.getElementById('intro'),
        foodGallery: document.getElementById('food-gallery-section'),
        filters: document.getElementById('filters'),
        search: document.getElementById('search'),
        areas: document.getElementById('areas-section'),
        mapa: document.getElementById('mapa-section'),
        compartir: document.getElementById('compartir-section'),
    };

    // Mostrar solo los elementos correspondientes
    switch (sectionId) {
        case 'inicio':
            sections.hero?.classList.add(CONFIG.CLASSES.ACTIVE);
            sections.intro?.classList.add(CONFIG.CLASSES.ACTIVE);
            sections.foodGallery?.classList.add(CONFIG.CLASSES.ACTIVE);
            sections.filters?.classList.add(CONFIG.CLASSES.ACTIVE);
            sections.search?.classList.add(CONFIG.CLASSES.ACTIVE);
            sections.areas?.classList.add(CONFIG.CLASSES.ACTIVE);
            break;
        case 'areas':
            sections.filters?.classList.add(CONFIG.CLASSES.ACTIVE);
            sections.search?.classList.add(CONFIG.CLASSES.ACTIVE);
            sections.areas?.classList.add(CONFIG.CLASSES.ACTIVE);
            break;
        case 'mapa':
            sections.mapa?.classList.add(CONFIG.CLASSES.ACTIVE);
            break;
        case 'compartir':
            sections.compartir?.classList.add(CONFIG.CLASSES.ACTIVE);
            break;
    }

    // Actualizar estado de enlaces del navbar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('bg-bus-yellow', 'text-gray-900');
        if (link.dataset.section === sectionId) {
            link.classList.add('bg-bus-yellow', 'text-gray-900');
        }
    });

    // Si es la sección mapa, inicializar/actualizar mapa
    if (sectionId === 'mapa') {
        setTimeout(() => {
            // El módulo de mapa se encargará de esto
            window.dispatchEvent(new CustomEvent('map:visible'));
        }, 100);
    }

    // Scroll suave al top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Configura los event listeners de navegación
 */
export function initNavigation() {
    document.querySelectorAll('.nav-link, [data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.dataset.section;
            showSection(sectionId);
        });
    });
}
