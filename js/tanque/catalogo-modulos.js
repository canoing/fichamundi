import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('aviso-modulos-aprobados');

    async function loadApprovedModules() {
        const { data, error } = await supabase
            .from('custom_modules')
            .select('id, module_type, country, content, price')
            .eq('vehicle', 'tank')
            .eq('status', 'approved')
            .eq('is_current', true);
        if (error) throw error;
        window.aplicarModulosPersonalizadosTanque(data || []);
        status.textContent = data?.length
            ? `Se cargaron ${data.length} módulo(s) aprobado(s) de todos los países.`
            : 'No hay módulos aprobados disponibles.';
        status.hidden = false;
    }

    loadApprovedModules().catch(error => {
        status.textContent = `No se pudieron cargar los módulos aprobados: ${error.message}`;
        status.hidden = false;
        status.setAttribute('role', 'alert');
    });
});
