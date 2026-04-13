/**
 * Configuración y constantes globales
 */
export const CONFIG = {
    // Rutas
    PARADAS_JSON: 'paradas.json',
    
    // Carousel
    CAROUSEL_INTERVAL: 4000,
    
    // Selectores DOM
    SELECTORS: {
        THEME_TOGGLE: '#themeToggle',
        THEME_ICON: '#themeIcon',
        LIST_CONTAINER: '#listContainer',
        RESULTS_COUNT: '#resultsCount',
        SEARCH_INPUT: '#searchInput',
        CLEAR_SEARCH: '#clearSearch',
        MAP: '#map',
        SUGGEST_FORM: '#suggestForm',
        SUBMISSIONS_HISTORY: '#submissionsHistory',
        SUBMISSIONS_LIST: '#submissionsList',
    },
    
    // Clases CSS
    CLASSES: {
        ACTIVE: 'active',
        SCROLLED: 'scrolled',
        DARK: 'dark',
        FILTER_ACTIVE: 'active',
    },
    
    // Storage keys
    STORAGE: {
        THEME: 'theme',
        SUBMISSIONS: 'suggestSubmissions',
    },
};
