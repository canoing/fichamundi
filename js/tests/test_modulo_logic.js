const assert = require('assert');

const {
  calcularModulosUsados,
  asegurarMotorBase,
  obtenerCantidadEnCategoria
} = require('./script.js');

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
