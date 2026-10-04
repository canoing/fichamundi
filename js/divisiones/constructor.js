let catalogoDivisiones = null;
let regimientosDivision = [];
let apoyosDivision = [];
let armasDivision = [];

function numeroSeguro(valor) {
    const numero = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

function extraerArmasDivision(datos) {
    const armas = [];
    const agregar = (entrada) => {
        if (!entrada || typeof entrada !== 'object') return;
        const informacion = entrada.seccion_1_informacion_general || {};
        const estadisticas = entrada.seccion_2_estadisticas_primarias || {};
        const nombre = entrada.nombre || entrada.Nombre || entrada.nombre_del_arma || informacion.nombre_del_arma;
        if (!nombre) return;
        armas.push({
            id_arma: entrada.id_arma || `arma-${armas.length}-${String(nombre).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            tipo_ficha: entrada.tipo_ficha || datos.tipo_ficha || 'Arma personalizada',
            nombre: String(nombre).trim(),
            hp_a_regimiento: numeroSeguro(entrada.hp_a_regimiento ?? entrada.hp ?? estadisticas.hp_a_regimiento),
            ataque: numeroSeguro(entrada.ataque ?? entrada.Ataque ?? estadisticas.ataque),
            defensa: numeroSeguro(entrada.defensa ?? entrada.Defensa ?? estadisticas.defensa),
            nivel_tech_tree: numeroSeguro(entrada.nivel_tech_tree ?? entrada.nivel_tech ?? estadisticas.nivel_tech_tree)
        });
    };

    if (Array.isArray(datos)) {
        datos.forEach(agregar);
    } else if (datos && Array.isArray(datos.armas)) {
        datos.armas.forEach(agregar);
    } else if (datos && Array.isArray(datos.armamentos)) {
        datos.armamentos.forEach(agregar);
    } else if (datos && Array.isArray(datos.ejemplo_armas_equipables)) {
        datos.ejemplo_armas_equipables.forEach(agregar);
    } else {
        agregar(datos);
    }

    return armas;
}

function calcularEstadisticasDivision(regimientos, apoyos, catalogo) {
    const tiposRegimiento = catalogo.regimientos_principales || {};
    const tiposApoyo = catalogo.batallones_apoyo || {};
    let hp = 0;
    let ataque = 0;
    let defensa = 0;
    let suministros = 0;
    const movimientos = [];
    const habilidades = [];
    let cantidadMontanistas = 0;

    (regimientos || []).forEach(regimiento => {
        const tipo = tiposRegimiento[regimiento.tipo_regimiento];
        if (!tipo) return;
        const arma = regimiento.arma_equipada || {};
        hp += numeroSeguro(tipo.hp_base) + numeroSeguro(arma.hp_a_regimiento);
        ataque += numeroSeguro(tipo.atk_base) + numeroSeguro(tipo.buffs?.atk_bonus) + numeroSeguro(arma.ataque);
        defensa += numeroSeguro(tipo.def_base) + numeroSeguro(tipo.buffs?.def_bonus) + numeroSeguro(arma.defensa);

        if (tipo.sup_depende_de_arma) suministros += numeroSeguro(regimiento.sup_arma);
        else suministros += numeroSeguro(tipo.sup_base);

        if (tipo.mov_depende_de_arma) movimientos.push(numeroSeguro(regimiento.mov_arma));
        else if (tipo.mov_base !== null && tipo.mov_base !== undefined) movimientos.push(numeroSeguro(tipo.mov_base));

        if (regimiento.tipo_regimiento === 'montanistas') cantidadMontanistas += 1;
        if (tipo.habilidad_pasiva?.ignora_def_ametralladoras) {
            habilidades.push('Ignora la defensa otorgada por ametralladoras enemigas');
        }
    });

    let bonusMovimiento = 0;
    (apoyos || []).forEach(apoyo => {
        const tipo = tiposApoyo[apoyo.tipo_apoyo];
        if (!tipo) return;
        const buffs = tipo.buffs || {};
        ataque += numeroSeguro(buffs.atk_bonus);
        defensa += numeroSeguro(buffs.def_bonus);
        if (apoyo.tipo_apoyo === 'logistica') {
            suministros -= Math.max(1, numeroSeguro(apoyo.reduccion_sup) || 1);
        } else {
            suministros += numeroSeguro(tipo.sup_costo);
        }
        hp += numeroSeguro(buffs.hp_bonus_base) + numeroSeguro(apoyo.hp_bonus_tecnologico);
        bonusMovimiento += numeroSeguro(buffs.mov_bonus_global);

        const terrenos = tipo.habilidad_pasiva?.ignora_debuff_mov_terrenos;
        if (Array.isArray(terrenos) && terrenos.length) {
            habilidades.push(`Ingenieros: ignora penalizadores de MOV en ${terrenos.join(', ')}`);
        }
        if (apoyo.tipo_apoyo === 'reconocimiento') {
            habilidades.push(' +1 MOV en todos los terrenos (Reconocimiento)'.trim());
        }
        if (apoyo.tipo_apoyo === 'antitanque') {
            habilidades.push('Especializada en neutralizar blindados enemigos (Antitanque)');
        }
    });

    if (movimientos.length) {
        const esReconocimiento = (apoyos || []).some(apoyo => apoyo.tipo_apoyo === 'reconocimiento');
        const cantidadRegimientos = (regimientos || []).length;
        if (cantidadRegimientos > 0 && cantidadMontanistas / cantidadRegimientos >= 0.5) {
            habilidades.push('Ignora penalizadores de MOV en montaña y colinas (50% o más de Montañistas)');
        }
        return {
            HP: hp,
            ATK: ataque,
            DEF: defensa,
            MOV: Math.max(0, Math.min(...movimientos) + bonusMovimiento),
            SUP: Math.max(0, suministros),
            habilidades_especiales: [...new Set(habilidades)]
        };
    }

    return {
        HP: hp,
        ATK: ataque,
        DEF: defensa,
        MOV: 0,
        SUP: Math.max(0, suministros),
        habilidades_especiales: [...new Set(habilidades)]
    };
}

function crearFichaDivision(informacion, regimientos, apoyos, catalogo) {
    const estadisticas = calcularEstadisticasDivision(regimientos, apoyos, catalogo);
    return {
        titulo: informacion.nombre_unidad,
        version: '1920 (Gran Guerra)',
        ficha_unidad: {
            informacion_general: {
                nombre_unidad: informacion.nombre_unidad,
                pais_operador: informacion.pais_operador,
                tipo_unidad: informacion.tipo_unidad
            },
            regimientos_principales: regimientos.map((regimiento, indice) => ({
                slot: indice + 1,
                tipo_regimiento: catalogo.regimientos_principales[regimiento.tipo_regimiento]?.nombre || regimiento.tipo_regimiento,
                arma_equipada: regimiento.arma_equipada || null,
                ...(regimiento.mov_arma !== undefined ? { mov_arma: numeroSeguro(regimiento.mov_arma) } : {}),
                ...(regimiento.sup_arma !== undefined ? { sup_arma: numeroSeguro(regimiento.sup_arma) } : {})
            })),
            batallones_apoyo: apoyos.map((apoyo, indice) => ({
                slot: indice + 1,
                tipo_apoyo: catalogo.batallones_apoyo[apoyo.tipo_apoyo]?.nombre || apoyo.tipo_apoyo,
                arma_o_equipo_asignado: null,
                ...(apoyo.tipo_apoyo === 'logistica' ? { reduccion_sup_tecnologica: Math.max(1, numeroSeguro(apoyo.reduccion_sup) || 1) } : {}),
                ...(['hospital_campana', 'mantenimiento'].includes(apoyo.tipo_apoyo)
                    ? { hp_bonus_tecnologico: numeroSeguro(apoyo.hp_bonus_tecnologico) }
                    : {})
            }))
        },
        estadisticas_acumuladas: estadisticas
    };
}

async function cargarCatalogoDivision() {
    const [respuestaUnidad, respuestaPlantilla] = await Promise.all([
        fetch('../data/referencias/divi/unida.json'),
        fetch('../data/referencias/divisiones.json')
    ]);
    if (!respuestaUnidad.ok || !respuestaPlantilla.ok) throw new Error('No se pudieron cargar los datos de divisiones.');
    const [catalogo, plantilla] = await Promise.all([respuestaUnidad.json(), respuestaPlantilla.json()]);
    catalogoDivisiones = catalogo;
    document.getElementById('version-plantilla').textContent = `${plantilla.titulo} · ${plantilla.version}`;
    agregarRegimiento();
    renderizarConstructor();
}

function opcionesTiposRegimiento(seleccionado) {
    return Object.entries(catalogoDivisiones.regimientos_principales).map(([id, tipo]) =>
        `<option value="${escaparHtml(id)}" ${id === seleccionado ? 'selected' : ''}>${escaparHtml(tipo.nombre)}</option>`
    ).join('');
}

function renderizarRegimientos() {
    const contenedor = document.getElementById('regimientos-container');
    contenedor.innerHTML = regimientosDivision.map((regimiento, indice) => {
        const tipo = catalogoDivisiones.regimientos_principales[regimiento.tipo_regimiento];
        const necesitaMov = tipo.mov_depende_de_arma;
        const necesitaSup = tipo.sup_depende_de_arma;
        const opcionesArmas = '<option value="">Sin arma</option>' + armasDivision.map(arma =>
            `<option value="${escaparHtml(arma.id_arma)}" ${regimiento.arma_equipada?.id_arma === arma.id_arma ? 'selected' : ''}>${escaparHtml(arma.nombre)} · ATK ${arma.ataque}, DEF ${arma.defensa}</option>`
        ).join('');
        return `<article class="opcion-modulo">
            <div class="modulo-topline"><strong>Regimiento ${indice + 1}</strong>
                <button type="button" class="btn btn-secondary" data-quitar-regimiento="${indice}" ${regimientosDivision.length <= 1 ? 'disabled' : ''} aria-label="Quitar regimiento ${indice + 1}">Quitar</button>
            </div>
            <div class="formulario">
                <div class="campo"><label for="tipo-regimiento-${indice}">Tipo de regimiento</label>
                    <select id="tipo-regimiento-${indice}" data-regimiento="${indice}" data-campo="tipo_regimiento">${opcionesTiposRegimiento(regimiento.tipo_regimiento)}</select>
                </div>
                <div class="campo"><label for="arma-regimiento-${indice}">Arma equipada</label>
                    <select id="arma-regimiento-${indice}" data-regimiento="${indice}" data-campo="arma_equipada">${opcionesArmas}</select>
                </div>
                ${necesitaMov ? `<div class="campo"><label for="mov-arma-${indice}">MOV propio del vehículo</label><input id="mov-arma-${indice}" type="number" min="0" step="any" value="${numeroSeguro(regimiento.mov_arma)}" data-regimiento="${indice}" data-campo="mov_arma" required></div>` : ''}
                ${necesitaSup ? `<div class="campo"><label for="sup-arma-${indice}">SUP del arma de artillería</label><input id="sup-arma-${indice}" type="number" min="0" step="any" value="${numeroSeguro(regimiento.sup_arma)}" data-regimiento="${indice}" data-campo="sup_arma" required></div>` : ''}
                <p class="inicio-descripcion">Base: ${tipo.sup_base ?? 'SUP por arma'} SUP · ${tipo.mov_base ?? 'MOV por arma'} MOV · ${tipo.hp_base} HP · ${tipo.atk_base || 0} ATK · ${tipo.def_base || 0} DEF</p>
            </div>
        </article>`;
    }).join('');
}

function renderizarApoyos() {
    const contenedor = document.getElementById('apoyos-container');
    contenedor.innerHTML = apoyosDivision.map((apoyo, indice) => {
        const tipo = catalogoDivisiones.batallones_apoyo[apoyo.tipo_apoyo];
        const extra = apoyo.tipo_apoyo === 'logistica'
            ? `<div class="campo"><label for="logistica-${indice}">Reducción SUP por tecnología</label><input id="logistica-${indice}" type="number" min="1" step="1" value="${numeroSeguro(apoyo.reduccion_sup) || 1}" data-apoyo="${indice}" data-campo="reduccion_sup"></div>`
            : ['hospital_campana', 'mantenimiento'].includes(apoyo.tipo_apoyo)
                ? `<div class="campo"><label for="hp-apoyo-${indice}">HP adicional por tecnología</label><input id="hp-apoyo-${indice}" type="number" min="0" step="any" value="${numeroSeguro(apoyo.hp_bonus_tecnologico)}" data-apoyo="${indice}" data-campo="hp_bonus_tecnologico"></div>`
                : '';
        return `<article class="opcion-modulo">
            <div class="modulo-topline"><strong>Apoyo ${indice + 1}</strong>
                <button type="button" class="btn btn-secondary" data-quitar-apoyo="${indice}" aria-label="Quitar apoyo ${indice + 1}">Quitar</button>
            </div>
            <div class="formulario"><div class="campo"><label for="tipo-apoyo-${indice}">Batallón</label>
                <select id="tipo-apoyo-${indice}" data-apoyo="${indice}" data-campo="tipo_apoyo">${Object.entries(catalogoDivisiones.batallones_apoyo).map(([id, item]) => `<option value="${escaparHtml(id)}" ${id === apoyo.tipo_apoyo ? 'selected' : ''}>${escaparHtml(item.nombre)}</option>`).join('')}</select>
            </div>${extra}<p class="inicio-descripcion">${escaparHtml(tipo.descripcion)} · ${tipo.sup_costo < 0 ? `Reducción base: ${Math.abs(tipo.sup_costo)} SUP` : `Consumo: ${tipo.sup_costo} SUP`}</p></div>
        </article>`;
    }).join('');
}

function renderizarConstructor() {
    renderizarRegimientos();
    renderizarApoyos();
    document.getElementById('contador-regimientos').textContent = `${regimientosDivision.length} / 16`;
    document.getElementById('contador-apoyos').textContent = `${apoyosDivision.length} / 2`;
    document.getElementById('btn-agregar-regimiento').disabled = regimientosDivision.length >= 16;
    document.getElementById('btn-agregar-apoyo').disabled = apoyosDivision.length >= 2;
    actualizarEstadisticas();
}

function actualizarEstadisticas() {
    const estadisticas = calcularEstadisticasDivision(regimientosDivision, apoyosDivision, catalogoDivisiones);
    document.getElementById('hp-total').textContent = estadisticas.HP;
    document.getElementById('atk-total').textContent = estadisticas.ATK;
    document.getElementById('def-total').textContent = estadisticas.DEF;
    document.getElementById('mov-total').textContent = estadisticas.MOV;
    document.getElementById('sup-total').textContent = estadisticas.SUP;
    document.getElementById('habilidades-total').innerHTML = estadisticas.habilidades_especiales.length
        ? estadisticas.habilidades_especiales.map(habilidad => `<li>${escaparHtml(habilidad)}</li>`).join('')
        : '<li>Sin habilidades especiales</li>';
}

function agregarRegimiento() {
    if (regimientosDivision.length >= 16) return;
    regimientosDivision.push({ tipo_regimiento: 'infanteria', arma_equipada: null, mov_arma: 1, sup_arma: 0 });
}

function agregarApoyo() {
    if (apoyosDivision.length >= 2) return;
    apoyosDivision.push({ tipo_apoyo: 'ingenieros', reduccion_sup: 1, hp_bonus_tecnologico: 0 });
}

function inicializarEventos() {
    document.getElementById('btn-agregar-regimiento').addEventListener('click', () => {
        agregarRegimiento();
        renderizarConstructor();
    });
    document.getElementById('btn-agregar-apoyo').addEventListener('click', () => {
        agregarApoyo();
        renderizarConstructor();
    });

    document.getElementById('regimientos-container').addEventListener('click', evento => {
        const boton = evento.target.closest('[data-quitar-regimiento]');
        if (!boton || regimientosDivision.length <= 1) return;
        regimientosDivision.splice(Number(boton.dataset.quitarRegimiento), 1);
        renderizarConstructor();
    });
    document.getElementById('apoyos-container').addEventListener('click', evento => {
        const boton = evento.target.closest('[data-quitar-apoyo]');
        if (!boton) return;
        apoyosDivision.splice(Number(boton.dataset.quitarApoyo), 1);
        renderizarConstructor();
    });

    document.getElementById('regimientos-container').addEventListener('change', evento => {
        const control = evento.target.closest('[data-regimiento]');
        if (!control) return;
        const regimiento = regimientosDivision[Number(control.dataset.regimiento)];
        const campo = control.dataset.campo;
        if (campo === 'arma_equipada') {
            regimiento.arma_equipada = armasDivision.find(arma => arma.id_arma === control.value) || null;
        } else if (campo === 'tipo_regimiento') {
            regimiento.tipo_regimiento = control.value;
            renderizarConstructor();
            return;
        } else {
            regimiento[campo] = numeroSeguro(control.value);
        }
        actualizarEstadisticas();
    });
    document.getElementById('regimientos-container').addEventListener('input', evento => {
        const control = evento.target.closest('[data-regimiento][type="number"]');
        if (!control) return;
        regimientosDivision[Number(control.dataset.regimiento)][control.dataset.campo] = numeroSeguro(control.value);
        actualizarEstadisticas();
    });
    document.getElementById('apoyos-container').addEventListener('change', evento => {
        const control = evento.target.closest('[data-apoyo]');
        if (!control) return;
        const apoyo = apoyosDivision[Number(control.dataset.apoyo)];
        if (control.dataset.campo === 'tipo_apoyo') {
            apoyo.tipo_apoyo = control.value;
            renderizarConstructor();
            return;
        }
        apoyo[control.dataset.campo] = numeroSeguro(control.value);
        actualizarEstadisticas();
    });
    document.getElementById('apoyos-container').addEventListener('input', evento => {
        const control = evento.target.closest('[data-apoyo][type="number"]');
        if (!control) return;
        apoyosDivision[Number(control.dataset.apoyo)][control.dataset.campo] = numeroSeguro(control.value);
        actualizarEstadisticas();
    });

    document.getElementById('importar-armas').addEventListener('change', async evento => {
        const archivo = evento.target.files[0];
        evento.target.value = '';
        if (!archivo) return;
        try {
            const datos = JSON.parse(await archivo.text());
            const nuevasArmas = extraerArmasDivision(datos);
            if (!nuevasArmas.length) throw new Error('No se encontraron armas con nombre y estadísticas válidas.');
            armasDivision = armasDivision.concat(nuevasArmas);
            const aviso = document.getElementById('aviso-importacion');
            aviso.textContent = `Se importaron ${nuevasArmas.length} arma(s).`;
            aviso.hidden = false;
            aviso.style.display = 'flex';
            renderizarConstructor();
        } catch (error) {
            const aviso = document.getElementById('aviso-importacion');
            aviso.textContent = `No se pudo importar el JSON: ${error.message}`;
            aviso.hidden = false;
            aviso.style.display = 'flex';
        }
    });

    document.getElementById('btn-guardar-division').addEventListener('click', () => {
        const formulario = document.getElementById('informacion-division');
        if (!formulario.reportValidity()) return;
        const ficha = crearFichaDivision({
            nombre_unidad: document.getElementById('nombre-unidad').value.trim(),
            pais_operador: document.getElementById('pais-operador').value.trim(),
            tipo_unidad: document.getElementById('tipo-unidad').value
        }, regimientosDivision, apoyosDivision, catalogoDivisiones);
        const contenido = new Blob([JSON.stringify(ficha, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(contenido);
        const enlace = document.createElement('a');
        const nombreArchivo = ficha.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
        enlace.href = url;
        enlace.download = `division-${nombreArchivo || 'sin-nombre'}.json`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
        const aviso = document.getElementById('aviso-guardado');
        aviso.textContent = 'Ficha de división descargada.';
        aviso.hidden = false;
        aviso.style.display = 'flex';
    });

    document.getElementById('btn-limpiar-division').addEventListener('click', () => {
        document.getElementById('informacion-division').reset();
        regimientosDivision = [];
        apoyosDivision = [];
        armasDivision = [];
        agregarRegimiento();
        document.getElementById('aviso-importacion').hidden = true;
        document.getElementById('aviso-importacion').style.display = 'none';
        document.getElementById('aviso-guardado').hidden = true;
        document.getElementById('aviso-guardado').style.display = 'none';
        renderizarConstructor();
    });
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        inicializarEventos();
        try {
            await cargarCatalogoDivision();
        } catch (error) {
            document.getElementById('error-carga').textContent = error.message;
            document.getElementById('error-carga').hidden = false;
            document.getElementById('error-carga').style.display = 'flex';
        }
    });
}

if (typeof module !== 'undefined') {
    module.exports = { calcularEstadisticasDivision, crearFichaDivision, extraerArmasDivision };
}