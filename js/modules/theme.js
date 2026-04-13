/**
 * Módulo de Tema (Dark/Light Mode)
 */
import { CONFIG } from './config.js';

const themeIcon = document.getElementById(CONFIG.SELECTORS.THEME_ICON.replace('#', ''));

/**
 * Inicializa el tema guardado o el preferido del sistema
 */
export function initTheme() {
    const savedTheme = localStorage.getItem(CONFIG.STORAGE.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        enableDarkMode();
    } else {
        enableLightMode();
    }
    
    // Configurar event listener
    const themeToggle = document.getElementById(CONFIG.SELECTORS.THEME_TOGGLE.replace('#', ''));
    themeToggle?.addEventListener('click', toggleTheme);
}

/**
 * Alterna entre modo oscuro y claro
 */
export function toggleTheme() {
    const isDark = document.documentElement.classList.contains(CONFIG.CLASSES.DARK);
    
    if (isDark) {
        enableLightMode();
    } else {
        enableDarkMode();
    }
}

/**
 * Activa el modo oscuro
 */
function enableDarkMode() {
    document.documentElement.classList.add(CONFIG.CLASSES.DARK);
    if (themeIcon) themeIcon.textContent = '☀️';
    localStorage.setItem(CONFIG.STORAGE.THEME, 'dark');
}

/**
 * Activa el modo claro
 */
function enableLightMode() {
    document.documentElement.classList.remove(CONFIG.CLASSES.DARK);
    if (themeIcon) themeIcon.textContent = '🌙';
    localStorage.setItem(CONFIG.STORAGE.THEME, 'light');
}
