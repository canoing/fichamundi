import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('aviso-modulos-aprobados');

    // Armas de infantería aprobadas (se seleccionan en cualquier regimiento).
    async function loadApprovedWeapons() {
        const { data, error } = await supabase
            .from('custom_modules')
            .select('id, country, content, price')
            .eq('vehicle', 'infantry')
            .eq('module_type', 'weapon')
            .eq('status', 'approved')
            .eq('is_current', true);
        if (error) throw error;
        window.establecerArmasDivisionAprobadas(data || []);
        return data || [];
    }

    // Plantillas de tanques/vehículos aprobadas en plantillas.html. Se
    // ofrecen como "vehículo" seleccionable en los regimientos blindados.
    async function loadApprovedVehicles() {
        const { data, error } = await supabase
            .from('templates')
            .select('id, country, file_name, content, status')
            .eq('status', 'approved');
        if (error) throw error;
        window.establecerVehiculosDivisionAprobados(data || []);
        return data || [];
    }

    try {
        const [armas, vehiculos] = await Promise.all([
            loadApprovedWeapons(),
            loadApprovedVehicles()
        ]);
        const mensajes = [];
        mensajes.push(armas.length
            ? `Se cargaron ${armas.length} arma(s) aprobada(s) de todos los países.`
            : 'No hay armas aprobadas disponibles.');
        mensajes.push(vehiculos.length
            ? `Se cargaron ${vehiculos.length} plantilla(s) aprobada(s) para vehículos.`
            : 'No hay plantillas de tanques aprobadas disponibles.');
        status.textContent = mensajes.join(' ');
        status.hidden = false;
    } catch (error) {
        status.textContent = `No se pudieron cargar los módulos aprobados: ${error.message}`;
        status.hidden = false;
        status.setAttribute('role', 'alert');
    }
});
