(() => {
    function makeDraggable(element, positionKey, label) {
        let dragging = false;
        let pointerOffsetX = 0;
        let pointerOffsetY = 0;
        let hasCustomPosition = false;

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function moveTo(left, top) {
            const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);
            element.style.left = `${clamp(left, 0, maxLeft)}px`;
            element.style.top = `${clamp(top, 0, maxTop)}px`;
            element.style.right = 'auto';
            element.style.bottom = 'auto';
            hasCustomPosition = true;
        }

        function savePosition() {
            try {
                localStorage.setItem(positionKey, JSON.stringify({
                    left: parseFloat(element.style.left),
                    top: parseFloat(element.style.top)
                }));
            } catch (error) {
                console.warn(`No se pudo guardar la posición de ${label}.`, error);
            }
        }

        try {
            const savedPosition = JSON.parse(localStorage.getItem(positionKey) || 'null');
            if (Number.isFinite(savedPosition?.left) && Number.isFinite(savedPosition?.top)) {
                requestAnimationFrame(() => moveTo(savedPosition.left, savedPosition.top));
            }
        } catch (error) {
            console.warn(`No se pudo recuperar la posición de ${label}.`, error);
        }

        element.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const bounds = element.getBoundingClientRect();
            pointerOffsetX = event.clientX - bounds.left;
            pointerOffsetY = event.clientY - bounds.top;
            moveTo(bounds.left, bounds.top);
            dragging = true;
            element.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        element.addEventListener('pointermove', event => {
            if (!dragging) return;
            moveTo(event.clientX - pointerOffsetX, event.clientY - pointerOffsetY);
        });

        element.addEventListener('pointerup', event => {
            if (!dragging) return;
            dragging = false;
            if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
            savePosition();
        });

        element.addEventListener('pointercancel', () => {
            dragging = false;
            savePosition();
        });

        element.addEventListener('keydown', event => {
            const directions = {
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0]
            };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            const bounds = element.getBoundingClientRect();
            const step = event.shiftKey ? 30 : 10;
            moveTo(bounds.left + direction[0] * step, bounds.top + direction[1] * step);
            savePosition();
        });

        window.addEventListener('resize', () => {
            if (!hasCustomPosition) return;
            const bounds = element.getBoundingClientRect();
            moveTo(bounds.left, bounds.top);
            savePosition();
        });
    }

    const coaster = document.createElement('button');
    coaster.type = 'button';
    coaster.className = 'portavasos';
    coaster.setAttribute('aria-label', 'Portavasos decorativo. Arrástralo para moverlo; usa las flechas del teclado para ajustarlo.');
    coaster.title = 'Portavasos decorativo · arrastra para mover';
    coaster.innerHTML = '<span class="portavasos-insignia" aria-hidden="true"></span>';
    document.body.append(coaster);

    const cup = document.createElement('button');
    cup.type = 'button';
    cup.className = 'portavasos-vaso';
    cup.setAttribute('aria-label', 'Vaso independiente. Arrástralo para moverlo; usa las flechas del teclado para ajustarlo.');
    cup.title = 'Vaso independiente · arrastra para mover';
    cup.innerHTML = `
        <svg aria-hidden="true" viewBox="0 0 48 64">
            <path d="M8 10h32l-4 46H12z" fill="rgba(226, 246, 255, 0.72)" stroke="#f7fbfd" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M10 29h28l-2.3 25H12.3z" fill="#d9903d"/>
            <path d="M8 10h32" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
            <path d="m15 17-2.5 31" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2.5" stroke-linecap="round"/>
        </svg>`;
    document.body.append(cup);

    makeDraggable(coaster, 'fichamundi-portavasos-position', 'el portavasos');
    makeDraggable(cup, 'fichamundi-vaso-position', 'el vaso');
})();
