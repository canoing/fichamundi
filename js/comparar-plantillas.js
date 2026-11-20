import { supabase } from './supabase.js';

const statusElement = document.getElementById('comparador-estado');
const armiesContainer = document.getElementById('comparador-ejercitos');
const resultContainer = document.getElementById('comparador-resultado');
const categoryDefinitions = [
    { id: 'naval', label: 'Barcos' },
    { id: 'aircraft', label: 'Aviones' },
    { id: 'infantry', label: 'Divisiones' }
];
const categoryById = new Map(categoryDefinitions.map(category => [category.id, category]));
const templatesById = new Map();
const armies = [
    { id: 'a', label: 'Ejército A', country: '', category: 'naval', templateId: '', units: [] },
    { id: 'b', label: 'Ejército B', country: '', category: 'naval', templateId: '', units: [] }
];
let attackerId = 'a';
let nextUnitId = 0;

function createElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
}

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
    if (content?.estadisticas_acumuladas && typeof content.estadisticas_acumuladas === 'object'
        && !Array.isArray(content.estadisticas_acumuladas)) {
        return content.estadisticas_acumuladas;
    }
    if (Array.isArray(content) && content[0] && typeof content[0] === 'object') {
        return content[0];
    }
    return content || {};
}

function getTemplateCategory(template) {
    const fileName = String(template.file_name || '').toLocaleLowerCase('es');
    const content = template.content || {};
    const selected = content.modulos_seleccionados || content.componentes_seleccionados || {};
    if (fileName.startsWith('buque-') || selected.casco) return 'naval';
    if (fileName.startsWith('avion-') || selected.fuselaje || selected.motores) return 'aircraft';
    if (fileName.startsWith('division-') || content.ficha_unidad) return 'infantry';
    return null;
}

function getTemplateTitle(template) {
    const content = template.content || {};
    return content.titulo
        || content.ficha_unidad?.informacion_general?.nombre_unidad
        || content.informacion_general?.nombre
        || content.informacion_general?.nombre_unidad
        || content[0]?.Nombre
        || String(template.file_name || '').replace(/\.json$/i, '')
        || 'Unidad sin nombre';
}

function readNumber(stats, keys) {
    for (const key of keys) {
        const value = stats[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            const number = Number(value.trim().replace(',', '.'));
            if (Number.isFinite(number)) return number;
        }
    }
    return 0;
}

function parseChannels(value, letters) {
    if (typeof value !== 'string') return {};
    const channels = {};
    const expression = new RegExp(`(-?\\d+(?:[.,]\\d+)?)\\s*\\(?\\s*(${letters.join('|')})\\s*\\)?`, 'gi');
    let match;
    while ((match = expression.exec(value))) {
        channels[match[2].toUpperCase()] = Number(match[1].replace(',', '.'));
    }
    return channels;
}

function parseAircraftAttack(value) {
    const channels = parseChannels(value, ['AT', 'AN', 'A']);
    return Object.fromEntries(Object.entries(channels).map(([type, amount]) => [
        type,
        amount
    ]));
}

function normalizeTemplate(template) {
    const stats = getTemplateStats(template.content);
    const category = getTemplateCategory(template);
    const rawAttack = stats.ataque;
    const aircraftAttack = parseAircraftAttack(rawAttack);
    const navalDefense = parseChannels(String(stats.defensa_pl_total || ''), ['P', 'L']);
    const navalAttack = parseChannels(String(stats.ataque_pl_total || ''), ['P', 'L']);
    const submarineDamage = parseChannels(String(stats.dano_submarino || ''), ['P', 'L']);
    const defenseType = String(stats.tipo_defensa || '').toUpperCase();
    const generalDefense = readNumber(stats, ['defensa', 'DEF', 'def']);
    if (category === 'naval' && !Object.keys(navalDefense).length) {
        const selectedDefense = readNumber(stats, ['defensa_pl_total']) || generalDefense;
        if (selectedDefense) navalDefense[defenseType === 'L' ? 'L' : 'P'] = selectedDefense;
    }

    return {
        id: String(template.id),
        title: getTemplateTitle(template),
        country: String(template.country || 'País sin nombre'),
        category,
        stats: {
            attackAir: readNumber(stats, ['ataque_aereo', 'ataque_aéreo', 'ataque_aereo_total'])
                || aircraftAttack.A
                || readNumber(stats, ['ataque']),
            attackGround: readNumber(stats, ['ataque_tierra', 'ataque_terrestre']) || aircraftAttack.AT || 0,
            attackNaval: readNumber(stats, ['ataque_naval']) || aircraftAttack.AN || 0,
            attackDivision: readNumber(stats, ['ATK', 'atk', 'ataque']),
            attackGeneral: readNumber(stats, ['ataque']),
            attackPL: {
                P: navalAttack.P || 0,
                L: navalAttack.L || 0
            },
            submarineDamagePL: {
                P: submarineDamage.P || 0,
                L: submarineDamage.L || 0
            },
            submarineDamage: readNumber(stats, ['dano_submarino']),
            navalDefense: {
                P: navalDefense.P || 0,
                L: navalDefense.L || 0
            },
            defense: generalDefense,
            hp: readNumber(stats, ['HP', 'hp', 'vida', 'vida_total', 'health'])
        }
    };
}

function formatNumber(value) {
    return new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(value);
}

function formatPLChannels(channels) {
    return ['P', 'L']
        .filter(type => channels[type] !== undefined && channels[type] !== 0)
        .map(type => `${formatNumber(channels[type])}(${type})`)
        .join(' ');
}

function getCategoryLabel(category) {
    return categoryById.get(category)?.label || 'Unidad';
}

function getTemplateStatRows(unit) {
    const stats = unit.stats;
    if (unit.category === 'naval') {
        const defenseChannel = stats.navalDefense.P ? 'P' : stats.navalDefense.L ? 'L' : '';
        return [
            ...(stats.attackPL.P || stats.attackPL.L
                ? [{ label: 'Daño P/L', value: formatPLChannels(stats.attackPL) }]
                : []),
            ...(stats.submarineDamagePL.P || stats.submarineDamagePL.L
                ? [{ label: 'Daño submarino', value: formatPLChannels(stats.submarineDamagePL) }]
                : []),
            ...(stats.submarineDamage ? [{ label: 'Daño submarino', value: stats.submarineDamage }] : []),
            ...(stats.attackGeneral ? [{ label: 'Ataque', value: stats.attackGeneral }] : []),
            ...(defenseChannel
                ? [{ label: `Defensa ${defenseChannel}`, value: stats.navalDefense[defenseChannel] }]
                : [])
        ];
    }
    if (unit.category === 'aircraft') {
        return [
            ['Ataque aéreo', stats.attackAir],
            ['Ataque terrestre', stats.attackGround],
            ['Ataque naval', stats.attackNaval],
            ['Defensa', stats.defense],
            ['HP', stats.hp]
        ].filter(([, value]) => value !== 0).map(([label, value]) => ({ label, value }));
    }
    return [
        ['Ataque', stats.attackDivision],
        ['Defensa', stats.defense],
        ['HP', stats.hp]
    ].filter(([, value]) => value !== 0).map(([label, value]) => ({ label, value }));
}

function renderStatList(parent, rows, className = 'comparador-stat-list') {
    if (!rows.length) {
        parent.append(createElement('p', 'Sin estadísticas disponibles.', 'comparador-muted'));
        return;
    }
    const list = createElement('dl', undefined, className);
    rows.forEach(({ label, value }) => {
        list.append(createElement('dt', label), createElement('dd', value));
    });
    parent.append(list);
}

function areCategoriesCompatible(left, right) {
    if (left === right) return true;
    return (left === 'naval' && right === 'aircraft')
        || (left === 'aircraft' && right === 'naval')
        || (left === 'aircraft' && right === 'infantry')
        || (left === 'infantry' && right === 'aircraft');
}

function getAvailableCategories(army) {
    const existing = [...new Set(army.units.map(unit => unit.category))];
    return categoryDefinitions.filter(category =>
        existing.every(current => areCategoriesCompatible(current, category.id))
    );
}

function sumUnitsByCategory(units) {
    const totals = new Map();
    units.forEach(unit => {
        const total = totals.get(unit.category) || {
            count: 0,
            attackAir: 0,
            attackGround: 0,
            attackNaval: 0,
            attackDivision: 0,
            attackGeneral: 0,
            attackPL: { P: 0, L: 0 },
            submarineDamagePL: { P: 0, L: 0 },
            submarineDamage: 0,
            navalDefense: { P: 0, L: 0 },
            defense: 0,
            hp: 0
        };
        total.count += 1;
        total.attackAir += unit.stats.attackAir;
        total.attackGround += unit.stats.attackGround;
        total.attackNaval += unit.stats.attackNaval;
        total.attackDivision += unit.stats.attackDivision;
        total.attackGeneral += unit.stats.attackGeneral;
        total.attackPL.P += unit.stats.attackPL.P;
        total.attackPL.L += unit.stats.attackPL.L;
        total.submarineDamagePL.P += unit.stats.submarineDamagePL.P;
        total.submarineDamagePL.L += unit.stats.submarineDamagePL.L;
        total.submarineDamage += unit.stats.submarineDamage;
        total.navalDefense.P += unit.stats.navalDefense.P;
        total.navalDefense.L += unit.stats.navalDefense.L;
        total.defense += unit.stats.defense;
        total.hp += unit.stats.hp;
        totals.set(unit.category, total);
    });
    return totals;
}

function getAggregateStatRows(category, stats) {
    if (category === 'naval') {
        return [
            ['Ataque P', stats.attackPL.P],
            ['Ataque L', stats.attackPL.L],
            ['Daño submarino P', stats.submarineDamagePL.P],
            ['Daño submarino L', stats.submarineDamagePL.L],
            ['Daño submarino', stats.submarineDamage],
            ['Ataque naval', stats.attackGeneral],
            ['Defensa P', stats.navalDefense.P],
            ['Defensa L', stats.navalDefense.L]
        ].filter(([, value]) => value !== 0).map(([label, value]) => ({ label, value }));
    }
    if (category === 'aircraft') {
        return [
            ['Ataque aéreo', stats.attackAir],
            ['Ataque terrestre', stats.attackGround],
            ['Ataque naval', stats.attackNaval],
            ['Defensa', stats.defense],
            ['HP', stats.hp]
        ].filter(([, value]) => value !== 0).map(([label, value]) => ({ label, value }));
    }
    return [
        ['Ataque', stats.attackDivision],
        ['Defensa', stats.defense],
        ['HP', stats.hp]
    ].filter(([, value]) => value !== 0).map(([label, value]) => ({ label, value }));
}

function addField(parent, labelText, element) {
    const wrapper = createElement('div', undefined, 'campo comparador-campo');
    const label = createElement('label', labelText);
    label.append(element);
    wrapper.append(label);
    parent.append(wrapper);
}

function renderArmyPanel(army) {
    const panel = createElement('section', undefined, 'comparador-ejercito');
    panel.append(createElement('h3', army.label));
    const controls = createElement('div', undefined, 'comparador-controles');

    const countrySelect = document.createElement('select');
    countrySelect.append(new Option('Selecciona un país', ''));
    const countries = [...new Set([...templatesById.values()].map(template => template.country))]
        .sort((left, right) => left.localeCompare(right, 'es'));
    countries.forEach(country => countrySelect.append(new Option(country, country)));
    countrySelect.value = army.country;
    countrySelect.addEventListener('change', () => {
        army.country = countrySelect.value;
        army.units = [];
        army.templateId = '';
        render();
    });
    addField(controls, 'País', countrySelect);

    const availableCategories = getAvailableCategories(army);
    if (!availableCategories.some(category => category.id === army.category)) {
        army.category = availableCategories[0]?.id || 'naval';
        army.templateId = '';
    }
    const categorySelect = document.createElement('select');
    availableCategories.forEach(category => categorySelect.append(new Option(category.label, category.id)));
    categorySelect.value = army.category;
    categorySelect.disabled = !army.country;
    categorySelect.addEventListener('change', () => {
        army.category = categorySelect.value;
        army.templateId = '';
        render();
    });
    addField(controls, 'Categoría de unidad', categorySelect);

    const countryTemplates = [...templatesById.values()]
        .filter(template => template.country === army.country && template.category === army.category)
        .sort((left, right) => left.title.localeCompare(right.title, 'es'));
    const availableTemplates = countryTemplates.filter(template =>
        !army.units.some(unit => unit.id === template.id)
    );
    const templateSelect = document.createElement('select');
    templateSelect.append(new Option(
        availableTemplates.length ? 'Selecciona una plantilla' : 'No hay plantillas disponibles',
        ''
    ));
    availableTemplates.forEach(template => {
        templateSelect.append(new Option(template.title, template.id));
    });
    if (availableTemplates.some(template => template.id === army.templateId)) {
        templateSelect.value = army.templateId;
    } else {
        army.templateId = '';
    }
    templateSelect.disabled = !army.country || !availableTemplates.length;
    templateSelect.addEventListener('change', () => {
        army.templateId = templateSelect.value;
        addButton.disabled = !army.templateId;
    });
    addField(controls, 'Plantilla aprobada', templateSelect);

    const addButton = createElement('button', 'Agregar unidad', 'btn btn-secondary comparador-agregar');
    addButton.type = 'button';
    addButton.disabled = !army.templateId;
    addButton.addEventListener('click', () => {
        if (!army.templateId) return;
        const template = templatesById.get(army.templateId);
        if (!template
            || army.units.some(unit => unit.id === template.id)
            || !getAvailableCategories(army).some(category => category.id === template.category)) return;
        army.units.push({ instanceId: ++nextUnitId, ...template });
        army.templateId = '';
        render();
    });
    controls.append(addButton);
    panel.append(controls);

    const unitCards = createElement('div', undefined, 'comparador-unidades');
    if (!army.units.length) {
        unitCards.append(createElement('p', 'Agrega plantillas aprobadas para formar este ejército.', 'comparador-muted'));
    } else {
        army.units.forEach(unit => {
            const card = createElement('article', undefined, 'comparador-unidad');
            const cardHeader = createElement('div', undefined, 'comparador-unidad-header');
            const title = createElement('h4', unit.title);
            const remove = createElement('button', 'Quitar', 'btn btn-secondary');
            remove.type = 'button';
            remove.setAttribute('aria-label', `Quitar ${unit.title} del ${army.label}`);
            remove.addEventListener('click', () => {
                army.units = army.units.filter(item => item.instanceId !== unit.instanceId);
                render();
            });
            cardHeader.append(title, remove);
            card.append(cardHeader);
            card.append(createElement('p', `${getCategoryLabel(unit.category)} · ${unit.country}`, 'comparador-tipo'));
            renderStatList(card, getTemplateStatRows(unit));
            unitCards.append(card);
        });
    }
    panel.append(unitCards);

    if (army.units.length) {
        const totalsSection = createElement('div', undefined, 'comparador-totales');
        totalsSection.append(createElement('h4', 'Suma horizontal de la formación'));
        sumUnitsByCategory(army.units).forEach((stats, category) => {
            const group = createElement('section', undefined, 'comparador-total-categoria');
            group.append(createElement('strong', `${getCategoryLabel(category)} · ${stats.count} unidad${stats.count === 1 ? '' : 'es'}`));
            renderStatList(group, getAggregateStatRows(category, stats));
            totalsSection.append(group);
        });
        panel.append(totalsSection);
    }
    return panel;
}

function getAttacksByCategory(units) {
    const attacks = {
        naval: { P: 0, L: 0, submarineP: 0, submarineL: 0, general: 0 },
        aircraft: { A: 0 },
        infantry: { AT: 0 }
    };
    units.forEach(unit => {
        if (unit.category === 'naval') {
            attacks.naval.P += unit.stats.attackPL.P;
            attacks.naval.L += unit.stats.attackPL.L;
            attacks.naval.submarineP += unit.stats.submarineDamagePL.P;
            attacks.naval.submarineL += unit.stats.submarineDamagePL.L;
            attacks.naval.general += unit.stats.attackGeneral + unit.stats.submarineDamage;
        } else if (unit.category === 'aircraft') {
            attacks.naval.general += unit.stats.attackNaval;
            attacks.aircraft.A += unit.stats.attackAir;
            attacks.infantry.AT += unit.stats.attackGround;
        } else if (unit.category === 'infantry') {
            attacks.infantry.AT += unit.stats.attackDivision;
        }
    });
    return attacks;
}

function applyDamage(defense, hp, damage) {
    const initialDefense = Math.max(0, defense);
    const initialHp = Math.max(0, hp);
    const defenseLoss = Math.min(initialDefense, Math.max(0, damage));
    const overflow = Math.max(0, damage - initialDefense);
    const hpLoss = Math.min(initialHp, overflow);
    return {
        initialDefense,
        remainingDefense: initialDefense - defenseLoss,
        initialHp,
        remainingHp: initialHp - hpLoss,
        damage
    };
}

function renderResultLine(parent, label, initial, remaining) {
    const row = createElement('div', undefined, 'comparador-resultado-linea');
    row.append(createElement('span', label), createElement('strong', `${formatNumber(initial)} → ${formatNumber(remaining)}`));
    parent.append(row);
}

function renderNavalOutcome(parent, stats, attacks) {
    const defenseP = stats.navalDefense.P;
    const defenseL = stats.navalDefense.L;
    const damageP = attacks.naval.P;
    const damageL = attacks.naval.L;
    const totalDamageP = damageP + attacks.naval.submarineP;
    const totalDamageL = damageL + attacks.naval.submarineL;
    const afterP = applyDamage(defenseP, 0, totalDamageP);
    const afterL = applyDamage(defenseL, 0, totalDamageL);
    const defenseAfterTypedDamage = afterP.remainingDefense + afterL.remainingDefense;
    const defenseAfterGenericDamage = applyDamage(
        defenseAfterTypedDamage,
        0,
        attacks.naval.general
    ).remainingDefense;

    renderResultLine(parent, 'Defensa P tras daño P', defenseP, afterP.remainingDefense);
    renderResultLine(parent, 'Defensa L tras daño L', defenseL, afterL.remainingDefense);
    if (attacks.naval.general) {
        renderResultLine(
            parent,
            'Defensa total tras daño naval',
            defenseAfterTypedDamage,
            defenseAfterGenericDamage
        );
    }
    const attackDetails = [
        damageP ? `P: ${formatNumber(damageP)}` : '',
        damageL ? `L: ${formatNumber(damageL)}` : '',
        attacks.naval.submarineP ? `Submarino P: ${formatNumber(attacks.naval.submarineP)}` : '',
        attacks.naval.submarineL ? `Submarino L: ${formatNumber(attacks.naval.submarineL)}` : '',
        attacks.naval.general ? `Naval: ${formatNumber(attacks.naval.general)}` : ''
    ].filter(Boolean);
    parent.append(createElement(
        'p',
        attackDetails.length ? `Ataques recibidos: ${attackDetails.join(' · ')}` : 'No recibe ataques navales aplicables.',
        'comparador-muted'
    ));
    parent.append(createElement('p', 'Los barcos no tienen HP: el daño solo reduce su defensa.', 'comparador-nota'));
}

function renderStandardOutcome(parent, defense, hp, damage) {
    const outcome = applyDamage(defense, hp, damage);
    renderResultLine(parent, 'Defensa', outcome.initialDefense, outcome.remainingDefense);
    renderResultLine(parent, 'HP', outcome.initialHp, outcome.remainingHp);
    parent.append(createElement(
        'p',
        damage ? `Daño aplicado: ${formatNumber(damage)}; primero reduce defensa y el excedente reduce HP.`
            : 'No recibe ataques de un tipo compatible.',
        'comparador-muted'
    ));
}

function renderBattleResults() {
    const [armyA, armyB] = armies;
    if (!armyA.units.length || !armyB.units.length) {
        resultContainer.hidden = true;
        resultContainer.replaceChildren();
        return;
    }
    const attacker = armies.find(army => army.id === attackerId);
    const defender = armies.find(army => army.id !== attackerId);
    const attacks = getAttacksByCategory(attacker.units);
    const defenderTotals = sumUnitsByCategory(defender.units);
    const section = createElement('section', undefined, 'comparador-batalla');
    section.append(createElement('h3', 'Resultado del enfrentamiento'));

    const roleControls = createElement('div', undefined, 'campo comparador-rol');
    const roleLabel = createElement('label', 'Ataca');
    const roleSelect = document.createElement('select');
    armies.forEach(army => {
        const country = army.country ? ` · ${army.country}` : '';
        roleSelect.append(new Option(`${army.label}${country}`, army.id));
    });
    roleSelect.value = attackerId;
    roleSelect.addEventListener('change', () => {
        attackerId = roleSelect.value;
        renderBattleResults();
    });
    roleLabel.append(roleSelect);
    roleControls.append(roleLabel);
    section.append(roleControls);
    section.append(createElement(
        'p',
        `${attacker.label} (${attacker.country}) ataca a ${defender.label} (${defender.country}).`,
        'comparador-enfrentamiento'
    ));

    defenderTotals.forEach((stats, category) => {
        const outcome = createElement('section', undefined, 'comparador-resultado-categoria');
        outcome.append(createElement('h4', getCategoryLabel(category)));
        if (category === 'naval') {
            renderNavalOutcome(outcome, stats, attacks);
        } else if (category === 'aircraft') {
            renderStandardOutcome(outcome, stats.defense, stats.hp, attacks.aircraft.A);
        } else {
            renderStandardOutcome(outcome, stats.defense, stats.hp, attacks.infantry.AT);
        }
        section.append(outcome);
    });
    resultContainer.replaceChildren(section);
    resultContainer.hidden = false;
}

function render() {
    armiesContainer.replaceChildren(...armies.map(renderArmyPanel));
    renderBattleResults();
}

function addTemplate(template) {
    const category = getTemplateCategory(template);
    if (!category) return;
    const normalized = normalizeTemplate(template);
    if (normalized.category) templatesById.set(normalized.id, normalized);
}

async function loadApprovedTemplates() {
    try {
        const batchSize = 500;
        let offset = 0;
        while (true) {
            const { data, error } = await supabase
                .from('templates')
                .select('id, country, file_name, content')
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .range(offset, offset + batchSize - 1);
            if (error) throw error;
            data.forEach(addTemplate);
            if (data.length < batchSize) break;
            offset += batchSize;
        }
        render();
        if (!templatesById.size) {
            showStatus('No hay plantillas aprobadas de barcos, aviones o divisiones.');
            return;
        }
        showStatus(`${templatesById.size} plantillas aprobadas disponibles para formar ejércitos.`);
    } catch (error) {
        showStatus(`No se pudieron cargar las plantillas aprobadas: ${error.message}`, true);
    }
}

render();
loadApprovedTemplates();
