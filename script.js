/**
 * CREADOR DE FICHAS DE BUQUES - U-Boat World RPG
 * Sistema de construcción de armamentos navales con selección modular.
 */

let datosJSON = null;
let cascos = {};
let modulos = {};
let seleccionados = {};
let capacidadModulosActual = 0;
let categoriaAbierta = {};

function obtenerCantidadEnCategoria(estado, categoria, nombreModulo) {
    if (!estado || !Array.isArray(estado[categoria])) return 0;
    const modulo = estado[categoria].find(item => item && item.nombre === nombreModulo);
    return modulo ? Number(modulo.cantidad || 0) : 0;
}

function getSlotsForItem(categoria, modulo, cantidad) {
    if (!modulo || !Number.isFinite(cantidad) || cantidad <= 0) return 0;
    if (categoria === 'propulsion') {
        return Math.max(0, cantidad - 1);
    }
    return cantidad;
}

function obtenerSlotsCategoria(estado, categoria) {
    if (!estado || !Array.isArray(estado[categoria])) return 0;

    if (categoria === 'propulsion') {
        const totalMotores = estado.propulsion.reduce((sum, item) => sum + Number(item?.cantidad || 0), 0);
        return Math.max(0, totalMotores - 1);
    }

    return estado[categoria].reduce((sum, item) => sum + Number(item?.cantidad || 0), 0);
}

function calcularModulosUsados(estado = seleccionados) {
    if (!estado) return 0;
    return obtenerSlotsCategoria(estado, 'propulsion') +
           obtenerSlotsCategoria(estado, 'armamento') +
           obtenerSlotsCategoria(estado, 'blindaje');
}

function obtenerMotorBaseSeleccionado(estado = seleccionados) {
    const motores = Array.isArray(estado.propulsion) ? estado.propulsion.filter(item => item && Number(item.cantidad || 0) > 0) : [];
    return motores.length > 0 ? motores[0] : null;
}

function asegurarMotorBase(estado, motoresDisponibles = []) {
    const siguiente = {
        casco: estado?.casco || null,
        propulsion: Array.isArray(estado?.propulsion) ? [...estado.propulsion] : [],
        armamento: Array.isArray(estado?.armamento) ? [...estado.armamento] : [],
        blindaje: Array.isArray(estado?.blindaje) ? [...estado.blindaje] : []
    };

    const tieneMotor = siguiente.propulsion.some(item => Number(item?.cantidad || 0) > 0);
    if (!tieneMotor) {
        const motorPredeterminado = motoresDisponibles.find(item => item && item.nombre) || { nombre: 'Motor de vapor avanzado', velocidad: 20, coste: '1M' };
        siguiente.propulsion = [{ ...motorPredeterminado, cantidad: 1 }];
    }

    return siguiente;
}

async function cargarDatos() {
    try {
        const resCascos = await fetch('cascos.json');
        const datosCascos = await resCascos.json();
        cascos = datosCascos.cascos;

        const resModulos = await fetch('modulos.json');
        const datosModulos = await resModulos.json();
        modulos = datosModulos;

        const motorBase = Array.isArray(modulos.propulsion) && modulos.propulsion.length > 0
            ? [{ ...modulos.propulsion[0], cantidad: 1 }]
            : [];

        seleccionados = {
            casco: null,
            propulsion: motorBase,
            armamento: [],
            blindaje: []
        };

        return true;
    } catch (error) {
        console.error('Error cargando JSONs:', error);
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
        } else {
            alert('Error: No se pudo cargar el archivo de configuración');
        }
    });
}

function generarModulos() {
    const container = document.getElementById('modulos-container');
    if (!container) return;
    container.innerHTML = '';

    generarCascos(container);

    if (modulos.propulsion && modulos.propulsion.length > 0) {
        generarCategoriaMultiple('propulsion', 'Propulsión (Motores)', container, modulos.propulsion);
    }
    if (modulos.armamento && modulos.armamento.length > 0) {
        generarCategoriaMultiple('armamento', 'Armamento', container, modulos.armamento);
    }
    if (modulos.blindaje && modulos.blindaje.length > 0) {
        generarCategoriaMultiple('blindaje', 'Blindaje', container, modulos.blindaje);
    }
}

function generarCascos(container) {
    const seccionCascos = document.createElement('div');
    seccionCascos.className = 'seccion-cascos';
    seccionCascos.innerHTML = '<h3>Selecciona un Casco</h3>';

    const cascoContainer = document.createElement('div');
    cascoContainer.className = 'cascos-container';

    Object.entries(cascos || {}).forEach(([tipoKey, items]) => {
        if (!Array.isArray(items)) return;

        items.forEach((casco, index) => {
            const cascoDiv = document.createElement('div');
            cascoDiv.className = 'opcion-casco';

            const radioId = `casco-${tipoKey}-${index}`;
            const isChecked = seleccionados.casco?.nombre === casco.nombre ? 'checked' : '';

            cascoDiv.innerHTML = `
                <label>
                    <input type="radio" name="casco" id="${radioId}" value="${casco.nombre}" data-capacidad="${casco.capacidad_modulos}" ${isChecked}>
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

            const radio = cascoDiv.querySelector('input[type="radio"]');
            radio.addEventListener('change', () => {
                seleccionados.casco = {
                    nombre: casco.nombre,
                    velocidad: casco.velocidad,
                    coste: casco.coste,
                    capacidad_modulos: casco.capacidad_modulos
                };
                capacidadModulosActual = casco.capacidad_modulos;
                actualizarCapacidadUI();
                calcularTotales();
            });
        });
    });

    seccionCascos.appendChild(cascoContainer);
    container.appendChild(seccionCascos);
}

function manejarCambioCantidad(categoria, item, accion) {
    const cantidadActual = obtenerCantidadEnCategoria(seleccionados, categoria, item.nombre);
    const cantidadObjetivo = accion === 'increment' ? cantidadActual + 1 : cantidadActual - 1;

    if (cantidadObjetivo < 0) return;

    const proximoEstado = {
        casco: seleccionados.casco ? { ...seleccionados.casco } : null,
        propulsion: Array.isArray(seleccionados.propulsion) ? [...seleccionados.propulsion] : [],
        armamento: Array.isArray(seleccionados.armamento) ? [...seleccionados.armamento] : [],
        blindaje: Array.isArray(seleccionados.blindaje) ? [...seleccionados.blindaje] : []
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

    if (categoria === 'propulsion' && !proximoEstado.propulsion.some(modulo => Number(modulo.cantidad || 0) > 0)) {
        proximoEstado.propulsion = [{ ...modulos.propulsion[0], cantidad: 1 }];
    }

    if (capacidadModulosActual > 0 && calcularModulosUsados(proximoEstado) > capacidadModulosActual) {
        alert(`No puedes exceder la capacidad del casco. Máximo ${capacidadModulosActual} módulos ocupados.`);
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

        const cantidadActual = obtenerCantidadEnCategoria(seleccionados, categoria, item.nombre);
        const estadoSimulado = JSON.parse(JSON.stringify(seleccionados));
        const categoriaActual = Array.isArray(estadoSimulado[categoria]) ? estadoSimulado[categoria] : [];
        const moduloExistente = categoriaActual.find(modulo => modulo && modulo.nombre === item.nombre);

        if (moduloExistente) {
            moduloExistente.cantidad = cantidadActual + 1;
        } else {
            categoriaActual.push({ ...item, cantidad: 1 });
            estadoSimulado[categoria] = categoriaActual;
        }

        const puedeSumar = capacidadModulosActual === 0 || calcularModulosUsados(estadoSimulado) <= capacidadModulosActual;

        let htmlInfo = '';
        if (item.velocidad !== undefined) {
            htmlInfo += `<div class="info-item"><span class="info-label">Velocidad:</span><span class="info-value">${item.velocidad > 0 ? '+' : ''}${item.velocidad}</span></div>`;
        }
        if (item.ataque_p_l !== undefined || item.ataque !== undefined) {
            const valorAtaque = obtenerAtaqueVisible(item);
            const esDañoCompuesto = typeof valorAtaque === 'string' && esValorCompuesto(valorAtaque);
            const etiquetaAtaque = esDañoCompuesto ? 'Daño (P/L)' : 'Ataque';
            htmlInfo += `<div class="info-item"><span class="info-label">${etiquetaAtaque}:</span><span class="info-value">${valorAtaque}</span></div>`;
        }
        if (item.defensa_p_l !== undefined || item.defensa !== undefined) {
            const valorDefensa = obtenerDefensaVisible(item);
            const esDefensaCompuesta = typeof valorDefensa === 'string' && esValorCompuesto(valorDefensa);
            const etiquetaDefensa = esDefensaCompuesta ? 'Defensa (P/L)' : 'Defensa';
            htmlInfo += `<div class="info-item"><span class="info-label">${etiquetaDefensa}:</span><span class="info-value">${valorDefensa}</span></div>`;
        }
        if (item.coste) {
            htmlInfo += `<div class="info-item"><span class="info-label">Coste:</span><span class="info-value">${item.coste}</span></div>`;
        }

        const infoMotor = categoria === 'propulsion' && cantidadActual > 0
            ? '<span class="motor-base-label">Motor base inclusivo sin slot</span>'
            : '<span class="motor-base-label">Sin motor asignado</span>';

        opcion.innerHTML = `
            <div class="modulo-topline">
                <strong>${item.nombre}</strong>
                ${infoMotor}
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

function calcularTotales() {
    let velocidadTotal = 0;
    let ataqueTotal = 0;
    let defensaTotal = 0;
    let costeTotal = 0;

    if (seleccionados.casco) {
        velocidadTotal += seleccionados.casco.velocidad || 0;
        costeTotal += parsearCoste(seleccionados.casco.coste);
    }

    // Los valores compuestos tipo "60(P) 15(L)" son un detalle de daño/defensa,
    // no un valor total que deba sumarse a las estadísticas del buque.
    // Se separan explícitamente para que el ataque y la defensa no compartan el mismo parser.
    ['propulsion', 'armamento', 'blindaje'].forEach(cat => {
        if (Array.isArray(seleccionados[cat])) {
            seleccionados[cat].forEach(modulo => {
                if (!modulo || !modulo.nombre) return;

                const cantidad = Number(modulo.cantidad || 1);
                velocidadTotal += (modulo.velocidad || 0) * cantidad;

                ataqueTotal += obtenerAtaqueTotal(modulo) * cantidad;
                defensaTotal += obtenerDefensaTotal(modulo) * cantidad;
                costeTotal += parsearCoste(modulo.coste) * cantidad;
            });
        }
    });

    const velocidadEl = document.getElementById('velocidad-total');
    const ataqueEl = document.getElementById('ataque-total');
    const defensaEl = document.getElementById('defensa-total');
    const costeEl = document.getElementById('coste-total');
    const ataquePLEl = document.getElementById('ataque-pl-total');
    const defensaPLEl = document.getElementById('defensa-pl-total');

    if (velocidadEl) velocidadEl.textContent = velocidadTotal;
    if (ataqueEl) ataqueEl.textContent = ataqueTotal;
    if (defensaEl) defensaEl.textContent = defensaTotal;
    if (costeEl) costeEl.textContent = `${costeTotal}M`;

    // Calcula y muestra los totales de daño y defensa compuesto (P/L)
    const ataquePLTotal = calcularAtaquePLTotal();
    const defensaPLTotal = calcularDefensaPLTotal();

    if (ataquePLEl) ataquePLEl.textContent = ataquePLTotal || '-';
    if (defensaPLEl) defensaPLEl.textContent = defensaPLTotal || '-';
}

function actualizarCapacidadUI() {
    const modulosColocados = calcularModulosUsados(seleccionados);
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

    const comprobante = document.getElementById('comprobante-modulos');
    const motorBase = obtenerMotorBaseSeleccionado(seleccionados);

    if (comprobante) {
        comprobante.innerHTML = `
            <strong>Comprobante de módulos:</strong>
            <span>${modulosColocados}/${capacidadTotal || 0} slots usados</span>
            <small>${motorBase ? `Motor base: ${motorBase.nombre}` : 'Sin motor base'}</small>
        `;
    }
}

function esValorCompuesto(valor) {
    if (typeof valor !== 'string') return false;
    return /\d+\s*\(?[PpLl]\)?|\(?[PpLl]\)?\s*\d+/i.test(valor);
}

function sumarValorNumerico(valor) {
    if (typeof valor === 'number') return valor;
    if (typeof valor !== 'string') return 0;
    if (esValorCompuesto(valor)) return 0;
    const numeros = valor.match(/\d+/g);
    return numeros ? numeros.reduce((sum, num) => sum + parseInt(num, 10), 0) : 0;
}

function obtenerAtaqueVisible(modulo) {
    if (modulo && modulo.ataque_p_l !== undefined) return modulo.ataque_p_l;
    if (modulo && modulo.ataque !== undefined) return modulo.ataque;
    return null;
}

function obtenerDefensaVisible(modulo) {
    if (modulo && modulo.defensa_p_l !== undefined) return modulo.defensa_p_l;
    if (modulo && modulo.defensa !== undefined) return modulo.defensa;
    return null;
}

function obtenerAtaqueTotal(modulo) {
    if (modulo && typeof modulo.ataque === 'number') return modulo.ataque;
    if (modulo && typeof modulo.ataque === 'string' && !esValorCompuesto(modulo.ataque)) return sumarValorNumerico(modulo.ataque);
    return 0;
}

function obtenerDefensaTotal(modulo) {
    if (modulo && typeof modulo.defensa === 'number') return modulo.defensa;
    if (modulo && typeof modulo.defensa === 'string' && !esValorCompuesto(modulo.defensa)) return sumarValorNumerico(modulo.defensa);
    return 0;
}

// Extrae los valores P y L de un valor compuesto como "30(P) 10(L)" o "30 P / 10 L"
function extraerValorPL(valor) {
    if (typeof valor !== 'string') return { p: 0, l: 0 };

    const coincidenciaP = valor.match(/(\d+)\s*\(?P\)?/i);
    const coincidenciaL = valor.match(/(\d+)\s*\(?L\)?/i);

    return {
        p: coincidenciaP ? parseInt(coincidenciaP[1], 10) : 0,
        l: coincidenciaL ? parseInt(coincidenciaL[1], 10) : 0
    };
}

// Calcula el total de ataque compuesto (P/L) de todos los módulos seleccionados
function calcularAtaquePLTotal(estado = seleccionados) {
    let ataqueP = 0;
    let ataqueL = 0;

    ['propulsion', 'armamento', 'blindaje'].forEach(cat => {
        if (Array.isArray(estado[cat])) {
            estado[cat].forEach(modulo => {
                if (!modulo || !modulo.nombre || !modulo.ataque_p_l) return;
                const cantidad = Number(modulo.cantidad || 1);
                const { p, l } = extraerValorPL(modulo.ataque_p_l);
                ataqueP += p * cantidad;
                ataqueL += l * cantidad;
            });
        }
    });

    return ataqueP === 0 && ataqueL === 0 ? null : `${ataqueP}(P) ${ataqueL}(L)`;
}

// Calcula el total de defensa compuesta (P/L) de todos los módulos seleccionados
function calcularDefensaPLTotal(estado = seleccionados) {
    let defensaP = 0;
    let defensaL = 0;

    ['propulsion', 'armamento', 'blindaje'].forEach(cat => {
        if (Array.isArray(estado[cat])) {
            estado[cat].forEach(modulo => {
                if (!modulo || !modulo.nombre || !modulo.defensa_p_l) return;
                const cantidad = Number(modulo.cantidad || 1);
                const { p, l } = extraerValorPL(modulo.defensa_p_l);
                defensaP += p * cantidad;
                defensaL += l * cantidad;
            });
        }
    });

    return defensaP === 0 && defensaL === 0 ? null : `${defensaP}(P) ${defensaL}(L)`;
}

function parsearCoste(coste) {
    if (!coste) return 0;
    return parseInt(coste.toString().replace(/[^0-9]/g, '')) || 0;
}

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
    if (!seleccionados.casco) {
          console.error('Error: No se puede guardar la ficha sin un casco selecciondo');
        alert('Debes seleccionar un casco primero');
      
    }
    if (seleccionados.casco) {

    const nombre = document.getElementById('nombre').value || 'Ficha Sin Nombre';
    const fecha = document.getElementById("fecha").value || "Fecha no especificada";
    const tipo = document.getElementById('tipo').value || 'No especificado';
    const pais = document.getElementById('pais').value || 'No especificado';
    const descripcion = document.getElementById('descripcion').value || '';
    const modulosTotales = calcularModulosUsados(seleccionados);

    if (capacidadModulosActual > 0 && modulosTotales > capacidadModulosActual) {
        alert(`El casco no puede llevar más de ${capacidadModulosActual} módulos.`);
        return;
    }

    const ficha = {
        titulo: nombre,
        fecha: fecha,
        informacion_general: {
            nombre,
            tipo,
            fecha,
            pais
        },
        modulos_seleccionados: {
            casco: seleccionados.casco,
            propulsion: seleccionados.propulsion,
            armamento: seleccionados.armamento,
            blindaje: seleccionados.blindaje
        },
        comprobante_modulos: {
            usados: modulosTotales,
            capacidad_total: capacidadModulosActual,
            disponibles: Math.max(0, capacidadModulosActual - modulosTotales),
            motor_base: obtenerMotorBaseSeleccionado(seleccionados)
        },
        estadisticas: {
            velocidad: parseInt(document.getElementById('velocidad-total').textContent),
            ataque: parseInt(document.getElementById('ataque-total').textContent),
            coste: document.getElementById('coste-total').textContent,
            modulos_colocados: modulosTotales,
            capacidad_total: capacidadModulosActual
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
}

function limpiarFormulario() {
    document.getElementById('nombre').value = '';
    document.getElementById('tipo').value = '';
    document.getElementById('pais').value = '';
    document.getElementById('descripcion').value = '';

    const motorBase = Array.isArray(modulos.propulsion) && modulos.propulsion.length > 0
        ? [{ ...modulos.propulsion[0], cantidad: 1 }]
        : [];

    seleccionados = {
        casco: null,
        propulsion: motorBase,
        armamento: [],
        blindaje: []
    };

    capacidadModulosActual = 0;
    generarModulos();
    actualizarCapacidadUI();
    calcularTotales();
}

if (typeof module !== 'undefined') {
    module.exports = {
        calcularModulosUsados,
        asegurarMotorBase,
        obtenerCantidadEnCategoria
    };
}
