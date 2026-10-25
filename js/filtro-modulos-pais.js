const countryFilter = document.getElementById('filtro-pais-modulos-creador');
const modulesContainer = document.getElementById('modulos-container');
const divisionContainer = document.getElementById('regimientos-container');

if (countryFilter) {
    function normalizeCountry(country) {
        return String(country || '').trim().toLocaleLowerCase('es');
    }

    // Valor especial: no mostrar módulos de ningún país (solo los base).
    const NINGUN_PAIS = '__ningun_pais__';

    function updateCountryOptions() {
        const selectedCountry = countryFilter.value;
        const countries = [...new Set([
            ...document.querySelectorAll('#modulos-container [data-pais-modulo]'),
            ...document.querySelectorAll('#regimientos-container option[data-pais-modulo]')
        ].map(element => element.dataset.paisModulo).filter(Boolean))]
            .sort((left, right) => left.localeCompare(right, 'es'));

        countryFilter.replaceChildren(
            new Option('Ningún país', NINGUN_PAIS),
            new Option('Todos los países', '')
        );
        countries.forEach(country => countryFilter.add(new Option(country, country)));
        if (countries.some(country => normalizeCountry(country) === normalizeCountry(selectedCountry))) {
            countryFilter.value = selectedCountry;
        } else if (selectedCountry === '' || selectedCountry === NINGUN_PAIS) {
            countryFilter.value = selectedCountry;
        } else {
            // El país seleccionado desapareció de la lista: volvemos al valor por defecto.
            countryFilter.value = NINGUN_PAIS;
        }
    }

    function applyCountryFilter() {
        const selectedCountry = countryFilter.value;
        const normalizedCountry = normalizeCountry(selectedCountry);
        const esNingunPais = selectedCountry === NINGUN_PAIS;

        document.querySelectorAll('#modulos-container [data-pais-modulo]').forEach(card => {
            const selected = card.querySelector('input[type="radio"]:checked')
                || card.querySelector('[data-action="decrement"]:not(:disabled)');
            // "Ningún país" oculta todos los módulos de país (quedan los base).
            // Una selección concreta oculta los de otros países.
            const matchesFilter = esNingunPais
                ? false
                : !selectedCountry || normalizeCountry(card.dataset.paisModulo) === normalizedCountry;
            card.hidden = (!matchesFilter) && !selected;
        });
        document.querySelectorAll('#regimientos-container option[data-pais-modulo]').forEach(option => {
            const matchesFilter = esNingunPais
                ? false
                : !selectedCountry || normalizeCountry(option.dataset.paisModulo) === normalizedCountry;
            option.hidden = (!matchesFilter) && !option.selected;
        });
    }

    // Estado por defecto: ningún módulo de país visible.
    countryFilter.value = NINGUN_PAIS;
    applyCountryFilter();

    countryFilter.addEventListener('change', applyCountryFilter);
    const observer = new MutationObserver(() => {
        updateCountryOptions();
        applyCountryFilter();
    });
    [modulesContainer, divisionContainer].filter(Boolean).forEach(container => {
        observer.observe(container, { childList: true, subtree: true });
    });
}
