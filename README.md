
activa para crear fichas de armamento de buques para Discord/U-Boat World con cálculo automático de estadísticas y costes.

## Características

- Secciones organizadas:
  - Información General (nombre, tipo, país)
  - Módulos con pestañas desplegables (Propulsión, Armamento)
  - Estadísticas automáticas
  - Descripción del lore

- Cálculo automático:
  - Velocidad total
  - Ataque total
  - Coste total en recursos

- Interfaz intuitiva:
  - Pestañas desplegables para cada categoría de módulos
  - Selección por suma de cantidades por módulo
  - Visualización inmediata de estadísticas

- Exportación:
  - Guarda la ficha completa como JSON

## Cómo usar

1. Abre `index.html` en tu navegador
2. Completa la información general:
   - Nombre del buque o clase
   - Tipo de buque
   - País de origen
3. Selecciona módulos:
   - Usa los botones de suma y resta para cada módulo
   - El casco valida la capacidad máxima disponible
   - El motor base se incluye por defecto sin ocupar slot
4. Agrega descripción del lore (opcional)
5. Guarda la ficha con el botón "Guardar Ficha"
   - Se descargará un archivo JSON con toda la información

## Archivos

- `index.html` - Estructura HTML de la página
- `styles.css` - Estilos y diseño responsivo
- `script.js` - Lógica de módulos, cálculos e interactividad
- `modulos.json` - Base de datos de módulos (referencia)

## Módulos disponibles

### Propulsión (Motores)
- Motor de vapor avanzado (20 vel)
- Motor de diésel I (40 vel)
- Motor de diésel II (60 vel)
- Motor de diésel avanzado (80 vel)

### Armamento
- Cañones pesados (básicos, refinados, avanzados)
- Cañones ligeros
- Torpedos (básico, II)
- Cargas de profundidad

## Cálculos

La aplicación calcula automáticamente:
- Velocidad: suma de velocidades de módulos seleccionados
- Ataque: suma de ataques de módulos seleccionados
- Coste: suma en millones de recursos

## Formato de exportación JSON

```json
{
  "titulo": "SMS Bayern",
  "fecha": "16/08/2026",
  "informacion_general": {
    "nombre": "SMS Bayern",
    "tipo": "Acorazado",
    "pais": "Imperio Alemán"
  },
  "modulos_seleccionados": {
    "Propulsión": {...},
    "Armamento": {...}
  },
  "estadisticas": {
    "velocidad": 40,
    "ataque": 95,
    "coste": "8M"
  },
  "descripcion": "Descripción del lore..."
}
```

## Diseño

- Tema oscuro con colores azul marino (U-boat themed)
- Interfaz responsiva (funciona en móvil y desktop)
- Animaciones suaves y transiciones

## Próximas mejoras posibles

- Cargar/editar fichas guardadas
- Más categorías de módulos (Blindaje, Defensa)
- Validación y restricciones de módulos
- Almacenamiento en localStorage
- Exportar a PDF o imagen

---

**Versión:** Beta 1.0  
**Última actualización:** 16/08/2026
