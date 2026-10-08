const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROTORS = [
    "EKMFLGDQVZNTOWYHXUSPAIBRCJ",
    "AJDKSIRUXBLHWTMCQGZNPYFVOE",
    "BDFHJLCPRTXVZNYEIWGAKMUSQO"
];
const REFLECTOR = "EJMZALYXVBWFCRQUONTSPIKHGD";
const ROTOR_SETTINGS = [0, 1, 2];
const DEFAULT_MESSAGE = "fur cano";
const CLUE_TEXT = "FUR CANO";
const CLUE_LENGTH = CLUE_TEXT.length;

let rotorState = [0, 0, 0];

function rotate(rotor, pos) {
    return rotor.slice(pos) + rotor.slice(0, pos);
}

function encryptLetter(letter, rotorSettings, positions) {
    let currentLetter = letter.toUpperCase();

    for (let i = 0; i < 3; i++) {
        const rotor = rotate(ROTORS[rotorSettings[i]], positions[i]);
        const index = ALPHABET.indexOf(currentLetter);
        currentLetter = rotor[index];
    }

    currentLetter = REFLECTOR[ALPHABET.indexOf(currentLetter)];

    for (let i = 2; i >= 0; i--) {
        const rotor = rotate(ROTORS[rotorSettings[i]], positions[i]);
        currentLetter = ALPHABET[rotor.indexOf(currentLetter)];
    }

    return currentLetter;
}

function stepRotors(positions) {
    positions[0] = (positions[0] + 1) % 26;

    if (positions[0] === 0) {
        positions[1] = (positions[1] + 1) % 26;

        if (positions[1] === 0) {
            positions[2] = (positions[2] + 1) % 26;
        }
    }
}

function cleanMessage(message) {
    return (message || '').toUpperCase().replace(/[^A-Z]/g, '');
}

function normalizeTextPreservingSpaces(message) {
    return (message || '').toUpperCase().replace(/[^A-Z\s]/g, '');
}

function processMessage(message, startPositions = [0, 0, 0], withStep = true) {
    const positions = [...startPositions];
    const output = [];
    const text = (message || '').toUpperCase();

    for (const ch of text) {
        if (ch === ' ') {
            output.push({ input: ch, output: ' ', positions: [...positions] });
            continue;
        }

        if (!/[A-Z]/.test(ch)) {
            continue;
        }

        const encrypted = encryptLetter(ch, ROTOR_SETTINGS, positions);
        output.push({ input: ch, output: encrypted, positions: [...positions] });
        if (withStep) {
            stepRotors(positions);
        }
    }

    return {
        output: output.map(item => item.output).join(''),
        letters: output,
        finalPositions: positions
    };
}

function appendClue(cipherText, startPositions) {
    const clueCipher = processMessage(CLUE_TEXT, startPositions, true).output;
    return `${cipherText}${clueCipher}`;
}

function findRotorPositionsFromClue(clueCipher) {
    const expectedClue = CLUE_TEXT;
    const cluePart = clueCipher.slice(-CLUE_LENGTH);

    if (clueCipher.length < CLUE_LENGTH) {
        return null;
    }

    for (let r1 = 0; r1 < 26; r1++) {
        for (let r2 = 0; r2 < 26; r2++) {
            for (let r3 = 0; r3 < 26; r3++) {
                const candidate = [r1, r2, r3];
                const encodedClue = processMessage(expectedClue, candidate, true).output;
                if (encodedClue === cluePart) {
                    return candidate;
                }
            }
        }
    }

    return null;
}

function decryptCipherText(cipherText, startPositions) {
    const text = normalizeTextPreservingSpaces(cipherText);
    if (text.length <= CLUE_LENGTH) {
        return '';
    }

    const bodyCipher = text.slice(0, -CLUE_LENGTH);
    const message = processMessage(bodyCipher, startPositions, true).output;
    return message;
}

function updateRotorDisplays(positions) {
    const rotorNodes = [
        document.getElementById('rotor-1'),
        document.getElementById('rotor-2'),
        document.getElementById('rotor-3')
    ];

    rotorNodes.forEach((node, index) => {
        if (!node) {
            return;
        }

        const value = positions[index] % ALPHABET.length;
        node.textContent = ALPHABET[value];
        node.classList.toggle('active', index === 0);
    });
}

function updateLampboard(activeLetter) {
    const lamps = document.querySelectorAll('.lamp');
    lamps.forEach((lamp) => {
        const isActive = lamp.textContent === activeLetter;
        lamp.classList.toggle('active', isActive);
    });
}

const msgInput = document.getElementById('msg');
const resultContainer = document.getElementById('result');
const encryptButton = document.getElementById('encrypt-btn');
const decryptButton = document.getElementById('decrypt-btn');
const copyButton = document.getElementById('copy-btn');
let lastOutputText = '';

function adjustOutputFontSize(value) {
    const outputEl = resultContainer && resultContainer.querySelector('.result-final');
    if (!outputEl) {
        return;
    }

    const plainText = cleanMessage(value || '');
    if (!plainText) {
        outputEl.style.fontSize = '1rem';
        return;
    }

    const baseSize = plainText.length > 18 ? '0.7rem' : plainText.length > 12 ? '0.9rem' : '1.1rem';
    outputEl.style.fontSize = baseSize;
}

function renderMessage(mode = 'encrypt') {
    if (!msgInput || !resultContainer) {
        return;
    }

    if (mode === 'decrypt') {
        const fullCipher = normalizeTextPreservingSpaces(msgInput.value);
        if (!fullCipher) {
            resultContainer.innerHTML = `
                <div class="output-header">
                    <span class="output-label">Mensaje descifrado:</span>
                    <span class="output-state">Esperando pista</span>
                </div>
                <div class="result-final">—</div>
            `;
            return;
        }

        const clueFound = findRotorPositionsFromClue(fullCipher);
        if (!clueFound) {
            resultContainer.innerHTML = `
                <div class="output-header">
                    <span class="output-label">Mensaje descifrado:</span>
                    <span class="output-state">Pista no válida</span>
                </div>
                <div class="result-final">Pista no válida</div>
            `;
            return;
        }

        const decrypted = decryptCipherText(fullCipher, clueFound);
        const label = 'Mensaje descifrado:';
        resultContainer.innerHTML = `
            <div class="output-header">
                <span class="output-label">${label}</span>
                <span class="output-state">Bombe resuelta</span>
            </div>
            <div class="cipher-sequence">
                ${decrypted.split('').map((char, index) => `
                    <span class="cipher-letter ${index === decrypted.length - 1 ? 'active' : ''}">${char}</span>
                `).join('') || '<span class="cipher-letter">—</span>'}
            </div>
            <div class="result-final">${decrypted || '—'}</div>
        `;

        adjustOutputFontSize(decrypted);
        updateRotorDisplays(clueFound);
        updateLampboard(decrypted.slice(-1) || 'A');
        return;
    }

    const body = normalizeTextPreservingSpaces(msgInput.value);
    const encryptedBody = processMessage(body, rotorState, true).output;
    const clueCipher = processMessage(CLUE_TEXT, rotorState, true).output;
    const cipherText = appendClue(encryptedBody, rotorState);
    const lastLetter = cipherText.slice(-1) || '';

    resultContainer.innerHTML = `
        <div class="output-header">
            <span class="output-label">Mensaje encriptado:</span>
            <span class="output-state">Pista añadida</span>
        </div>
        <div class="cipher-sequence">
            ${cipherText.split('').map((char, index) => `
                <span class="cipher-letter ${index === cipherText.length - 1 ? 'active' : ''}">${char}</span>
            `).join('') || '<span class="cipher-letter">—</span>'}
        </div>
        <div class="result-final">${cipherText}</div>
    `;

    lastOutputText = cipherText;
    adjustOutputFontSize(cipherText);
    rotorState = processMessage(body, rotorState, true).finalPositions;
    updateRotorDisplays(rotorState);
    updateLampboard(lastLetter);
}

async function copyOutputText() {
    if (!resultContainer) {
        return;
    }

    const outputText = resultContainer.querySelector('.result-final')?.textContent?.trim() || lastOutputText || '';
    if (!outputText) {
        return;
    }

    try {
        await navigator.clipboard.writeText(outputText);
        if (copyButton) {
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copiado';
            copyButton.disabled = true;
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.disabled = false;
            }, 1200);
        }
    } catch (error) {
        if (copyButton) {
            copyButton.textContent = 'No se pudo copiar';
            setTimeout(() => {
                copyButton.textContent = 'Copiar texto';
            }, 1200);
        }
    }
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

if (copyButton) {
    copyButton.addEventListener('click', copyOutputText);
}

if (msgInput) {
    msgInput.value = DEFAULT_MESSAGE;
    msgInput.addEventListener('input', function () {
        renderMessage('encrypt');
    });

    msgInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            renderMessage('encrypt');
        }
    });

    renderMessage('encrypt');
}
