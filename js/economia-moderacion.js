import { supabase } from './supabase.js';
import { loadResearchNames } from './investigation-names.js';

const economyFields = [
    ['gdp_latest', 'PIB más reciente', value => `${value} miles de millones USD`],
    ['military_spending', 'Gasto militar', value => `${value}% del PIB`],
    ['primary_sector', 'Sector primario', value => value],
    ['secondary_light', 'Sector secundario ligero', value => value],
    ['secondary_heavy', 'Sector secundario pesado', value => value],
    ['tertiary_sector', 'Sector terciario', value => value]
];
function normalizeCountry(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('es');
}

function createElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (text !== undefined) element.textContent = String(text);
    if (className) element.className = className;
    return element;
}

function normalizeModuleName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[()\-_,./]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getModuleName(module) {
    return module?.nombre
        || module?.Nombre
        || module?.nombre_del_arma
        || module?.name;
}

function getModuleOriginLabel(module, country) {
    const origin = module?.pais_modulo || module?.country || module?.pais;
    if (typeof origin !== 'string' || !origin.trim()) return '';
    return normalizeCountry(origin) === normalizeCountry(country)
        ? `Propio · ${origin.trim()}`
        : `Extranjero · ${origin.trim()}`;
}

function isCustomModule(module) {
    return Boolean(
        module?.modulo_personalizado
        || module?.pais_modulo
        || module?.country
        || module?.pais
    );
}

function getModuleCategoryLabel(category) {
    const labels = {
        casco: 'Casco',
        cascos: 'Cascos',
        fuselaje: 'Fuselaje',
        motores: 'Motores',
        propulsion: 'Propulsión',
        motor: 'Motor',
        armamento: 'Armamento',
        bombas: 'Bombas',
        torpedos: 'Torpedos',
        alas: 'Alas',
        traccion: 'Tracción',
        comunicacion: 'Comunicación',
        blindaje: 'Blindaje',
        arma_equipada: 'Arma equipada',
        vehiculo: 'Vehículo'
    };
    return labels[category] || category.replaceAll('_', ' ').replace(/^./, character => character.toLocaleUpperCase('es'));
}

function getTemplateModules(template, country) {
    const modules = [];
    const content = template && typeof template === 'object' ? template : {};
    const selected = content.componentes_seleccionados || content.modulos_seleccionados || {};

    Object.entries(selected).forEach(([category, value]) => {
        const items = Array.isArray(value) ? value : [value];
        items.forEach(module => {
            const name = getModuleName(module);
            if (name) {
                const isCustom = isCustomModule(module);
                modules.push({
                    name,
                    category,
                    isCustom,
                    origin: isCustom ? getModuleOriginLabel(module, country) : ''
                });
            }
        });
    });

    ['regimientos_principales', 'batallones_apoyo'].forEach(category => {
        const entries = content.ficha_unidad?.[category];
        if (!Array.isArray(entries)) return;
        entries.forEach(entry => {
            ['arma_equipada', 'vehiculo'].forEach(type => {
                const module = entry?.[type];
                const name = getModuleName(module);
                if (name) {
                    const isCustom = isCustomModule(module);
                    modules.push({
                        name,
                        category: type,
                        isCustom,
                        origin: isCustom ? getModuleOriginLabel(module, country) : ''
                    });
                }
            });
        });
    });
    return modules;
}

function renderTemplateModules(content, templateContent, country, investigatedNames) {
    const section = createElement('section', undefined, 'moderator-template-research');
    section.append(createElement('h3', 'Investigación de los módulos de la plantilla'));

    const modules = getTemplateModules(templateContent, country);
    if (!modules.length) {
        section.append(createElement(
            'p',
            'La wiki de este país está vacía: la plantilla no contiene módulos para comprobar.',
            'moderator-research-empty'
        ));
        content.append(section);
        return;
    }

    const list = createElement('ul', undefined, 'moderator-template-module-list');
    modules.forEach(module => {
        const item = createElement('li');
        item.append(createElement(
            'span',
            [module.name, getModuleCategoryLabel(module.category), module.isCustom ? 'Módulo personalizado' : '']
                .filter(Boolean)
                .join(' · ')
        ));
        if (module.isCustom) {
            item.append(createElement(
                'span',
                ['Personalizado aprobado', module.origin].filter(Boolean).join(' · '),
                'inicio-estado inicio-estado-approved'
            ));
        } else {
            const isInvestigated = investigatedNames.has(normalizeModuleName(module.name));
            item.append(createElement(
                'span',
                isInvestigated ? 'Investigado' : 'No investigado',
                `moderator-research-status ${isInvestigated ? 'moderator-research-status-completed' : 'moderator-research-status-not-completed'}`
            ));
        }
        list.append(item);
    });
    section.append(list);
    content.append(section);
}

export function createModeratorEconomyMenu(container) {
    const toggle = createElement('button', '', 'btn btn-secondary moderator-economy-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');

    const panel = createElement('section', undefined, 'moderator-economy-panel');
    panel.id = 'panel-guia-economica-moderacion';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Wiki y guía económica del país');
    toggle.setAttribute('aria-controls', panel.id);
    const panelHeader = createElement('div', undefined, 'moderator-economy-header');
    const heading = createElement('h2', 'Wiki y guía económica');
    const closeButton = createElement('button', 'Cerrar', 'btn btn-secondary');
    closeButton.type = 'button';
    panelHeader.append(heading, closeButton);
    const content = createElement('div', undefined, 'moderator-economy-content');
    const notice = createElement(
        'p',
        'La guía económica y las investigaciones dependen de la información publicada para cada país.',
        'legacy-valky-warning'
    );
    panel.append(panelHeader, content, notice);
    container.classList.add('moderator-economy-menu');
    container.replaceChildren(toggle, panel);

    function setPanelOpen(isOpen) {
        panel.hidden = !isOpen;
        toggle.setAttribute('aria-expanded', String(isOpen));
    }

    toggle.addEventListener('click', () => setPanelOpen(panel.hidden));
    closeButton.addEventListener('click', () => setPanelOpen(false));

    let requestId = 0;
    return {
        hide() {
            requestId += 1;
            container.hidden = true;
            setPanelOpen(false);
        },
        async show(country, isModerator = false, templateContent = null) {
            const currentRequestId = ++requestId;
            container.hidden = true;
            setPanelOpen(false);
            if (!isModerator || !country.trim()) return;

            const [countriesResult, postsResult] = await Promise.all([
                supabase.from('investigation_countries').select('id, country'),
                supabase
                    .from('country_wiki_posts')
                    .select('country, economy, created_at')
                    .order('created_at', { ascending: false })
                    .limit(100)
            ]);
            if (currentRequestId !== requestId) return;
            if (countriesResult.error) throw countriesResult.error;
            if (postsResult.error) throw postsResult.error;

            const investigationCountry = (countriesResult.data || []).find(item =>
                normalizeCountry(item.country) === normalizeCountry(country)
            );

            let researchStates = [];
            if (investigationCountry) {
                const statesResult = await supabase
                    .from('investigation_country_states')
                    .select('node_id')
                    .eq('country_id', investigationCountry.id)
                    .eq('status', 'completed');
                if (currentRequestId !== requestId) return;
                if (statesResult.error) throw statesResult.error;
                researchStates = statesResult.data || [];
            }
            const researchNames = researchStates.length ? await loadResearchNames() : new Map();
            if (currentRequestId !== requestId) return;
            const investigatedNames = new Set(researchStates
                .map(state => researchNames.get(state.node_id))
                .filter(Boolean)
                .map(normalizeModuleName));

            const wikiPost = (postsResult.data || []).find(post =>
                normalizeCountry(post.country) === normalizeCountry(country)
            );
            heading.textContent = `Wiki y guía económica · ${country}`;
            content.replaceChildren();
            if (templateContent) {
                renderTemplateModules(content, templateContent, country, investigatedNames);
            }

            const definitions = createElement('dl', undefined, 'moderator-economy-grid');
            economyFields.forEach(([key, label, formatValue]) => {
                const value = wikiPost?.economy?.[key];
                if (value === null || value === undefined || String(value).trim() === '') return;
                definitions.append(createElement('dt', label));
                definitions.append(createElement('dd', formatValue(String(value).trim())));
            });

            if (definitions.childElementCount) {
                content.append(definitions);
            } else {
                content.append(createElement('p', 'No hay datos económicos publicados en la wiki de este país.'));
            }
            toggle.textContent = `Wiki y economía: ${country}`;
            container.hidden = false;
        }
    };
}

export function createCountryMenuButton(country, onClick) {
    const button = createElement('button', country, 'moderator-country-button');
    button.type = 'button';
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });
    return button;
}
