import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('aviso-modulos-aprobados');

    async function loadApprovedModules() {
        const { data, error } = await supabase
            .from('custom_modules')
            .select('id, module_type, country, content, price')
            .eq('vehicle', 'naval')
            .eq('status', 'approved')
            .eq('is_current', true);
        if (error) throw error;
        window.aplicarModulosAprobadosNavales(data || []);
        status.textContent = data?.length
            ? `Se cargaron ${data.length} módulo(s) aprobado(s) de todos los países.`
            : 'No hay módulos aprobados disponibles.';
        status.hidden = false;
    }

    loadApprovedModules().catch(error => {
        status.textContent = `No se pudieron cargar módulos aprobados: ${error.message}`;
        status.hidden = false;
        status.setAttribute('role', 'alert');
    });
});
