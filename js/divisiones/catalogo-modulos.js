import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('aviso-modulos-aprobados');

    async function loadApprovedModules() {
        const { data, error } = await supabase
            .from('custom_modules')
            .select('id, country, content, price')
            .eq('vehicle', 'infantry')
            .eq('module_type', 'weapon')
            .eq('status', 'approved')
            .eq('is_current', true);
        if (error) throw error;
        window.establecerArmasDivisionAprobadas(data || []);
        status.textContent = data?.length
            ? `Se cargaron ${data.length} arma(s) aprobada(s) de todos los países.`
            : 'No hay armas aprobadas disponibles.';
        status.hidden = false;
    }

    loadApprovedModules().catch(error => {
        status.textContent = `No se pudieron cargar las armas aprobadas: ${error.message}`;
        status.hidden = false;
        status.setAttribute('role', 'alert');
    });
});
