/**
 * INDICADOR DE INVESTIGACIÓN - betaWorld
 *
 * Marca con un punto verde los módulos que el país escrito en el campo
 * `#pais` ya tiene investigados (estado "completed" en Supabase).
 *
 * Es solo una indicación visual: NO impide seleccionar módulos no
 * investigados. La información de investigaciones se obtiene de forma
 * "local" (mismo enfoque que wiki.js / investigaciones.js):
 *   - Los nombres de las tecnologías se leen del árbol local tree.json.
 *   - Los estados por país se consultan en Supabase (tablas
 *     investigation_countries e investigation_country_states).
 *
 * Uso: incluir este script (module) en las páginas de constructor. Detecta
 * automáticamente el campo de país y el contenedor de módulos.
 */

const TREE_PATH = '../data/investigacion/tree.json';
const COUNTRIES_TABLE = 'investigation_countries';
const STATES_TABLE = 'investigation_country_states';
// El árbol de infantería es una clave hermana de `arboles_tecnologicos_CM`.
const INFANTRY_TREE_KEY = 'arbol_infanteria_1910_1920';

// Nombres normalizados de las tecnologías investigadas por país.
// Clave: país normalizado -> Set de nombres de módulo normalizados.
const researchedModulesByCountry = new Map();

// Conjunto de nombres de tecnologías del árbol (solo para referencia).
const treeModuleNames = new Set();

let datosCargados = false;
let supabaseClient = null;

/* ============================================================
   UTILIDADES
   ============================================================ */

// Normaliza texto para comparar nombres: minúsculas, sin acentos,
// sin paréntesis ni guiones, espacios colapsados.
function normalizarModulo(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[()\-_,./]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizarPais(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escapePathPart(value) {
    return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

async function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const modulo = await import('./supabase.js');
    supabaseClient = modulo.supabase;
    return supabaseClient;
}

/* ============================================================
   CARGA DE DATOS
   ============================================================ */

// Recorre el árbol y devuelve los nodos con { id, nombre }.
function recolectarNodosArbol() {
    const nodos = [];
    return fetch(TREE_PATH)
        .then(response => {
            if (!response.ok) throw new Error(`No se pudo leer tree.json (HTTP ${response.status}).`);
            return response.json();
        })
        .then(data => {
            const tree = data?.arboles_tecnologicos_CM;
            if (!tree || typeof tree !== 'object') {
                throw new Error('tree.json no contiene arboles_tecnologicos_CM.');
            }

            Object.entries(tree).forEach(([treeKey, branch]) => {
                function visit(value, path = []) {
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => visit(item, [...path, String(index)]));
                        return;
                    }
                    if (!value || typeof value !== 'object') return;
                    if (typeof value.nombre === 'string') {
                        nodos.push({
                            id: [treeKey, ...path].map(escapePathPart).join('/'),
                            nombre: value.nombre
                        });
                        treeModuleNames.add(normalizarModulo(value.nombre));
                    }
                    Object.entries(value).forEach(([key, child]) => {
                        visit(child, [...path, key]);
                    });
                }
                visit(branch);
            });

            // El árbol de infantería es una clave hermana de arboles_tecnologicos_CM.
            const infantryTree = data?.[INFANTRY_TREE_KEY];
            if (infantryTree && typeof infantryTree === 'object') {
                function visitInfantry(value, path = []) {
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => visitInfantry(item, [...path, String(index)]));
                        return;
                    }
                    if (!value || typeof value !== 'object') return;
                    if (typeof value.nombre === 'string') {
                        nodos.push({
                            id: [INFANTRY_TREE_KEY, ...path].map(escapePathPart).join('/'),
                            nombre: value.nombre
                        });
                        treeModuleNames.add(normalizarModulo(value.nombre));
                    }
                    Object.entries(value).forEach(([key, child]) => {
                        visitInfantry(child, [...path, key]);
                    });
                }
                visitInfantry(infantryTree);
            }

            return nodos;
        });
}

// Construye el mapa país -> Set(nombres normalizados) con los módulos
// investigados (estado "completed") de cada país.
async function cargarInvestigacionesPorPais(nodos) {
    const supabase = await getSupabaseClient();

    const countriesResult = await supabase
        .from(COUNTRIES_TABLE)
        .select('id, country');
    if (countriesResult.error) throw countriesResult.error;

    const countries = countriesResult.data || [];
    if (!countries.length) return;

    const statesResult = await supabase
        .from(STATES_TABLE)
        .select('country_id, node_id, status')
        .eq('status', 'completed')
        .in('country_id', countries.map(country => country.id));
    if (statesResult.error) throw statesResult.error;

    const nombrePorNodo = new Map(nodos.map(nodo => [nodo.id, nodo.nombre]));
    const countryById = new Map(countries.map(country => [country.id, country]));

    (statesResult.data || []).forEach(state => {
        if (state.status !== 'completed') return;
        const country = countryById.get(state.country_id);
        if (!country) return;
        const nombre = nombrePorNodo.get(state.node_id);
        if (!nombre) return;
        const countryKey = normalizarPais(country.country);
        if (!researchedModulesByCountry.has(countryKey)) {
            researchedModulesByCountry.set(countryKey, new Set());
        }
        researchedModulesByCountry.get(countryKey).add(normalizarModulo(nombre));
    });
}

/* ============================================================
   APLICACIÓN DEL INDICADOR EN EL DOM
   ============================================================ */

// Obtiene el nombre mostrado en una tarjeta de módulo.
function obtenerNombreTarjeta(tarjeta) {
    const strong = tarjeta.querySelector('.modulo-topline strong');
    return strong ? strong.textContent : '';
}

// Aplica / quita el punto verde según el país actual.
function actualizarIndicadores() {
    const paisInput = document.getElementById('pais');
    const contenedor = document.getElementById('modulos-container');
    if (!contenedor) return;

    const countryKey = normalizarPais(paisInput ? paisInput.value : '');
    const investigados = researchedModulesByCountry.get(countryKey) || null;

    contenedor.querySelectorAll('.opcion-modulo').forEach(tarjeta => {
        const nombre = normalizarModulo(obtenerNombreTarjeta(tarjeta));
        const estaInvestigado = Boolean(investigados && nombre && investigados.has(nombre));

        // Punto verde en la línea superior de la tarjeta.
        const topline = tarjeta.querySelector('.modulo-topline');
        let punto = topline ? topline.querySelector('.indicador-investigado') : null;

        if (estaInvestigado) {
            tarjeta.classList.add('modulo-investigado');
            if (topline && !punto) {
                punto = document.createElement('span');
                punto.className = 'indicador-investigado';
                punto.title = 'Módulo investigado por este país';
                punto.setAttribute('aria-label', 'Módulo investigado');
                topline.insertBefore(punto, topline.firstChild);
            }
        } else {
            tarjeta.classList.remove('modulo-investigado');
            if (punto) punto.remove();
        }
    });
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

function inicializar() {
    const paisInput = document.getElementById('pais');
    const contenedor = document.getElementById('modulos-container');
    if (!contenedor) return;

    // Al escribir el país se recalculan los indicadores al instante.
    if (paisInput) {
        paisInput.addEventListener('input', actualizarIndicadores);
        paisInput.addEventListener('change', actualizarIndicadores);
    }

    // Las tarjetas se regeneran constantemente (cambio de chasis/cantidad),
    // así que observamos el contenedor para reaplicar el indicador.
    const observer = new MutationObserver(() => actualizarIndicadores());
    observer.observe(contenedor, { childList: true, subtree: true });

    // Carga el árbol local y luego los estados investigados por país.
    recolectarNodosArbol()
        .then(nodos => cargarInvestigacionesPorPais(nodos))
        .then(() => {
            datosCargados = true;
            actualizarIndicadores();
        })
        .catch(error => {
            // La indicación es opcional: si falla, el constructor sigue funcionando.
            console.warn('No se pudo cargar el indicador de investigaciones:', error);
        });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
}

// Expuesto por si otro script necesita saber si terminó la carga.
if (typeof window !== 'undefined') {
    window.indicadorInvestigacion = {
        actualizar: actualizarIndicadores,
        cargado: () => datosCargados
    };
}
