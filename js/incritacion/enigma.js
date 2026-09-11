const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ROTORS = [
    "EKMFLGDQVZNTOWYHXUSPAIBRCJ", // Rotor I
    "AJDKSIRUXBLHWTMCQGZNPYFVOE", // Rotor II
    "BDFHJLCPRTXVZNYEIWGAKMUSQO" // Rotor III
];
const REFLECTOR = "EJMZALYXVBWFCRQUONTSPIKHGD";

function rotate(rotor, pos) {
    return rotor.slice(pos) + rotor.slice(0, pos);
}

function encryptLetter(letter, rotorSettings, positions) {
    let currentLetter = letter;

    for (let i = 0; i < 3; i++) {
        const rotor = rotate(ROTORS[rotorSettings[i]], positions[i]);
        currentLetter = rotor[ALPHABET.indexOf(currentLetter)];
    }

    currentLetter = REFLECTOR[ALPHABET.indexOf(currentLetter)];

    for (let i = 2; i >= 0; i--) {
        const rotor = rotate(ROTORS[rotorSettings[i]], positions[i]);
        currentLetter = ALPHABET[rotor.indexOf(currentLetter)];
    }

    return currentLetter;
}

function stepRotors(positions) {
    positions[0]++;
    if (positions[0] === 26) {
        positions[0] = 0;
        positions[1]++;
        if (positions[1] === 26) {
            positions[1] = 0;
            positions[2] = (positions[2] + 1) % 26;
        }
    }
}

function encryptMessage(message, rotorSettings = [0, 1, 2], startPositions = [0, 0, 0]) {
    let result = '';
    const positions = [...startPositions];
    const cleanMsg = message.toUpperCase().replace(/[^A-Z]/g, '');

    for (let ch of cleanMsg) {
        result += encryptLetter(ch, rotorSettings, positions);
        stepRotors(positions);
    }

    return result;
}

const msgInput = document.getElementById('msg');
const resultContainer = document.getElementById('result');
const encryptButton = document.getElementById('encrypt-btn');
const decryptButton = document.getElementById('decrypt-btn');

function renderMessage(mode) {
    if (!msgInput || !resultContainer) {
        return;
    }

    const transformed = encryptMessage(msgInput.value);
    const label = mode === 'decrypt' ? 'Mensaje descifrado:' : 'Mensaje encriptado:';

    resultContainer.innerHTML = `
        <li class="modulo-item-compacto">
            <span><strong>${label}</strong> ${transformed}</span>
        </li>
    `;
}

if (encryptButton) {
    encryptButton.addEventListener('click', function () {
        renderMessage('encrypt');
    });
}

if (decryptButton) {
    decryptButton.addEventListener('click', function () {
        renderMessage('decrypt');
    });
}

if (msgInput) {
    msgInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            renderMessage('encrypt');
        }
    });
}
