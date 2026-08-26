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

    // ------------------------------------------------
    // HELPERS
    // ------------------------------------------------
    function num(valor) {
        return Number(valor || 0).toFixed(2);
    }

    function sumarCampo(modulos, campo) {
        if (!Array.isArray(modulos)) return 0;
        return modulos.reduce((sum, m) => {
            const cant = Number(m.cantidad || 1);
            return sum + (Number(m[campo] || 0) * cant);
        }, 0);
    }

    function setTexto(id, texto) {
        const el = document.getElementById(id);
        if (el) el.textContent = texto;
    }

    function mostrarFicha(ficha) {
        // Ocultar zona de carga y mostrar ficha
        dropZone.style.display = 'none';
        fichaDisplay.classList.add('active');

        const info = ficha.informacion_general || {};
        const stats = ficha.estadisticas || {};
        const comprobante = ficha.comprobante_modulos || {};
        const modulosSel = ficha.modulos_seleccionados || {};

        // Información General
        setTexto('v-nombre', info.nombre || ficha.titulo || 'Sin nombre');
        setTexto('v-tipo-badge', info.tipo || '-');
        setTexto('v-pais', info.pais || '-');
        setTexto('v-fecha', info.fecha || ficha.fecha || '-');

        // Estadísticas
        setTexto('v-hp', stats.hp !== undefined ? num(stats.hp) : '-');
        setTexto('v-velocidad', stats.velocidad !== undefined ? num(stats.velocidad) : '-');
        setTexto('v-ataque', stats.ataque !== undefined ? num(stats.ataque) : '-');
        setTexto('v-defensa', stats.defensa !== undefined ? num(stats.defensa) : '-');
        setTexto('v-peso-total', stats.peso_total !== undefined ? num(stats.peso_total) : '-');
        setTexto('v-cap-peso-total', stats.capacidad_peso_total !== undefined ? num(stats.capacidad_peso_total) : '-');
        setTexto('v-coste', stats.coste !== undefined ? `${num(stats.coste)}M` : '-');
        setTexto('v-piezas', `${stats.piezas_colocadas ?? '-'} / ${stats.capacidad_piezas_total ?? '-'}`);

        // Estado de validez combinado (peso y piezas)
        const validoPeso = stats.valido !== false;
        const validoPiezas = comprobante.valido_por_piezas !== false;
        const validoGeneral = validoPeso && validoPiezas;
        const validezEl = document.getElementById('v-validez');
        if (validezEl) {
            validezEl.textContent = validoGeneral ? 'VÁLIDO' : 'NO VÁLIDO';
            validezEl.style.color = validoGeneral ? '#2b8a3e' : '#c92a2a';
        }

        // Daño P/L y Defensa P/L (calculado a partir de los módulos)
        setTexto('v-ataque-pl', calcularAtPL(modulosSel));
        setTexto('v-defensa-pl', calcularDefPL(modulosSel));

        // Lista de Módulos
        const listaUl = document.getElementById('v-lista-modulos');
        listaUl.innerHTML = '';

        // Chasis (objeto único) primero
        if (modulosSel.chasis) {
            const li = document.createElement('li');
            li.className = 'modulo-item-compacto';
            li.innerHTML = `
                <span><strong>Chasis:</strong> ${modulosSel.chasis.nombre || '-'}</span>
                <small>Tipo de blindaje: ${modulosSel.chasis.tipo_blindaje || 'P'}</small>
            `;
            listaUl.appendChild(li);
        }

        // Categorías en el orden del constructor de tanques
        const categorias = [
            { key: 'traccion', nombre: 'Tracción' },
            { key: 'motor', nombre: 'Motor' },
            { key: 'comunicacion', nombre: 'Comunicación' },
            { key: 'blindaje', nombre: 'Blindaje' },
            { key: 'armamento', nombre: 'Armamento' }
        ];

        categorias.forEach(cat => {
            const modulos = modulosSel[cat.key];
            if (!Array.isArray(modulos)) return;

            modulos.forEach(m => {
                if (Number(m.cantidad || 0) <= 0) return;
                const li = document.createElement('li');
                li.className = 'modulo-item-compacto';
                li.innerHTML = `
                    <span><span class="cant">x${m.cantidad}</span> ${m.nombre || '-'}</span>
                    <small>${cat.nombre}</small>
                `;
                listaUl.appendChild(li);
            });
        });

        // Comprobante de peso / piezas
        const liComp = document.createElement('li');
        liComp.className = 'modulo-item-compacto comprobante-visor';
        liComp.innerHTML = `
            <span><strong>Comprobante:</strong> Peso ${comprobante.peso_total !== undefined ? num(comprobante.peso_total) : '-'}
                / ${comprobante.capacidad_peso_total !== undefined ? num(comprobante.capacidad_peso_total) : '-'}</span>
            <small>Piezas ${comprobante.piezas_usadas ?? '-'} / ${comprobante.capacidad_piezas_total ?? '-'} ·
            Estilo blindaje: ${comprobante.estilo_blindaje || 'P'}</small>
        `;
        listaUl.appendChild(liComp);

        // Descripción
        setTexto('v-descripcion', ficha.descripcion || 'Sin descripción de lore.');
    }

    // Ataque total P/L: suma el campo "ataque" de armamento y comunicación.
    // En tanques el ataque no varía por estilo, así que se muestra igual en P y L.
    function calcularAtPL(modulosSel) {
        const total = sumarCampo(modulosSel.armamento, 'ataque') + sumarCampo(modulosSel.comunicacion, 'ataque');
        return total > 0 ? `${num(total)}(P) ${num(total)}(L)` : null;
    }

    // Defensa P/L: suma blindaje_P y blindaje_L de todos los blindajes instalados.
    function calcularDefPL(modulosSel) {
        let pTotal = 0;
        let lTotal = 0;

        const blindajes = Array.isArray(modulosSel.blindaje) ? modulosSel.blindaje : [];
        blindajes.forEach(m => {
            const cant = Number(m.cantidad || 1);
            pTotal += Number(m.blindaje_P || 0) * cant;
            lTotal += Number(m.blindaje_L || 0) * cant;
        });

        return (pTotal > 0 || lTotal > 0) ? `${num(pTotal)}(P) ${num(lTotal)}(L)` : null;
    }
});
