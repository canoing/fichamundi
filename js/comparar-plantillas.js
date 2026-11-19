import { supabase } from './supabase.js';

const vehicleSelects = [1, 2, 3, 4].map(number =>
    document.getElementById(`comparador-vehiculo-${number}`)
);
const statusElement = document.getElementById('comparador-estado');
const chartContainer = document.getElementById('comparador-grafico');
const svgNamespace = 'http://www.w3.org/2000/svg';
const colors = ['#2d5a7b', '#d35454', '#39834a', '#8a5da8'];
const templatesById = new Map();

function showStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.setAttribute('role', isError ? 'alert' : 'status');
}

function getTemplateStats(content) {
    if (content?.ficha_unidad && content.estadisticas_acumuladas
        && typeof content.estadisticas_acumuladas === 'object'
        && !Array.isArray(content.estadisticas_acumuladas)) {
        return content.estadisticas_acumuladas;
    }
    if (content?.estadisticas && typeof content.estadisticas === 'object'
        && !Array.isArray(content.estadisticas)) {
        return content.estadisticas;
    }
    if (Array.isArray(content) && content[0] && typeof content[0] === 'object') {
        return content[0];
    }
    return null;
}

function formatStatName(key) {
    const labels = {
        hp: 'HP',
        atk: 'ATK',
        def: 'DEF',
        mov: 'MOV',
        sup: 'SUP',
        ataque: 'Ataque',
        defensa: 'Defensa',
        coste: 'Coste',
        costo: 'Coste',
        coste_de_produccion: 'Coste de producción',
        ataque_pl_total: 'Ataque (P/L)',
        defensa_pl_total: 'Defensa (P/L)',
        dano_submarino: 'Daño submarino',
        ataque_naval: 'Daño naval',
        ataque_tierra: 'Daño terrestre',
        maniobrabilidad: 'Maniobrabilidad',
        peso_total: 'Peso'
    };
    const normalized = key.toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return labels[normalized]
        || normalized.replace(/_/g, ' ').replace(/^./, character => character.toLocaleUpperCase('es'));
}

function getNumericStats(stats) {
    const numericStats = new Map();
    Object.entries(stats || {}).forEach(([key, value]) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
            numericStats.set(formatStatName(key), value);
            return;
        }
        if (typeof value !== 'string' || !value.trim()) return;
        const numericValue = Number(value.trim());
        if (Number.isFinite(numericValue)) {
            numericStats.set(formatStatName(key), numericValue);
            return;
        }

        const plValues = [...value.matchAll(/(-?\d+(?:\.\d+)?)\s*\(?\s*([PL])\s*\)?/gi)];
        if (!plValues.length) return;
        plValues.forEach(([, amount, type]) => {
            numericStats.set(`${formatStatName(key)} (${type.toLocaleUpperCase('es')})`, Number(amount));
        });
    });
    return numericStats;
}

function getTemplateCategory(template) {
    const fileName = String(template.file_name || '').toLocaleLowerCase('es');
    const content = template.content || {};
    const selected = content.modulos_seleccionados || content.componentes_seleccionados || {};
    if (fileName.startsWith('buque-') || selected.casco) return 'Barco';
    if (fileName.startsWith('avion-') || selected.fuselaje || selected.motores) return 'Avión';
    if (fileName.startsWith('tanque-') || selected.chasis || selected.traccion) return 'Tanque';
    if (fileName.startsWith('division-') || content.ficha_unidad) return 'División';
    return 'Vehículo';
}

function getTemplateTitle(template) {
    const content = template.content || {};
    return content.titulo
        || content.ficha_unidad?.informacion_general?.nombre_unidad
        || content.informacion_general?.nombre
        || content.informacion_general?.nombre_unidad
        || content[0]?.Nombre
        || template.file_name
        || 'Vehículo sin nombre';
}

function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS(svgNamespace, tagName);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    return element;
}

function renderLegend(vehicles, chart) {
    const legend = document.createElement('div');
    legend.className = 'comparador-legend';
    vehicles.forEach((vehicle, index) => {
        const item = document.createElement('span');
        item.className = 'comparador-legend-item';
        item.append(createSvgElement('svg', {
            width: 14,
            height: 14,
            viewBox: '0 0 14 14',
            'aria-hidden': 'true',
            style: 'vertical-align: -2px; margin-right: 4px;'
        }));
        item.firstElementChild.append(createSvgElement('rect', {
            width: 14,
            height: 14,
            rx: 3,
            fill: colors[index]
        }));
        item.append(document.createTextNode(` ${vehicle.title} · ${vehicle.country} (${vehicle.category})`));
        legend.append(item);
    });
    chart.append(legend);
}

function renderChart(vehicles) {
    chartContainer.replaceChildren();
    const metricNames = [...new Set(vehicles.flatMap(vehicle => [...vehicle.stats.keys()]))]
        .sort((left, right) => left.localeCompare(right, 'es'));
    if (!metricNames.length) {
        chartContainer.hidden = true;
        showStatus('Los vehículos seleccionados no tienen estadísticas numéricas que se puedan graficar.');
        return;
    }

    const chart = document.createElement('div');
    chart.className = 'plantilla-categoria comparador-chart-card';
    const heading = document.createElement('h3');
    heading.textContent = 'Estadísticas guardadas (cada métrica usa su propia escala)';
    chart.append(heading);

    const isCompact = window.matchMedia('(max-width: 640px)').matches;
    const rowHeight = isCompact ? 92 : 78;
    const chartWidth = isCompact ? 360 : 960;
    const baseX = isCompact ? 180 : 510;
    const maxBarWidth = isCompact ? 105 : 245;
    const chartHeight = metricNames.length * rowHeight + 20;
    const svg = createSvgElement('svg', {
        viewBox: `0 0 ${chartWidth} ${chartHeight}`,
        width: '100%',
        class: 'comparador-chart-svg',
        role: 'img',
        'aria-label': `Gráfico comparativo de ${metricNames.length} estadísticas para ${vehicles.length} vehículos`
    });
    const chartViewport = document.createElement('div');
    chartViewport.className = 'comparador-chart-viewport';
    chartViewport.style.overflowX = isCompact ? 'hidden' : 'auto';
    svg.style.minWidth = isCompact ? '0' : '720px';

    metricNames.forEach((metric, metricIndex) => {
        const rowY = metricIndex * rowHeight + 10;
        const label = createSvgElement('text', {
            x: 8,
            y: rowY + 18,
            class: 'comparador-chart-metric',
            'font-size': 14,
            'font-weight': 700
        });
        label.textContent = metric;
        svg.append(label);

        const availableValues = vehicles
            .map(vehicle => vehicle.stats.get(metric))
            .filter(value => value !== undefined);
        const maxValue = Math.max(...availableValues.map(Math.abs), 1);
        const hasNegativeValues = availableValues.some(value => value < 0);
        const metricBaseX = isCompact
            ? hasNegativeValues ? 180 : 68
            : baseX;
        const metricMaxBarWidth = isCompact
            ? hasNegativeValues ? 110 : 220
            : maxBarWidth;
        svg.append(createSvgElement('line', {
            x1: metricBaseX,
            y1: rowY + 22,
            x2: metricBaseX,
            y2: rowY + rowHeight - 4,
            class: 'comparador-chart-axis',
            'stroke-width': 1
        }));

        vehicles.forEach((vehicle, vehicleIndex) => {
            const value = vehicle.stats.get(metric);
            const barY = rowY + 25 + vehicleIndex * 12;
            if (value === undefined) {
                const missing = createSvgElement('text', {
                    x: metricBaseX + 8,
                    y: barY + 10,
                    class: 'comparador-chart-missing',
                    'font-size': 12
                });
                missing.textContent = 'Sin dato';
                svg.append(missing);
                return;
            }
            const width = Math.abs(value) / maxValue * metricMaxBarWidth;
            const barX = value < 0 ? metricBaseX - width : metricBaseX;
            svg.append(createSvgElement('rect', {
                x: barX,
                y: barY,
                width: Math.max(width, 1),
                height: 9,
                rx: 2,
                fill: colors[vehicleIndex]
            }));
            const valueLabel = createSvgElement('text', {
                x: value < 0 ? barX - 6 : barX + width + 6,
                y: barY + 9,
                class: 'comparador-chart-value',
                'font-size': 12,
                'text-anchor': value < 0 ? 'end' : 'start'
            });
            valueLabel.textContent = String(value);
            svg.append(valueLabel);
        });
    });

    chartViewport.append(svg);
    chart.append(chartViewport);
    renderLegend(vehicles, chart);
    chartContainer.append(chart);
    chartContainer.hidden = false;
    showStatus(`Comparando ${vehicles.length} vehículos con ${metricNames.length} estadísticas disponibles.`);
}

function updateComparison() {
    const selectedIds = vehicleSelects.map(select => select.value).filter(Boolean);
    if (new Set(selectedIds).size !== selectedIds.length) {
        chartContainer.hidden = true;
        showStatus('Selecciona vehículos distintos para compararlos.', true);
        return;
    }
    if (selectedIds.length < 2) {
        chartContainer.hidden = true;
        showStatus('Selecciona al menos dos vehículos para mostrar la comparación.');
        return;
    }
    renderChart(selectedIds.map(id => templatesById.get(id)));
}

function addTemplateOption(template) {
    const stats = getNumericStats(getTemplateStats(template.content));
    if (!stats.size) return;
    const id = String(template.id);
    const title = getTemplateTitle(template);
    const country = String(template.country || 'Sin país');
    const category = getTemplateCategory(template);
    templatesById.set(id, { title, country, category, stats });
}

function populateVehicleSelects() {
    const groups = new Map();
    templatesById.forEach((vehicle, id) => {
        const key = JSON.stringify([vehicle.country, vehicle.category]);
        if (!groups.has(key)) {
            groups.set(key, {
                country: vehicle.country,
                category: vehicle.category,
                vehicles: []
            });
        }
        groups.get(key).vehicles.push({ ...vehicle, id });
    });

    const sortedGroups = [...groups.values()].sort((left, right) =>
        left.country.localeCompare(right.country, 'es')
        || left.category.localeCompare(right.category, 'es')
    );
    vehicleSelects.forEach(select => {
        const placeholder = select.options[0].textContent;
        select.replaceChildren(new Option(placeholder, ''));
        sortedGroups.forEach(group => {
            const optionGroup = document.createElement('optgroup');
            optionGroup.label = `${group.country} — ${group.category}`;
            group.vehicles
                .sort((left, right) => left.title.localeCompare(right.title, 'es'))
                .forEach(vehicle => optionGroup.append(new Option(vehicle.title, vehicle.id)));
            select.append(optionGroup);
        });
    });
}

async function loadApprovedTemplates() {
    try {
        const batchSize = 500;
        let offset = 0;
        while (true) {
            const { data, error } = await supabase
                .from('templates')
                .select('id, country, file_name, content, status')
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .range(offset, offset + batchSize - 1);
            if (error) throw error;

            data.forEach(addTemplateOption);
            if (data.length < batchSize) break;
            offset += batchSize;
        }

        populateVehicleSelects();
        if (!templatesById.size) {
            showStatus('No hay plantillas aprobadas con estadísticas numéricas disponibles.');
            return;
        }
        showStatus(`${templatesById.size} plantillas aprobadas con estadísticas numéricas disponibles.`);
    } catch (error) {
        showStatus(`No se pudieron cargar las plantillas aprobadas: ${error.message}`, true);
    }
}

vehicleSelects.forEach((select, index) => {
    select.add(new Option(index > 1 ? 'No comparar' : 'Selecciona un vehículo', ''));
    select.addEventListener('change', updateComparison);
});

window.matchMedia('(max-width: 640px)').addEventListener('change', updateComparison);

loadApprovedTemplates();
