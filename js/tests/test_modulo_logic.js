const assert = require('assert');

const {
  calcularModulosUsados,
  asegurarMotorBase,
  obtenerCantidadEnCategoria,
  calcularDefensaPLTotal,
  calcularAtaquePLTotal,
  obtenerVelocidadBlindaje
} = require('../naval/constructor.js');

const seleccionados = {
  casco: { capacidad_modulos: 4 },
  propulsion: [{ nombre: 'Motor de diésel I', cantidad: 2 }],
  armamento: [
    { nombre: 'Cañón ligero básico', cantidad: 2 }
  ],
  blindaje: [{ nombre: 'Blindaje Remachado', cantidad: 1 }]
};

assert.equal(calcularModulosUsados(seleccionados), 1 + 2 + 1);
assert.equal(obtenerCantidadEnCategoria(seleccionados, 'armamento', 'Cañón ligero básico'), 2);
const cascoSubmarino = {
  casco: { nombre: 'Casco submarino inicial', defensa_p_l: '5(P) 5(L)' },
  propulsion: [],
  armamento: [],
  blindaje: []
};
assert.equal(calcularDefensaPLTotal(cascoSubmarino), '5(P)');
assert.equal(calcularModulosUsados(cascoSubmarino), 0);
assert.equal(calcularDefensaPLTotal({ ...cascoSubmarino, tipo_defensa: 'L' }), '5(L)');

const cascoConBlindaje = {
  casco: { nombre: 'Casco submarino inicial', defensa_p_l: '5(P) 5(L)' },
  tipo_defensa: 'P',
  propulsion: [],
  armamento: [],
  blindaje: [{
    nombre: 'Blindaje',
    defensa_p_l: '40(P) 20(L)',
    velocidad: '-25(p) -10(l)',
    cantidad: 1
  }]
};
assert.equal(calcularDefensaPLTotal(cascoConBlindaje), '45(P)');
assert.equal(obtenerVelocidadBlindaje(cascoConBlindaje.blindaje[0].velocidad, 'P'), -25);
assert.equal(calcularDefensaPLTotal({ ...cascoConBlindaje, tipo_defensa: 'L' }), '25(L)');
assert.equal(obtenerVelocidadBlindaje(cascoConBlindaje.blindaje[0].velocidad, 'L'), -10);
assert.equal(obtenerVelocidadBlindaje(-5, 'L'), -5);

const ataquePL = {
  casco: null,
  tipo_defensa: 'P',
  propulsion: [],
  armamento: [{ nombre: 'Torpedo', ataque_p_l: '30(P) 10(L)', cantidad: 1 }],
  blindaje: []
};
assert.equal(calcularAtaquePLTotal(ataquePL), '30(P) 10(L)');
assert.equal(calcularAtaquePLTotal({ ...ataquePL, tipo_defensa: 'L' }), '30(P) 10(L)');

const sinMotor = {
  casco: { capacidad_modulos: 3 },
  propulsion: [],
  armamento: [],
  blindaje: []
};

const conMotor = asegurarMotorBase(sinMotor, [{ nombre: 'Motor de diésel II', velocidad: 60, coste: '2M' }]);
assert.equal(conMotor.propulsion[0].nombre, 'Motor de diésel II');
assert.equal(conMotor.propulsion[0].cantidad, 1);

console.log('Pruebas de lógica de módulos OK');
