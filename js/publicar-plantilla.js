window.publicarPlantilla = async function ({ country, filePrefix, content, button, status }) {
    const pais = country.trim();
    if (!pais || pais.length > 100) {
        status.textContent = 'Indica el país (máximo 100 caracteres) para publicar la ficha.';
        status.hidden = false;
        status.style.display = 'flex';
        status.setAttribute('role', 'alert');
        return;
    }

    const titulo = content.titulo
        || content.ficha_unidad?.informacion_general?.nombre_unidad
        || 'ficha';
    const nombreSeguro = titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 120);
    const fileName = `${filePrefix}-${nombreSeguro || 'sin-nombre'}.json`;

    button.disabled = true;
    status.textContent = 'Publicando ficha...';
    status.hidden = false;
    status.style.display = 'flex';
    status.setAttribute('role', 'status');

    try {
        const { supabase } = await import('./supabase.js');
        const { error } = await supabase.from('templates').insert({
            country: pais,
            file_name: fileName,
            content
        });

        if (error) {
            status.textContent = `No se pudo publicar la ficha: ${error.message}`;
            status.setAttribute('role', 'alert');
            return;
        }

        status.textContent = 'Ficha publicada y enviada a revisión. Ya aparece en Plantillas comunitarias como pendiente.';
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.textContent = `No se pudo publicar la ficha: ${message}`;
        status.setAttribute('role', 'alert');
    } finally {
        button.disabled = false;
    }
};
