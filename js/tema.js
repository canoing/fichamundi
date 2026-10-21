(function () {
    const preferenceKey = 'fichamundi-theme';
    const root = document.documentElement;

    function readPreference() {
        try {
            return localStorage.getItem(preferenceKey) === 'prinz';
        } catch (error) {
            console.warn('No se pudo leer la preferencia de apariencia.', error);
            return false;
        }
    }

    function setTheme(isPrinz) {
        root.dataset.theme = isPrinz ? 'prinz' : 'claro';
    }

    setTheme(readPreference());

    function addThemeToggle() {
        const header = document.querySelector('header');
        if (!header) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';

        const updateButton = (isPrinz) => {
            button.textContent = isPrinz ? 'Desactivar modo Prinz' : 'Activar modo Prinz';
            button.setAttribute('aria-pressed', String(isPrinz));
        };

        updateButton(root.dataset.theme === 'prinz');
        button.addEventListener('click', () => {
            const isPrinz = root.dataset.theme !== 'prinz';
            setTheme(isPrinz);
            updateButton(isPrinz);

            try {
                localStorage.setItem(preferenceKey, isPrinz ? 'prinz' : 'claro');
            } catch (error) {
                console.error('No se pudo guardar la preferencia de apariencia.', error);
            }
        });

        const headerBar = header.querySelector('.header-barra');
        if (headerBar) {
            headerBar.append(button);
        } else {
            const nav = header.querySelector('nav');
            header.insertBefore(button, nav);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addThemeToggle, { once: true });
    } else {
        addThemeToggle();
    }
})();
