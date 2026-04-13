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

        // Resetear formulario
        form.reset();

        // Restaurar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        // Mostrar mensaje de éxito
        showThankYouMessage(name);

    } catch (error) {
        console.error('Error al enviar:', error);
        alert('Hubo un error al enviar tu sugerencia. Por favor, inténtalo de nuevo.');
        
        // Restaurar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Muestra el mensaje de agradecimiento
 */
function showThankYouMessage(name) {
    const section = document.querySelector('#compartir-section');
    
    const thankYouHTML = `
        <div id="thankYouMessage" class="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-0 overflow-hidden border-2 border-green-200 dark:border-green-800 text-center animate-fade-in">
            <div class="relative h-64 sm:h-80 w-full bg-gray-100 dark:bg-gray-800">
                <img src="assets/img/thankyou.jpg" alt="Gracias" class="w-full h-full object-cover" loading="lazy">
            </div>
            <div class="p-6 sm:p-8">
                <div class="text-5xl mb-4">🎉</div>
                <h3 class="text-2xl sm:text-3xl font-bold text-green-800 dark:text-green-200 mb-3">
                    ¡Gracias por tu sugerencia, ${escapeHTML(name)}!
                </h3>
                <p class="text-lg text-green-700 dark:text-green-300 mb-2">
                    Hemos recibido tu propuesta correctamente.
                </p>
                <p class="text-green-600 dark:text-green-400 mb-6">
                    Revisaremos la información y la añadiremos al mapa si es válida. 🚌
                </p>
                <button onclick="window.closeThankYou()" class="bg-bus-green text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors btn-touch inline-flex items-center gap-2">
                    <span>Volver al formulario</span>
                    <span>✏️</span>
                </button>
            </div>
        </div>
    `;
    
    // Ocultar formulario y mostrar agradecimiento
    const formContainer = section.querySelector('form')?.parentElement;
    if (formContainer) {
        formContainer.style.display = 'none';
    }
    
    // Insertar mensaje después del título
    const title = section.querySelector('h2');
    const thankYouDiv = document.createElement('div');
    thankYouDiv.innerHTML = thankYouHTML;
    title.parentNode.insertBefore(thankYouDiv.firstChild, title.nextSibling);
    
    // Auto-ocultar después de 10 segundos
    setTimeout(() => {
        const msg = document.getElementById('thankYouMessage');
        if (msg) msg.classList.add('hidden');
    }, 10000);
}

/**
 * Cierra el mensaje de agradecimiento
 */
window.closeThankYou = () => {
    const thankYouMsg = document.getElementById('thankYouMessage');
    const formContainer = document.querySelector('#compartir-section form')?.parentElement;
    
    if (thankYouMsg) {
        thankYouMsg.remove();
    }
    if (formContainer) {
        formContainer.style.display = 'block';
    }
};

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
