const assert = require('assert');
const catalogo = require('../../data/referencias/divi/unida.json');
const {
  calcularEstadisticasDivision,
  crearFichaDivision,
  extraerArmasDivision
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

console.log('Pruebas de lógica de divisiones OK');