# Fichamundi - Sistema de Diseño y Cálculo de Naves y Buques

**Fichamundi** es una herramienta web interactiva orientada al diseño, personalización y cálculo de especificaciones técnicas para buques y submarinos. La aplicación permite seleccionar un casco base e integrar múltiples módulos de equipamiento (como armamento, sistemas de propulsión, blindaje, sensores y componentes internos), calculando dinámicamente las estadísticas finales de la nave.



## Propósito del Proyecto

El objetivo principal es proporcionar una interfaz clara y funcional para configurar vehículos navales de manera modular. A través de este sistema se busca:

1. **Automatizar el cálculo de métricas:** Calcular al instante variables fundamentales como el desplazamiento total, consumo energético, peso acumulado, requerimientos de espacio e impacto en las prestaciones de la nave a medida que se agregan o retiran componentes.
2. **Garantizar consistencia en los datos:** Estructurar las especificaciones de cascos y módulos en archivos independientes para evitar la duplicación de atributos y asegurar una gestión precisa de las variantes de equipamiento.
3. **Facilitar la expansión de contenido:** Permitir la incorporación de nuevas estructuras o módulos modificando únicamente los archivos de datos sin necesidad de reescribir la lógica del sistema.



## Arquitectura y Componentes del Sistema

El proyecto está construido sin dependencias externas pesadas, utilizando tecnologías web estándar y un enfoque orientado a datos.

## Estructura de Carpetas

La organización del proyecto está pensada para escalar a múltiples plantillas de vehículos
(naval, aviación, terrestre) reutilizando la misma lógica central.

```
fichamundi/
├── index.html                  # Constructor (entry point raíz - naval)
├── visor.html                  # Visor de fichas (entry point raíz - naval)
├── README.md
├── CAMBIOS.md
├── RESUMEN_CAMBIOS.md
├── css/
│   └── styles.css              # Estilos globales compartidos
├── data/
│   ├── vehiculos/              # Datos por tipo de vehículo
│   │   └── naval/
│   │       ├── cascos.json     # Cascos del constructor naval
│   │       └── modulos.json    # Módulos (propulsión, armamento, blindaje)
│   └── referencias/            # Documentos de referencia
│       └── buques_1910.json
└── js/
    ├── core/
    │   └── config.js           # Configuración central (rutas de datos por vehículo)
    ├── naval/
    │   ├── constructor.js      # Lógica del constructor naval
    │   └── visor.js            # Lógica del visor naval
    └── tests/
        ├── test_json.js
        └── test_modulo_logic.js
```

## Flujo de trabajo para añadir una nueva plantilla de vehículo

Para agregar una nueva plantilla (ej. aviación) sin tocar la lógica existente:

1. **Crear los datos** en `data/vehiculos/aviacion/` (ej. `fuselajes.json`, `modulos.json`).
2. **Registrar el vehículo** en `js/core/config.js` dentro del objeto `VEHICULOS`:

   ```js
   aviacion: {
     nombre: 'Aviación',
     datos: {
       fuselajes: 'data/vehiculos/aviacion/fuselajes.json',
       modulos:   'data/vehiculos/aviacion/modulos.json'
     }
   }
   ```

3. **Crear el constructor/visor** de la nueva plantilla en `js/aviacion/`.
4. Enlazar los scripts en la nueva página HTML con el orden correcto:
   `<script src="js/core/config.js"></script>` **antes** del constructor/visor.

La lógica central de cálculo vive en `js/core/config.js` y los módulos por vehículo,
manteniendo consistencia en las claves de datos (`nombre`, `velocidad`, `coste`, `cantidad`).
