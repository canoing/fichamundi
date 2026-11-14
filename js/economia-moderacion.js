import { supabase } from './supabase.js';

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

export function createModeratorEconomyMenu(container) {
    const toggle = createElement('button', '', 'btn btn-secondary moderator-economy-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');

    const panel = createElement('section', undefined, 'moderator-economy-panel');
    panel.id = 'panel-guia-economica-moderacion';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Guía económica del país');
    toggle.setAttribute('aria-controls', panel.id);
    const panelHeader = createElement('div', undefined, 'moderator-economy-header');
    const heading = createElement('h2', 'Guía económica');
    const closeButton = createElement('button', 'Cerrar', 'btn btn-secondary');
    closeButton.type = 'button';
    panelHeader.append(heading, closeButton);
    const content = createElement('div', undefined, 'moderator-economy-content');
    const notice = createElement(
        'p',
        'Esta información es solo una guía y depende de que cada usuario haya completado la wiki de su país.',
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
        async show(country, isModerator = false) {
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
            if (!investigationCountry) return;

            const statesResult = await supabase
                .from('investigation_country_states')
                .select('node_id')
                .eq('country_id', investigationCountry.id)
                .eq('status', 'completed');
            if (currentRequestId !== requestId) return;
            if (statesResult.error) throw statesResult.error;
            const completedStates = statesResult.data || [];
            if (!completedStates.length) return;

            const wikiPost = (postsResult.data || []).find(post =>
                normalizeCountry(post.country) === normalizeCountry(country)
            );
            heading.textContent = `Guía económica · ${country}`;
            content.replaceChildren();

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
            toggle.textContent = `Guía económica: ${country}`;
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
