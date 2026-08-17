// Test que el JSON se carga correctamente
fetch('creacion_de_buques_1910.json')
    .then(r => r.json())
    .then(data => {
        console.log('✅ JSON cargado');
        console.log('Propulsión:', data.modulos_y_tecnologias.propulsion?.length, 'items');
        console.log('Armamento:', data.modulos_y_tecnologias.armamento?.length, 'items');
        console.log('Blindaje:', data.modulos_y_tecnologias.blindaje?.length, 'items');
        console.log('Cascos:', Object.keys(data.modulos_y_tecnologias.cascos || {}).length, 'tipos');
    })
    .catch(e => console.error(' Error:', e));
