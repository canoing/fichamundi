import { supabase } from './supabase.js';

const vehicleTypes = {
    tank: [
        ['chassis', 'Chasis'],
        ['traccion', 'Tracción'],
        ['motor', 'Motor'],
        ['comunicacion', 'Comunicación'],
        ['blindaje', 'Blindaje'],
        ['armamento', 'Armamento']
    ],
    aircraft: [
        ['fuselaje', 'Fuselaje'],
        ['motores', 'Motor'],
        ['armamento', 'Armamento'],
        ['bombas', 'Bombas'],
        ['torpedos', 'Torpedos'],
        ['alas', 'Alas']
    ],
    naval: [
        ['hull_destructores', 'Casco de destructor'],
        ['hull_fragatas', 'Casco de fragata'],
        ['hull_cruceros_ligeros', 'Casco de crucero ligero'],
        ['hull_cruceros_pesados', 'Casco de crucero pesado'],
        ['hull_cruceros_de_batalla', 'Casco de crucero de batalla'],
        ['hull_acorazados_dreadnoughts', 'Casco de acorazado'],
        ['hull_submarinos', 'Casco de submarino'],
        ['propulsion', 'Propulsión'],
        ['armamento', 'Armamento'],
        ['blindaje', 'Blindaje']
    ],
    infantry: [['weapon', 'Arma de división']]
};

const sources = new Map();
const fieldDefinitions = new Map();
const vehicleSelect = document.getElementById('vehiculo-modulo');
const typeSelect = document.getElementById('tipo-modulo');
const sourceSelect = document.getElementById('modulo-base');
const countryInput = document.getElementById('pais-modulo');
const countryFilter = document.getElementById('filtro-pais-modulos');
const moduleForm = document.getElementById('formulario-modulo');
const fieldsContainer = document.getElementById('campos-modulo');
const approvedList = document.getElementById('lista-modulos-aprobados');
const catalogStatus = document.getElementById('estado-catalogo');
const submitStatus = document.getElementById('estado-envio-modulo');
const moderationStatus = document.getElementById('estado-moderacion');
const moderationPanel = document.getElementById('panel-moderacion-modulos');
const pendingList = document.getElementById('lista-pendientes-modulos');

let approvedModules = [];
let sourcesByKey = new Map();
let moderatorKey = '';
let pendingModules = [];

function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.hidden = !message;
    element.style.display = message ? 'flex' : 'none';
    element.setAttribute('role', isError ? 'alert' : 'status');
}

function vehicleTypeOptions(vehicle) {
    return vehicleTypes[vehicle] || [];
}

function typeLabel(vehicle, type) {
    return vehicleTypeOptions(vehicle).find(([value]) => value === type)?.[1] || type;
}

function keyFor(vehicle, type) {
    return `${vehicle}:${type}`;
}

function moduleFields(vehicle, type, content = {}) {
    const definitions = fieldDefinitions.get(keyFor(vehicle, type)) || [];
    const values = Object.keys(content).filter(key => !['id', 'inicial', 'price', 'precio', 'coste', 'costo'].includes(key));
    const keys = definitions.length ? definitions.map(field => field.key) : values;
    return keys.map(key => {
        const value = content[key];
        const field = definitions.find(item => item.key === key);
        return {
            key,
            label: field?.label || key.replace(/_/g, ' ').replace(/^./, character => character.toLocaleUpperCase('es')),
            type: field?.type || (typeof value === 'number' ? 'number' : value && typeof value === 'object' ? 'json' : typeof value === 'boolean' ? 'checkbox' : 'text'),
            defaultValue: field?.defaultValue ?? (typeof value === 'boolean' ? value : ''),
            required: key === 'nombre' || field?.required || false
        };
    });
}

function createField(field, value, idPrefix) {
    const wrapper = document.createElement('div');
    wrapper.className = 'campo';
    const id = `${idPrefix}-${field.key}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = field.label;
    wrapper.append(label);

    let input;
    if (field.type === 'json') {
        input = document.createElement('textarea');
        input.rows = 4;
        input.value = JSON.stringify(value ?? {}, null, 2);
    } else {
        input = document.createElement('input');
        input.type = field.type;
        if (field.type === 'number') input.step = 'any';
        if (field.type === 'checkbox') input.checked = Boolean(value ?? field.defaultValue);
        else if (value !== undefined && value !== null) input.value = String(value);
        else if (field.defaultValue !== undefined && field.defaultValue !== '') input.value = String(field.defaultValue);
    }
    input.id = id;
    input.name = field.key;
    input.required = Boolean(field.required);
    wrapper.append(input);
    return wrapper;
}

function renderFields(container, vehicle, type, content = {}, idPrefix = 'modulo') {
    const fields = moduleFields(vehicle, type, content);
    container.replaceChildren(...fields.map(field =>
        createField(field, content[field.key] ?? field.defaultValue, idPrefix)
    ));
}

function readContent(container, vehicle, type) {
    return Object.fromEntries(moduleFields(vehicle, type).map(field => {
        const input = container.querySelector(`[name="${field.key}"]`);
        if (field.type === 'checkbox') return [field.key, input.checked];
        if (field.type === 'json') {
            try {
                return [field.key, JSON.parse(input.value)];
            } catch {
                input.setCustomValidity('Ingresa un objeto JSON válido.');
                input.reportValidity();
                input.setCustomValidity('');
                throw new Error(`El campo ${field.label} no contiene JSON válido.`);
            }
        }
        return [field.key, field.type === 'number' ? Number(input.value) : input.value.trim()];
    }));
}

async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`No se pudo cargar el catálogo ${path}.`);
    return response.json();
}

function recordSources(vehicle, type, modules) {
    const records = (modules || []).filter(module => module && typeof module === 'object' && module.nombre)
        .map(module => ({ label: module.nombre, content: module }));
    sources.set(keyFor(vehicle, type), records);
    const example = records[0]?.content || {};
    const fields = Object.entries(example)
        .filter(([key, value]) => !['id', 'inicial', 'coste', 'costo', 'price', 'precio'].includes(key) && value !== undefined)
        .map(([key, value]) => ({
            key,
            type: typeof value === 'number' ? 'number' : value && typeof value === 'object' ? 'json' : typeof value === 'boolean' ? 'checkbox' : 'text',
            label: key === 'nombre' ? 'Nombre' : key.replace(/_/g, ' ').replace(/^./, character => character.toLocaleUpperCase('es')),
            defaultValue: typeof value === 'boolean' || (value && typeof value === 'object') ? value : '',
            required: true
        }));
    fieldDefinitions.set(keyFor(vehicle, type), fields);
}

async function loadBuiltInSources() {
    const [tankChassis, tankModules, aircraftFuselages, aircraftModules, navalHulls, navalModules, infantryData] = await Promise.all([
        fetchJson('../data/vehiculos/tanque/chazi.json'),
        fetchJson('../data/vehiculos/tanque/modulo.json'),
        fetchJson('../data/vehiculos/aviones/fuselaje.json'),
        fetchJson('../data/vehiculos/aviones/modulosaviones.json'),
        fetchJson('../data/vehiculos/naval/cascos.json'),
        fetchJson('../data/vehiculos/naval/modulos.json'),
        fetchJson('../data/referencias/divi/unida.json')
    ]);

    recordSources('tank', 'chassis', tankChassis.chasis);
    recordSources('tank', 'traccion', tankChassis.sistemas_traccion);
    recordSources('tank', 'motor', tankModules.motores);
    recordSources('tank', 'comunicacion', tankModules.comunicacion);
    recordSources('tank', 'blindaje', tankModules.blindajes);
    recordSources('aircraft', 'fuselaje', aircraftFuselages);
    Object.entries(aircraftModules).forEach(([type, modules]) => recordSources('aircraft', type, modules));
    Object.entries(navalHulls.cascos || {}).forEach(([group, modules]) => recordSources('naval', `hull_${group}`, modules));
    Object.entries(navalModules).forEach(([type, modules]) => recordSources('naval', type, modules));
    const infantryWeapons = infantryData.ejemplo_armas_equipables || [];
    recordSources('infantry', 'weapon', infantryWeapons);
    fieldDefinitions.set(keyFor('infantry', 'weapon'), [
        { key: 'nombre', type: 'text', label: 'Nombre', defaultValue: '', required: true },
        { key: 'tipo', type: 'text', label: 'Tipo de unidad', defaultValue: '', required: true },
        { key: 'hp_a_regimiento', type: 'number', label: 'HP por regimiento', defaultValue: 0, required: true },
        { key: 'ataque', type: 'number', label: 'Ataque', defaultValue: 0, required: true },
        { key: 'defensa', type: 'number', label: 'Defensa', defaultValue: 0, required: true },
        { key: 'nivel_tech_tree', type: 'number', label: 'Nivel tecnológico', defaultValue: 0, required: true },
        { key: 'mov_propio', type: 'number', label: 'Movimiento propio', defaultValue: 0, required: true },
        { key: 'sup_costo', type: 'number', label: 'Costo de suministros', defaultValue: 0, required: true }
    ]);
    sources.set(keyFor('infantry', 'weapon'), infantryWeapons.map(weapon => ({
        label: weapon.nombre,
        content: {
            nombre: weapon.nombre,
            tipo: weapon.tipo || '',
            hp_a_regimiento: 0,
            ataque: Number(weapon.buffs?.atk) || 0,
            defensa: Number(weapon.buffs?.def) || 0,
            nivel_tech_tree: 0,
            mov_propio: Number(weapon.mov_propio) || 0,
            sup_costo: Number(weapon.sup_costo) || 0
        }
    })));
}

function updateModuleTypes() {
    const options = vehicleTypeOptions(vehicleSelect.value);
    typeSelect.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
}

async function refreshSources() {
    const vehicle = vehicleSelect.value;
    const type = typeSelect.value;
    const country = countryInput.value.trim().toLocaleLowerCase('es');
    const builtIn = sources.get(keyFor(vehicle, type)) || [];
    const approved = approvedModules.filter(module =>
        module.vehicle === vehicle && module.module_type === type &&
        module.country.trim().toLocaleLowerCase('es') === country
    );
    sourcesByKey = new Map();
    sourceSelect.replaceChildren(new Option('Crear desde cero', ''));
    builtIn.forEach((source, index) => {
        const key = `builtin:${index}`;
        sourcesByKey.set(key, source.content);
        sourceSelect.add(new Option(`Base: ${source.label}`, key));
    });
    approved.forEach(module => {
        const key = `approved:${module.id}`;
        sourcesByKey.set(key, module.content);
        sourceSelect.add(new Option(`Aprobado: ${module.content.nombre}`, key));
    });
    renderFields(fieldsContainer, vehicle, type);
}

function refreshCountryOptions() {
    const countries = [...new Set(approvedModules.map(module => module.country.trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, 'es'));
    const selected = countryFilter.value;
    countryFilter.replaceChildren(new Option('Todos los países', ''));
    countries.forEach(country => countryFilter.add(new Option(country, country)));
    if (countries.includes(selected)) countryFilter.value = selected;
}

function renderApprovedModules() {
    const country = countryFilter.value.toLocaleLowerCase('es');
    const filtered = approvedModules.filter(module =>
        !country || module.country.trim().toLocaleLowerCase('es') === country
    );
    approvedList.replaceChildren();
    filtered.forEach(module => {
        const card = document.createElement('article');
        card.className = 'opcion-modulo';
        const title = document.createElement('h3');
        title.textContent = module.content.nombre;
        const details = document.createElement('p');
        details.className = 'inicio-descripcion';
        details.textContent = `${module.country} · ${typeLabel(module.vehicle, module.module_type)} · Precio: ${Number(module.price).toFixed(2)} M`;
        const copyButton = document.createElement('button');
        copyButton.className = 'btn btn-secondary';
        copyButton.type = 'button';
        copyButton.textContent = 'Crear una revisión';
        copyButton.addEventListener('click', async () => {
            vehicleSelect.value = module.vehicle;
            countryInput.value = module.country;
            updateModuleTypes();
            typeSelect.value = module.module_type;
            await refreshSources();
            sourceSelect.value = `approved:${module.id}`;
            renderFields(fieldsContainer, module.vehicle, module.module_type, module.content);
            moduleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        card.append(title, details, copyButton);
        approvedList.append(card);
    });
    setStatus(catalogStatus, filtered.length ? '' : 'No hay módulos aprobados para este filtro.');
}

function renderReviewFields(container, module) {
    const contentContainer = document.createElement('div');
    contentContainer.className = 'formulario';
    const idPrefix = `revision-${module.id}`;
    const fields = moduleFields(module.vehicle, module.module_type, module.content);
    fields.forEach(field => contentContainer.append(createField(field, module.content[field.key], idPrefix)));
    const priceField = createField({
        key: 'price',
        label: 'Precio de producción (M)',
        type: 'number',
        required: true
    }, module.price ?? '', idPrefix);
    priceField.querySelector('input').min = '0';
    priceField.querySelector('input').step = 'any';
    const commentField = createField({
        key: 'review_comment',
        label: 'Comentario de revisión',
        type: 'text'
    }, module.review_comment ?? '', idPrefix);
    commentField.querySelector('input').maxLength = 5000;
    container.replaceChildren(contentContainer, priceField, commentField);
}

function renderPendingModules() {
    pendingList.replaceChildren();
    pendingModules.forEach(module => {
        const card = document.createElement('article');
        card.className = 'opcion-modulo';
        const heading = document.createElement('h3');
        heading.textContent = `${module.content.nombre} · ${module.country} · ${typeLabel(module.vehicle, module.module_type)}`;
        const details = document.createElement('p');
        details.className = 'inicio-descripcion';
        details.textContent = new Date(module.created_at).toLocaleString('es');
        const editor = document.createElement('form');
        editor.addEventListener('submit', async event => {
            event.preventDefault();
            const reviewStatus = event.submitter?.dataset.status || 'approved';
            const priceInput = editor.querySelector('[name="price"]');
            if (reviewStatus === 'approved') priceInput.required = true;
            else priceInput.required = false;
            if (!editor.reportValidity()) return;

            let content;
            try {
                content = readContent(editor, module.vehicle, module.module_type);
            } catch (error) {
                setStatus(moderationStatus, error.message, true);
                return;
            }
            const priceValue = priceInput.value.trim();
            const price = priceValue ? Number(priceValue) : null;
            const comment = editor.querySelector('[name="review_comment"]').value.trim();
            const buttons = editor.querySelectorAll('[type="submit"]');
            buttons.forEach(button => { button.disabled = true; });
            try {
                const { error } = await supabase.rpc('review_custom_module', {
                    p_module_id: module.id,
                    p_status: reviewStatus,
                    p_content: content,
                    p_price: price,
                    p_review_comment: comment || null,
                    p_moderator_key: moderatorKey
                });
                if (error) throw error;
                setStatus(moderationStatus, 'Revisión guardada.');
                await loadPendingModules();
                await loadApprovedModules();
            } catch (error) {
                setStatus(moderationStatus, `No se pudo guardar la revisión: ${error.message}`, true);
            } finally {
                buttons.forEach(button => { button.disabled = false; });
            }
        });
        renderReviewFields(editor, module);
        const actions = document.createElement('div');
        actions.className = 'acciones';
        const approve = document.createElement('button');
        approve.type = 'submit';
        approve.dataset.status = 'approved';
        approve.className = 'btn btn-primary';
        approve.textContent = 'Aprobar';
        const reject = document.createElement('button');
        reject.type = 'submit';
        reject.dataset.status = 'rejected';
        reject.className = 'btn btn-secondary';
        reject.textContent = 'Rechazar';
        actions.append(approve, reject);
        editor.append(actions);
        card.append(heading, details, editor);
        pendingList.append(card);
    });
    if (!pendingModules.length) {
        pendingList.append(Object.assign(document.createElement('p'), {
            className: 'inicio-descripcion',
            textContent: 'No hay módulos pendientes de revisión.'
        }));
    }
}

async function loadApprovedModules() {
    setStatus(catalogStatus, 'Cargando módulos aprobados...');
    const { data, error } = await supabase
        .from('custom_modules')
        .select('id, revision_of, vehicle, module_type, country, content, price, status, is_current, created_at')
        .eq('status', 'approved')
        .eq('is_current', true)
        .order('created_at', { ascending: false });
    if (error) throw error;
    approvedModules = data || [];
    refreshCountryOptions();
    renderApprovedModules();
    await refreshSources();
}

async function loadPendingModules() {
    const { data, error } = await supabase.rpc('get_pending_custom_modules', {
        p_moderator_key: moderatorKey
    });
    if (error) throw error;
    pendingModules = Array.isArray(data) ? data : [];
    renderPendingModules();
}

vehicleSelect.addEventListener('change', () => {
    updateModuleTypes();
    refreshSources().catch(error => setStatus(submitStatus, error.message, true));
});
typeSelect.addEventListener('change', () => {
    refreshSources().catch(error => setStatus(submitStatus, error.message, true));
});
countryInput.addEventListener('change', () => {
    refreshSources().catch(error => setStatus(submitStatus, error.message, true));
});
countryFilter.addEventListener('change', renderApprovedModules);
sourceSelect.addEventListener('change', () => {
    const source = sourcesByKey.get(sourceSelect.value);
    renderFields(fieldsContainer, vehicleSelect.value, typeSelect.value, source || {});
    if (sourceSelect.value.startsWith('approved:')) {
        const module = approvedModules.find(item => item.id === sourceSelect.value.slice('approved:'.length));
        if (module) countryInput.value = module.country;
    }
});

moduleForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!moduleForm.reportValidity()) return;
    const selectedSource = sourceSelect.value;
    const revisionOf = selectedSource.startsWith('approved:') ? selectedSource.slice('approved:'.length) : null;
    let content;
    try {
        content = readContent(fieldsContainer, vehicleSelect.value, typeSelect.value);
    } catch (error) {
        setStatus(submitStatus, error.message, true);
        return;
    }
    const button = moduleForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
        const { error } = await supabase.from('custom_modules').insert({
            vehicle: vehicleSelect.value,
            module_type: typeSelect.value,
            country: countryInput.value.trim().toLocaleUpperCase('es'),
            content,
            revision_of: revisionOf
        });
        if (error) throw error;
        setStatus(submitStatus, 'Módulo enviado a moderación; aparecerá en el generador del país cuando sea aprobado.');
        sourceSelect.value = '';
        renderFields(fieldsContainer, vehicleSelect.value, typeSelect.value);
    } catch (error) {
        setStatus(submitStatus, `No se pudo enviar el módulo: ${error.message}`, true);
    } finally {
        button.disabled = false;
    }
});

document.getElementById('limpiar-modulo').addEventListener('click', () => {
    window.setTimeout(() => {
        updateModuleTypes();
        refreshSources().catch(error => setStatus(submitStatus, error.message, true));
    });
});
document.getElementById('actualizar-catalogo').addEventListener('click', () => {
    loadApprovedModules().catch(error => setStatus(catalogStatus, `No se pudo cargar el catálogo: ${error.message}`, true));
});

const moderatorAccess = document.getElementById('acceso-moderacion');
const moderatorToggle = document.getElementById('mostrar-acceso-moderacion');
moderatorToggle.addEventListener('click', () => {
    moderatorAccess.hidden = !moderatorAccess.hidden;
    moderatorToggle.setAttribute('aria-expanded', String(!moderatorAccess.hidden));
});
document.getElementById('formulario-acceso-moderacion').addEventListener('submit', async event => {
    event.preventDefault();
    const key = document.getElementById('clave-moderador-modulos').value;
    try {
        const { data, error } = await supabase.rpc('check_moderator_key', { p_moderator_key: key });
        if (error) throw error;
        if (!data) {
            setStatus(moderationStatus, 'La clave de moderador no es válida.', true);
            return;
        }
        moderatorKey = key;
        await loadPendingModules();
        moderationPanel.hidden = false;
        setStatus(moderationStatus, 'Acceso de moderador habilitado.');
    } catch (error) {
        moderatorKey = '';
        setStatus(moderationStatus, `No se pudo validar el acceso o cargar la cola: ${error.message}`, true);
    }
});
document.getElementById('cerrar-moderacion-modulos').addEventListener('click', () => {
    moderatorKey = '';
    pendingModules = [];
    pendingList.replaceChildren();
    moderationPanel.hidden = true;
    document.getElementById('clave-moderador-modulos').value = '';
    setStatus(moderationStatus, 'Acciones de moderación ocultas.');
});

const params = new URLSearchParams(window.location.search);
if (['tank', 'aircraft', 'naval', 'infantry'].includes(params.get('vehicle'))) {
    vehicleSelect.value = params.get('vehicle');
}
updateModuleTypes();
if (vehicleTypeOptions(vehicleSelect.value).some(([type]) => type === params.get('type'))) {
    typeSelect.value = params.get('type');
}

Promise.all([loadBuiltInSources(), loadApprovedModules()])
    .then(() => refreshSources())
    .catch(error => setStatus(catalogStatus, `No se pudo cargar el catálogo de módulos: ${error.message}`, true));
