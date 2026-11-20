/**
 * CREADOR DE FICHAS DE AVIONES - Fichamundi / U-Boat World RPG
 * Sistema de construcción de aeronaves con selección modular.
 */

let fuselajes = [];
let fuselajesBase = [];
let modulosAviacion = {};
let modulosAviacionBase = {};
let seleccionados = {
    fuselaje: null,
    motores: [],
    armamento: [],
    bombas: [],
    torpedos: [],
    alas: []
};
let capacidadPiezasActual = 0;
let categoriaAbierta = {};
let catalogoModulosPersonalizadosListo = false;
let modulosAprobadosPendientes = null;

// Rol del avión: 'caza', 'bombardero' o 'polivalente'.
// Según este valor se decide si la Maniobrabilidad suma al ataque aéreo
// o se convierte en defensa (caso bombardero).
let tipoAvion = 'polivalente';

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

function limpiarMarcaModulo(item) {
    if (!item || typeof item !== 'object') return item;
    const { modulo_personalizado, ...modulo } = item;
    return modulo;
}

function adaptarModuloPersonalizado(module, fields) {
    const content = module?.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
    const modulo = Object.fromEntries(fields
        .filter(field => field !== 'id' && Object.hasOwn(content, field))
        .map(field => [field, content[field]]));
    return {
        ...modulo,
        id: module.id,
        modulo_personalizado: true,
        pais_modulo: module.country,
        coste: Number(module.price)
    };
}

function buscarModuloActualizado(disponibles, guardado) {
    if (!guardado || typeof guardado !== 'object') return null;
    return disponibles.find(item => guardado.id && String(item.id) === String(guardado.id))
        || disponibles.find(item => item.nombre === guardado.nombre)
        || null;
}

function restaurarCategoriaActualizada(disponibles, guardados) {
    if (!Array.isArray(guardados)) return [];
    return guardados.map(guardado => {
        const modulo = buscarModuloActualizado(disponibles, guardado);
        return modulo ? { ...modulo, cantidad: Number(guardado.cantidad ?? 1) } : null;
    }).filter(Boolean);
}

if (typeof window !== 'undefined') {
    window.cargarActualizacionPlantilla = function () {
        const content = window.contextoActualizacionPlantilla?.content;
        if (!content) return;
        const info = content.informacion_general || {};
        const selected = content.componentes_seleccionados || content.modulos_seleccionados || {};
        seleccionados.fuselaje = buscarModuloActualizado(fuselajes, selected.fuselaje);
        seleccionados.motores = restaurarCategoriaActualizada(modulosAviacion.motores || [], selected.motores);
        seleccionados.armamento = restaurarCategoriaActualizada(modulosAviacion.armamento || [], selected.armamento);
        seleccionados.bombas = restaurarCategoriaActualizada(modulosAviacion.bombas || [], selected.bombas);
        seleccionados.torpedos = restaurarCategoriaActualizada(modulosAviacion.torpedos || [], selected.torpedos);
        seleccionados.alas = restaurarCategoriaActualizada(modulosAviacion.alas || [], selected.alas);
        capacidadPiezasActual = Number(seleccionados.fuselaje?.capacidad_piezas || 0);
        tipoAvion = info.tipo || content.tipo || 'polivalente';

        document.getElementById('nombre').value = content.titulo || info.nombre || '';
        document.getElementById('pais').value = window.contextoActualizacionPlantilla.country || info.pais || '';
        document.getElementById('anio').value = info.anio || content.anio || '';
        document.getElementById('descripcion').value = content.descripcion || '';
        generarModulos();
        actualizarCapacidadUI();
        calcularTotales();
    };
}

// --------------------------------------------------------------------------
// Utilidades de acceso a estado
// --------------------------------------------------------------------------
function obtenerCantidadEnCategoria(estado, categoria, nombreModulo) {
    if (!estado || !Array.isArray(estado[categoria])) return 0;
    const modulo = estado[categoria].find(item => item && item.nombre === nombreModulo);
    return modulo ? Number(modulo.cantidad || 0) : 0;
}

function contarPiezasCategoria(estado, categoria) {
    if (!estado || !Array.isArray(estado[categoria])) return 0;
    return estado[categoria].reduce((sum, item) => sum + (Number(item?.espacios_piezas || 0) * Number(item?.cantidad || 0)), 0);
}

function calcularPiezasUsadas(estado = seleccionados) {
    if (!estado) return 0;
    return contarPiezasCategoria(estado, 'motores') +
           contarPiezasCategoria(estado, 'armamento') +
           contarPiezasCategoria(estado, 'bombas') +
           contarPiezasCategoria(estado, 'torpedos') +
           contarPiezasCategoria(estado, 'alas');
}

function obtenerAlasEquipadas(estado = seleccionados) {
    if (!Array.isArray(estado.alas)) return [];
    return estado.alas.filter(item => item && Number(item.cantidad || 0) > 0);
}

function obtenerMotorSeleccionado(estado = seleccionados) {
    const motores = Array.isArray(estado.motores) ? estado.motores.filter(item => item && Number(item.cantidad || 0) > 0) : [];
    return motores.length > 0 ? motores[0] : null;
}

function sumarPorCategoria(estado, categoria, campo) {
    if (!Array.isArray(estado[categoria])) return 0;
    return estado[categoria].reduce((sum, item) => sum + (Number(item?.[campo] || 0) * Number(item?.cantidad || 0)), 0);
}

// --------------------------------------------------------------------------
// Cálculos según reglas de aviación
// --------------------------------------------------------------------------
function calcularPesoTotal(estado = seleccionados) {
    if (!estado || !estado.fuselaje) return 0;

    let peso = Number(estado.fuselaje.peso || 0);
    peso += sumarPorCategoria(estado, 'motores', 'peso');
    peso += sumarPorCategoria(estado, 'armamento', 'peso');
    peso += sumarPorCategoria(estado, 'bombas', 'peso');
    peso += sumarPorCategoria(estado, 'torpedos', 'peso');
    peso += sumarPorCategoria(estado, 'alas', 'peso');

    // Penalización de peso del ala: penalizacion_peso_ala (fuselaje) × cantidad_alas (ala equipada)
    const alasPenalizacion = Number(estado.fuselaje.penalizacion_peso_ala || 0);
    obtenerAlasEquipadas(estado).forEach(ala => {
        peso += alasPenalizacion * Number(ala.cantidad_alas || 0);
    });

    return peso;
}

function calcularVelocidadFinal(estado = seleccionados) {
    // Se suman las velocidades de TODOS los motores equipados (incluida su cantidad).
    const velocidadMotores = sumarPorCategoria(estado, 'motores', 'velocidad');
    if (velocidadMotores === 0) return 0;
    return velocidadMotores - calcularPesoTotal(estado);
}

function calcularAltitud(estado = seleccionados) {
    return Math.max(0, calcularVelocidadFinal(estado) / 5);
}

function calcularManiobrabilidad(estado = seleccionados) {
    const alas = obtenerAlasEquipadas(estado);
    if (alas.length === 0) return 0;
    return Math.max(...alas.map(ala => Number(ala.maniobrabilidad || 0)));
}

function calcularAtaqueAereoBase(estado = seleccionados) {
    return sumarPorCategoria(estado, 'armamento', 'ataque');
}

function calcularAtaqueAereo(estado = seleccionados) {
    const maniobrabilidadEnAtaque = tipoAvion === 'bombardero'
        ? 0
        : calcularManiobrabilidad(estado);
    return calcularAtaqueAereoBase(estado) + maniobrabilidadEnAtaque;
}

function calcularAtaqueTierra(estado = seleccionados) {
    return sumarPorCategoria(estado, 'bombas', 'ataque_tierra');
}

function calcularAtaqueNaval(estado = seleccionados) {
    return sumarPorCategoria(estado, 'torpedos', 'ataque_naval');
}

// Ataque Total: (Ataque aéreo base + Maniobrabilidad) para los tipos
// 'caza' y 'polivalente'. En el caso 'bombardero' la Maniobrabilidad NO se
// suma al ataque aéreo (pasa a ser defensa). Más bombas ('AT') y torpedos ('AN').
// Formato: "10A/14AT"
function calcularAtaqueTotal(estado = seleccionados) {
    const ataqueA = calcularAtaqueAereo(estado);
    const ataqueT = calcularAtaqueTierra(estado);
    const ataqueN = calcularAtaqueNaval(estado);

    const partes = [];
    partes.push(`${ataqueA}A`);
    if (ataqueT > 0) partes.push(`${ataqueT}AT`);
    if (ataqueN > 0) partes.push(`${ataqueN}AN`);
    return partes.length > 0 ? partes.join('/') : '-';
}

// Vida del avión (no incluye defensa; la Maniobrabilidad se maneja aparte).
function calcularVidaTotal(estado = seleccionados) {
    if (!estado || !estado.fuselaje) return 0;
    return Number(estado.fuselaje.vida || 0);
}

// Defensa del avión: en un caza la defensa siempre es 0,
// porque la Maniobrabilidad se usa como ataque aéreo.
// En bombardero la Maniobrabilidad se convierte en defensa.
function calcularDefensaTotal(estado = seleccionados) {
    if (tipoAvion === 'caza') return 0;
    return calcularManiobrabilidad(estado);
}

function calcularCosteTotal(estado = seleccionados) {
    if (!estado || !estado.fuselaje) return 0;
    let coste = Number(estado.fuselaje.coste || 0);
    coste += sumarPorCategoria(estado, 'motores', 'coste');
    coste += sumarPorCategoria(estado, 'armamento', 'coste');
    coste += sumarPorCategoria(estado, 'bombas', 'coste');
    coste += sumarPorCategoria(estado, 'torpedos', 'coste');
    coste += sumarPorCategoria(estado, 'alas', 'coste');
    return coste;
}

// --------------------------------------------------------------------------
// Carga de datos
// --------------------------------------------------------------------------
async function cargarDatos() {
    try {
        const resFuselajes = await fetch('../data/vehiculos/aviones/fuselaje.json');
        const datosFuselajes = await resFuselajes.json();
        fuselajesBase = datosFuselajes.fuselajes || datosFuselajes;
        fuselajes = fuselajesBase;

        const resModulos = await fetch('../data/vehiculos/aviones/modulosaviones.json');
        const datosModulos = await resModulos.json();
        modulosAviacionBase = datosModulos;
        modulosAviacion = modulosAviacionBase;

        const motorBase = Array.isArray(modulosAviacion.motores) && modulosAviacion.motores.length > 0
            ? [{ ...modulosAviacion.motores[0], cantidad: 1 }]
            : [];

        seleccionados = {
            fuselaje: null,
            motores: motorBase,
            armamento: [],
            bombas: [],
            torpedos: [],
            alas: []
        };

        return true;
    } catch (error) {
        console.error('Error cargando JSONs de aviación:', error);
        return false;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        const cargado = await cargarDatos();
        if (cargado) {
            generarModulos();
            agregarEventListeners();
            actualizarCapacidadUI();
            calcularTotales();
            window.cargarActualizacionPlantilla();
            catalogoModulosPersonalizadosListo = true;
            if (modulosAprobadosPendientes) {
                window.aplicarModulosAprobadosAvion(modulosAprobadosPendientes);
                modulosAprobadosPendientes = null;
            }
        } else {
            alert('Error: No se pudo cargar la configuración de aviación');
        }
    });
}

if (typeof window !== 'undefined') {
    window.aplicarModulosAprobadosAvion = (modules) => {
        if (!catalogoModulosPersonalizadosListo) {
            modulosAprobadosPendientes = modules;
            return;
        }
        const byType = new Map();
        modules.forEach(module => {
            const type = module.module_type;
            const base = type === 'fuselaje' ? fuselajesBase : modulosAviacionBase[type];
            if (!Array.isArray(base)) return;
            const fields = [...new Set(base.flatMap(item => Object.keys(item || {})))];
            const adapted = adaptarModuloPersonalizado(module, fields);
            if (!adapted?.nombre) return;
            const list = byType.get(type) || [];
            list.push(adapted);
            byType.set(type, list);
        });
        fuselajes = [...fuselajesBase, ...(byType.get('fuselaje') || [])];
        modulosAviacion = Object.fromEntries(
            Object.entries(modulosAviacionBase).map(([type, items]) => [type, [...items, ...(byType.get(type) || [])]])
        );
        const approvedIds = new Set(modules.map(module => module.id));
        if (seleccionados.fuselaje?.modulo_personalizado && !approvedIds.has(seleccionados.fuselaje.id)) {
            seleccionados.fuselaje = null;
            capacidadPiezasActual = 0;
        }
        ['motores', 'armamento', 'bombas', 'torpedos', 'alas'].forEach(category => {
            seleccionados[category] = (seleccionados[category] || []).filter(module =>
                !module.modulo_personalizado || approvedIds.has(module.id)
            );
        });
        generarModulos();
        actualizarCapacidadUI();
        calcularTotales();
        window.cargarActualizacionPlantilla();
    };
}

// --------------------------------------------------------------------------
// Generación de la interfaz
// --------------------------------------------------------------------------
function generarModulos() {
    const container = document.getElementById('modulos-container');
    if (!container) return;
    container.innerHTML = '';

    generarSelectorTipo(container);
    generarFuselajes(container);

    if (modulosAviacion.motores && modulosAviacion.motores.length > 0) {
        generarCategoriaMultiple('motores', 'Motores', container, modulosAviacion.motores);
    }
    if (modulosAviacion.armamento && modulosAviacion.armamento.length > 0) {
        generarCategoriaMultiple('armamento', 'Armamento Primario', container, modulosAviacion.armamento);
    }
    if (modulosAviacion.bombas && modulosAviacion.bombas.length > 0) {
        generarCategoriaMultiple('bombas', 'Armamento Secundario - Bombas', container, modulosAviacion.bombas);
    }
    if (modulosAviacion.torpedos && modulosAviacion.torpedos.length > 0) {
        generarCategoriaMultiple('torpedos', 'Armamento Secundario - Torpedos', container, modulosAviacion.torpedos);
    }
    if (modulosAviacion.alas && modulosAviacion.alas.length > 0) {
        generarCategoriaMultiple('alas', 'Alas', container, modulosAviacion.alas);
    }
}

function generarSelectorTipo(container) {
    const seccionTipo = document.createElement('div');
    seccionTipo.className = 'seccion-cascos';
    seccionTipo.innerHTML = '<h3>Tipo de Avión</h3>';

    const tipoContainer = document.createElement('div');
    tipoContainer.className = 'cascos-container tipos-avion';

    const opciones = [
        { valor: 'caza', nombre: 'Caza', desc: 'Ataque aéreo con Maniobrabilidad como ataque.' },
        { valor: 'bombardero', nombre: 'Bombardero', desc: 'La Maniobrabilidad se convierte en defensa.' },
      
    ];

    opciones.forEach((opcion, index) => {
        const div = document.createElement('div');
        div.className = 'opcion-casco';

        const radioId = `tipo-avion-${index}`;
        const isChecked = tipoAvion === opcion.valor ? 'checked' : '';

        div.innerHTML = `
            <label>
                <input type="radio" name="tipo-avion" id="${radioId}" value="${opcion.valor}" ${isChecked}>
                <strong>${opcion.nombre}</strong>
            </label>
            <div class="casco-info">
                <div class="info-item">
                    <span class="info-value">${opcion.desc}</span>
                </div>
            </div>
        `;

        tipoContainer.appendChild(div);

        const radio = div.querySelector('input[type="radio"]');
        radio.addEventListener('change', () => {
            tipoAvion = opcion.valor;
            actualizarCapacidadUI();
            calcularTotales();
        });
    });

    seccionTipo.appendChild(tipoContainer);
    container.appendChild(seccionTipo);
}

function generarFuselajes(container) {
    const seccionFuselajes = document.createElement('div');
    seccionFuselajes.className = 'seccion-cascos';
    seccionFuselajes.innerHTML = '<h3>Selecciona un Fuselaje</h3>';

    const fuselajeContainer = document.createElement('div');
    fuselajeContainer.className = 'cascos-container';

    (fuselajes || []).forEach((fuselaje, index) => {
        const div = document.createElement('div');
        div.className = 'opcion-casco';
        if (fuselaje.pais_modulo) div.dataset.paisModulo = fuselaje.pais_modulo;

        const radioId = `fuselaje-${index}`;
        const isChecked = seleccionados.fuselaje?.nombre === fuselaje.nombre ? 'checked' : '';

        div.innerHTML = `
            <label>
                <input type="radio" name="fuselaje" id="${radioId}" value="${escaparHtml(fuselaje.nombre)}" data-capacidad="${escaparHtml(fuselaje.capacidad_piezas)}" ${isChecked}>
                <strong>${escaparHtml(fuselaje.nombre)}</strong>
                <span class="capacidad-badge">Cap: ${escaparHtml(fuselaje.capacidad_piezas)}</span>
            </label>
            <div class="casco-info">
                ${fuselaje.pais_modulo ? `<div class="info-item"><span class="info-label">País del módulo:</span><span class="info-value">${escaparHtml(fuselaje.pais_modulo)}</span></div>` : ''}
                <div class="info-item">
                    <span class="info-label">Vida:</span>
                    <span class="info-value">${escaparHtml(fuselaje.vida)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Peso:</span>
                    <span class="info-value">${escaparHtml(fuselaje.peso)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Coste:</span>
                    <span class="info-value">${escaparHtml(fuselaje.coste)}</span>
                </div>
            </div>
        `;

        fuselajeContainer.appendChild(div);

        const radio = div.querySelector('input[type="radio"]');
        radio.addEventListener('change', () => {
            seleccionados.fuselaje = { ...fuselaje };
            capacidadPiezasActual = fuselaje.capacidad_piezas;
            actualizarCapacidadUI();
            calcularTotales();
        });
    });

    seccionFuselajes.appendChild(fuselajeContainer);
    container.appendChild(seccionFuselajes);
}

function manejarCambioCantidad(categoria, item, accion) {
    const cantidadActual = obtenerCantidadEnCategoria(seleccionados, categoria, item.nombre);
    const cantidadObjetivo = accion === 'increment' ? cantidadActual + 1 : cantidadActual - 1;

    if (cantidadObjetivo < 0) return;

    const proximoEstado = {
        fuselaje: seleccionados.fuselaje ? { ...seleccionados.fuselaje } : null,
        motores: Array.isArray(seleccionados.motores) ? [...seleccionados.motores] : [],
        armamento: Array.isArray(seleccionados.armamento) ? [...seleccionados.armamento] : [],
        bombas: Array.isArray(seleccionados.bombas) ? [...seleccionados.bombas] : [],
        torpedos: Array.isArray(seleccionados.torpedos) ? [...seleccionados.torpedos] : [],
        alas: Array.isArray(seleccionados.alas) ? [...seleccionados.alas] : []
    };

    const categoriaActual = proximoEstado[categoria] || [];
    const existente = categoriaActual.find(modulo => modulo && modulo.nombre === item.nombre);

    if (cantidadObjetivo === 0) {
        proximoEstado[categoria] = categoriaActual.filter(modulo => modulo.nombre !== item.nombre);
    } else if (existente) {
        existente.cantidad = cantidadObjetivo;
        proximoEstado[categoria] = categoriaActual.map(modulo => modulo.nombre === item.nombre ? existente : modulo);
    } else {
        proximoEstado[categoria] = [...categoriaActual, { ...item, cantidad: cantidadObjetivo }];
    }

    if (categoria === 'motores' && !proximoEstado.motores.some(m => Number(m.cantidad || 0) > 0)) {
        const motorBase = Array.isArray(modulosAviacion.motores) && modulosAviacion.motores.length > 0
            ? modulosAviacion.motores[0]
            : { nombre: 'Motor Básico', velocidad: 15, espacios_piezas: 1, coste: 0.01 };
        proximoEstado.motores = [{ ...motorBase, cantidad: 1 }];
    }

    if (capacidadPiezasActual > 0 && calcularPiezasUsadas(proximoEstado) > capacidadPiezasActual) {
        alert(`No puedes exceder la capacidad del fuselaje. Máximo ${capacidadPiezasActual} piezas.`);
        return;
    }

    const estadoCategoriaAbierta = { ...categoriaAbierta };
    seleccionados = proximoEstado;
    generarModulos();
    categoriaAbierta = estadoCategoriaAbierta;
    actualizarCapacidadUI();
    calcularTotales();
}

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
        if (item.pais_modulo) opcion.dataset.paisModulo = item.pais_modulo;

        const cantidadActual = obtenerCantidadEnCategoria(seleccionados, categoria, item.nombre);
        const estadoSimulado = JSON.parse(JSON.stringify(seleccionados));
        const categoriaActual = Array.isArray(estadoSimulado[categoria]) ? estadoSimulado[categoria] : [];
        const moduloExistente = categoriaActual.find(m => m && m.nombre === item.nombre);

        if (moduloExistente) {
            moduloExistente.cantidad = cantidadActual + 1;
        } else {
            categoriaActual.push({ ...item, cantidad: 1 });
            estadoSimulado[categoria] = categoriaActual;
        }

        const puedeSumar = capacidadPiezasActual === 0 || calcularPiezasUsadas(estadoSimulado) <= capacidadPiezasActual;

        let htmlInfo = '';
        if (item.velocidad !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Velocidad:</span><span class="info-value">${escaparHtml(item.velocidad)}</span></div>`;
        }
        if (item.ataque !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Ataque A:</span><span class="info-value">${escaparHtml(item.ataque)}</span></div>`;
        }
        if (item.ataque_tierra !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Ataque Tierra:</span><span class="info-value">${escaparHtml(item.ataque_tierra)}</span></div>`;
        }
        if (item.ataque_naval !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Ataque Naval:</span><span class="info-value">${escaparHtml(item.ataque_naval)}</span></div>`;
        }
        if (item.maniobrabilidad !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Manio:</span><span class="info-value">${escaparHtml(item.maniobrabilidad)}</span></div>`;
        }
        if (item.cantidad_alas !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Alas:</span><span class="info-value">${escaparHtml(item.cantidad_alas)}</span></div>`;
        }
        if (item.peso !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Peso:</span><span class="info-value">${escaparHtml(item.peso)}</span></div>`;
        }
        if (item.espacios_piezas !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Piezas:</span><span class="info-value">${escaparHtml(item.espacios_piezas)}</span></div>`;
        }
        if (item.coste !== undefined && item.coste !== null) {
            htmlInfo += `<div class="info-item"><span class="info-label">Coste:</span><span class="info-value">${escaparHtml(item.coste)}</span></div>`;
        }
        if (item.pais_modulo) {
            htmlInfo += `<div class="info-item"><span class="info-label">País del módulo:</span><span class="info-value">${escaparHtml(item.pais_modulo)}</span></div>`;
        }

        opcion.innerHTML = `
            <div class="modulo-topline">
                <strong>${escaparHtml(item.nombre)}</strong>
            </div>
            <div class="modulo-info">${htmlInfo}</div>
            <div class="modulo-controls">
                <button type="button" class="qty-btn" data-action="decrement" data-categoria="${categoria}" data-item="${escaparHtml(item.nombre)}" ${cantidadActual <= 0 ? 'disabled' : ''}>-</button>
                <span class="qty-value" id="cantidad-${categoria}-${index}">${cantidadActual}</span>
                <button type="button" class="qty-btn" data-action="increment" data-categoria="${categoria}" data-item="${escaparHtml(item.nombre)}" ${!puedeSumar ? 'disabled' : ''}>+</button>
            </div>
        `;

        opciones.appendChild(opcion);

        opcion.querySelector('[data-action="decrement"]')
            .addEventListener('click', () => manejarCambioCantidad(categoria, item, 'decrement'));
        opcion.querySelector('[data-action="increment"]')
            .addEventListener('click', () => manejarCambioCantidad(categoria, item, 'increment'));
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

// --------------------------------------------------------------------------
// Cálculo y actualización de la UI
// --------------------------------------------------------------------------
function calcularTotales() {
    const pesoEl = document.getElementById('peso-total');
    const velocidadEl = document.getElementById('velocidad-total');
    const altitudEl = document.getElementById('altitud-total');
    const manioEl = document.getElementById('manio-total');
    const ataqueEl = document.getElementById('ataque-total');
    const defensaEl = document.getElementById('defensa-total');
    const vidaEl = document.getElementById('vida-total');
    const costeEl = document.getElementById('coste-total');

    const pesoTotal = calcularPesoTotal();
    const velocidadFinal = calcularVelocidadFinal();
    const altitud = calcularAltitud();
    const manio = calcularManiobrabilidad();
    const ataque = calcularAtaqueTotal();
    const defensa = calcularDefensaTotal();
    const vida = calcularVidaTotal();
    const coste = calcularCosteTotal();

    if (pesoEl) pesoEl.textContent = pesoTotal;
    if (velocidadEl) velocidadEl.textContent = velocidadFinal;
    if (altitudEl) altitudEl.textContent = altitud;
    if (manioEl) manioEl.textContent = manio;
    if (ataqueEl) ataqueEl.textContent = ataque;
    if (defensaEl) defensaEl.textContent = defensa;
    if (vidaEl) vidaEl.textContent = vida;
    if (costeEl) costeEl.textContent = `${coste.toFixed(2)}M`;
}

function actualizarCapacidadUI() {
    const piezasColocadas = calcularPiezasUsadas(seleccionados);
    const capacidadTotal = capacidadPiezasActual;
    const piezasRestantes = Math.max(0, capacidadTotal - piezasColocadas);
    const capacidadEl = document.getElementById('capacidad-piezas');

    if (capacidadEl) {
        capacidadEl.innerHTML = `
            <span class="capacidad-usado">${piezasColocadas}</span> /
            <span class="capacidad-total">${capacidadTotal}</span>
            <span class="capacidad-restante">(${piezasRestantes} disponibles)</span>
        `;
    }

    const comprobante = document.getElementById('comprobante-modulos');
    const motor = obtenerMotorSeleccionado(seleccionados);
    const nombreTipo = tipoAvion.charAt(0).toUpperCase() + tipoAvion.slice(1);

    if (comprobante) {
        comprobante.innerHTML = `
            <strong>Comprobante de módulos:</strong>
            <span>${piezasColocadas}/${capacidadTotal || 0} piezas usadas</span>
            <small>${motor ? `Motor base: ${escaparHtml(motor.nombre)}` : 'Sin motor asignado'} · Tipo: ${escaparHtml(nombreTipo)}</small>
        `;
    }
}

// --------------------------------------------------------------------------
// Acciones
// --------------------------------------------------------------------------
function agregarEventListeners() {
    const publicarBtn = document.getElementById('btn-publicar-ficha');
    const limpiarBtn = document.getElementById('btn-limpiar');

    if (publicarBtn) {
        publicarBtn.addEventListener('click', () => publicarFicha());
    }

    if (limpiarBtn) {
        limpiarBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas limpiar todos los datos?')) {
                limpiarFormulario();
            }
        });
    }
}

function publicarFicha() {
    const ficha = crearFicha();
    if (!ficha) return;

    window.publicarPlantilla({
        country: document.getElementById('pais').value,
        filePrefix: 'avion',
        content: ficha,
        button: document.getElementById('btn-publicar-ficha'),
        status: document.getElementById('estado-publicacion')
    });
}

function crearFicha() {
    if (!seleccionados.fuselaje) {
        console.error('Error: No se puede publicar la ficha sin un fuselaje seleccionado');
        alert('Debes seleccionar un fuselaje primero');
        return null;
    }

    const nombre = document.getElementById('nombre').value || 'Ficha Sin Nombre';
    const pais = document.getElementById('pais').value || 'No especificado';
    const anio = document.getElementById('anio').value || 'Año no especificado';
    const descripcion = document.getElementById('descripcion').value || '';
    const tipoSeleccionado = document.querySelector('input[name="tipo-avion"]:checked')?.value || 'tipo no especificado';
    // Sincronizar la variable global del sistema con la opción seleccionada,
    // para que los cálculos usen siempre el tipo visible en la ficha.
    tipoAvion = tipoSeleccionado;

    if (capacidadPiezasActual > 0 && calcularPiezasUsadas(seleccionados) > capacidadPiezasActual) {
        alert(`El fuselaje no puede llevar más de ${capacidadPiezasActual} piezas.`);
        return null;
    }

    const ficha = {
        titulo: nombre,
        tipo: tipoAvion,
        informacion_general: {
            nombre,
            tipo: tipoAvion,
            pais,
            anio
        },
        componentes_seleccionados: {
            fuselaje: limpiarMarcaModulo(seleccionados.fuselaje),
            motores: seleccionados.motores.map(limpiarMarcaModulo),
            armamento: seleccionados.armamento.map(limpiarMarcaModulo),
            bombas: seleccionados.bombas.map(limpiarMarcaModulo),
            torpedos: seleccionados.torpedos.map(limpiarMarcaModulo),
            alas: seleccionados.alas.map(limpiarMarcaModulo)
        },
        comprobante_piezas: {
            usados: calcularPiezasUsadas(seleccionados),
            capacidad_total: capacidadPiezasActual,
            disponibles: Math.max(0, capacidadPiezasActual - calcularPiezasUsadas(seleccionados)),
            motor_base: limpiarMarcaModulo(obtenerMotorSeleccionado(seleccionados))
        },
        estadisticas: {
            peso: calcularPesoTotal(),
            velocidad: calcularVelocidadFinal(),
            altitud: calcularAltitud(),
            maniobrabilidad: calcularManiobrabilidad(),
            ataque: calcularAtaqueTotal(),
            ataque_aereo: calcularAtaqueAereo(),
            ataque_tierra: calcularAtaqueTierra(),
            ataque_naval: calcularAtaqueNaval(),
            defensa: calcularDefensaTotal(),
            vida: calcularVidaTotal(),
            coste: calcularCosteTotal(),
            piezas_colocados: calcularPiezasUsadas(seleccionados),
            capacidad_total: capacidadPiezasActual
        },
        descripcion
    };

    return ficha;
}

function limpiarFormulario() {
    const nombre = document.getElementById('nombre');
    const pais = document.getElementById('pais');
    const anio = document.getElementById('anio');
    const descripcion = document.getElementById('descripcion');

    if (nombre) nombre.value = '';
    if (pais) pais.value = '';
    if (anio) anio.value = '';
    if (descripcion) descripcion.value = '';

    const motorBase = Array.isArray(modulosAviacion.motores) && modulosAviacion.motores.length > 0
        ? [{ ...modulosAviacion.motores[0], cantidad: 1 }]
        : [];

    seleccionados = {
        fuselaje: null,
        motores: motorBase,
        armamento: [],
        bombas: [],
        torpedos: [],
        alas: []
    };

    capacidadPiezasActual = 0;
    tipoAvion = 'polivalente';
    generarModulos();
    actualizarCapacidadUI();
    calcularTotales();
}

if (typeof module !== 'undefined') {
    module.exports = {
        calcularPiezasUsadas,
        calcularPesoTotal,
        calcularVelocidadFinal,
        calcularAltitud,
        calcularManiobrabilidad,
        calcularAtaqueTotal,
        calcularDefensaTotal,
        calcularVidaTotal,
        calcularCosteTotal,
        obtenerMotorSeleccionado
    };
}
