document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fichaDisplay = document.getElementById('ficha-display');

    // Manejo de eventos de clic y arrastre
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) leerArchivo(file);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#e6f2ff';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '#f0f7ff';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#f0f7ff';
        const file = e.dataTransfer.files[0];
        if (file) leerArchivo(file);
    });

    function leerArchivo(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const ficha = JSON.parse(e.target.result);
                mostrarFicha(ficha);
            } catch (err) {
                alert('Error: El archivo no es un JSON válido');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    // SOPORTE PARA VISTA PREVIA DESDE LOCALSTORAGE
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('preview') === 'true') {
        const fichaPreview = localStorage.getItem('ficha_preview');
        if (fichaPreview) {
            mostrarFicha(JSON.parse(fichaPreview));
            // Opcional: limpiar después de mostrar
            // localStorage.removeItem('ficha_preview');
        }
    }

    function mostrarFicha(ficha) {
        // Ocultar zona de carga y mostrar ficha
        dropZone.style.display = 'none';
        fichaDisplay.classList.add('active');

        // Información General
        document.getElementById('v-nombre').textContent = ficha.informacion_general.nombre;
        document.getElementById('v-tipo-badge').textContent = ficha.informacion_general.tipo;
        document.getElementById('v-pais').textContent = ficha.informacion_general.pais;
        document.getElementById('v-fecha').textContent = ficha.fecha;

        // Estadísticas
        document.getElementById('v-velocidad').textContent = ficha.estadisticas.velocidad;
        document.getElementById('v-ataque').textContent = ficha.estadisticas.ataque;
        document.getElementById('v-defensa').textContent = ficha.estadisticas.defensa;
        document.getElementById('v-coste').textContent = ficha.estadisticas.coste;

        // Daño P/L (Buscando en la estructura del JSON)
        // Nota: Re-calculamos o extraemos si el JSON lo tiene guardado de forma específica.
        // En el script.js actual, el JSON no guarda el string P/L directamente en 'estadisticas', 
        // así que lo calcularemos de los módulos seleccionados.
        
        const ataquePL = calcularPL(ficha.modulos_seleccionados, 'ataque_p_l');
        const defensaPL = calcularPL(ficha.modulos_seleccionados, 'defensa_p_l');
        
        document.getElementById('v-ataque-pl').textContent = ataquePL || '-';
        document.getElementById('v-defensa-pl').textContent = defensaPL || '-';

        // Lista de Módulos
        const listaUl = document.getElementById('v-lista-modulos');
        listaUl.innerHTML = '';

        // Casco primero
        if (ficha.modulos_seleccionados.casco) {
            const li = document.createElement('li');
            li.className = 'modulo-item-compacto';
            li.innerHTML = `<span><strong>Casco:</strong> ${ficha.modulos_seleccionados.casco.nombre}</span>`;
            listaUl.appendChild(li);
        }

        // Otros módulos
        ['propulsion', 'armamento', 'blindaje'].forEach(cat => {
            const modulos = ficha.modulos_seleccionados[cat];
            if (Array.isArray(modulos)) {
                modulos.forEach(m => {
                    if (m.cantidad > 0) {
                        const li = document.createElement('li');
                        li.className = 'modulo-item-compacto';
                        li.innerHTML = `
                            <span><span class="cant">x${m.cantidad}</span> ${m.nombre}</span>
                            <small>${cat.charAt(0).toUpperCase() + cat.slice(1)}</small>
                        `;
                        listaUl.appendChild(li);
                    }
                });
            }
        });

        // Descripción
        document.getElementById('v-descripcion').textContent = ficha.descripcion || 'Sin descripción de lore.';
    }

    function calcularPL(modulosSel, propiedad) {
        let pTotal = 0;
        let lTotal = 0;
        let tieneValores = false;

        ['propulsion', 'armamento', 'blindaje'].forEach(cat => {
            const mods = modulosSel[cat];
            if (Array.isArray(mods)) {
                mods.forEach(m => {
                    if (m[propiedad]) {
                        const cant = m.cantidad || 1;
                        const pMatch = m[propiedad].match(/(\d+)\s*\(?P\)?/i);
                        const lMatch = m[propiedad].match(/(\d+)\s*\(?L\)?/i);
                        if (pMatch) pTotal += parseInt(pMatch[1]) * cant;
                        if (lMatch) lTotal += parseInt(lMatch[1]) * cant;
                        tieneValores = true;
                    }
                });
            }
        });

        return tieneValores ? `${pTotal}(P) ${lTotal}(L)` : null;
    }
});
