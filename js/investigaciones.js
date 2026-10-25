import { supabase } from './supabase.js';

const COUNTRIES_TABLE = 'investigation_countries';
const STATES_TABLE = 'investigation_country_states';
const SLOT_LIMIT = 2;
const STATUS_LABELS = {
    not_started: 'Sin investigar',
    in_progress: 'En proceso',
    completed: 'Investigado'
};
const CATEGORY_LABELS = {
    civil: 'Tecnologías civiles',
    infanteria: 'Tecnologías de infantería',
    naval: 'Tecnologías navales',
    blindados: 'Tecnologías blindadas',
    aerea: 'Tecnologías aéreas'
};
const TREE_CATEGORY_BY_KEY = {
    arbol_civil_1910_1919: 'civil',
    linea_maritima_1910_1920: 'naval',
    arbol_tanques_y_vehiculos_1910_1920: 'blindados',
    aviacion: 'aerea'
};

// El árbol de infantería vive fuera de `arboles_tecnologicos_CM` en tree.json
// (como clave hermana) y agrupa sus nodos por rama de armas/artillería.
const INFANTRY_TREE_KEY = 'arbol_infanteria_1910_1920';
// Propiedades de infantería que ya no se muestran como dato suelto.
const INFANTRY_HIDDEN_KEYS = new Set([
    'nombre', 'id', 'tipo', 'requisitos',
    'investigacion_inicial', 'investigacion_especial'
]);

const branchForm = document.getElementById('formulario-rama');
const countryInput = document.getElementById('nombre-pais');
const branchStatus = document.getElementById('estado-rama');
const listStatus = document.getElementById('estado-investigaciones');
const branchList = document.getElementById('lista-ramas');
let treeData;
let countries = [];
let statesByCountry = new Map();
let openCountryIds = new Set();
let openCountryAfterRefresh = '';
const pendingStates = new Map();

function createElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (text !== undefined) element.textContent = String(text);
    if (className) element.className = className;
    return element;
}

function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.hidden = !message;
    element.dataset.error = String(isError);
    element.setAttribute('role', isError ? 'alert' : 'status');
}

// Corrige tildes en etiquetas generadas a partir de claves sin acentos.
const LABEL_ACCENTS = {
    artilleria: 'Artillería',
    ingenieria: 'Ingeniería',
    construccion: 'Construcción',
    extraccion: 'Extracción',
    aviacion: 'Aviación',
    comunicacion: 'Comunicación',
    traccion: 'Tracción'
};

function formatLabel(value) {
    const formatted = value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, character => character.toLocaleUpperCase('es'));
    return LABEL_ACCENTS[value] || formatted;
}

function formatValue(value) {
    if (value === null || value === undefined) return 'Sin dato';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (Array.isArray(value)) return value.map(formatValue).join(', ');
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([key, detail]) => `${formatLabel(key)}: ${formatValue(detail)}`)
            .join(' · ');
    }
    return String(value);
}

function escapePathPart(value) {
    return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pendingStateKey(countryId, nodeId) {
    return `${countryId}:${nodeId}`;
}

function collectTechnologies() {
    const tree = treeData?.arboles_tecnologicos_CM;
    if (!tree || typeof tree !== 'object') {
        throw new Error('tree.json no contiene arboles_tecnologicos_CM.');
    }

    const nodesByCategory = new Map(
        Object.keys(CATEGORY_LABELS).map(category => [category, []])
    );

    function addNode(category, id, branch, technology) {
        nodesByCategory.get(category).push({ id, category, branch, technology });
    }

    Object.entries(tree).forEach(([treeKey, branch]) => {
        const category = TREE_CATEGORY_BY_KEY[treeKey];
        if (!category) return;

        function visit(value, path = [], subBranches = []) {
            if (Array.isArray(value)) {
                value.forEach((item, index) => visit(item, [...path, String(index)], subBranches));
                return;
            }
            if (!value || typeof value !== 'object') return;

            const nextBranches = typeof value.nombre === 'string'
                ? subBranches
                : [...subBranches, ...path.slice(-1)];

            if (typeof value.nombre === 'string') {
                addNode(
                    category,
                    [treeKey, ...path].map(escapePathPart).join('/'),
                    nextBranches.map(formatLabel).join(' / ') || CATEGORY_LABELS[category],
                    value
                );
            }

            Object.entries(value).forEach(([key, child]) => {
                visit(child, [...path, key], nextBranches);
            });
        }

        visit(branch);
    });

    collectInfantryTechnologies(treeData?.[INFANTRY_TREE_KEY], addNode);

    return nodesByCategory;
}

function collectInfantryTechnologies(infantryTree, addNode) {
    if (!infantryTree || typeof infantryTree !== 'object') return;

    function visit(value, path = [], subBranches = []) {
        if (Array.isArray(value)) {
            // La clave del array (p. ej. `fusiles`) identifica la rama junto a
            // su grupo contenedor (p. ej. `armas`).
            const key = path[path.length - 1];
            const nextBranches = key && /^\d+$/.test(key) ? subBranches : [...subBranches, key].filter(Boolean);
            value.forEach((item, index) => visit(item, [...path, String(index)], nextBranches));
            return;
        }
        if (!value || typeof value !== 'object') return;

        if (typeof value.nombre === 'string') {
            addNode(
                'infanteria',
                [INFANTRY_TREE_KEY, ...path].map(escapePathPart).join('/'),
                subBranches.map(formatLabel).join(' / ') || CATEGORY_LABELS.infanteria,
                value
            );
            return;
        }

        Object.entries(value).forEach(([key, child]) => {
            const nextBranches = Array.isArray(child)
                ? subBranches
                : [...subBranches, key];
            visit(child, [...path, key], nextBranches);
        });
    }

    visit(infantryTree);
}

function isInitialTechnology(technology) {
    return Boolean(technology.tecnologia_inicial || technology.investigacion_inicial);
}

function renderTechnologyDetails(technology) {
    const details = document.createElement('details');
    details.className = 'research-node-details';
    details.append(createElement('summary', 'Ver detalles'));

    const list = document.createElement('ul');
    Object.entries(technology)
        .filter(([key]) => !INFANTRY_HIDDEN_KEYS.has(key) && key !== 'tecnologia_inicial')
        .forEach(([key, value]) => {
            const item = createElement('li');
            item.append(createElement('strong', `${formatLabel(key)}: `));
            item.append(document.createTextNode(formatValue(value)));
            list.append(item);
        });
    if (technology.investigacion_especial) {
        const item = createElement('li');
        item.append(createElement('strong', 'Investigación especial: '));
        item.append(document.createTextNode(formatValue(technology.investigacion_especial)));
        list.append(item);
    }
    if (Array.isArray(technology.requisitos) && technology.requisitos.length) {
        const item = createElement('li');
        item.append(createElement('strong', 'Requisitos: '));
        item.append(document.createTextNode(technology.requisitos.join(', ')));
        list.append(item);
    }
    if (!list.childElementCount && !isInitialTechnology(technology)) {
        list.append(createElement('li', 'Sin datos adicionales.'));
    }
    details.append(list);
    return details;
}

function getNodeStatus(countryId, nodeId, drafts) {
    return drafts.has(nodeId)
        ? drafts.get(nodeId)
        : statesByCountry.get(countryId)?.get(nodeId)?.status || 'not_started';
}

function countInProgress(countryId, nodes, drafts) {
    return nodes.filter(node =>
        getNodeStatus(countryId, node.id, drafts) === 'in_progress'
    ).length;
}

function updateSlotCounter(countryId, nodes, drafts, counter) {
    counter.textContent = `Slots en proceso: ${countInProgress(countryId, nodes, drafts)}/${SLOT_LIMIT}`;
}

async function saveCategoryStatus(event, country, category, nodes, drafts, button, feedback, counter) {
    event.preventDefault();
    const changedStates = nodes
        .filter(node => {
            const persistedStatus = statesByCountry.get(country.id)?.get(node.id)?.status || 'not_started';
            return drafts.has(node.id) && drafts.get(node.id) !== persistedStatus;
        })
        .map(node => ({ node_id: node.id, status: drafts.get(node.id) }));

    if (!changedStates.length) {
        feedback.textContent = 'No hay cambios pendientes en esta categoría.';
        return;
    }

    const activeCount = countInProgress(country.id, nodes, drafts);
    if (activeCount > SLOT_LIMIT) {
        feedback.textContent = `Esta categoría tiene ${activeCount} investigaciones en proceso. El máximo es ${SLOT_LIMIT}; cambia algunas a «Sin investigar» o «Investigado».`;
        updateSlotCounter(country.id, nodes, drafts, counter);
        return;
    }

    button.disabled = true;
    feedback.textContent = 'Guardando cambios de la categoría…';
    try {
        const { error } = await supabase.rpc('update_investigation_category_states', {
            p_country_id: country.id,
            p_category: category,
            p_states: changedStates
        });

        if (error) {
            feedback.textContent = error.code === '23514'
                ? `No se guardaron los cambios: solo puede haber ${SLOT_LIMIT} investigaciones en proceso por categoría.`
                : `No se pudieron guardar los cambios: ${error.message}`;
            return;
        }

        const states = statesByCountry.get(country.id) || new Map();
        changedStates.forEach(state => {
            states.set(state.node_id, { category, status: state.status });
            drafts.delete(state.node_id);
            pendingStates.delete(pendingStateKey(country.id, state.node_id));
        });
        statesByCountry.set(country.id, states);
        updateSlotCounter(country.id, nodes, drafts, counter);
        feedback.textContent = `Se guardaron ${changedStates.length} cambios.`;
    } catch (error) {
        feedback.textContent = `No se pudieron guardar los cambios por un error de conexión: ${error.message}`;
    } finally {
        button.disabled = false;
    }
}

function renderTechnologyNode(country, node, drafts, nodes, counter) {
    const card = createElement('article', undefined, 'research-node');
    const heading = createElement('div', undefined, 'research-node-heading');
    heading.append(createElement('h4', node.technology.nombre));
    if (isInitialTechnology(node.technology)) {
        heading.append(createElement('span', 'Tecnología inicial', 'research-initial'));
    }
    card.append(heading, renderTechnologyDetails(node.technology));

    const form = createElement('form', undefined, 'research-state-form');
    const label = createElement('label', 'Estado');
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Estado de ${node.technology.nombre}`);
    Object.entries(STATUS_LABELS).forEach(([value, text]) => select.add(new Option(text, value)));
    select.value = getNodeStatus(country.id, node.id, drafts);
    select.addEventListener('change', () => {
        drafts.set(node.id, select.value);
        pendingStates.set(pendingStateKey(country.id, node.id), select.value);
        updateSlotCounter(country.id, nodes, drafts, counter);
    });
    label.append(select);

    form.append(label);
    card.append(form);
    return card;
}

function renderCountry(country) {
    const countryDetails = createElement('details', undefined, 'research-publication');
    countryDetails.dataset.countryId = country.id;
    countryDetails.open = openCountryIds.has(country.id) || country.id === openCountryAfterRefresh;

    const summary = document.createElement('summary');
    summary.append(createElement('strong', `Tree de ${country.country}`));
    countryDetails.append(summary);

    const content = createElement('div', undefined, 'research-publication-content');
    const technologiesByCategory = collectTechnologies();

    Object.entries(CATEGORY_LABELS).forEach(([category, label]) => {
        const categoryNodes = technologiesByCategory.get(category) || [];
        const categoryBranch = document.createElement('details');
        categoryBranch.className = 'research-branch';
        categoryBranch.open = category === 'infanteria';
        categoryBranch.append(createElement('summary', label));

        const categoryContent = createElement('div', undefined, 'research-category-content');
        const categoryDrafts = new Map();
        categoryNodes.forEach(node => {
            const key = pendingStateKey(country.id, node.id);
            if (pendingStates.has(key)) categoryDrafts.set(node.id, pendingStates.get(key));
        });
        const counter = createElement('span', undefined, 'research-slot-counter');
        counter.setAttribute('aria-label', `${label}: slots en proceso`);
        updateSlotCounter(country.id, categoryNodes, categoryDrafts, counter);
        categoryContent.append(counter);

        if (!categoryNodes.length) {
            const message = category === 'infanteria'
                ? 'tree.json todavía no incluye tecnologías de infantería ni artillería.'
                : 'Esta categoría no contiene tecnologías en tree.json.';
            categoryContent.append(createElement('p', message, 'research-empty'));
        } else {
            const branches = new Map();
            categoryNodes.forEach(node => {
                if (!branches.has(node.branch)) {
                    const branch = document.createElement('details');
                    branch.className = 'research-sub-branch';
                    branch.open = true;
                    branch.append(createElement('summary', node.branch));
                    const nodeList = createElement('div', undefined, 'research-nodes');
                    branch.append(nodeList);
                    branches.set(node.branch, nodeList);
                    categoryContent.append(branch);
                }
                branches.get(node.branch).append(
                    renderTechnologyNode(country, node, categoryDrafts, categoryNodes, counter)
                );
            });
        }

        if (categoryNodes.length) {
            const saveForm = createElement('form', undefined, 'research-category-save');
            const saveButton = createElement('button', 'Guardar cambios de categoría', 'btn btn-primary');
            saveButton.type = 'submit';
            const feedback = createElement('p', undefined, 'research-category-feedback');
            feedback.setAttribute('role', 'status');
            saveForm.append(saveButton, feedback);
            saveForm.addEventListener('submit', event => saveCategoryStatus(
                event,
                country,
                category,
                categoryNodes,
                categoryDrafts,
                saveButton,
                feedback,
                counter
            ));
            categoryContent.append(saveForm);
        }

        categoryBranch.append(categoryContent);
        content.append(categoryBranch);
    });

    countryDetails.append(content);
    countryDetails.addEventListener('toggle', () => {
        if (countryDetails.open) openCountryIds.add(country.id);
        else openCountryIds.delete(country.id);
    });
    return countryDetails;
}

function renderCountries() {
    branchList.replaceChildren();
    if (!countries.length) {
        branchList.append(createElement('p', 'Todavía no hay ramas por país. Añade la primera desde el formulario.', 'research-empty'));
        return;
    }
    countries.forEach(country => branchList.append(renderCountry(country)));
    openCountryAfterRefresh = '';
}

async function refreshCountries() {
    openCountryIds = new Set(
        [...branchList.querySelectorAll('.research-publication[open]')]
            .map(element => element.dataset.countryId)
    );
    showStatus(listStatus, 'Cargando ramas…');

    try {
        const countryResult = await supabase
            .from(COUNTRIES_TABLE)
            .select('id, country, created_at')
            .order('created_at', { ascending: false });
        if (countryResult.error) {
            showStatus(listStatus, `No se pudieron cargar las ramas: ${countryResult.error.message}. Verifica que hayas aplicado la migración SQL de investigaciones por país.`, true);
            return;
        }

        countries = countryResult.data;
        statesByCountry = new Map();
        if (countries.length) {
            const stateResult = await supabase
                .from(STATES_TABLE)
                .select('country_id, node_id, category, status')
                .in('country_id', countries.map(country => country.id));
            if (stateResult.error) {
                showStatus(listStatus, `No se pudieron cargar los estados: ${stateResult.error.message}`, true);
                return;
            }

            stateResult.data.forEach(state => {
                const states = statesByCountry.get(state.country_id) || new Map();
                states.set(state.node_id, state);
                statesByCountry.set(state.country_id, states);
            });
        }

        renderCountries();
        showStatus(listStatus, `${countries.length} ramas cargadas.`);
    } catch (error) {
        showStatus(listStatus, `No se pudieron cargar las ramas por un error de conexión: ${error.message}`, true);
    }
}

branchForm.addEventListener('submit', async event => {
    event.preventDefault();
    const country = countryInput.value.trim();
    if (!country || country.length > 100) {
        showStatus(branchStatus, 'Escribe un nombre de país de hasta 100 caracteres.', true);
        return;
    }

    const submitButton = document.getElementById('anadir-rama');
    submitButton.disabled = true;
    showStatus(branchStatus, 'Añadiendo rama…');
    try {
        const { data, error } = await supabase
            .from(COUNTRIES_TABLE)
            .insert({ country })
            .select('id')
            .single();
        if (error) {
            const duplicate = error.code === '23505';
            showStatus(
                branchStatus,
                duplicate
                    ? `Ya existe una rama para «${country}».`
                    : `No se pudo añadir la rama: ${error.message}`,
                true
            );
            return;
        }

        openCountryAfterRefresh = data.id;
        branchForm.reset();
        showStatus(branchStatus, `Rama «Tree de ${country}» añadida.`);
        await refreshCountries();
    } catch (error) {
        showStatus(branchStatus, `No se pudo conectar para añadir la rama: ${error.message}`, true);
    } finally {
        submitButton.disabled = false;
    }
});

document.getElementById('actualizar-investigaciones').addEventListener('click', refreshCountries);

try {
    const response = await fetch('../data/investigacion/tree.json');
    if (!response.ok) throw new Error(`No se pudo leer tree.json (HTTP ${response.status}).`);
    treeData = await response.json();
    collectTechnologies();
} catch (error) {
    showStatus(listStatus, `No se pudo preparar el árbol del proyecto: ${error.message}`, true);
}

await refreshCountries();
supabase
    .channel('investigation-countries-updates')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: COUNTRIES_TABLE
    }, refreshCountries)
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: STATES_TABLE
    }, refreshCountries)
    .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            showStatus(listStatus, 'No se pudo activar la sincronización en tiempo real. Usa «Actualizar ramas» para consultar los cambios.', true);
        }
    });
