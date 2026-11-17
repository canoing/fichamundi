let researchNamesPromise;

export function loadResearchNames() {
    if (!researchNamesPromise) {
        researchNamesPromise = fetch('../data/investigacion/tree.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`No se pudo cargar tree.json (HTTP ${response.status}).`);
                }
                return response.json();
            })
            .then(treeData => {
                const names = new Map();
                const trees = treeData?.arboles_tecnologicos_CM;
                if (!trees || typeof trees !== 'object') {
                    throw new Error('tree.json no contiene arboles_tecnologicos_CM.');
                }
                const escapePathPart = value => value.replaceAll('~', '~0').replaceAll('/', '~1');

                function visit(value, treeKey, path = []) {
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => visit(item, treeKey, [...path, String(index)]));
                        return;
                    }
                    if (!value || typeof value !== 'object') return;
                    if (typeof value.nombre === 'string') {
                        names.set([treeKey, ...path].map(escapePathPart).join('/'), value.nombre);
                    }
                    Object.entries(value).forEach(([key, child]) => visit(child, treeKey, [...path, key]));
                }

                Object.entries(trees).forEach(([treeKey, branch]) => visit(branch, treeKey));

                const infantryTree = treeData?.arbol_infanteria_1910_1920;
                if (infantryTree && typeof infantryTree === 'object') {
                    visit(infantryTree, 'arbol_infanteria_1910_1920');
                }
                return names;
            })
            .catch(error => {
                researchNamesPromise = null;
                throw error;
            });
    }
    return researchNamesPromise;
}
