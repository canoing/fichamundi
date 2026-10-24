import { supabase } from './supabase.js';

const countryFilter = document.getElementById('filtro-pais');
const statusFilter = document.getElementById('filtro-estado');
const templateList = document.getElementById('lista-plantillas');
const listStatus = document.getElementById('estado-lista');
const accessForm = document.getElementById('formulario-acceso');
const accessSection = document.getElementById('acceso-moderacion');
const accessToggle = document.getElementById('mostrar-acceso');
const moderatorStatus = document.getElementById('estado-moderador');
const moderatorPanel = document.getElementById('panel-moderacion');

let templates = [];
let commentsByTemplate = new Map();
let moderatorKey = '';

function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.hidden = !message;
    element.style.display = message ? 'flex' : 'none';
    element.setAttribute('role', isError ? 'alert' : 'status');
}

function createElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (text !== undefined) element.textContent = String(text);
    if (className) element.className = className;
    return element;
}

function formatDate(value) {
    return new Date(value).toLocaleString('es', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function setAccessOpen(isOpen) {
    accessSection.hidden = !isOpen;
    accessToggle.setAttribute('aria-expanded', String(isOpen));
}

function displayValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') return '';
    if (typeof value === 'number') return Number(value.toFixed(2)).toString();
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
        return Number(Number(value).toFixed(2)).toString();
    }
    return String(value);
}

function humanizeKey(key) {
    const labels = {
        hp: 'HP',
        atk: 'ATK',
        ataque: 'Ataque',
        defensa: 'Defensa',
        def: 'DEF',
        mov: 'MOV',
        sup: 'SUP',
        coste: 'Coste',
        costo: 'Coste',
        coste_de_produccion: 'Coste de producción',
        defensa_pl_total: 'Defensa (P/L)',
        capacidad_peso_total: 'Capacidad de peso',
        capacidad_piezas_total: 'Capacidad de piezas',
        piezas_colocadas: 'Piezas',
        modulos_colocados: 'Módulos',
        valido: 'Diseño válido',
        valido_por_piezas: 'Capacidad válida',
        peso_total: 'Peso',
        maniobrabilidad: 'Maniobrabilidad',
        nivel_tech_tree: 'Nivel tecnológico',
        hp_a_regimiento: 'HP aportado'
    };
    const normalized = key.toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return labels[normalized] || normalized.replace(/_/g, ' ').replace(/^./, character => character.toLocaleUpperCase('es'));
}

function createStatsGrid(stats, limit = 8) {
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
    const entries = Object.entries(stats)
        .filter(([key]) => !['nombre', 'name', 'nombre_del_arma', 'id', 'id_arma'].includes(key.toLocaleLowerCase('es')))
        .map(([key, value]) => [key, displayValue(value)])
        .filter(([, value]) => value !== '')
        .slice(0, limit);
    if (!entries.length) return null;

    const grid = createElement('div', undefined, 'stats-grid');
    entries.forEach(([key, value]) => {
        const box = createElement('div', undefined, 'stat-box');
        box.append(createElement('label', humanizeKey(key)));
        box.append(createElement('span', value, 'stat-value'));
        grid.append(box);
    });
    return grid;
}

function calculateNavalDefenseTotal(selected) {
    let defenseP = 0;
    let defenseL = 0;

    ['propulsion', 'armamento', 'blindaje'].forEach(category => {
        if (!Array.isArray(selected?.[category])) return;
        selected[category].forEach(module => {
            if (typeof module?.defensa_p_l !== 'string') return;
            const quantity = Number(module.cantidad ?? 1);
            if (!Number.isFinite(quantity) || quantity <= 0) return;

            const matchP = module.defensa_p_l.match(/(\d+)\s*\(?P\)?/i);
            const matchL = module.defensa_p_l.match(/(\d+)\s*\(?L\)?/i);
            defenseP += (matchP ? Number(matchP[1]) : 0) * quantity;
            defenseL += (matchL ? Number(matchL[1]) : 0) * quantity;
        });
    });

    return defenseP || defenseL ? `${defenseP}(P) ${defenseL}(L)` : null;
}

function createModuleList(groups) {
    const entries = [];
    groups.forEach(([key, label, isSingle]) => {
        const modules = isSingle ? [key] : key;
        if (isSingle) {
            const module = key;
            if (module && typeof module === 'object') {
                entries.push({ module, label });
            }
            return;
        }
        if (!Array.isArray(modules)) return;
        modules.forEach(module => {
            if (!module || typeof module !== 'object' || Number(module.cantidad ?? 1) <= 0) return;
            entries.push({ module, label });
        });
    });

    if (!entries.length) return null;
    const list = createElement('ul');
    entries.forEach(({ module, label }) => {
        const item = createElement('li', undefined, 'modulo-item-compacto');
        const name = module.nombre || module.Nombre || module.nombre_del_arma || label;
        const quantity = Number(module.cantidad);
        const prefix = quantity > 0 ? `x${quantity} ` : '';
        item.append(createElement('span', `${prefix}${name}`));
        const defense = module.defensa_p_l !== undefined
            ? `Defensa (P/L): ${module.defensa_p_l}`
            : module.defensa !== undefined
                ? `Defensa: ${module.defensa}`
                : '';
        item.append(createElement('small', [label, defense].filter(Boolean).join(' · ')));
        list.append(item);
    });
    return list;
}

function createDivisionLists(unidad) {
    const sections = [];
    const lists = [
        ['regimientos_principales', 'Regimientos principales'],
        ['batallones_apoyo', 'Batallones de apoyo']
    ];
    lists.forEach(([key, title]) => {
        const entries = unidad[key];
        if (!Array.isArray(entries) || !entries.length) return;
        const section = createElement('section', undefined, 'seccion');
        section.append(createElement('h4', title));
        const list = createElement('ul');
        entries.forEach((entry, index) => {
            const item = createElement('li', undefined, 'modulo-item-compacto');
            const name = entry.tipo_regimiento || entry.tipo_apoyo || `${title.slice(0, -1)} ${index + 1}`;
            item.append(createElement('span', name));
            const details = [];
            if (entry.slot !== undefined) details.push(`Slot ${entry.slot}`);
            const weapon = entry.arma_equipada;
            if (weapon) {
                details.push(`${weapon.nombre || weapon.nombre_del_arma || 'Arma'} · ATK ${weapon.ataque ?? 0}`);
            }
            if (entry.hp_bonus_tecnologico !== undefined) details.push(`HP tecnológico ${entry.hp_bonus_tecnologico}`);
            item.append(createElement('small', details.join(' · ')));
            list.append(item);
        });
        section.append(list);
        sections.push(section);
    });
    return sections;
}

function createTemplatePreview(content) {
    const preview = createElement('div', undefined, 'ficha-compacta active');
    const info = content?.informacion_general || {};
    const division = content?.ficha_unidad;
    const stats = division ? content.estadisticas_acumuladas : content?.estadisticas;
    const selected = content?.componentes_seleccionados || content?.modulos_seleccionados;
    const heading = division
        ? info.nombre_unidad || content.titulo
        : info.nombre || content?.titulo || (Array.isArray(content) ? content[0]?.Nombre : '');
    const type = division
        ? info.tipo_unidad
        : info.tipo || content?.tipo || content?.tipo_ficha;

    if (heading) preview.append(createElement('h3', heading));
    const metadata = [type, info.anio || info.fecha || content?.fecha].filter(Boolean).join(' · ');
    if (metadata) preview.append(createElement('p', metadata, 'inicio-descripcion'));

    let previewStats = stats && typeof stats === 'object' && !Array.isArray(stats) ? { ...stats } : stats;
    if (!division && selected && (!previewStats || typeof previewStats !== 'object' || Array.isArray(previewStats))) {
        previewStats = {};
    }
    if (previewStats && selected && !previewStats.defensa_pl_total) {
        previewStats.defensa_pl_total = calculateNavalDefenseTotal(selected);
    }
    const statsGrid = createStatsGrid(previewStats || (Array.isArray(content) ? content[0] : null));
    if (statsGrid) preview.append(statsGrid);

    if (division) {
        createDivisionLists(division).forEach(section => preview.append(section));
        const abilities = stats?.habilidades_especiales;
        if (Array.isArray(abilities) && abilities.length) {
            const section = createElement('section', undefined, 'seccion');
            section.append(createElement('h4', 'Habilidades especiales'));
            const list = createElement('ul');
            abilities.forEach(ability => list.append(createElement('li', ability)));
            section.append(list);
            preview.append(section);
        }
    } else {
        if (selected && typeof selected === 'object') {
            const groups = [];
            const categoryLabels = {
                fuselaje: 'Fuselaje',
                casco: 'Casco',
                chasis: 'Chasis',
                motores: 'Motores',
                propulsion: 'Propulsión',
                motor: 'Motor',
                armamento: 'Armamento',
                bombas: 'Bombas',
                torpedos: 'Torpedos',
                alas: 'Alas',
                traccion: 'Tracción',
                comunicacion: 'Comunicación',
                blindaje: 'Blindaje'
            };
            Object.entries(selected).forEach(([key, value]) => {
                const label = categoryLabels[key] || humanizeKey(key);
                if (Array.isArray(value)) groups.push([value, label, false]);
                else if (value && typeof value === 'object') groups.push([value, label, true]);
            });
            const moduleList = createModuleList(groups);
            if (moduleList) {
                const section = createElement('section', undefined, 'seccion');
                section.append(createElement('h4', 'Componentes instalados'));
                section.append(moduleList);
                preview.append(section);
            }
        }

        if (Array.isArray(content) && content.length > 1) {
            const list = createElement('ul');
            content.forEach(entry => {
                const name = entry?.Nombre || entry?.nombre || entry?.nombre_del_arma;
                if (name) list.append(createElement('li', name, 'modulo-item-compacto'));
            });
            if (list.childElementCount) {
                const section = createElement('section', undefined, 'seccion');
                section.append(createElement('h4', 'Elementos'));
                section.append(list);
                preview.append(section);
            }
        }
    }

    if (content?.descripcion) {
        preview.append(createElement('p', content.descripcion, 'inicio-descripcion'));
    }

    return preview;
}

function addTemplateComments(container, templateId) {
    const comments = commentsByTemplate.get(templateId) || [];
    if (!comments.length) return;

    const details = document.createElement('details');
    details.className = 'plantilla-comentarios';
    details.append(createElement('summary', `Comentarios de moderación (${comments.length})`));
    const list = createElement('ul');
    comments.forEach(comment => {
        const item = createElement('li');
        item.append(createElement('strong', `${comment.json_path}: `));
        item.append(document.createTextNode(comment.comment));
        list.append(item);
    });
    details.append(list);
    container.append(details);
}

function createTemplateCard(template) {
    const card = createElement('details', undefined, 'opcion-modulo');
    const summary = document.createElement('summary');
    const contentTitle = template.content?.titulo
        || template.content?.ficha_unidad?.informacion_general?.nombre_unidad
        || template.content?.informacion_general?.nombre
        || template.content?.informacion_general?.nombre_unidad
        || template.content?.[0]?.Nombre
        || template.file_name;
    summary.append(createElement('strong', contentTitle));
    summary.append(document.createTextNode(` · ${template.country} · ${formatDate(template.created_at)} · `));
    const statuses = {
        pending: 'Pendiente',
        approved: 'Aprobada',
        rejected: 'Desaprobada'
    };
    summary.append(createElement('span', statuses[template.status], 'inicio-estado'));
    const templateComments = commentsByTemplate.get(template.id) || [];
    const reviewPreview = template.review_comment || templateComments[0]?.comment;
    if (reviewPreview) {
        const preview = reviewPreview.length > 120
            ? `${reviewPreview.slice(0, 117)}...`
            : reviewPreview;
        summary.append(document.createTextNode(` · Comentario: ${preview}`));
    }
    card.append(summary);

    const content = document.createElement('div');
    content.className = 'plantilla-contenido';
    content.append(createTemplatePreview(template.content));
    if (template.review_comment) {
        const review = createElement('p', undefined, 'inicio-descripcion');
        review.append(createElement('strong', 'Comentario del moderador: '));
        review.append(document.createTextNode(template.review_comment));
        content.append(review);
    }

    addTemplateComments(content, template.id);

    if (template.status === 'pending' && moderatorKey) {
        content.append(createModeratorTools(template));
    }

    card.append(content);
    return card;
}

function renderTemplates() {
    const selectedCountry = countryFilter.value;
    const selectedStatus = statusFilter.value;
    const visibleTemplates = templates.filter(template =>
        (!selectedCountry || template.country === selectedCountry)
        && (!selectedStatus || template.status === selectedStatus)
    );

    templateList.replaceChildren();
    const firstPendingTemplateId = moderatorKey
        ? visibleTemplates.find(template => template.status === 'pending')?.id
        : undefined;
    visibleTemplates.forEach(template => {
        const card = createTemplateCard(template);
        card.open = Boolean(firstPendingTemplateId && template.id === firstPendingTemplateId);
        templateList.append(card);
    });
    if (!visibleTemplates.length) {
        templateList.append(createElement('p', 'No hay plantillas para los filtros seleccionados.'));
    }
}

function renderCountryOptions() {
    const selectedCountry = countryFilter.value;
    const countries = [...new Set(templates.map(template => template.country))]
        .sort((left, right) => left.localeCompare(right, 'es'));

    countryFilter.replaceChildren(new Option('Todos los países', ''));
    countries.forEach(country => countryFilter.add(new Option(country, country)));
    if (countries.includes(selectedCountry)) {
        countryFilter.value = selectedCountry;
    }
}

async function refreshTemplates() {
    showStatus(listStatus, 'Cargando plantillas...');
    const templatesResult = await supabase
        .from('templates')
        .select('id, country, file_name, content, status, created_at, review_comment')
        .order('created_at', { ascending: false })
        .limit(100);

    if (templatesResult.error) {
        showStatus(listStatus, `No se pudieron cargar las plantillas: ${templatesResult.error.message}`, true);
        return;
    }
    templates = templatesResult.data;

    const templateIds = templates.map(template => template.id);
    commentsByTemplate = new Map();
    if (templateIds.length) {
        const commentsResult = await supabase
            .from('template_comments')
            .select('template_id, json_path, comment')
            .in('template_id', templateIds)
            .order('created_at', { ascending: true });

        if (commentsResult.error) {
            showStatus(listStatus, `No se pudieron cargar los comentarios: ${commentsResult.error.message}`, true);
            return;
        }
        commentsResult.data.forEach(comment => {
            const comments = commentsByTemplate.get(comment.template_id) || [];
            comments.push(comment);
            commentsByTemplate.set(comment.template_id, comments);
        });
    }

    renderCountryOptions();
    renderTemplates();
    showStatus(listStatus, `${templates.length} plantillas cargadas.`);
}

function createModeratorTools(template) {
    const section = createElement('section');
    const reviewCommentField = createElement('div', undefined, 'campo');
    const reviewCommentLabel = createElement('label', 'Comentario (opcional)');
    const reviewCommentInput = document.createElement('textarea');
    reviewCommentInput.maxLength = 5000;
    reviewCommentLabel.append(reviewCommentInput);
    reviewCommentField.append(reviewCommentLabel);
    const actions = createElement('div', undefined, 'acciones');
    const approveButton = createElement('button', 'Aprobar');
    approveButton.type = 'button';
    approveButton.className = 'btn btn-primary';
    const rejectButton = createElement('button', 'Rechazar');
    rejectButton.type = 'button';
    rejectButton.className = 'btn btn-secondary';
    actions.append(approveButton, rejectButton);
    const feedback = createElement('p');
    feedback.setAttribute('role', 'status');
    section.append(reviewCommentField, actions, feedback);

    async function setReviewStatus(status, button) {
        const decision = status === 'approved' ? 'aprobar' : 'desaprobar';
        if (!window.confirm(`¿Estás seguro de que quieres ${decision} "${template.file_name}"?`)) {
            return;
        }

        approveButton.disabled = true;
        rejectButton.disabled = true;
        const { error } = await supabase.rpc('review_template', {
            p_template_id: template.id,
            p_status: status,
            p_review_comment: reviewCommentInput.value.trim() || null,
            p_moderator_key: moderatorKey
        });
        if (error) {
            approveButton.disabled = false;
            rejectButton.disabled = false;
            feedback.textContent = `No se pudo actualizar la plantilla: ${error.message}`;
            return;
        }
        button.disabled = true;
        feedback.textContent = status === 'approved' ? 'Plantilla aprobada.' : 'Plantilla rechazada.';
        await refreshTemplates();
    }

    approveButton.addEventListener('click', () => setReviewStatus('approved', approveButton));
    rejectButton.addEventListener('click', () => setReviewStatus('rejected', rejectButton));
    return section;
}

accessForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(accessForm);
    const submittedKey = String(formData.get('moderator_key') || '');
    if (!submittedKey) {
        showStatus(moderatorStatus, 'Escribe la clave de moderador.', true);
        return;
    }

    const submitButton = accessForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const { data, error } = await supabase.rpc('check_moderator_key', {
        p_moderator_key: submittedKey
    });
    submitButton.disabled = false;

    if (error) {
        showStatus(moderatorStatus, `No se pudo verificar el acceso: ${error.message}`, true);
        return;
    }
    if (!data) {
        moderatorKey = '';
        accessForm.reset();
        showStatus(moderatorStatus, 'Acceso denegado: la clave es incorrecta.', true);
        return;
    }

    moderatorKey = submittedKey;
    accessForm.reset();
    setAccessOpen(false);
    moderatorPanel.hidden = false;
    showStatus(moderatorStatus, 'Acceso aceptado. Acciones de revisión disponibles para plantillas pendientes.');
    renderTemplates();
});

document.getElementById('cerrar-sesion').addEventListener('click', () => {
    moderatorKey = '';
    moderatorPanel.hidden = true;
    setAccessOpen(true);
    showStatus(moderatorStatus, 'Acciones de moderación ocultas.');
    renderCountryOptions();
    renderTemplates();
});

countryFilter.addEventListener('change', renderTemplates);
statusFilter.addEventListener('change', renderTemplates);
document.getElementById('actualizar-plantillas').addEventListener('click', refreshTemplates);

accessToggle.addEventListener('click', () => {
    setAccessOpen(accessSection.hidden);
});

refreshTemplates();
