/**
 * CREADOR DE FICHAS DE TANQUES Y VEHÍCULOS BLINDADOS - betaWorld
 * Sistema de construcción de blindados con selección modular,
 * importador de módulos personalizados (chasis y armamento) y
 * cálculo automático de peso/capacidad/velocidad.
 */

// Estado global de la aplicación
let chasisBase = {};                 // chazi.json -> { chasis: [], sistemas_traccion: [] }
let modulos = {};                    // modulo.json -> { motores, blindajes, comunicacion }
let chasisPersonalizados = [];       // chasis importados por el usuario (plantilla chazispersona.json)
let armamentosPersonalizados = [];   // armamento importado por el usuario (plantilla armapersona.json)
let seleccionados = {};
let estiloBlindajeActual = 'P';      // 'P' (Grande) o 'L' (Chico), según el chasis
let categoriaAbierta = {};
let capacidadPiezasActual = 0;       // Capacidad de piezas del chasis seleccionado

/* ============================================================
   HELPERS DE CATEGORÍAS Y CANTIDADES
   ============================================================ */

function obtenerCantidadEnCategoria(estado, categoria, nombreModulo) {
    if (!estado || !Array.isArray(estado[categoria])) return 0;
    const modulo = estado[categoria].find(item => item && item.nombre === nombreModulo);
    return modulo ? Number(modulo.cantidad || 0) : 0;
}

// Cuenta las piezas ocupadas en una categoría.
// Cada unidad usa `espacios_piezas` si el módulo lo define; si no, ocupa 1 pieza.
function contarPiezasCategoria(estado, categoria) {
    if (!estado || !Array.isArray(estado[categoria])) return 0;
    return estado[categoria].reduce(
        (sum, item) => sum + (Number(item?.espacios_piezas || 1)) * (Number(item?.cantidad || 0)),
        0
    );
}

// Piezas totales usadas en todas las categorías de módulos.
function calcularPiezasUsadas(estado = seleccionados) {
    if (!estado) return 0;
    return ['traccion', 'motor', 'comunicacion', 'blindaje', 'armamento'].reduce(
        (sum, cat) => sum + contarPiezasCategoria(estado, cat),
        0
    );
}

// Determina si el vehículo no supera el límite de piezas del chasis.
function esValidoPorPiezas(estado = seleccionados) {
    return capacidadPiezasActual === 0 || calcularPiezasUsadas(estado) <= capacidadPiezasActual;
}

function obtenerEstadoCopia() {
    return {
        chasis: seleccionados.chasis ? { ...seleccionados.chasis } : null,
        traccion: Array.isArray(seleccionados.traccion) ? seleccionados.traccion.map(m => ({ ...m })) : [],
        motor: Array.isArray(seleccionados.motor) ? seleccionados.motor.map(m => ({ ...m })) : [],
        comunicacion: Array.isArray(seleccionados.comunicacion) ? seleccionados.comunicacion.map(m => ({ ...m })) : [],
        blindaje: Array.isArray(seleccionados.blindaje) ? seleccionados.blindaje.map(m => ({ ...m })) : [],
        armamento: Array.isArray(seleccionados.armamento) ? seleccionados.armamento.map(m => ({ ...m })) : []
    };
}

/* ============================================================
   LÓGICA MATEMÁTICA Y REGLAS DE TANQUES
   ============================================================ */

// Devuelve la letra P o L del chasis seleccionado (por defecto 'P')
function obtenerEstiloBlindaje(estado = seleccionados) {
    const c = estado && estado.chasis;
    if (c && c.tipo_blindaje) return c.tipo_blindaje === 'L' ? 'L' : 'P';
    return 'P';
}

// Capacidad extra por Sistema de Tracción.
// (cantidad de piezas / unidades_por_grupo) * peso_extra_por_grupo
function capacidadTraccion(estado = seleccionados) {
    let extra = 0;
    (estado && estado.traccion || []).forEach(t => {
        const cant = Number(t.cantidad || 0);
        const porGrupo = Number(t.unidades_por_grupo || 0);
        if (cant > 0 && porGrupo > 0) {
            extra += Math.floor(cant / porGrupo) * Number(t.peso_extra_por_grupo || 0);
        }
    });
    return Number(extra.toFixed(2));
}

// Capacidad de Peso Total = Capacidad base del Motor + Capacidad extra por Tracción
function capacidadPesoTotal(estado = seleccionados) {
    let motorCap = 0;
    (estado && estado.motor || []).forEach(m => {
        const cant = Number(m.cantidad || 0);
        if (cant > 0) motorCap += Number(m.capacidad_peso || 0) * cant;
    });
    return Number((motorCap + capacidadTraccion(estado)).toFixed(2));
}

// Peso del chasis seleccionado
function pesoChasis(estado = seleccionados) {
    return estado && estado.chasis ? parseFloat(estado.chasis.peso || 0) : 0;
}

// Peso del blindaje según el estilo del chasis (P -> peso_P, L -> peso_L)
function pesoBlindaje(estado = seleccionados) {
    const estilo = obtenerEstiloBlindaje(estado);
    let peso = 0;
    (estado && estado.blindaje || []).forEach(b => {
        const cant = Number(b.cantidad || 0);
        const val = estilo === 'P' ? b.peso_P : b.peso_L;
        peso += (val === undefined ? 0 : parseFloat(val || 0)) * cant;
    });
    return Number(peso.toFixed(2));
}

// Peso del armamento instalado
function pesoArmamento(estado = seleccionados) {
    let peso = 0;
    (estado && estado.armamento || []).forEach(a => {
        const cant = Number(a.cantidad || 0);
        peso += (a.peso === undefined ? 0 : parseFloat(a.peso || 0)) * cant;
    });
    return Number(peso.toFixed(2));
}

// Peso Total = Chasis + Blindaje + Armamento
function pesoTotal(estado = seleccionados) {
    return Number((pesoChasis(estado) + pesoBlindaje(estado) + pesoArmamento(estado)).toFixed(2));
}

// Velocidad Total = Velocidad del Motor + Velocidad del Sistema de Comunicación
function velocidadTotal(estado = seleccionados) {
    let vel = 0;
    (estado && estado.motor || []).forEach(m => {
        const cant = Number(m.cantidad || 0);
        vel += (m.velocidad === undefined ? 0 : parseFloat(m.velocidad || 0)) * cant;
    });
    (estado && estado.comunicacion || []).forEach(c => {
        const cant = Number(c.cantidad || 0);
        vel += (c.velocidad === undefined ? 0 : parseFloat(c.velocidad || 0)) * cant;
    });
    return Number(vel.toFixed(2));
}

// HP proviene del chasis
function hpTotal(estado = seleccionados) {
    return estado && estado.chasis ? parseFloat(estado.chasis.hp || 0) : 0;
}

// Ataque Total = suma del ataque del armamento + sistemas de comunicación
function ataqueTotal(estado = seleccionados) {
    let atq = 0;
    (estado && estado.armamento || []).forEach(a => {
        const cant = Number(a.cantidad || 0);
        atq += (a.ataque === undefined ? 0 : parseFloat(a.ataque || 0)) * cant;
    });
    (estado && estado.comunicacion || []).forEach(c => {
        const cant = Number(c.cantidad || 0);
        atq += (c.ataque === undefined ? 0 : parseFloat(c.ataque || 0)) * cant;
    });
    return Number(atq.toFixed(2));
}

// Defensa Total = valor de blindaje consumido (blindaje_P o blindaje_L según chasis)
function defensaTotal(estado = seleccionados) {
    const estilo = obtenerEstiloBlindaje(estado);
    let def = 0;
    (estado && estado.blindaje || []).forEach(b => {
        const cant = Number(b.cantidad || 0);
        const val = estilo === 'P' ? b.blindaje_P : b.blindaje_L;
        def += (val === undefined ? 0 : parseFloat(val || 0)) * cant;
    });
    return Number(def.toFixed(2));
}

function parsearCoste(coste) {
    if (coste === undefined || coste === null) return 0;
    if (typeof coste === 'number') return coste;
    if (typeof coste === 'string') return parseFloat(coste.toString().replace(/[^0-9.]/g, '')) || 0;
    return 0;
}

// Coste Total de todos los módulos seleccionados
function costeTotal(estado = seleccionados) {
    let coste = 0;
    if (estado && estado.chasis) coste += parsearCoste(estado.chasis.coste);

    ['traccion', 'motor', 'comunicacion', 'blindaje', 'armamento'].forEach(cat => {
        (estado && estado[cat] || []).forEach(mod => {
            const cant = Number(mod.cantidad || 0);
            coste += parsearCoste(mod.coste) * cant;
        });
    });

    return Number(coste.toFixed(2));
}

// Determina si el vehículo es válido según el peso
function esValidoPorPeso(estado = seleccionados) {
    const cap = capacidadPesoTotal(estado);
    const peso = pesoTotal(estado);
    return peso <= cap && cap > 0;
}

/* ============================================================
   CARGA DE DATOS (el armamento NO se precarga: es personalizado)
   ============================================================ */

async function cargarDatos() {
    try {
        const [resChazi, resModulo] = await Promise.all([
            fetch('../data/vehiculos/tanque/chazi.json'),
            fetch('../data/vehiculos/tanque/modulo.json')
        ]);

        chasisBase = await resChazi.json();
        modulos = await resModulo.json();

        // Motor base automático (primer motor disponible)
        const motorBase = Array.isArray(modulos.motores) && modulos.motores.length > 0
            ? [{ ...modulos.motores[0], cantidad: 1 }]
            : [];

        seleccionados = {
            chasis: null,
            traccion: [],
            motor: motorBase,
            comunicacion: [],
            blindaje: [],
            armamento: []
        };

        capacidadPiezasActual = 0;

        return true;
    } catch (error) {
        console.error('Error cargando JSONs de tanques:', error);
        return false;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        const cargado = await cargarDatos();
        if (cargado) {
            generarModulos();
            agregarEventListeners();
            agregarImportador();
            actualizarUI();
            calcularTotales();
            actualizarCapacidadUI();
        } else {
            alert('Error: No se pudo cargar el archivo de configuración');
        }
    });
}

/* ============================================================
   GENERACIÓN DE LA INTERFAZ (CHASIS / MÓDULOS)
   ============================================================ */

function generarModulos() {
    const container = document.getElementById('modulos-container');
    if (!container) return;
    container.innerHTML = '';

    generarChasis(container);

    // TODOS los módulos son multiselección (los contadores + / - permiten
    // elegir la cantidad de unidades de cada módulo)
    if (modulos.motores && modulos.motores.length > 0) {
        generarCategoriaMultiple('motor', 'Motores (multiselección)', container, modulos.motores);
    }
    if (modulos.comunicacion && modulos.comunicacion.length > 0) {
        generarCategoriaMultiple('comunicacion', 'Sistemas de Comunicación (multiselección)', container, modulos.comunicacion);
    }
    if (modulos.blindajes && modulos.blindajes.length > 0) {
        generarCategoriaMultiple('blindaje', 'Blindaje (P/L según chasis)', container, modulos.blindajes);
    }
    if (chasisBase.sistemas_traccion && chasisBase.sistemas_traccion.length > 0) {
        generarCategoriaMultiple('traccion', 'Sistema de Tracción (Llantas / Orugas)', container, chasisBase.sistemas_traccion);
    }

    // El armamento SOLO proviene del importador del usuario.
    if (armamentosPersonalizados.length > 0) {
        generarCategoriaMultiple('armamento', 'Armamento', container, armamentosPersonalizados);
    }
}

/* Genera las tarjetas de selección de chasis (radio), incluyendo
   los chasis personalizados importados. */
function generarChasis(container) {
    const seccionChasis = document.createElement('div');
    seccionChasis.className = 'seccion-cascos';
    seccionChasis.innerHTML = '<h3>Selecciona un Chasis</h3>';

    const chasisContainer = document.createElement('div');
    chasisContainer.className = 'cascos-container';

    const lista = (chasisBase.chasis || []).concat(chasisPersonalizados);

    lista.forEach((chasis, index) => {
        const chasisDiv = document.createElement('div');
        chasisDiv.className = 'opcion-casco';

        const radioId = `chasis-${index}`;
        const isChecked = seleccionados.chasis && seleccionados.chasis.nombre === chasis.nombre ? 'checked' : '';
        const estilo = chasis.tipo_blindaje === 'L' ? 'L' : 'P';

        chasisDiv.innerHTML = `
            <label>
                <input type="radio" name="chasis" id="${radioId}" value="${chasis.nombre}" ${isChecked}>
                <strong>${chasis.nombre}</strong>
                <span class="capacidad-badge">${chasis.tipo_blindaje === 'L' ? 'L' : 'P'}</span>
            </label>
            <div class="casco-info">
                <div class="info-item"><span class="info-label">Piezas:</span><span class="info-value">${chasis.capacidad_piezas}</span></div>
                <div class="info-item"><span class="info-label">Peso:</span><span class="info-value">${chasis.peso}</span></div>
                <div class="info-item"><span class="info-label">HP:</span><span class="info-value">${chasis.hp}</span></div>
                <div class="info-item"><span class="info-label">Coste:</span><span class="info-value">${chasis.coste}M</span></div>
            </div>
        `;

        chasisContainer.appendChild(chasisDiv);

        const radio = chasisDiv.querySelector('input[type="radio"]');
        radio.addEventListener('change', () => {
            seleccionados.chasis = { ...chasis };
            estiloBlindajeActual = estilo;
            capacidadPiezasActual = Number(chasis.capacidad_piezas || 0);
            // Limpiar blindaje para que se actualice el estilo P/L
            seleccionados.blindaje = [];
            generarModulos();
            actualizarUI();
            calcularTotales();
            actualizarCapacidadUI();
        });
    });

    seccionChasis.appendChild(chasisContainer);
    container.appendChild(seccionChasis);
}

/* Categoría con múltiple: todas las categorías son multiselección.
   Los contadores + / - permiten elegir la cantidad de unidades de cada
   módulo (motor, comunicación, blindaje, tracción, armamento). */
function generarCategoriaMultiple(categoria, titulo, container, items = []) {
    if (!items || items.length === 0) return;

    const debeEstarAbierta = categoriaAbierta[categoria] ?? true;
    categoriaAbierta[categoria] = debeEstarAbierta;

    const categoriaDiv = document.createElement('div');
    categoriaDiv.className = 'modulo-categoria';
    categoriaDiv.dataset.categoria = categoria;

    const header = document.createElement('div');
    header.className = 'modulo-header';
    header.innerHTML = `<span>${titulo}</span><span class="toggle-icon">▼</span>`;

    const content = document.createElement('div');
    content.className = 'modulo-content';
    if (debeEstarAbierta) {
        content.classList.add('active');
        header.classList.add('active');
    }

    const opciones = document.createElement('div');
    opciones.className = 'opciones-modulo';

    items.forEach((item, index) => {
        const opcion = document.createElement('div');
        opcion.className = 'opcion-modulo';

        const cantidadActual = obtenerCantidadEnCategoria(seleccionados, categoria, item.nombre);

        // Simula añadir una unidad más para saber si aún cabe dentro del límite de piezas.
        const estadoSimulado = JSON.parse(JSON.stringify(seleccionados));
        const categoriaSimulada = Array.isArray(estadoSimulado[categoria]) ? estadoSimulado[categoria] : [];
        const modSimulado = categoriaSimulada.find(m => m && m.nombre === item.nombre);
        if (modSimulado) {
            modSimulado.cantidad = (Number(modSimulado.cantidad || 0) + 1);
        } else {
            estadoSimulado[categoria] = [...categoriaSimulada, { ...item, cantidad: 1 }];
        }
        const puedeSumar = esValidoPorPiezas(estadoSimulado);

        let htmlInfo = '';
        // Motor: muestra velocidad y capacidad de peso
        if (categoria === 'motor') {
            if (item.velocidad !== undefined) htmlInfo += `<div class="info-item"><span class="info-label">Velocidad:</span><span class="info-value">+${item.velocidad}</span></div>`;
            if (item.capacidad_peso !== undefined) htmlInfo += `<div class="info-item"><span class="info-label">Cap. Peso:</span><span class="info-value">${item.capacidad_peso}</span></div>`;
        }
        // Comunicación: velocidad y ataque
        if (categoria === 'comunicacion') {
            if (item.velocidad !== undefined) htmlInfo += `<div class="info-item"><span class="info-label">Velocidad:</span><span class="info-value">+${item.velocidad}</span></div>`;
            if (item.ataque !== undefined) htmlInfo += `<div class="info-item"><span class="info-label">Ataque:</span><span class="info-value">+${item.ataque}</span></div>`;
        }
        // Blindaje: blindaje P/L y peso P/L según el chasis
        if (categoria === 'blindaje') {
            htmlInfo += `<div class="info-item"><span class="info-label">Blindaje P:</span><span class="info-value">${item.blindaje_P}</span></div>`;
            htmlInfo += `<div class="info-item"><span class="info-label">Blindaje L:</span><span class="info-value">${item.blindaje_L}</span></div>`;
            htmlInfo += `<div class="info-item"><span class="info-label">Peso P/L:</span><span class="info-value">${item.peso_P}/${item.peso_L}</span></div>`;
        }
        // Tracción: regla y bonus/unidades
        if (categoria === 'traccion') {
            if (item.regla_capacidad) htmlInfo += `<div class="info-item"><span class="info-label">Regla:</span><span class="info-value">${item.regla_capacidad}</span></div>`;
            htmlInfo += `<div class="info-item"><span class="info-label">Bonus/Unidades:</span><span class="info-value">+${item.peso_extra_por_grupo} / ${item.unidades_por_grupo}</span></div>`;
        }
        // Armamento: ataque y peso
        if (categoria === 'armamento') {
            if (item.ataque !== undefined) htmlInfo += `<div class="info-item"><span class="info-label">Ataque:</span><span class="info-value">+${item.ataque}</span></div>`;
            if (item.peso !== undefined) htmlInfo += `<div class="info-item"><span class="info-label">Peso:</span><span class="info-value">${item.peso}</span></div>`;
        }
        if (item.coste !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Coste:</span><span class="info-value">${item.coste}M</span></div>`;
        }

        opcion.innerHTML = `
            <div class="modulo-topline">
                <strong>${item.nombre}</strong>
            </div>
            <div class="modulo-info">${htmlInfo}</div>
            <div class="modulo-controls">
                <button type="button" class="qty-btn" data-action="decrement" data-categoria="${categoria}" data-item="${item.nombre}" ${cantidadActual <= 0 ? 'disabled' : ''}>-</button>
                <span class="qty-value" id="cantidad-${categoria}-${index}">${cantidadActual}</span>
                <button type="button" class="qty-btn" data-action="increment" data-categoria="${categoria}" data-item="${item.nombre}" ${!puedeSumar ? 'disabled' : ''}>+</button>
            </div>
        `;

        opciones.appendChild(opcion);

        const btnMenos = opcion.querySelector('[data-action="decrement"]');
        const btnMas = opcion.querySelector('[data-action="increment"]');

        btnMenos.addEventListener('click', () => manejarCambioCantidad(categoria, item, 'decrement'));
        btnMas.addEventListener('click', () => manejarCambioCantidad(categoria, item, 'increment'));
    });

    content.appendChild(opciones);

    header.addEventListener('click', () => {
        const abrir = !content.classList.contains('active');
        header.classList.toggle('active', abrir);
        content.classList.toggle('active', abrir);
        categoriaAbierta[categoria] = abrir;
    });

    categoriaDiv.appendChild(header);
    categoriaDiv.appendChild(content);
    container.appendChild(categoriaDiv);
}

function manejarCambioCantidad(categoria, item, accion) {
    const cantidadActual = obtenerCantidadEnCategoria(seleccionados, categoria, item.nombre);
    const cantidadObjetivo = accion === 'increment' ? cantidadActual + 1 : cantidadActual - 1;

    if (cantidadObjetivo < 0) return;

    const proximoEstado = obtenerEstadoCopia();
    const categoriaActual = proximoEstado[categoria];
    const existente = categoriaActual.find(mod => mod && mod.nombre === item.nombre);

    if (cantidadObjetivo === 0) {
        proximoEstado[categoria] = categoriaActual.filter(mod => mod.nombre !== item.nombre);
    } else if (existente) {
        existente.cantidad = cantidadObjetivo;
        proximoEstado[categoria] = categoriaActual.map(mod => mod.nombre === item.nombre ? existente : mod);
    } else {
        proximoEstado[categoria] = [...categoriaActual, { ...item, cantidad: cantidadObjetivo }];
    }

    // Verificador de piezas: no permitir superar la capacidad del chasis.
    if (capacidadPiezasActual > 0 && calcularPiezasUsadas(proximoEstado) > capacidadPiezasActual) {
        alert(`No puedes exceder la capacidad de piezas del chasis. Máximo ${capacidadPiezasActual} piezas.`);
        return;
    }

    seleccionados = proximoEstado;
    generarModulos();
    actualizarUI();
    calcularTotales();
    actualizarCapacidadUI();
}

/* ============================================================
   IMPORTADOR DE MÓDULOS PERSONALIZADOS (CHASIS Y ARMAMENTO)
   ============================================================ */

function agregarImportador() {
    const importChasis = document.getElementById('import-chasis');
    const importArmamento = document.getElementById('import-armamento');

    if (importChasis) {
        importChasis.addEventListener('change', (e) => {
            const archivo = e.target.files[0];
            if (archivo) procesarImportacionChasis(archivo);
            e.target.value = '';
        });
    }

    if (importArmamento) {
        importArmamento.addEventListener('change', (e) => {
            const archivo = e.target.files[0];
            if (archivo) procesarImportacionArmamento(archivo);
            e.target.value = '';
        });
    }
}

function procesarImportacionChasis(archivo) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const chasisImportados = extraerChasisPlantilla(data);

            if (chasisImportados.length === 0) {
                alert('El JSON no contiene un chasis válido según la plantilla chazispersona.json.');
                return;
            }

            chasisPersonalizados = chasisPersonalizados.concat(chasisImportados);
            mostrarMensajeImportacion(`Chasis "${chasisImportados[0].nombre}" importado correctamente.`);
            generarModulos();
        } catch (err) {
            alert('Error: El archivo no es un JSON válido de chasis.');
            console.error(err);
        }
    };
    reader.readAsText(archivo);
}

function procesarImportacionArmamento(archivo) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const armasImportadas = extraerArmamentoPlantilla(data);

            if (armasImportadas.length === 0) {
                alert('El JSON no contiene un armamento válido según la plantilla armapersona.json.');
                return;
            }

            armamentosPersonalizados = armamentosPersonalizados.concat(armasImportadas);
            mostrarMensajeImportacion(`Armamento "${armasImportadas[0].nombre}" importado correctamente.`);
            generarModulos();
        } catch (err) {
            alert('Error: El archivo no es un JSON válido de armamento.');
            console.error(err);
        }
    };
    reader.readAsText(archivo);
}

// Extrae chasis desde la plantilla chazispersona.json.
// Campos: Nombre, Capacidad de piezas, Peso, HP, Costo de producción
function extraerChasisPlantilla(data) {
    const resultados = [];
    const mapear = (obj) => {
        if (!obj || !obj.Nombre) return;
        const limpiar = (v) => String(v || '').trim();
        const numero = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

        resultados.push({
            id: 'pers_chasis_' + Date.now() + "_" + resultados.length,
            nombre: limpiar(obj.Nombre),
            tipo_blindaje: limpiar(obj["Tipo de blindaje"] || obj.tipo_blindaje || "P").toUpperCase() === "L" ? "L" : "P",
            capacidad_piezas: numero(obj["Capacidad de piezas"] ?? obj.capacidad_piezas),
            peso: numero(obj["Peso"] ?? obj.peso),
            hp: numero(obj["HP"] ?? obj.hp),
            coste: numero(obj["Costo de producción"] ?? obj.coste)
        });
    };

    if (Array.isArray(data)) {
        data.forEach(mapear);
    } else if (Array.isArray(data.chasis)) {
        data.chasis.forEach(mapear);
    } else if (Array.isArray(data.chasis_personalizados)) {
        data.chasis_personalizados.forEach(mapear);
    } else {
        mapear(data);
    }

    return resultados;
}

// Extrae armamento desde la plantilla armapersona.json.
// Campos: Nombre, Ataque, Peso, Coste de producción
function extraerArmamentoPlantilla(data) {
    const resultados = [];
    const mapear = (obj) => {
        if (!obj || !obj.Nombre) return;
        const limpiar = (v) => String(v || '').trim();
        const numero = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

        resultados.push({
            id: 'pers_arma_' + Date.now() + '_' + resultados.length,
            nombre: limpiar(obj.Nombre),
            ataque: numero(obj["Ataque"] ?? obj.ataque),
            peso: numero(obj["Peso"] ?? obj.peso),
            coste: numero(obj["Coste de producción"] ?? obj.coste)
        });
    };

    if (Array.isArray(data)) {
        data.forEach(mapear);
    } else if (Array.isArray(data.armamento)) {
        data.armamento.forEach(mapear);
    } else if (Array.isArray(data.armas)) {
        data.armas.forEach(mapear);
    } else {
        mapear(data);
    }

    return resultados;
}

function mostrarMensajeImportacion(mensaje) {
    const aviso = document.getElementById('aviso-importacion');
    if (aviso) {
        aviso.textContent = mensaje;
        aviso.style.display = 'block';
        setTimeout(() => { aviso.style.display = 'none'; }, 4000);
    }
}

/* ============================================================
   CÁLCULO DE TOTALES Y ACTUALIZACIÓN DE LA UI
   ============================================================ */

function actualizarUI() {
    actualizarComprobante();
    actualizarAdvertenciaPeso();
    actualizarCapacidadUI();
}

// Muestra el contador de piezas usadas / capacidad del chasis.
function actualizarCapacidadUI() {
    const capacidadEl = document.getElementById('capacidad-piezas');
    if (!capacidadEl) return;

    const piezasColocadas = calcularPiezasUsadas(seleccionados);
    const capacidadTotal = capacidadPiezasActual;
    const piezasRestantes = Math.max(0, capacidadTotal - piezasColocadas);

    if (capacidadTotal > 0) {
        capacidadEl.innerHTML = `
            <span class="capacidad-usado">${piezasColocadas}</span> /
            <span class="capacidad-total">${capacidadTotal}</span>
            <span class="capacidad-restante">(${piezasRestantes} disponibles)</span>
        `;
    } else {
        capacidadEl.textContent = '0 / 0';
    }
}

function actualizarComprobante() {
    const comprobante = document.getElementById('comprobante-modulos');
    const cap = capacidadPesoTotal();
    const peso = pesoTotal();
    const motor = (seleccionados.motor || []).find(m => Number(m.cantidad || 0) > 0);
    const traccionExtra = capacidadTraccion();

    if (comprobante) {
        const porcentaje = cap > 0 ? Math.round((peso / cap) * 100) : 0;
        comprobante.innerHTML = `
            <strong>Comprobante de peso:</strong>
            <span>Peso ${peso.toFixed(2)} / Cap. ${cap.toFixed(2)} (${porcentaje}%)</span>
            <small>${motor ? `Motor base: ${motor.nombre}` : 'Sin motor base'}</small>
            <small>Capacidad extra por tracción: +${traccionExtra.toFixed(2)}</small>
        `;
    }
}

function actualizarAdvertenciaPeso() {
    const aviso = document.getElementById('peso-advertencia');
    if (!aviso) return;

    if (!seleccionados.chasis) {
        aviso.style.display = 'none';
        return;
    }

    const cap = capacidadPesoTotal();
    const peso = pesoTotal();
    const valido = peso <= cap && cap > 0;

    if (!valido) {
        aviso.style.display = 'block';
        aviso.style.background = '#ffe6e6';
        aviso.style.border = '2px solid #ff6b6b';
        aviso.style.color = '#c92a2a';
        aviso.style.padding = '10px';
        aviso.style.borderRadius = '6px';
        aviso.style.marginBottom = '12px';
        aviso.textContent = `Advertencia: El vehículo supera la capacidad de peso (${peso.toFixed(2)} / ${cap.toFixed(2)}). Este diseño no es válido. Reduce armamento o blindaje.`;
    } else {
        aviso.style.display = 'none';
    }
}

function calcularTotales() {
    const cap = capacidadPesoTotal();
    const peso = pesoTotal();
    const valido = esValidoPorPeso();

    const set = (id, valor, sufijo = '') => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${valor}${sufijo}`;
    };

    set('hp-total', hpTotal().toFixed(2));
    set('velocidad-total', velocidadTotal().toFixed(2));
    set('ataque-total', ataqueTotal().toFixed(2));
    set('defensa-total', defensaTotal().toFixed(2));
    set('peso-total', peso.toFixed(2));
    set('cap-peso-total', cap.toFixed(2));
    set('coste-total', costeTotal().toFixed(2), 'M');

    const estadoValidez = document.getElementById('estado-validez');
    if (estadoValidez) {
        if (!seleccionados.chasis) {
            estadoValidez.textContent = 'Selecciona un chasis';
            estadoValidez.style.color = '#888';
        } else if (valido) {
            estadoValidez.textContent = 'Diseño VÁLIDO';
            estadoValidez.style.color = '#2b8a3e';
        } else {
            estadoValidez.textContent = 'Diseño NO VÁLIDO (peso excede)';
            estadoValidez.style.color = '#c92a2a';
        }
    }

    actualizarAdvertenciaPeso();
    actualizarComprobante();
}

/* ============================================================
   GUARDAR / LIMPIAR FICHA
   ============================================================ */

function agregarEventListeners() {
    const guardarBtn = document.getElementById('btn-guardar');
    const limpiarBtn = document.getElementById('btn-limpiar');

    if (guardarBtn) {
        guardarBtn.addEventListener('click', () => guardarFicha());
    }

    if (limpiarBtn) {
        limpiarBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas limpiar todos los datos?')) {
                limpiarFormulario();
            }
        });
    }
}

function guardarFicha() {
    if (!seleccionados.chasis) {
        alert('Debes seleccionar un chasis primero');
        return;
    }

    if (!esValidoPorPeso()) {
        alert('No puedes guardar una ficha que supera el límite de peso. Revisa la configuración.');
        return;
    }

    if (!esValidoPorPiezas()) {
        alert(`No puedes guardar una ficha que supera la capacidad de piezas. Máximo ${capacidadPiezasActual} piezas.`);
        return;
    }

    const nombre = document.getElementById('nombre').value || 'Ficha Sin Nombre';
    const ano = document.getElementById('fecha').value || 'Año no especificado';
    const tipo = document.getElementById('tipo').value || 'No especificado';
    const pais = document.getElementById('pais').value || 'No especificado';
    const descripcion = document.getElementById('descripcion').value || '';

    const ficha = {
        titulo: nombre,
        fecha: ano,
        informacion_general: {
            nombre,
            tipo,
            fecha: ano,
            pais
        },
        modulos_seleccionados: {
            chasis: seleccionados.chasis,
            traccion: seleccionados.traccion,
            motor: seleccionados.motor,
            comunicacion: seleccionados.comunicacion,
            blindaje: seleccionados.blindaje,
            armamento: seleccionados.armamento
        },
        comprobante_modulos: {
            peso_total: pesoTotal(),
            capacidad_peso_total: capacidadPesoTotal(),
            piezas_usadas: calcularPiezasUsadas(),
            capacidad_piezas_total: capacidadPiezasActual,
            valido_por_piezas: esValidoPorPiezas(),
            valido: esValidoPorPeso(),
            estilo_blindaje: obtenerEstiloBlindaje()
        },
        estadisticas: {
            hp: hpTotal(),
            velocidad: velocidadTotal(),
            ataque: ataqueTotal(),
            defensa: defensaTotal(),
            peso_total: pesoTotal(),
            capacidad_peso_total: capacidadPesoTotal(),
            piezas_colocadas: calcularPiezasUsadas(),
            capacidad_piezas_total: capacidadPiezasActual,
            coste: costeTotal(),
            valido: esValidoPorPeso()
        },
        descripcion
    };

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

function limpiarFormulario() {
    document.getElementById('nombre').value = '';
    document.getElementById('tipo').value = '';
    document.getElementById('pais').value = '';
    document.getElementById('fecha').value = '';
    document.getElementById('descripcion').value = '';

    const motorBase = Array.isArray(modulos.motores) && modulos.motores.length > 0
        ? [{ ...modulos.motores[0], cantidad: 1 }]
        : [];

    seleccionados = {
        chasis: null,
        traccion: [],
        motor: motorBase,
        comunicacion: [],
        blindaje: [],
        armamento: []
    };

    estiloBlindajeActual = 'P';
    categoriaAbierta = {};
    capacidadPiezasActual = 0;
    generarModulos();
    actualizarUI();
    calcularTotales();
    actualizarCapacidadUI();
}

if (typeof module !== 'undefined') {
    module.exports = {
        capacidadPesoTotal,
        pesoTotal,
        velocidadTotal,
        esValidoPorPeso,
        calcularPiezasUsadas,
        esValidoPorPiezas
    };
}
