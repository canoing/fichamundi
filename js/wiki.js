const menuToggle = document.getElementById('menu-toggle');
const navMenu = document.getElementById('nav-menu');
const searchInput = document.getElementById('buscar-pais');
const statusMessage = document.getElementById('estado-wiki');
const countryArticles = document.getElementById('articulos-paises');
const publicationForm = document.getElementById('formulario-publicacion-pais');
const publicationStatus = document.getElementById('estado-publicacion-pais');
const researchNames = new Map();
const approvedModulesByCountry = new Map();
const approvedTemplatesByCountry = new Map();
const economyFields = [
    ['gdp_latest', 'PIB más reciente (último valor proporcionado por Yair)', 'number'],
    ['military_spending', 'Gasto militar (% del PIB)', 'number'],
    ['primary_sector', 'Sector primario', 'sector'],
    ['secondary_light', 'Sector secundario ligero', 'sector'],
    ['secondary_heavy', 'Sector secundario pesado', 'sector'],
    ['tertiary_sector', 'Sector terciario', 'sector']
];
const sectorOptions = [
    ['', 'Sin especificar'],
    ['Bajo', 'Bajo'],
    ['Medio', 'Medio'],
    ['Alto', 'Alto']
];
const researchStatusLabels = {
    not_started: 'Sin investigar',
    in_progress: 'En proceso',
    completed: 'Investigado'
};
const liveResearchByCountry = new Map();
let liveResearchLoaded = false;
let communityPosts = [];
let approvedModulesLoaded = false;
let approvedTemplatesLoaded = false;

if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('abierto');
        menuToggle.classList.toggle('open', isOpen);
        menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('abierto');
            menuToggle.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
        });
    });
}

function createElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
}

function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.hidden = !message;
    element.style.display = message ? 'flex' : 'none';
    element.setAttribute('role', isError ? 'alert' : 'status');
}

function normalizeText(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

function renderSnapshotList(article, title, items, formatItem) {
    const section = createElement('section', undefined, 'wiki-publication-section');
    section.append(createElement('h3', title));
    const entries = Array.isArray(items)
        ? items.filter(item => typeof item === 'string' ? item.trim() : item && typeof item === 'object')
        : [];
    if (!entries.length) {
        section.append(createElement('p', 'No hay datos disponibles.', 'wiki-empty'));
    } else {
        const list = createElement('ul', undefined, 'wiki-name-list');
        entries.forEach(item => list.append(createElement('li', formatItem(item), 'wiki-name-item')));
        section.append(list);
    }
    article.append(section);
}

function renderEconomy(article, economy) {
    const section = createElement('section', undefined, 'wiki-publication-section');
    section.append(createElement('h3', 'Datos económicos'));
    const definitions = createElement('dl', undefined, 'wiki-economy-grid');
    economyFields.forEach(([key, label]) => {
        const value = economy?.[key];
        if (value === null || value === undefined || String(value).trim() === '') return;
        definitions.append(createElement('dt', label));
        definitions.append(createElement('dd', value));
    });
    if (!definitions.childElementCount) {
        section.append(createElement('p', 'No se añadieron datos económicos.', 'wiki-empty'));
    } else {
        section.append(definitions);
    }
    article.append(section);
}

function getLiveCountryResearch(country) {
    const items = liveResearchByCountry.get(normalizeText(country));
    if (!Array.isArray(items)) return [];
    return items.filter(item => item.status === 'completed' || item.status === 'in_progress');
}

function appendLiveResearchItems(entries, blank) {
    const fragment = document.createDocumentFragment();
    if (!entries.length) {
        fragment.append(createElement('p', blank, 'wiki-empty'));
        return fragment;
    }
    const categories = new Map();
    entries.forEach(item => {
        const label = item.category || 'Otras investigaciones';
        if (!categories.has(label)) categories.set(label, []);
        categories.get(label).push(item);
    });
    const categoryLabels = {
        civil: 'Tecnologías civiles',
        infanteria: 'Tecnologías de infantería',
        naval: 'Tecnologías navales',
        blindados: 'Tecnologías blindadas',
        aerea: 'Tecnologías aéreas'
    };
    const categoryList = createElement('div', undefined, 'wiki-research-categories');
    categories.forEach((research, category) => {
        const details = createElement('details', undefined, 'wiki-research-category');
        const summary = createElement('summary');
        summary.append(createElement('strong', categoryLabels[category] || category));
        summary.append(createElement('span', `${research.length} investigaciones`, 'wiki-research-count'));
        details.append(summary);

        const list = createElement('ul', undefined, 'wiki-name-list');
        research.forEach(item => {
            const row = createElement('li', undefined, 'wiki-research-item');
            row.append(createElement('span', getResearchName(item), 'wiki-research-name'));
            row.append(createElement(
                'span',
                researchStatusLabels[item.status] || item.status || 'Sin estado',
                `wiki-research-status wiki-research-status-${item.status || 'unknown'}`
            ));
            list.append(row);
        });
        details.append(list);
        categoryList.append(details);
    });
    fragment.append(categoryList);
    return fragment;
}

function renderLiveResearch(article, country) {
    if (!liveResearchLoaded) return;
    const items = getLiveCountryResearch(country);
    const section = createElement('section', undefined, 'wiki-publication-section wiki-research-section');
    section.append(createElement('h3', 'Investigaciones en curso e investigadas'));
    section.append(appendLiveResearchItems(
        items,
        'No hay investigaciones en proceso ni investigadas para este país.'
    ));
    article.append(section);
}

function readEconomy(form) {
    return Object.fromEntries(economyFields.map(([key]) => {
        const input = form.elements.namedItem(key);
        const value = input?.dataset.edited === 'true'
            ? input.value
            : input?.dataset.originalValue ?? input?.value ?? '';
        return [key, String(value).trim()];
    }));
}

function renderEconomyFields(form, economy = {}) {
    const section = createElement('details');
    section.className = 'research-branch';
    section.append(createElement('summary', 'Datos económicos'));
    const fields = createElement('div');
    fields.className = 'formulario';
    economyFields.forEach(([key, label, type]) => {
        const wrapper = createElement('div');
        wrapper.className = 'campo';
        const inputId = `economia-${key}-${form.id}`;
        const labelElement = createElement('label', label);
        labelElement.htmlFor = inputId;
        const input = type === 'sector' ? document.createElement('select') : document.createElement('input');
        input.id = inputId;
        input.name = key;
        if (type === 'sector') {
            sectorOptions.forEach(([value, text]) => input.add(new Option(text, value)));
            if (economy?.[key] && !sectorOptions.some(([value]) => value === economy[key])) {
                input.add(new Option(economy[key], economy[key]));
            }
            input.value = economy?.[key] || '';
        } else {
            input.type = 'number';
            input.min = '0';
            input.step = 'any';
            if (key === 'military_spending') input.max = '100';
            const originalValue = economy?.[key] ?? '';
            input.dataset.originalValue = String(originalValue);
            input.value = String(originalValue);
            if (!input.value && String(originalValue).trim()) {
                input.addEventListener('focus', () => {
                    input.dataset.edited = 'true';
                }, { once: true });
            }
        }
        input.addEventListener('input', () => {
            input.dataset.edited = 'true';
        });
        input.addEventListener('change', () => {
            input.dataset.edited = 'true';
        });
        wrapper.append(labelElement, input);
        fields.append(wrapper);
    });
    section.append(fields);
    form.append(section);
}

function filterCountries() {
    const query = normalizeText(searchInput.value.trim());
    document.querySelectorAll('[data-search-text]').forEach(element => {
        const matches = element.dataset.searchText.includes(query);
        element.hidden = !matches;
        element.style.display = matches ? '' : 'none';
    });
}

function createEditForm(post, article) {
    const form = createElement('form');
    form.id = `formulario-edicion-${post.id}`;
    form.className = 'plantilla-contenido';
    form.hidden = true;

    const contentField = createElement('div');
    contentField.className = 'campo';
    const contentId = `contenido-edicion-${post.id}`;
    const label = createElement('label', 'Publicación');
    label.htmlFor = contentId;
    const textarea = document.createElement('textarea');
    textarea.id = contentId;
    textarea.name = 'content';
    textarea.rows = 8;
    textarea.maxLength = 10000;
    textarea.required = true;
    textarea.value = post.content;
    contentField.append(label, textarea);
    form.append(contentField);
    renderEconomyFields(form, post.economy);

    const actions = createElement('div');
    actions.className = 'acciones';
    const saveButton = createElement('button', 'Guardar cambios');
    saveButton.className = 'btn btn-primary';
    saveButton.type = 'submit';
    const cancelButton = createElement('button', 'Cancelar');
    cancelButton.className = 'btn btn-secondary';
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', () => {
        form.hidden = true;
        article.querySelector('[data-action="edit"]').hidden = false;
    });
    actions.append(saveButton, cancelButton);
    const feedback = createElement('p');
    feedback.className = 'comprobante-modulos';
    feedback.setAttribute('role', 'status');
    form.append(actions, feedback);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        saveButton.disabled = true;
        showStatus(feedback, 'Guardando cambios...');
        let changesSaved = false;
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('country_wiki_posts')
                .update({
                    content: textarea.value.trim(),
                    economy: readEconomy(form)
                })
                .eq('id', post.id)
                .select('id, country, content, economy, weapons, approved_modules, investigations, created_at')
                .maybeSingle();
            if (error) throw error;
            if (!data) throw new Error('No se encontró la publicación para confirmar los cambios.');
            changesSaved = true;
            communityPosts = communityPosts.map(item => item.id === data.id ? data : item);
            renderCommunityPosts();
            filterCountries();
            showStatus(publicationStatus, `Se actualizaron los datos de ${post.country}.`);
        } catch (error) {
            const message = changesSaved
                ? `Los cambios se guardaron, pero no se pudo actualizar la lista: ${error.message}`
                : `No se pudieron guardar los cambios: ${error.message}`;
            showStatus(changesSaved ? publicationStatus : feedback, message, true);
        } finally {
            saveButton.disabled = false;
        }
    });
    return form;
}

function renderCommunityPost(post) {
    const article = createElement('details', undefined, 'research-publication');
    article.id = `publicacion-pais-${post.id}`;
    article.dataset.searchText = getPostSearchText(post);

    const date = new Date(post.created_at).toLocaleString('es', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
    const summary = createElement('summary');
    summary.append(createElement('strong', post.country));
    summary.append(document.createTextNode(` · Publicación comunitaria · ${date}`));
    article.append(summary);

    const content = createElement('div', undefined, 'research-publication-content');
    const narrativeSection = createElement('section', undefined, 'wiki-publication-section wiki-narrative-section');
    narrativeSection.append(createElement('h3', 'Descripción'));
    const narrative = createElement('p', post.content, 'wiki-narrative');
    narrative.style.whiteSpace = 'pre-wrap';
    narrativeSection.append(narrative);
    content.append(narrativeSection);
    renderEconomy(content, post.economy);

    const countryKey = normalizeText(post.country);
    const storedModules = Array.isArray(post.approved_modules) ? post.approved_modules : [];
    const modules = approvedModulesLoaded
        ? approvedModulesByCountry.get(countryKey) || []
        : storedModules;
    const templateNames = approvedTemplatesLoaded
        ? (approvedTemplatesByCountry.get(countryKey) || []).map(template => template.name)
        : (Array.isArray(post.weapons) ? post.weapons : []);
    const catalog = createElement('div', undefined, 'wiki-catalog-grid');
    renderSnapshotList(catalog, 'Armamento aprobado', templateNames, item => item);
    renderSnapshotList(catalog, 'Módulos aprobados', modules, getModuleName);
    content.append(catalog);
    renderLiveResearch(content, post.country);

    const editButton = createElement('button', 'Editar información');
    editButton.className = 'btn btn-secondary';
    editButton.type = 'button';
    editButton.dataset.action = 'edit';
    const form = createEditForm(post, article);
    editButton.addEventListener('click', () => {
        editButton.hidden = true;
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    content.append(editButton, form);
    article.append(content);
    countryArticles.append(article);
}

function updateWikiStatus() {
    const armamentCount = [...approvedTemplatesByCountry.values()]
        .reduce((total, templates) => total + templates.length, 0);
    const moduleCount = [...approvedModulesByCountry.values()]
        .reduce((total, modules) => total + modules.length, 0);
    statusMessage.textContent = `${communityPosts.length} publicaciones cargadas. ${armamentCount} plantillas aprobadas y ${moduleCount} módulos aprobados indexados.`;
}

async function getSupabaseClient() {
    const { supabase } = await import('./supabase.js');
    return supabase;
}

async function loadLiveResearch() {
    const supabase = await getSupabaseClient();
    const countriesResult = await supabase
        .from('investigation_countries')
        .select('id, country');
    if (countriesResult.error) throw countriesResult.error;

    const countries = countriesResult.data || [];
    liveResearchByCountry.clear();
    liveResearchLoaded = true;
    if (!countries.length) return;

    const statesResult = await supabase
        .from('investigation_country_states')
        .select('country_id, node_id, category, status')
        .in('status', ['completed', 'in_progress'])
        .in('country_id', countries.map(country => country.id));
    if (statesResult.error) throw statesResult.error;

    const countryById = new Map(countries.map(country => [country.id, country]));
    (statesResult.data || []).forEach(state => {
        const country = countryById.get(state.country_id);
        if (!country) return;
        const countryKey = normalizeText(country.country.trim());
        const items = liveResearchByCountry.get(countryKey) || [];
        items.push({
            node_id: state.node_id,
            category: state.category,
            status: state.status,
            name: researchNames.get(state.node_id) || state.node_id
        });
        liveResearchByCountry.set(countryKey, items);
    });
}

async function loadCommunityPosts() {
    const supabase = await getSupabaseClient();
    const [postsResult, modulesResult, templatesResult] = await Promise.all([
        supabase
            .from('country_wiki_posts')
            .select('id, country, content, economy, weapons, approved_modules, investigations, created_at')
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('custom_modules')
            .select('country, module_type, content')
            .eq('status', 'approved')
            .eq('is_current', true),
        supabase
            .from('templates')
            .select('country, file_name, content')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
    ]);
    if (postsResult.error) throw postsResult.error;

    communityPosts = postsResult.data;
    approvedModulesByCountry.clear();
    approvedModulesLoaded = !modulesResult.error;
    if (approvedModulesLoaded) {
        (modulesResult.data || []).forEach(module => {
            const countryKey = normalizeText(module.country.trim());
            if (!approvedModulesByCountry.has(countryKey)) approvedModulesByCountry.set(countryKey, []);
            approvedModulesByCountry.get(countryKey).push(module);
        });
    }
    approvedTemplatesByCountry.clear();
    approvedTemplatesLoaded = !templatesResult.error;
    if (approvedTemplatesLoaded) {
        (templatesResult.data || []).forEach(template => {
            const countryKey = normalizeText(template.country.trim());
            const names = approvedTemplatesByCountry.get(countryKey) || [];
            const name = getTemplateName(template);
            if (name && !names.some(item => item.name === name)) {
                names.push({ name, country: template.country });
            }
            approvedTemplatesByCountry.set(countryKey, names);
        });
    }
    renderCommunityPosts();
    filterCountries();
    const catalogErrors = [
        modulesResult.error && `módulos aprobados: ${modulesResult.error.message}`,
        templatesResult.error && `plantillas aprobadas: ${templatesResult.error.message}`
    ].filter(Boolean);
    if (catalogErrors.length) {
        showStatus(statusMessage, `${communityPosts.length} publicaciones cargadas. No se pudieron cargar ${catalogErrors.join('; ')}.`, true);
        return;
    }
    updateWikiStatus();
}

function renderCommunityPosts() {
    countryArticles.replaceChildren();
    communityPosts.forEach(renderCommunityPost);
    const publishedCountries = new Set(communityPosts.map(post => normalizeText(post.country)));
    const catalogCountries = new Set([
        ...(approvedModulesLoaded ? approvedModulesByCountry.keys() : []),
        ...(approvedTemplatesLoaded ? approvedTemplatesByCountry.keys() : [])
    ]);
    catalogCountries.forEach(countryKey => {
        if (publishedCountries.has(countryKey)) return;
        const modules = approvedModulesByCountry.get(countryKey) || [];
        const templates = approvedTemplatesByCountry.get(countryKey) || [];
        const country = modules[0]?.country || templates[0]?.country || countryKey;
        renderApprovedCatalogCountry(country, templates.map(template => template.name), modules);
    });
}

function renderApprovedCatalogCountry(country, templateNames, modules) {
    const article = createElement('details', undefined, 'research-publication');
    article.dataset.searchText = normalizeText(`${country} ${templateNames.join(' ')} ${modules.map(getModuleName).join(' ')}`);

    const summary = createElement('summary');
    summary.append(createElement('strong', country));
    summary.append(document.createTextNode(' · Catálogo aprobado'));
    article.append(summary);

    const content = createElement('div', undefined, 'research-publication-content');
    const catalog = createElement('div', undefined, 'wiki-catalog-grid');
    renderSnapshotList(catalog, 'Armamento aprobado', templateNames, item => item);
    renderSnapshotList(catalog, 'Módulos aprobados', modules, getModuleName);
    content.append(catalog);
    renderLiveResearch(content, country);

    const createButton = createElement('button', 'Crear publicación');
    createButton.type = 'button';
    createButton.className = 'btn btn-primary';
    const form = createCountryPublicationForm(country);
    createButton.addEventListener('click', () => {
        createButton.hidden = true;
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    content.append(createButton, form);
    article.append(content);
    countryArticles.append(article);
}

function createCountryPublicationForm(country) {
    const countryKey = normalizeText(country);
    const form = createElement('form');
    form.id = `formulario-nueva-publicacion-${countryKey.replace(/[^a-z0-9]+/g, '-')}`;
    form.className = 'plantilla-contenido wiki-create-publication-form';
    form.hidden = true;

    const field = createElement('div');
    field.className = 'campo';
    const contentId = `${form.id}-contenido`;
    const label = createElement('label', 'Publicación');
    label.htmlFor = contentId;
    const textarea = document.createElement('textarea');
    textarea.id = contentId;
    textarea.name = 'content';
    textarea.rows = 8;
    textarea.maxLength = 10000;
    textarea.required = true;
    textarea.placeholder = `Escribe la historia y descripción de ${country}...`;
    field.append(label, textarea);
    form.append(field);
    renderEconomyFields(form);

    const actions = createElement('div', undefined, 'acciones');
    const saveButton = createElement('button', 'Guardar publicación');
    saveButton.type = 'submit';
    saveButton.className = 'btn btn-primary';
    const cancelButton = createElement('button', 'Cancelar');
    cancelButton.type = 'button';
    cancelButton.className = 'btn btn-secondary';
    const feedback = createElement('p', undefined, 'comprobante-modulos');
    feedback.setAttribute('role', 'status');
    actions.append(saveButton, cancelButton);
    form.append(actions, feedback);

    cancelButton.addEventListener('click', () => {
        form.hidden = true;
        form.parentElement.querySelector('button').hidden = false;
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        saveButton.disabled = true;
        showStatus(feedback, 'Guardando publicación...');
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('country_wiki_posts')
                .insert({
                    country,
                    content: textarea.value.trim(),
                    economy: readEconomy(form),
                    weapons: [],
                    approved_modules: [],
                    investigations: []
                })
                .select('id, country, content, economy, weapons, approved_modules, investigations, created_at')
                .single();
            if (error) throw error;

            communityPosts.unshift(data);
            renderCommunityPosts();
            filterCountries();
            updateWikiStatus();
            showStatus(publicationStatus, `Se creó la publicación de ${country}. Ya puedes editarla desde su tarjeta.`);
        } catch (error) {
            showStatus(feedback, `No se pudo crear la publicación: ${error.message}`, true);
        } finally {
            saveButton.disabled = false;
        }
    });
    return form;
}

function escapeIlike(value) {
    return value.replace(/[\\%_]/g, character => `\\${character}`);
}

function getModuleName(module) {
    return module.content?.nombre
        || module.content?.Nombre
        || module.content?.nombre_del_arma
        || module.content?.name
        || module.content?.seccion_1_informacion_general?.nombre_del_arma
        || 'Módulo sin nombre';
}

function getTemplateName(template) {
    const content = template.content;
    return content?.titulo
        || content?.ficha_unidad?.informacion_general?.nombre_unidad
        || content?.informacion_general?.nombre
        || content?.informacion_general?.nombre_unidad
        || content?.[0]?.Nombre
        || template.file_name.replace(/\.json$/i, '');
}

function getResearchName(item) {
    return item?.name || researchNames.get(item?.node_id) || item?.node_id || 'Investigación sin nombre';
}

function getPostSearchText(post) {
    const research = Array.isArray(post.investigations)
        ? post.investigations.map(item => [
            getResearchName(item),
            item.category,
            item.status
        ].filter(Boolean).join(' '))
        : [];
    const countryKey = normalizeText(post.country);
    const modules = (approvedModulesByCountry.get(countryKey) || []).map(getModuleName);
    const templates = (approvedTemplatesByCountry.get(countryKey) || [])
        .map(template => template.name);
    return normalizeText([
        post.country,
        post.content,
        JSON.stringify(post.economy || {}),
        ...modules,
        ...templates,
        ...research
    ].join(' '));
}

async function collectCountryData(country, supabase) {
    const pattern = escapeIlike(country);
    const [modulesResult, templatesResult, countriesResult] = await Promise.all([
        supabase
            .from('custom_modules')
            .select('vehicle, module_type, country, content, price')
            .eq('status', 'approved')
            .eq('is_current', true)
            .ilike('country', pattern),
        supabase
            .from('templates')
            .select('country, file_name, content')
            .eq('status', 'approved')
            .ilike('country', pattern),
        supabase
            .from('investigation_countries')
            .select('id')
            .ilike('country', pattern)
            .limit(2)
    ]);
    if (modulesResult.error) throw modulesResult.error;
    if (templatesResult.error) throw templatesResult.error;
    if (countriesResult.error) throw countriesResult.error;

    let investigations = [];
    if (countriesResult.data.length) {
        const statesResult = await supabase
            .from('investigation_country_states')
            .select('node_id, category, status, updated_at')
            .in('country_id', countriesResult.data.map(item => item.id));
        if (statesResult.error) throw statesResult.error;
        investigations = statesResult.data.map(item => ({
            ...item,
            name: researchNames.get(item.node_id) || item.node_id
        }));
    }

    const modules = modulesResult.data || [];
    return {
        weapons: (templatesResult.data || []).map(getTemplateName),
        approved_modules: modules.map(module => ({
            ...module,
            content: { nombre: getModuleName(module) }
        })),
        investigations
    };
}

async function loadResearchNames() {
    const response = await fetch('../data/investigacion/tree.json');
    if (!response.ok) throw new Error(`No se pudo cargar tree.json (HTTP ${response.status}).`);
    const treeData = await response.json();
    const trees = treeData?.arboles_tecnologicos_CM;
    if (!trees || typeof trees !== 'object') {
        throw new Error('tree.json no contiene arboles_tecnologicos_CM.');
    }
    const escapePathPart = value => value.replaceAll('~', '~0').replaceAll('/', '~1');

    Object.entries(trees).forEach(([treeKey, branch]) => {
        function visit(value, path = []) {
            if (Array.isArray(value)) {
                value.forEach((item, index) => visit(item, [...path, String(index)]));
                return;
            }
            if (!value || typeof value !== 'object') return;
            if (typeof value.nombre === 'string') {
                researchNames.set([treeKey, ...path].map(escapePathPart).join('/'), value.nombre);
            }
            Object.entries(value).forEach(([key, child]) => visit(child, [...path, key]));
        }
        visit(branch);
    });
}

publicationForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!publicationForm.reportValidity()) return;

    const country = document.getElementById('nombre-pais-publicacion').value.trim();
    const content = document.getElementById('contenido-publicacion-pais').value.trim();
    if (!country || country.length > 100 || !content) {
        showStatus(publicationStatus, 'Escribe el nombre del país y el contenido de la publicación.', true);
        return;
    }

    const button = document.getElementById('publicar-pais');
    button.disabled = true;
    showStatus(publicationStatus, 'Recopilando información aprobada del país y publicando…');
    try {
        const supabase = await getSupabaseClient();
        const snapshot = await collectCountryData(country, supabase);
        const economy = readEconomy(publicationForm);
        const { data, error } = await supabase
            .from('country_wiki_posts')
            .insert({ country, content, economy, ...snapshot })
            .select('id, country, content, economy, weapons, approved_modules, investigations, created_at')
            .single();
        if (error) throw error;

        approvedModulesByCountry.set(normalizeText(country), [
            ...snapshot.approved_modules
        ]);
        approvedTemplatesByCountry.set(normalizeText(country), snapshot.weapons.map(name => ({ name, country })));
        communityPosts.unshift(data);
        publicationForm.reset();
        renderCommunityPosts();
        filterCountries();
        updateWikiStatus();
        showStatus(publicationStatus, `Publicación de ${country} guardada con ${snapshot.weapons.length} armas, ${snapshot.approved_modules.length} módulos aprobados y ${snapshot.investigations.length} investigaciones.`);
    } catch (error) {
        showStatus(publicationStatus, `No se pudo guardar la publicación: ${error.message}`, true);
    } finally {
        button.disabled = false;
    }
});

searchInput.addEventListener('input', filterCountries);

loadResearchNames().catch(error => {
    console.error('No se pudieron cargar los nombres de investigaciones:', error);
    return error;
}).then(researchError => {
    const liveResearch = loadLiveResearch().catch(error => {
        console.error('No se pudieron cargar las investigaciones en vivo:', error);
        liveResearchLoaded = false;
        liveResearchByCountry.clear();
        return `investigaciones en vivo: ${error.message}`;
    });
    return liveResearch
        .then(liveError => loadCommunityPosts().then(() => ({ researchError, liveError })));
}).then(({ researchError, liveError }) => {
    const warnings = [
        researchError && `los nombres de investigación (${researchError.message})`,
        liveError
    ].filter(Boolean);
    if (warnings.length) {
        showStatus(statusMessage, `Publicaciones cargadas. No se pudieron mostrar ${warnings.join(' ni ')}.`, true);
    }
}).catch(error => {
    showStatus(statusMessage, `No se pudieron cargar las publicaciones: ${error.message}`, true);
    console.error('Error al cargar las publicaciones de la wiki:', error);
});
