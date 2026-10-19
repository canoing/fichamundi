import { supabase } from './supabase.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const uploadForm = document.getElementById('formulario-envio');
const uploadStatus = document.getElementById('estado-envio');
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

function addTemplateComments(container, templateId) {
    const comments = commentsByTemplate.get(templateId) || [];
    if (!comments.length) return;

    const heading = createElement('h4', 'Comentarios de moderación');
    const list = createElement('ul');
    comments.forEach(comment => {
        const item = createElement('li');
        item.append(createElement('strong', `${comment.json_path}: `));
        item.append(document.createTextNode(comment.comment));
        list.append(item);
    });
    container.append(heading, list);
}

function renderJsonValue(value) {
    if (Array.isArray(value)) {
        const list = createElement('div', undefined, 'modulo-info');
        value.forEach((item, index) => {
            const entry = createElement('div', undefined, 'info-item');
            entry.append(createElement('span', `Elemento ${index + 1}: `, 'info-label'));
            entry.append(renderJsonValue(item));
            list.append(entry);
        });
        if (!value.length) list.append(createElement('span', 'Lista vacía', 'info-value'));
        return list;
    }

    if (value !== null && typeof value === 'object') {
        const fields = createElement('div', undefined, 'modulo-info');
        Object.entries(value).forEach(([key, detail]) => {
            const field = createElement('div', undefined, 'info-item');
            field.append(createElement('span', `${key}: `, 'info-label'));
            field.append(renderJsonValue(detail));
            fields.append(field);
        });
        if (!Object.keys(value).length) fields.append(createElement('span', 'Sin campos', 'info-value'));
        return fields;
    }

    const formatted = value === null
        ? 'Sin dato'
        : typeof value === 'boolean'
            ? (value ? 'Sí' : 'No')
            : String(value);
    return createElement('span', formatted, 'info-value');
}

function createTemplateCard(template) {
    const card = createElement('details', undefined, 'opcion-modulo');
    const summary = document.createElement('summary');
    summary.append(createElement('strong', template.file_name));
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
    content.append(createElement('h3', template.file_name));
    content.append(createElement('p', `País: ${template.country}`));
    content.append(createElement('p', `Enviada: ${formatDate(template.created_at)}`));
    if (template.review_comment) {
        content.append(createElement('p', `Comentario general del moderador: ${template.review_comment}`));
    }

    const jsonHeading = createElement('h4', 'Contenido de la plantilla');
    const jsonContent = renderJsonValue(template.content);
    content.append(jsonHeading, jsonContent);
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
        card.open = template.id === firstPendingTemplateId;
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

uploadForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fileInput = document.getElementById('archivo-json');
    const file = fileInput.files[0];
    const country = document.getElementById('pais-envio').value.trim();

    if (!file || !file.name.toLocaleLowerCase('es').endsWith('.json')) {
        showStatus(uploadStatus, 'Selecciona un archivo con extensión .json.', true);
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        showStatus(uploadStatus, 'El archivo supera el límite de 2 MB.', true);
        return;
    }
    if (!country || country.length > 100) {
        showStatus(uploadStatus, 'Escribe un país de hasta 100 caracteres.', true);
        return;
    }

    let content;
    try {
        content = JSON.parse(await file.text());
    } catch {
        showStatus(uploadStatus, 'El archivo no contiene JSON válido.', true);
        return;
    }
    if (content === null || typeof content !== 'object') {
        showStatus(uploadStatus, 'El JSON debe tener un objeto o una lista como contenido principal.', true);
        return;
    }

    const submitButton = uploadForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    showStatus(uploadStatus, 'Enviando plantilla...');
    const { error } = await supabase.from('templates').insert({
        country,
        file_name: file.name,
        content
    });
    submitButton.disabled = false;
    if (error) {
        showStatus(uploadStatus, `No se pudo enviar la plantilla: ${error.message}`, true);
        return;
    }

    uploadForm.reset();
    showStatus(uploadStatus, 'Plantilla enviada. Quedó pendiente de revisión por un moderador.');
    await refreshTemplates();
});

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
