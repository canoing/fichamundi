/**
 * CONFIGURACIÓN CENTRAL - Fichamundi
 * Centraliza las rutas de datos por tipo de vehículo.
 *
 * El objetivo es que agregar una nueva plantilla de vehículo (aviación,
 * terrestre, etc.) solo requiera añadir una nueva entrada aquí, sin tocar
 * la lógica central del constructor/visor.
 *
 * Uso:
 *   const config = obtenerConfigVehiculo('naval');
 *   // config.rutas.cascos => 'data/vehiculos/naval/cascos.json'
 */
(function (global) {
  'use strict';

  /**
   * Registro central de vehículos.
   * Cada entrada define:
   *  - nombre:  nombre legible de la plantilla
   *  - datos:   rutas a los archivos JSON de datos del vehículo
   */
  const VEHICULOS = {
    naval: {
      nombre: 'Naval',
      datos: {
        cascos: 'data/vehiculos/naval/modulos.json',
        modulos: 'data/vehiculos/naval/modulos.json'
      }
    }
    // Ejemplo futuro (aviación):
    // aviacion: {
    //   nombre: 'Aviación',
    //   datos: {
    //     fuselajes: 'data/vehiculos/aviacion/fuselajes.json',
    //     modulos: 'data/vehiculos/aviacion/modulos.json'
    //   }
    // }
  };

  /**
   * Devuelve la configuración de un vehículo, o null si no existe.
   * @param {string} tipo - Clave del vehículo (ej: 'naval').
   * @returns {object|null}
   */
  function obtenerConfigVehiculo(tipo) {
    return VEHICULOS[tipo] || null;
  }

  /**
   * Devuelve las rutas de datos de un vehículo.
   * @param {string} tipo
   * @returns {object|null}
   */
  function obtenerRutasVehiculo(tipo) {
    const cfg = obtenerConfigVehiculo(tipo);
    return cfg ? cfg.datos : null;
  }

  // API pública
  const api = {
    VEHICULOS,
    obtenerConfigVehiculo,
    obtenerRutasVehiculo
  };

  // Exposición para navegador y Node (tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.Fichamundi = global.Fichamundi || {};
  global.Fichamundi.config = api;
})(typeof window !== 'undefined' ? window : globalThis);
