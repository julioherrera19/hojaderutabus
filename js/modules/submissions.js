/**
 * Módulo de Envíos de Sugerencias
 */
import { CONFIG } from './config.js';
import { state } from './state.js';

/**
 * Inicializa el formulario de sugerencias
 */
export function initSubmissions() {
    loadSubmissionsFromStorage();

    const form = document.getElementById(CONFIG.SELECTORS.SUGGEST_FORM.replace('#', ''));
    form?.addEventListener('submit', handleSubmit);
}

/**
 * Maneja el envío del formulario
 */
async function handleSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    // Validación básica
    const name = formData.get('name')?.trim();
    const email = formData.get('email')?.trim();
    const message = formData.get('message')?.trim();

    if (!name || !email || !message) {
        alert('Por favor, completa todos los campos obligatorios (*).');
        return;
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Por favor, introduce un correo electrónico válido.');
        return;
    }

    // Mostrar estado de envío
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Enviando...</span>';
    submitBtn.disabled = true;

    try {
        // Enviar a Netlify Forms
        await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(Object.fromEntries(formData))
        });

        // Crear objeto de sugerencia para localStorage
        const submission = {
            id: Date.now(),
            name,
            email,
            message,
            fecha: new Date().toISOString(),
            estado: 'enviado'
        };

        // Guardar en localStorage para historial local
        saveSubmissionToStorage(submission);

        // Mostrar mensaje de éxito
        alert(`¡Gracias por tu sugerencia, ${name}! 🚌\n\nHemos recibido tu propuesta correctamente.\nRevisaremos la información y la añadiremos al mapa si es válida.`);

        // Resetear formulario
        form.reset();

        // Restaurar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error al enviar:', error);
        alert('Hubo un error al enviar tu sugerencia. Por favor, inténtalo de nuevo.');
        
        // Restaurar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Carga los envíos guardados en localStorage
 */
function loadSubmissionsFromStorage() {
    const stored = localStorage.getItem(CONFIG.STORAGE.SUBMISSIONS);
    if (stored) {
        state.submissions = JSON.parse(stored);
        renderSubmissionsHistory();
    }
}

/**
 * Guarda un envío en localStorage
 */
function saveSubmissionToStorage(submission) {
    state.submissions.push(submission);
    localStorage.setItem(CONFIG.STORAGE.SUBMISSIONS, JSON.stringify(state.submissions));
    renderSubmissionsHistory();
}

/**
 * Renderiza el historial de envíos
 */
export function renderSubmissionsHistory() {
    const historyContainer = document.getElementById(CONFIG.SELECTORS.SUBMISSIONS_HISTORY.replace('#', ''));
    const listContainer = document.getElementById(CONFIG.SELECTORS.SUBMISSIONS_LIST.replace('#', ''));

    if (!state.submissions.length) {
        historyContainer?.classList.add('hidden');
        return;
    }

    historyContainer?.classList.remove('hidden');
    
    listContainer.innerHTML = state.submissions.map(sub => `
        <div class="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm text-gray-700 dark:text-gray-300">${sub.message}</p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Enviado por: ${sub.name}</p>
                </div>
                <span class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full font-medium whitespace-nowrap ml-2">
                    ✓ Pendiente
                </span>
            </div>
        </div>
    `).join('');
}
