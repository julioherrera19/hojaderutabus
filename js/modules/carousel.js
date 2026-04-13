/**
 * Módulo del Carrusel
 * Gestiona el carrusel de imágenes/video del héroe
 */
import { CONFIG } from './config.js';
import { state } from './state.js';

let slides = [];
let dots = [];

/**
 * Inicializa el carrusel
 */
export function initCarousel() {
    slides = document.querySelectorAll('.carousel-slide');
    dots = document.querySelectorAll('.carousel-dot');
    
    // Configurar event listeners para los dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showSlide(index);
            resetCarousel();
        });
    });
    
    // Iniciar autoplay
    startCarousel();
}

/**
 * Muestra un slide específico
 */
export function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.classList.toggle(CONFIG.CLASSES.ACTIVE, i === index);
    });
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('bg-bus-yellow', i === index);
        dot.classList.toggle('bg-gray-300', i !== index);
        dot.classList.toggle('dark:bg-gray-600', i !== index);
    });
}

/**
 * Avanza al siguiente slide
 */
function nextSlide() {
    state.currentSlide = (state.currentSlide + 1) % slides.length;
    showSlide(state.currentSlide);
}

/**
 * Inicia el autoplay del carrusel
 */
export function startCarousel() {
    stopCarousel();
    state.carouselInterval = setInterval(nextSlide, CONFIG.CAROUSEL_INTERVAL);
}

/**
 * Detiene el autoplay del carrusel
 */
export function stopCarousel() {
    if (state.carouselInterval) {
        clearInterval(state.carouselInterval);
    }
}

/**
 * Reinicia el autoplay (útil tras interacción del usuario)
 */
export function resetCarousel() {
    startCarousel();
}

/**
 * Destruye el carrusel (limpia event listeners)
 */
export function destroyCarousel() {
    stopCarousel();
    slides = [];
    dots = [];
}
