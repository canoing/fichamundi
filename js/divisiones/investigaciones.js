const TREE_PATH = '../data/investigacion/tree.json';
const CIVIL_TREE_KEY = 'arbol_civil_1910_1919';
let nodosInvestigacion = null;
let clienteSupabase = null;
let solicitudActual = 0;
let temporizador = null;

function normalizar(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escaparParteRuta(valor) {
    return valor.replaceAll('~', '~0').replaceAll('/', '~1');
}

async function obtenerClienteSupabase() {
    if (clienteSupabase) return clienteSupabase;
    const modulo = await import('../supabase.js');
    clienteSupabase = modulo.supabase;
    return clienteSupabase;
}

async function cargarNodosInvestigacion() {
    if (nodosInvestigacion) return nodosInvestigacion;
    const respuesta = await fetch(TREE_PATH);
    if (!respuesta.ok) throw new Error(`No se pudo leer tree.json (HTTP ${respuesta.status}).`);

    const arbol = await respuesta.json();
    const ramaCivil = arbol?.arboles_tecnologicos_CM?.[CIVIL_TREE_KEY];
    if (!ramaCivil || typeof ramaCivil !== 'object') {
        throw new Error('tree.json no contiene el árbol de tecnologías civiles.');
    }

    nodosInvestigacion = { medicina: new Map(), ingenieria: new Map() };
    function recorrer(valor, ruta = []) {
        if (Array.isArray(valor)) {
            valor.forEach((elemento, indice) => recorrer(elemento, [...ruta, String(indice)]));
            return;
        }
        if (!valor || typeof valor !== 'object') return;

        if (typeof valor.nombre === 'string') {
            const medicina = valor.nombre.match(/^Medicina moderna \((\d+)\)$/i);
            const ingenieria = valor.nombre.match(/^Ingeniería \((\d+)\)$/i);
            const coincidencia = medicina || ingenieria;
            if (coincidencia) {
                const tecnologia = medicina ? 'medicina' : 'ingenieria';
                const nodeId = [CIVIL_TREE_KEY, ...ruta].map(escaparParteRuta).join('/');
                nodosInvestigacion[tecnologia].set(nodeId, Number(coincidencia[1]));
            }
        }
        Object.entries(valor).forEach(([clave, hijo]) => recorrer(hijo, [...ruta, clave]));
    }
    recorrer(ramaCivil);
    return nodosInvestigacion;
}

function publicarEstado(niveles, mensaje) {
    document.dispatchEvent(new CustomEvent('division:investigaciones', {
        detail: { niveles, mensaje }
    }));
}

async function buscarInvestigaciones(pais) {
    const solicitud = ++solicitudActual;
    const paisBuscado = String(pais || '').trim();
    if (!paisBuscado) {
        publicarEstado({ medicina: null, ingenieria: null }, 'Escribe el país operador para consultar sus investigaciones civiles; si no hay datos, podrás indicar el nivel manualmente.');
        return;
    }

    publicarEstado({ medicina: null, ingenieria: null }, 'Consultando investigaciones civiles del país…');
    try {
        const [nodos, supabase] = await Promise.all([
            cargarNodosInvestigacion(),
            obtenerClienteSupabase()
        ]);
        const paisesResult = await supabase.from('investigation_countries').select('id, country');
        if (paisesResult.error) throw paisesResult.error;
        if (solicitud !== solicitudActual) return;

        const paisCoincidente = (paisesResult.data || [])
            .find(item => normalizar(item.country) === normalizar(paisBuscado));
        if (!paisCoincidente) {
            publicarEstado(
                { medicina: null, ingenieria: null },
                `No hay investigaciones registradas para ${paisBuscado}; indica los niveles manualmente en los apoyos correspondientes.`
            );
            return;
        }

        const estadosResult = await supabase
            .from('investigation_country_states')
            .select('node_id, status, category')
            .eq('country_id', paisCoincidente.id)
            .eq('category', 'civil')
            .eq('status', 'completed');
        if (estadosResult.error) throw estadosResult.error;
        if (solicitud !== solicitudActual) return;

        const niveles = { medicina: null, ingenieria: null };
        (estadosResult.data || []).forEach(estado => {
            for (const tecnologia of Object.keys(niveles)) {
                const nivel = nodos[tecnologia].get(estado.node_id);
                if (nivel && (!niveles[tecnologia] || nivel > niveles[tecnologia])) {
                    niveles[tecnologia] = nivel;
                }
            }
        });
        const resumen = [
            niveles.medicina ? `Medicina moderna ${niveles.medicina}` : 'Medicina moderna sin nivel investigado',
            niveles.ingenieria ? `Ingeniería ${niveles.ingenieria}` : 'Ingeniería sin nivel investigado'
        ].join(' · ');
        publicarEstado(niveles, `${resumen}. Los apoyos sin investigación completada permiten nivel manual.`);
    } catch (error) {
        if (solicitud !== solicitudActual) return;
        console.error('No se pudieron consultar las investigaciones civiles:', error);
        publicarEstado(
            { medicina: null, ingenieria: null },
            `No se pudieron consultar las investigaciones civiles (${error.message}); indica los niveles manualmente.`
        );
    }
}

function programarConsulta(pais) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => buscarInvestigaciones(pais), 300);
}

document.addEventListener('DOMContentLoaded', () => {
    const paisInput = document.getElementById('pais-operador');
    if (!paisInput) return;

    paisInput.addEventListener('input', () => programarConsulta(paisInput.value));
    paisInput.addEventListener('change', () => programarConsulta(paisInput.value));
    document.getElementById('informacion-division')
        ?.addEventListener('reset', () => setTimeout(() => programarConsulta(''), 0));
    document.addEventListener('division:buscar-investigaciones', evento => {
        programarConsulta(evento.detail?.pais || '');
    });

    programarConsulta(paisInput.value);
});
