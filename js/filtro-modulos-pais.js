const countryFilter = document.getElementById('filtro-pais-modulos-creador');
const modulesContainer = document.getElementById('modulos-container');
const divisionContainer = document.getElementById('regimientos-container');

if (countryFilter) {
    function normalizeCountry(country) {
        return String(country || '').trim().toLocaleLowerCase('es');
    }

    function updateCountryOptions() {
        const selectedCountry = countryFilter.value;
        const countries = [...new Set([
            ...document.querySelectorAll('#modulos-container [data-pais-modulo]'),
            ...document.querySelectorAll('#regimientos-container option[data-pais-modulo]')
        ].map(element => element.dataset.paisModulo).filter(Boolean))]
            .sort((left, right) => left.localeCompare(right, 'es'));

        countryFilter.replaceChildren(new Option('Todos los países', ''));
        countries.forEach(country => countryFilter.add(new Option(country, country)));
        if (countries.some(country => normalizeCountry(country) === normalizeCountry(selectedCountry))) {
            countryFilter.value = selectedCountry;
        }
    }

    function applyCountryFilter() {
        const selectedCountry = normalizeCountry(countryFilter.value);
        document.querySelectorAll('#modulos-container [data-pais-modulo]').forEach(card => {
            const selected = card.querySelector('input[type="radio"]:checked')
                || card.querySelector('[data-action="decrement"]:not(:disabled)');
            card.hidden = Boolean(selectedCountry)
                && normalizeCountry(card.dataset.paisModulo) !== selectedCountry
                && !selected;
        });
        document.querySelectorAll('#regimientos-container option[data-pais-modulo]').forEach(option => {
            option.hidden = Boolean(selectedCountry)
                && normalizeCountry(option.dataset.paisModulo) !== selectedCountry
                && !option.selected;
        });
    }

    countryFilter.addEventListener('change', applyCountryFilter);
    const observer = new MutationObserver(() => {
        updateCountryOptions();
        applyCountryFilter();
    });
    [modulesContainer, divisionContainer].filter(Boolean).forEach(container => {
        observer.observe(container, { childList: true, subtree: true });
    });
}
