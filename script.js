/**
 * CREADOR DE FICHAS DE BUQUES - U-Boat World RPG
 * Sistema de construcción de armamentos navales con selección modular.
 *
 * ARQUITECTURA:
 * - cascos.json: datos de cascos (solo 1 seleccionable)
 * - modulos.json: propulsión, armamento y blindaje (múltiples seleccionables)
 * - estado centralizado en el objeto `seleccionados`
 * - cálculos en tiempo real
 */

// ==================== ESTADO GLOBAL ====================
let datosJSON = null;           // Reservado para futuras extensiones
let cascos = {};                // Cascos del JSON (por tipo)
let modulos = {};               // Módulos del JSON (propulsión, armamento, blindaje)
let seleccionados = {};         // Selecciones del usuario (casco + arrays de módulos)
let capacidadModulosActual = 0; // Capacidad de módulos del casco actual

/**
 * Carga los datos desde los JSON.
 * Lee cascos.json y modulos.json para inicializar la aplicación.
 *
 * @returns {boolean} true si se cargó correctamente, false si hubo error
 */
async function cargarDatos() {
    try {
        // Cargar cascos
        const resCascos = await fetch('cascos.json');
        const datosCascos = await resCascos.json();
        cascos = datosCascos.cascos; // Extrae el objeto 'cascos' del JSON
        console.log('Cascos cargados:', Object.keys(cascos).length, 'tipos');

        // Cargar módulos
        const resModulos = await fetch('modulos.json');
        const datosModulos = await resModulos.json();
        modulos = datosModulos; // Contiene propulsion, armamento y blindaje
        console.log('Módulos cargados:',
            'Propulsión:', modulos.propulsion?.length || 0,
            'Armamento:', modulos.armamento?.length || 0,
            'Blindaje:', modulos.blindaje?.length || 0
        );

        // Inicializar el objeto de selecciones del usuario
        // - casco: null (un solo casco)
        // - propulsion, armamento, blindaje: arrays (múltiples módulos)
        seleccionados = {
            "casco": null,
            "propulsion": [],
            "armamento": [],
            "blindaje": []
        };

        console.log('Datos cargados correctamente');
        return true;
    } catch (error) {
        console.error('Error cargando JSONs:', error);
        return false;
    }
}

/**
 * Inicializa la página cuando el DOM está listo.
 * 1. Carga los datos
 * 2. Genera la interfaz
 * 3. Asocia eventos de botones
 * 4. Calcula estadísticas iniciales
 */
document.addEventListener('DOMContentLoaded', async () => {
    const cargado = await cargarDatos();
    if (cargado) {
        generarModulos();
        agregarEventListeners();
        calcularTotales();
    } else {
        alert('Error: No se pudo cargar el archivo de configuración');
    }
});

// Genera la interfaz principal a partir de los JSON.
function generarModulos() {
    const container = document.getElementById('modulos-container');
    container.innerHTML = '';

    console.log('Regenerando módulos...', { cascos, modulos });

    // Sección de cascos: selector tipo radio, solo un casco puede estar seleccionado
    generarCascos(container);

    // Propulsión
    if (modulos.propulsion && modulos.propulsion.length > 0) {
        console.log('Generando propulsión:', modulos.propulsion.length, 'items');
        generarCategoriaMultiple('propulsion', 'Propulsión (Motores)', container, modulos.propulsion);
    } else {
        console.warn('No hay propulsión disponible');
    }

    // Armamento
    if (modulos.armamento && modulos.armamento.length > 0) {
        console.log('Generando armamento:', modulos.armamento.length, 'items');
        generarCategoriaMultiple('armamento', 'Armamento', container, modulos.armamento);
    } else {
        console.warn('No hay armamento disponible');
    }

    // Blindaje
    if (modulos.blindaje && modulos.blindaje.length > 0) {
        console.log('Generando blindaje:', modulos.blindaje.length, 'items');
        generarCategoriaMultiple('blindaje', 'Blindaje', container, modulos.blindaje);
    } else {
        console.log('Blindaje no disponible (normal)');
    }
}

// Genera la sección de cascos: un solo radio button activo a la vez.
function generarCascos(container) {
    const seccionCascos = document.createElement('div');
    seccionCascos.className = 'seccion-cascos';
    seccionCascos.innerHTML = '<h3>Selecciona un Casco</h3>';

    const cascoContainer = document.createElement('div');
    cascoContainer.className = 'cascos-container';

    // Recorre todos los tipos de casco del JSON
    Object.entries(cascos || {}).forEach(([tipoKey, items]) => {
        if (!Array.isArray(items)) return;

        items.forEach((casco, index) => {
            const cascoDiv = document.createElement('div');
            cascoDiv.className = 'opcion-casco';

            const radioId = `casco-${tipoKey}-${index}`;
            const isChecked = seleccionados.casco?.nombre === casco.nombre ? 'checked' : '';

            cascoDiv.innerHTML = `
                <label>
                    <input 
                        type="radio" 
                        name="casco" 
                        id="${radioId}"
                        value="${casco.nombre}"
                        data-capacidad="${casco.capacidad_modulos}"
                    >
                    <strong>${casco.nombre}</strong>
                    <span class="capacidad-badge">Cap: ${casco.capacidad_modulos}</span>
                </label>
                <div class="casco-info">
                    <div class="info-item">
                        <span class="info-label">Velocidad:</span>
                        <span class="info-value">${casco.velocidad > 0 ? '+' : ''}${casco.velocidad}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Coste:</span>
                        <span class="info-value">${casco.coste}</span>
                    </div>
                </div>
            `;

            cascoContainer.appendChild(cascoDiv);

            // Evento para seleccionar casco y guardar su capacidad
            const radio = cascoDiv.querySelector('input[type="radio"]');
            if (isChecked) radio.checked = true;

            radio.addEventListener('change', () => {
                seleccionados.casco = {
                    nombre: casco.nombre,
                    velocidad: casco.velocidad,
                    coste: casco.coste,
                    capacidad_modulos: casco.capacidad_modulos
                };
                capacidadModulosActual = casco.capacidad_modulos;
                console.log('Casco seleccionado:', seleccionados.casco);
                actualizarCapacidadUI();
                calcularTotales();
            });
        });
    });

    seccionCascos.appendChild(cascoContainer);
    container.appendChild(seccionCascos);
}

// Genera una categoría con opciones de selección múltiple mediante checkbox.
function generarCategoriaMultiple(categoria, titulo, container, items = []) {
    if (!items || items.length === 0) return;

    const categoriaDiv = document.createElement('div');
    categoriaDiv.className = 'modulo-categoria';
    categoriaDiv.dataset.categoria = categoria;

    // Encabezado desplegable
    const header = document.createElement('div');
    header.className = 'modulo-header';
    header.innerHTML = `
        <span>${titulo}</span>
        <span class="toggle-icon">▼</span>
    `;

    // Contenido con los módulos
    const content = document.createElement('div');
    content.className = 'modulo-content';

    const opciones = document.createElement('div');
    opciones.className = 'opciones-modulo';

    items.forEach((item, index) => {
        const opcion = document.createElement('div');
        opcion.className = 'opcion-modulo';

        const checkboxId = `${categoria}-${index}`;
        const isChecked = (Array.isArray(seleccionados[categoria]) && seleccionados[categoria].some(m => m.nombre === item.nombre)) ? 'checked' : '';

        let htmlInfo = '';
        if (item.velocidad !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Velocidad:</span><span class="info-value">${item.velocidad > 0 ? '+' : ''}${item.velocidad}</span></div>`;
        }
        if (item.ataque !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Ataque:</span><span class="info-value">${item.ataque}</span></div>`;
        }
        if (item.defensa !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Defensa:</span><span class="info-value">${item.defensa}</span></div>`;
        }
        if (item.coste) {
            htmlInfo += `<div class="info-item"><span class="info-label">Coste:</span><span class="info-value">${item.coste}</span></div>`;
        }

        opcion.innerHTML = `
            <label>
                <input 
                    type="checkbox" 
                    id="${checkboxId}"
                    value="${item.nombre}"
                    data-categoria="${categoria}"
                    ${isChecked}
                >
                <strong>${item.nombre}</strong>
            </label>
            <div class="modulo-info">
                ${htmlInfo}
            </div>
        `;

        opciones.appendChild(opcion);

        // Evento para agregar o quitar el módulo de la selección
        const checkbox = opcion.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!Array.isArray(seleccionados[categoria])) {
                    seleccionados[categoria] = [];
                }
                seleccionados[categoria].push(item);
                console.log('Módulo agregado:', categoria, item.nombre);
            } else {
                seleccionados[categoria] = seleccionados[categoria].filter(m => m.nombre !== item.nombre);
                console.log('Módulo removido:', categoria, item.nombre);
            }
            actualizarCapacidadUI();
            calcularTotales();
        });
    });

    content.appendChild(opciones);

    // Permite expandir o contraer la categoría
    header.addEventListener('click', () => {
        header.classList.toggle('active');
        content.classList.toggle('active');
    });

    categoriaDiv.appendChild(header);
    categoriaDiv.appendChild(content);
    container.appendChild(categoriaDiv);
}

// Calcula estadísticas y coste totales a partir de las selecciones.
function calcularTotales() {
    let velocidadTotal = 0;
    let ataqueTotal = 0;
    let defensaTotal = 0;
    let costeTotal = 0;

    // Procesar casco
    if (seleccionados.casco) {
        velocidadTotal += seleccionados.casco.velocidad || 0;
        costeTotal += parsearCoste(seleccionados.casco.coste);
    }

    // Procesar propulsión, armamento, blindaje (arrays)
    ['propulsion', 'armamento', 'blindaje'].forEach(cat => {
        if (Array.isArray(seleccionados[cat])) {
            seleccionados[cat].forEach(modulo => {
                if (modulo) {
                    velocidadTotal += modulo.velocidad || 0;
                    
                    if (typeof modulo.ataque === 'number') {
                        ataqueTotal += modulo.ataque;
                    } else if (typeof modulo.ataque === 'string') {
                        const numeros = modulo.ataque.match(/\d+/g);
                        if (numeros) {
                            ataqueTotal += numeros.reduce((sum, num) => sum + parseInt(num), 0);
                        }
                    }

                    if (typeof modulo.defensa === 'string') {
                        const numeros = modulo.defensa.match(/\d+/g);
                        if (numeros) {
                            defensaTotal += numeros.reduce((sum, num) => sum + parseInt(num), 0);
                        }
                    }
                    
                    costeTotal += parsearCoste(modulo.coste);
                }
            });
        }
    });

    // Actualizar UI
    document.getElementById('velocidad-total').textContent = velocidadTotal;
    document.getElementById('ataque-total').textContent = ataqueTotal;
    document.getElementById('defensa-total').textContent = defensaTotal;
    document.getElementById('coste-total').textContent = `${costeTotal}M`;
}

// Actualiza la capacidad visual de módulos del casco seleccionado.
function actualizarCapacidadUI() {
    const modulosColocados = (seleccionados.propulsion?.length || 0) +
                             (seleccionados.armamento?.length || 0) +
                             (seleccionados.blindaje?.length || 0);

    const capacidadTotal = capacidadModulosActual;
    const modulosRestantes = Math.max(0, capacidadTotal - modulosColocados);

    const capacidadEl = document.getElementById('capacidad-modulos');
    if (capacidadEl) {
        capacidadEl.innerHTML = `
            <span class="capacidad-usado">${modulosColocados}</span> /
            <span class="capacidad-total">${capacidadTotal}</span>
            <span class="capacidad-restante">(${modulosRestantes} disponibles)</span>
        `;
    }
}

// Convierte un coste como "2M" en un número útil para sumar.
function parsearCoste(coste) {
    if (!coste) return 0;
    return parseInt(coste.toString().replace(/[^0-9]/g, '')) || 0;
}

// Asocia eventos a los botones principales del formulario.
function agregarEventListeners() {
    // Botón Guardar
    document.getElementById('btn-guardar').addEventListener('click', () => {
        guardarFicha();
    });

    // Botón Limpiar
    document.getElementById('btn-limpiar').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas limpiar todos los datos?')) {
            limpiarFormulario();
        }
    });
}

// Guarda la ficha actual como archivo JSON.
function guardarFicha() {
    if (!seleccionados.casco) {
alert('Debes seleccionar un casco primero');
        return;
    }

    const nombre = document.getElementById('nombre').value || 'Ficha Sin Nombre';
    const tipo = document.getElementById('tipo').value || 'No especificado';
    const pais = document.getElementById('pais').value || 'No especificado';
    const descripcion = document.getElementById('descripcion').value || '';

    const ficha = {
        titulo: nombre,
        fecha: new Date().toLocaleDateString('es-ES'),
        informacion_general: {
            nombre,
            tipo,
            pais
        },
        modulos_seleccionados: {
            casco: seleccionados.casco,
            propulsion: seleccionados.propulsion,
            armamento: seleccionados.armamento,
            blindaje: seleccionados.blindaje
        },
        estadisticas: {
            velocidad: parseInt(document.getElementById('velocidad-total').textContent),
            ataque: parseInt(document.getElementById('ataque-total').textContent),
            defensa: parseInt(document.getElementById('defensa-total').textContent),
            coste: document.getElementById('coste-total').textContent,
            modulos_colocados: (seleccionados.propulsion?.length || 0) + 
                             (seleccionados.armamento?.length || 0) + 
                             (seleccionados.blindaje?.length || 0),
            capacidad_total: capacidadModulosActual
        },
        descripcion
    };

    // Crear descarga JSON
    const dataStr = JSON.stringify(ficha, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombre.replace(/\s+/g, '-').toLowerCase()}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Ficha guardada como JSON');
}

// Reinicia el formulario y borra todas las selecciones.
function limpiarFormulario() {
    document.getElementById('nombre').value = '';
    document.getElementById('tipo').value = '';
    document.getElementById('pais').value = '';
    document.getElementById('descripcion').value = '';

    seleccionados = {
        "casco": null,
        "propulsion": [],
        "armamento": [],
        "blindaje": []
    };

    capacidadModulosActual = 0;
    generarModulos();
    actualizarCapacidadUI();
    calcularTotales();
}
