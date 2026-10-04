const formularioArma = document.getElementById('formulario-arma');

formularioArma.addEventListener('submit', evento => {
    evento.preventDefault();
    if (!formularioArma.reportValidity()) return;

    const datos = new FormData(formularioArma);
    const nombre = String(datos.get('nombre_del_arma')).trim();
    const numero = campo => Number(datos.get(campo));
    const arma = {
        tipo_ficha: 'Rifle de Infantería / Ametralladora (1910)',
        seccion_1_informacion_general: {
            nombre_del_arma: nombre
        },
        seccion_2_estadisticas_primarias: {
            hp_a_regimiento: numero('hp_a_regimiento'),
            ataque: numero('ataque'),
            defensa: numero('defensa'),
            nivel_tech_tree: numero('nivel_tech_tree')
        }
    };

    const contenido = new Blob([JSON.stringify(arma, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(contenido);
    const enlace = document.createElement('a');
    const nombreArchivo = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    enlace.href = url;
    enlace.download = `arma-${nombreArchivo || 'personalizada'}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    const aviso = document.getElementById('aviso-creador');
    aviso.textContent = 'JSON creado. Regresa a divisiones e importa el archivo descargado.';
    aviso.hidden = false;
    aviso.style.display = 'flex';
});

formularioArma.addEventListener('reset', () => {
    const aviso = document.getElementById('aviso-creador');
    aviso.textContent = '';
    aviso.hidden = true;
    aviso.style.display = 'none';
});