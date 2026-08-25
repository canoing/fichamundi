/**
 * VISOR DE FICHAS DE AVIONES - Fichamundi
 * Muestra las fichas generadas por el constructor de aviación.
 */
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fichaDisplay = document.getElementById('ficha-display');

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

    function mostrarFicha(ficha) {
        dropZone.style.display = 'none';
        fichaDisplay.classList.add('active');

        // Información general
        document.getElementById('v-nombre').textContent =
            ficha.informacion_general.nombre || ficha.titulo || '-';
        document.getElementById('v-pais').textContent =
            ficha.informacion_general.pais || '-';
        document.getElementById('v-fecha').textContent =
            ficha.informacion_general.anio || ficha.fecha || '-';
        document.getElementById('v-tipo-badge').textContent = 'Avión';

        // Estadísticas
        const est = ficha.estadisticas || {};
        document.getElementById('v-peso').textContent = est.peso ?? 0;
        document.getElementById('v-velocidad').textContent = est.velocidad ?? 0;
        document.getElementById('v-altitud').textContent = est.altitud ?? 0;
        document.getElementById('v-manio').textContent = est.maniobrabilidad ?? 0;
        document.getElementById('v-ataque').textContent = est.ataque || '-';
        document.getElementById('v-vida').textContent = est.vida ?? 0;
        document.getElementById('v-coste').textContent =
            (est.coste !== undefined && est.coste !== null) ? `${est.coste.toFixed(3)}M` : '-';

        // Lista de componentes
        const listaUl = document.getElementById('v-lista-componentes');
        listaUl.innerHTML = '';

        const comp = ficha.componentes_seleccionados || ficha.modulos_seleccionados || {};

        const etiquetas = [
            ['fuselaje', 'Fuselaje'],
            ['motores', 'Motores'],
            ['armamento', 'Armamento Primario'],
            ['bombas', 'Bombas'],
            ['torpedos', 'Torpedos'],
            ['alas', 'Alas']
        ];

        etiquetas.forEach(([campo, etiqueta]) => {
            const item = comp[campo];

            if (campo === 'fuselaje') {
                if (item) {
                    const li = document.createElement('li');
                    li.className = 'modulo-item-compacto';
                    li.innerHTML = `<span><strong>${etiqueta}:</strong> ${item.nombre}</span>`;
                    listaUl.appendChild(li);
                }
                return;
            }

            if (Array.isArray(item)) {
                item.forEach(m => {
                    if (m && m.cantidad > 0) {
                        const li = document.createElement('li');
                        li.className = 'modulo-item-compacto';
                        li.innerHTML = `
                            <span><span class="cant">x${m.cantidad}</span> ${m.nombre}</span>
                            <small>${etiqueta}</small>
                        `;
                        listaUl.appendChild(li);
                    }
                });
            }
        });

        // Descripción
        document.getElementById('v-descripcion').textContent =
            ficha.descripcion || 'Sin descripción de lore.';
    }
});
