const formPlantilla = document.getElementById('creador-plantilla');

if (formPlantilla) {
    formPlantilla.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!formPlantilla.reportValidity()) return;

        const valores = new FormData(formPlantilla);
        const numero = (campo) => Number(valores.get(campo));
        const nombre = valores.get('nombre').trim();
        let plantilla;
        let prefijo;

        if (formPlantilla.dataset.tipo === 'chasis') {
            plantilla = [{
                Nombre: nombre,
                'Tipo de blindaje': valores.get('blindaje'),
                'Capacidad de piezas': numero('capacidad'),
                Peso: numero('peso'),
                HP: numero('hp'),
                'Costo de producción': numero('coste')
            }];
            prefijo = 'chasis';
        } else {
            plantilla = [{
                Nombre: nombre,
                Ataque: numero('ataque'),
                Peso: numero('peso'),
                'Coste de producción': numero('coste')
            }];
            prefijo = 'armamento';
        }

        const blob = new Blob([JSON.stringify(plantilla, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        const nombreArchivo = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
        enlace.href = url;
        enlace.download = `${prefijo}-${nombreArchivo || 'personalizado'}.json`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);

        const aviso = document.getElementById('aviso-creador');
        aviso.textContent = 'Archivo JSON creado. Ya puedes importarlo en el constructor de tanques.';
        aviso.style.display = 'block';
    });

    formPlantilla.addEventListener('reset', () => {
        const aviso = document.getElementById('aviso-creador');
        aviso.textContent = '';
        aviso.style.display = 'none';
    });
}