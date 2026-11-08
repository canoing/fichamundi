(() => {
    const positionKey = 'fichamundi-portavasos-position';
    const coaster = document.createElement('button');
    coaster.type = 'button';
    coaster.className = 'portavasos';
    coaster.setAttribute('aria-label', 'Portavasos decorativo. Arrástralo para moverlo; usa las flechas del teclado para ajustarlo.');
    coaster.title = 'Portavasos decorativo · arrastra para mover';
    coaster.innerHTML = '<span class="portavasos-insignia" aria-hidden="true"></span>';
    document.body.append(coaster);

    let dragging = false;
    let pointerOffsetX = 0;
    let pointerOffsetY = 0;

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function moveTo(left, top) {
        const maxLeft = Math.max(0, window.innerWidth - coaster.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - coaster.offsetHeight);
        coaster.style.left = `${clamp(left, 0, maxLeft)}px`;
        coaster.style.top = `${clamp(top, 0, maxTop)}px`;
        coaster.style.right = 'auto';
        coaster.style.bottom = 'auto';
    }

    function savePosition() {
        try {
            localStorage.setItem(positionKey, JSON.stringify({
                left: parseFloat(coaster.style.left),
                top: parseFloat(coaster.style.top)
            }));
        } catch (error) {
            console.warn('No se pudo guardar la posición del portavasos.', error);
        }
    }

    try {
        const savedPosition = JSON.parse(localStorage.getItem(positionKey) || 'null');
        if (Number.isFinite(savedPosition?.left) && Number.isFinite(savedPosition?.top)) {
            requestAnimationFrame(() => moveTo(savedPosition.left, savedPosition.top));
        }
    } catch (error) {
        console.warn('No se pudo recuperar la posición del portavasos.', error);
    }

    coaster.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const bounds = coaster.getBoundingClientRect();
        pointerOffsetX = event.clientX - bounds.left;
        pointerOffsetY = event.clientY - bounds.top;
        moveTo(bounds.left, bounds.top);
        dragging = true;
        coaster.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    coaster.addEventListener('pointermove', event => {
        if (!dragging) return;
        moveTo(event.clientX - pointerOffsetX, event.clientY - pointerOffsetY);
    });

    coaster.addEventListener('pointerup', event => {
        if (!dragging) return;
        dragging = false;
        if (coaster.hasPointerCapture(event.pointerId)) coaster.releasePointerCapture(event.pointerId);
        savePosition();
    });

    coaster.addEventListener('pointercancel', () => {
        dragging = false;
        savePosition();
    });

    coaster.addEventListener('keydown', event => {
        const directions = {
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0]
        };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        const bounds = coaster.getBoundingClientRect();
        const step = event.shiftKey ? 30 : 10;
        moveTo(bounds.left + direction[0] * step, bounds.top + direction[1] * step);
        savePosition();
    });

    window.addEventListener('resize', () => {
        const bounds = coaster.getBoundingClientRect();
        moveTo(bounds.left, bounds.top);
        if (coaster.style.right === 'auto') savePosition();
    });
})();
