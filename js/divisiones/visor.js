document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fichaDisplay = document.getElementById('ficha-display');
    const errorCarga = document.getElementById('error-carga');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', evento => {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', evento => {
        const archivo = evento.target.files[0];
        if (archivo) leerArchivo(archivo);
    });

    dropZone.addEventListener('dragover', evento => {
        evento.preventDefault();
        dropZone.style.background = '#e6f2ff';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '#f0f7ff';
    });

    dropZone.addEventListener('drop', evento => {
        evento.preventDefault();
        dropZone.style.background = '#f0f7ff';
        const archivo = evento.dataTransfer.files[0];
        if (archivo) leerArchivo(archivo);
    });

    document.getElementById('btn-otra-ficha').addEventListener('click', () => {
        fichaDisplay.classList.remove('active');
        dropZone.style.display = '';
        fileInput.value = '';
        errorCarga.hidden = true;
        errorCarga.style.display = 'none';
    });

    function leerArchivo(archivo) {
        archivo.text().then(contenido => {
            mostrarFicha(JSON.parse(contenido));
        }).catch(error => {
            mostrarError(`No se pudo leer la ficha: ${error.message}`);
        });
    }

    function mostrarError(mensaje) {
        errorCarga.textContent = mensaje;
        errorCarga.hidden = false;
        errorCarga.style.display = 'flex';
    }

    function establecerTexto(id, valor, predeterminado = '-') {
        const elemento = document.getElementById(id);
        elemento.textContent = valor === undefined || valor === null || valor === '' ? predeterminado : String(valor);
    }

    function crearDetalle(etiqueta, valor) {
        const detalle = document.createElement('small');
        detalle.textContent = `${etiqueta}: ${valor}`;
        return detalle;
    }

    function agregarElemento(lista, titulo, detalles = []) {
        const elemento = document.createElement('li');
        elemento.className = 'modulo-item-compacto';
        const nombre = document.createElement('span');
        nombre.textContent = titulo;
        elemento.appendChild(nombre);
        detalles.filter(detalle => detalle !== null && detalle !== undefined && detalle !== '')
            .forEach(detalle => elemento.appendChild(crearDetalle(detalle.etiqueta, detalle.valor)));
        lista.appendChild(elemento);
    }

    function validarFicha(ficha) {
        if (!ficha || typeof ficha !== 'object' || Array.isArray(ficha)) {
            throw new Error('El archivo debe contener un objeto JSON de división.');
        }
        const unidad = ficha.ficha_unidad;
        const stats = ficha.estadisticas_acumuladas;
        if (!unidad || typeof unidad !== 'object' || !unidad.informacion_general || !stats || typeof stats !== 'object') {
            throw new Error('El JSON no tiene el formato de ficha de división esperado.');
        }
        if (!Array.isArray(unidad.regimientos_principales) || !Array.isArray(unidad.batallones_apoyo)) {
            throw new Error('Faltan las listas de regimientos o batallones de apoyo.');
        }
        return ficha;
    }

    function mostrarFicha(datos) {
        try {
            const ficha = validarFicha(datos);
            const unidad = ficha.ficha_unidad;
            const info = unidad.informacion_general;
            const stats = ficha.estadisticas_acumuladas;

            establecerTexto('v-nombre', info.nombre_unidad || ficha.titulo, 'Unidad sin nombre');
            establecerTexto('v-tipo', info.tipo_unidad);
            establecerTexto('v-pais', info.pais_operador);
            establecerTexto('v-version', ficha.version);
            establecerTexto('v-cantidad-regimientos', unidad.regimientos_principales.length, '0');
            establecerTexto('v-cantidad-apoyos', unidad.batallones_apoyo.length, '0');
            establecerTexto('v-hp', stats.HP ?? stats.hp, '0');
            establecerTexto('v-atk', stats.ATK ?? stats.ataque, '0');
            establecerTexto('v-def', stats.DEF ?? stats.defensa, '0');
            establecerTexto('v-mov', stats.MOV ?? stats.movimiento, '0');
            establecerTexto('v-sup', stats.SUP ?? stats.suministros, '0');

            const habilidades = document.getElementById('v-habilidades');
            habilidades.replaceChildren();
            const listaHabilidades = Array.isArray(stats.habilidades_especiales) ? stats.habilidades_especiales : [];
            if (!listaHabilidades.length) {
                const habilidad = document.createElement('li');
                habilidad.textContent = 'Sin habilidades especiales';
                habilidades.appendChild(habilidad);
            } else {
                listaHabilidades.forEach(texto => {
                    const habilidad = document.createElement('li');
                    habilidad.textContent = String(texto);
                    habilidades.appendChild(habilidad);
                });
            }

            const listaRegimientos = document.getElementById('v-lista-regimientos');
            listaRegimientos.replaceChildren();
            unidad.regimientos_principales.forEach((regimiento, indice) => {
                const arma = regimiento.arma_equipada;
                const detalles = [
                    { etiqueta: 'Slot', valor: regimiento.slot || indice + 1 },
                    arma ? { etiqueta: 'Arma', valor: arma.nombre || arma.nombre_del_arma || 'Arma sin nombre' } : null,
                    arma && (arma.ataque || arma.defensa || arma.hp_a_regimiento)
                        ? { etiqueta: 'Aporte del arma', valor: `HP ${arma.hp_a_regimiento || 0} · ATK ${arma.ataque || 0} · DEF ${arma.defensa || 0}` }
                        : null,
                    regimiento.mov_arma !== undefined ? { etiqueta: 'MOV propio', valor: regimiento.mov_arma } : null,
                    regimiento.sup_arma !== undefined ? { etiqueta: 'SUP del arma', valor: regimiento.sup_arma } : null
                ];
                agregarElemento(listaRegimientos, regimiento.tipo_regimiento || 'Regimiento sin tipo', detalles);
            });

            const listaApoyos = document.getElementById('v-lista-apoyos');
            listaApoyos.replaceChildren();
            unidad.batallones_apoyo.forEach((apoyo, indice) => {
                const detalles = [
                    { etiqueta: 'Slot', valor: apoyo.slot || indice + 1 },
                    apoyo.reduccion_sup_tecnologica !== undefined
                        ? { etiqueta: 'Reducción SUP tecnológica', valor: apoyo.reduccion_sup_tecnologica }
                        : null,
                    apoyo.hp_bonus_tecnologico !== undefined
                        ? { etiqueta: 'HP tecnológico', valor: apoyo.hp_bonus_tecnologico }
                        : null,
                    apoyo.arma_o_equipo_asignado
                        ? { etiqueta: 'Equipo', valor: typeof apoyo.arma_o_equipo_asignado === 'string'
                            ? apoyo.arma_o_equipo_asignado
                            : apoyo.arma_o_equipo_asignado.nombre || 'Equipo asignado' }
                        : null
                ];
                agregarElemento(listaApoyos, apoyo.tipo_apoyo || 'Apoyo sin tipo', detalles);
            });

            errorCarga.hidden = true;
            errorCarga.style.display = 'none';
            dropZone.style.display = 'none';
            fichaDisplay.classList.add('active');
        } catch (error) {
            mostrarError(error.message);
        }
    }
});