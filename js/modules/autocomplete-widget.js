/**
 * Widget de Autocompletado genérico
 * Siguiendo el principio de Responsabilidad Única (SRP)
 */
export class AutocompleteWidget {
    /**
     * @param {HTMLInputElement} input - Elemento input a vincular
     * @param {Object} options - Configuración del widget
     */
    constructor(input, options = {}) {
        this.input = input;
        this.options = {
            listId: options.listId || `autocomplete-${Math.random().toString(36).substr(2, 9)}`,
            fetchData: options.fetchData || (async () => []),
            onSelect: options.onSelect || (() => {}),
            debounceMs: options.debounceMs || 300,
            minLength: options.minLength || 2
        };

        this.timeout = null;
        this.container = document.createElement('div');
        this.container.className = 'autocomplete-container';
        this.list = document.createElement('ul');
        this.list.id = this.options.listId;
        this.list.className = 'autocomplete-list hidden';

        this.init();
    }

    init() {
        // Envolver el input en el contenedor sin romper el layout
        this.input.parentNode.insertBefore(this.container, this.input);
        this.container.appendChild(this.input);
        this.container.appendChild(this.list);

        this.input.setAttribute('autocomplete', 'off');
        this.input.addEventListener('input', (e) => this.handleInput(e));
        
        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.list.classList.add('hidden');
            }
        });
    }

    handleInput(e) {
        const value = e.target.value.trim();
        clearTimeout(this.timeout);

        if (value.length < this.options.minLength) {
            this.list.classList.add('hidden');
            return;
        }

        this.timeout = setTimeout(async () => {
            try {
                const data = await this.options.fetchData(value);
                this.renderResults(data);
            } catch (err) {
                console.error('Error fetching suggestions:', err);
            }
        }, this.options.debounceMs);
    }

    renderResults(data) {
        this.list.innerHTML = '';
        if (!data || data.length === 0) {
            this.list.classList.add('hidden');
            return;
        }

        this.list.classList.remove('hidden');
        data.forEach(item => {
            const li = document.createElement('li');
            li.className = 'autocomplete-item';
            
            // Iconos decorativos para diferenciar origen de los datos
            const icon = item.tipo === 'local' ? '📍' : '🌍';
            
            li.innerHTML = `
                <span class="shrink-0">${icon}</span>
                <span class="truncate font-medium">${item.nombre}</span>
            `;
            
            li.addEventListener('click', () => {
                this.input.value = item.nombre;
                this.list.classList.add('hidden');
                this.options.onSelect(item);
            });
            this.list.appendChild(li);
        });
    }
}
