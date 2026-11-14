const UPDATE_CONTEXT_KEY = 'plantilla-comunitaria-actualizacion';
const requestedTemplateId = new URLSearchParams(window.location.search).get('actualizar');
let updateContext = null;
let updateContextInvalid = false;

if (requestedTemplateId) {
    try {
        const storedContext = sessionStorage.getItem(UPDATE_CONTEXT_KEY);
        const parsedContext = storedContext ? JSON.parse(storedContext) : null;
        if (parsedContext?.id === requestedTemplateId
            && parsedContext.content
            && typeof parsedContext.content === 'object'
            && !Array.isArray(parsedContext.content)) {
            updateContext = parsedContext;
        } else {
            throw new Error('No se encontró la plantilla que se quiere actualizar. Vuelve a Plantillas y pulsa «Actualizar» otra vez.');
        }
    } catch (error) {
        updateContextInvalid = true;
        window.addEventListener('DOMContentLoaded', () => {
            const status = document.getElementById('estado-publicacion') || document.getElementById('aviso-guardado');
            if (!status) return;
            status.textContent = error.message;
            status.hidden = false;
            status.style.display = 'flex';
            status.setAttribute('role', 'alert');
        });
    }
}

window.contextoActualizacionPlantilla = updateContext;
window.actualizacionPlantillaInvalida = updateContextInvalid;
window.prepararActualizacionPlantilla = function (content) {
    if (!updateContext || !content || typeof content !== 'object' || Array.isArray(content)) return content;

    const changes = document.getElementById('cambios-actualizacion')?.value.trim() || '';
    const originalTitle = updateContext.originalTitle || 'Plantilla';
    const currentTitle = content.titulo
        || content.ficha_unidad?.informacion_general?.nombre_unidad
        || content.informacion_general?.nombre
        || originalTitle;
    const suffix = ' · Actualización';
    const title = currentTitle.endsWith(suffix) ? currentTitle : `${currentTitle}${suffix}`;
    content.titulo = title;
    if (content.informacion_general) content.informacion_general.nombre = title;
    if (content.ficha_unidad?.informacion_general) {
        content.ficha_unidad.informacion_general.nombre_unidad = title;
    }
    content.actualizacion = {
        plantilla_original_id: updateContext.id,
        nombre_original: originalTitle,
        cambios: changes
    };
    const description = String(content.descripcion || '').trim();
    content.descripcion = [description, `Cambios realizados: ${changes}`].filter(Boolean).join('\n\n');
    return content;
};

window.finalizarActualizacionPlantilla = function () {
    if (!updateContext) return;
    sessionStorage.removeItem(UPDATE_CONTEXT_KEY);
    updateContext = null;
    window.contextoActualizacionPlantilla = null;
};

window.addEventListener('DOMContentLoaded', () => {
    const section = document.getElementById('seccion-actualizacion');
    const changesInput = document.getElementById('cambios-actualizacion');
    if (!section || !changesInput) return;
    section.hidden = !updateContext;
    changesInput.required = Boolean(updateContext);
});
