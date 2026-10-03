const menuToggle = document.getElementById('menu-toggle');
const navMenu = document.getElementById('nav-menu');
const searchInput = document.getElementById('buscar-pais');
const statusMessage = document.getElementById('estado-wiki');
const countryIndex = document.getElementById('indice-paises');
const countryArticles = document.getElementById('articulos-paises');

if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('abierto');
        menuToggle.classList.toggle('open', isOpen);
        menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('abierto');
            menuToggle.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
        });
    });
}

function createElement(tagName, text) {
    const element = document.createElement(tagName);
    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }
    return element;
}

function renderValue(value) {
    if (Array.isArray(value)) {
        const list = createElement('ul');
        value.forEach(item => {
            const listItem = createElement('li');
            listItem.append(renderValue(item));
            list.append(listItem);
        });
        return list;
    }

    if (value && typeof value === 'object') {
        const definitions = createElement('dl');
        Object.entries(value).forEach(([label, detail]) => {
            definitions.append(createElement('dt', label));
            const description = createElement('dd');
            description.append(renderValue(detail));
            definitions.append(description);
        });
        return definitions;
    }

    return createElement('span', value === null ? 'Sin datos' : value);
}

function getCountryNames(country) {
    const names = country['Nombre oficial y común'];
    if (names && typeof names === 'object') {
        return {
            official: names['Nombre oficial'] || 'País sin nombre oficial',
            common: names['Nombre común'] || names['Nombre oficial'] || 'País sin nombre'
        };
    }
    return { official: String(names || 'País sin nombre'), common: String(names || 'País sin nombre') };
}

function normalizeText(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

function renderCountry(country, index) {
    const names = getCountryNames(country);
    const articleId = `pais-${index}`;
    const link = createElement('a');
    link.className = 'inicio-tarjeta';
    link.href = `#${articleId}`;
    link.dataset.searchText = normalizeText(JSON.stringify(country));
    link.append(createElement('h3', names.common));
    link.append(createElement('p', names.official));
    countryIndex.append(link);

    const article = createElement('article');
    article.className = 'seccion';
    article.id = articleId;
    article.dataset.searchText = normalizeText(JSON.stringify(country));
    article.append(createElement('h2', names.common));

    const officialName = createElement('p');
    officialName.append(createElement('strong', 'Nombre oficial: '));
    officialName.append(document.createTextNode(names.official));
    article.append(officialName);

    Object.entries(country).forEach(([label, value]) => {
        if (label === 'Nombre oficial y común') return;
        const section = createElement('section');
        section.append(createElement('h3', label));
        section.append(renderValue(value));
        article.append(section);
    });

    countryArticles.append(article);
}

function filterCountries() {
    const query = normalizeText(searchInput.value.trim());
    document.querySelectorAll('[data-search-text]').forEach(element => {
        const matches = element.dataset.searchText.includes(query);
        element.hidden = !matches;
        element.style.display = matches ? '' : 'none';
    });
}

searchInput.addEventListener('input', filterCountries);

fetch('../data/referencias/wiki.json')
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(countries => {
        if (!Array.isArray(countries)) throw new Error('El archivo debe contener una lista de países.');
        countries.forEach(renderCountry);
        statusMessage.textContent = `${countries.length} países en la wiki.`;
        filterCountries();
    })
    .catch(error => {
        statusMessage.textContent = 'No se pudieron cargar los países. Comprueba el archivo wiki.json y abre el sitio desde un servidor web.';
        console.error('Error al cargar la wiki:', error);
    });