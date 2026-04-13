/**
 * Gestión del estado global de la aplicación
 */
export const state = {
    // Datos
    paradas: [],
    
    // Filtros
    currentFilter: 'all',
    searchQuery: '',
    
    // Carousel
    currentSlide: 0,
    carouselInterval: null,
    
    // Mapa
    map: null,
    mapMarkers: [],
    
    // Envíos de formulario
    submissions: [],
};

/**
 * Inicializa el estado con valores por defecto
 */
export function initState() {
    state.paradas = [];
    state.currentFilter = 'all';
    state.searchQuery = '';
    state.currentSlide = 0;
    state.carouselInterval = null;
    state.map = null;
    state.mapMarkers = [];
    state.submissions = [];
}
