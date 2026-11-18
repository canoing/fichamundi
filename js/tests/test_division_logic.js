const assert = require('assert');
const catalogo = require('../../data/referencias/divi/unida.json');
global.window = {};
const {
  calcularEstadisticasDivision,
  calcularBonusTecnologico,
  crearFichaDivision,
  extraerArmasDivision,
  MAX_APOYOS_DIVISION
} = require('../divisiones/constructor.js');

const arma = extraerArmasDivision({
  tipo_ficha: 'Rifle de Infantería / Ametralladora (1910)',
  seccion_1_informacion_general: { nombre_del_arma: 'Rifle de prueba' },
  seccion_2_estadisticas_primarias: {
    hp_a_regimiento: 2,
    ataque: 1,
    defensa: 1,
    nivel_tech_tree: 3
  }
})[0];

assert.equal(arma.nombre, 'Rifle de prueba');
assert.equal(arma.hp_a_regimiento, 2);
assert.equal(arma.nivel_tech_tree, 3);

const armaConBuffs = extraerArmasDivision({
  tipo_ficha: 'Arma de ejemplo',
  nombre: 'Cañón de prueba',
  buffs: { atk: 4, def: 2 }
})[0];
assert.equal(armaConBuffs.ataque, 4);
assert.equal(armaConBuffs.defensa, 2);

const regimientos = [
  { tipo_regimiento: 'infanteria', arma_equipada: arma },
  { tipo_regimiento: 'motorizada', arma_equipada: null }
];
const apoyos = [
  { tipo_apoyo: 'reconocimiento' },
  { tipo_apoyo: 'logistica', reduccion_sup: 2 }
];
const estadisticas = calcularEstadisticasDivision(regimientos, apoyos, catalogo);

assert.deepEqual(
  { HP: estadisticas.HP, ATK: estadisticas.ATK, DEF: estadisticas.DEF, MOV: estadisticas.MOV, SUP: estadisticas.SUP },
  { HP: 24, ATK: 4, DEF: 5, MOV: 3, SUP: 3 }
);

const artilleria = calcularEstadisticasDivision([
  { tipo_regimiento: 'artilleria', arma_equipada: null, sup_arma: 3 }
], [], catalogo);
assert.equal(artilleria.MOV, 0);
assert.equal(artilleria.SUP, 3);
assert.equal(artilleria.ATK, 5);
assert.equal(artilleria.DEF, 1);

const ficha = crearFichaDivision(
  { nombre_unidad: 'División de prueba', pais_operador: 'Boreostia', tipo_unidad: 'Mixta' },
  regimientos,
  apoyos,
  catalogo
);
assert.equal(ficha.ficha_unidad.regimientos_principales.length, 2);
assert.equal(ficha.ficha_unidad.batallones_apoyo.length, 2);
assert.equal(ficha.estadisticas_acumuladas.MOV, 3);

const armaConPrecio = { ...arma, precio: 2.5 };
const estadisticasConPrecio = calcularEstadisticasDivision([
  { tipo_regimiento: 'infanteria', arma_equipada: armaConPrecio },
  { tipo_regimiento: 'infanteria', arma_equipada: armaConPrecio }
], [], catalogo);
assert.equal(estadisticasConPrecio.coste, 5);

const fichaConPrecio = crearFichaDivision(
  { nombre_unidad: 'División con armas', pais_operador: 'Boreostia', tipo_unidad: 'Infantería' },
  [
    { tipo_regimiento: 'infanteria', arma_equipada: armaConPrecio },
    { tipo_regimiento: 'infanteria', arma_equipada: armaConPrecio }
  ],
  [],
  catalogo
);
assert.equal(fichaConPrecio.estadisticas_acumuladas.coste, 5);

window.establecerVehiculosDivisionAprobados([{
  id: 'vehiculo-prueba',
  country: 'Boreostia',
  file_name: 'vehiculo-prueba.json',
  content: {
    titulo: 'Vehículo de prueba',
    componentes_seleccionados: { chasis: { nombre: 'Chasis de prueba' } },
    estadisticas: { hp: 20, ataque: 5, defensa: 4, velocidad: 7, coste: 3 }
  }
}]);
const motorizadaConVehiculo = calcularEstadisticasDivision([
  {
    tipo_regimiento: 'motorizada',
    vehiculo_id: 'vehiculo-prueba',
    arma_equipada: { hp_a_regimiento: 2, ataque: 1, defensa: 1, precio: 0.5 }
  }
], [], catalogo);
assert.deepEqual(
  {
    HP: motorizadaConVehiculo.HP,
    ATK: motorizadaConVehiculo.ATK,
    DEF: motorizadaConVehiculo.DEF,
    MOV: motorizadaConVehiculo.MOV,
    SUP: motorizadaConVehiculo.SUP,
    coste: motorizadaConVehiculo.coste
  },
  { HP: 34, ATK: 8, DEF: 7, MOV: 7, SUP: 3, coste: 3.5 }
);
const fichaMotorizadaConVehiculo = crearFichaDivision(
  { nombre_unidad: 'Infantería motorizada', pais_operador: 'Boreostia', tipo_unidad: 'Motorizada' },
  [{
    tipo_regimiento: 'motorizada',
    vehiculo_id: 'vehiculo-prueba',
    arma_equipada: { nombre: 'Fusil de prueba', precio: 0.5 }
  }],
  [],
  catalogo
);
assert.equal(
  fichaMotorizadaConVehiculo.ficha_unidad.regimientos_principales[0].vehiculo.plantilla_id,
  'vehiculo-prueba'
);
assert.equal(
  fichaMotorizadaConVehiculo.ficha_unidad.regimientos_principales[0].arma_equipada.nombre,
  'Fusil de prueba'
);

assert.equal(MAX_APOYOS_DIVISION, 4);
assert.deepEqual([0, 1, 2, 3].map(calcularBonusTecnologico), [0, 20, 40, 80]);

const granadero = calcularEstadisticasDivision([
  {
    tipo_regimiento: 'granaderos',
    arma_equipada: {
      tipo_ficha: 'Fusil de infantería',
      nombre: 'Fusil de prueba',
      hp_a_regimiento: 2,
      ataque: 1,
      defensa: 1
    }
  }
], [], catalogo);
assert.equal(granadero.HP, 2);
assert.equal(granadero.ATK, 7);
assert.equal(granadero.DEF, 3);
assert(granadero.habilidades_especiales.includes('+5 ATK contra unidades (Regimiento de Granaderos)'));
const granaderoSinFusil = calcularEstadisticasDivision([
  {
    tipo_regimiento: 'granaderos',
    arma_equipada: { tipo_ficha: 'Escopeta', nombre: 'Escopeta de prueba', hp_a_regimiento: 8, ataque: 20, defensa: 10 }
  }
], [], catalogo);
assert.equal(granaderoSinFusil.HP, 5);
assert.equal(granaderoSinFusil.ATK, 6);
assert.equal(granaderoSinFusil.DEF, 2);

const apoyoTecnologico = calcularEstadisticasDivision([
  { tipo_regimiento: 'infanteria' }
], [
  { tipo_apoyo: 'hospital_campana', nivel_medicina_manual: 3 },
  { tipo_apoyo: 'mantenimiento', nivel_ingenieria_manual: 2 }
], catalogo);
assert.equal(apoyoTecnologico.HP, 170);

const apoyosGranGuerra = calcularEstadisticasDivision([
  { tipo_regimiento: 'infanteria' }
], [
  { tipo_apoyo: 'escopeteros' },
  { tipo_apoyo: 'tropas_de_asalto' },
  { tipo_apoyo: 'tropas_lanzallamas_combate' },
  { tipo_apoyo: 'guerra_quimica' }
], catalogo);
assert.equal(apoyosGranGuerra.ATK, 30);
assert.equal(apoyosGranGuerra.HP, 13);
assert.equal(apoyosGranGuerra.DEF, 3);
assert.equal(apoyosGranGuerra.MOV, 2);
assert.equal(apoyosGranGuerra.SUP, 17);
assert(apoyosGranGuerra.habilidades_especiales.includes('+12 ATK en trincheras (Batallón de Apoyo de Escopeteros)'));
assert(apoyosGranGuerra.habilidades_especiales.includes('30 ATK contra fortificaciones con escopeta, subfusil, fusil de asalto (Batallón de Tropas de Asalto (Choque))'));
assert(apoyosGranGuerra.habilidades_especiales.includes('Ignora todas las fortificaciones (Batallón de Guerra Química)'));
assert(apoyosGranGuerra.habilidades_especiales.includes('Reduce la DEF enemiga 1/6 por 4 turnos (CD de 4 turnos)'));

const apoyoLanzallamasTrincheras = calcularEstadisticasDivision([
  { tipo_regimiento: 'infanteria' }
], [{ tipo_apoyo: 'lanzallamas_apoyo' }], catalogo);
assert.equal(apoyoLanzallamasTrincheras.ATK, 1);
assert(apoyoLanzallamasTrincheras.habilidades_especiales.includes('+14 ATK en trincheras (Batallón de Apoyo Lanzallamas)'));

const penalizacionTropasAsalto = calcularEstadisticasDivision([
  {
    tipo_regimiento: 'infanteria',
    arma_equipada: { nombre: 'Fusil de prueba', tipo_ficha: 'Fusil', ataque: 1, defensa: 1 }
  }
], [{ tipo_apoyo: 'tropas_de_asalto' }], catalogo);
assert.equal(penalizacionTropasAsalto.ATK, 1);
assert.equal(penalizacionTropasAsalto.DEF, 2);

console.log('Pruebas de lógica de divisiones OK');