const textBox = document.getElementById('text-input');
const speakButton = document.getElementById('speak-button');
const stopButton = document.getElementById('stop-button');
const clearButton = document.getElementById('clear-button');
const voiceSelect = document.getElementById('voice-select');
const rateControl = document.getElementById('rate-control');
const pitchControl = document.getElementById('pitch-control');
const volumeControl = document.getElementById('volume-control');
const rateValue = document.getElementById('rate-value');
const pitchValue = document.getElementById('pitch-value');
const volumeValue = document.getElementById('volume-value');
const pauseButton = document.getElementById('pause-button');
const resumeButton = document.getElementById('resume-button');
const characterCount = document.getElementById('character-count');
const documentInput = document.getElementById('document-input');
const importStatus = document.getElementById('import-status');
const importError = document.getElementById('import-error');

let availableVoices = [];

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function populateVoiceList() {
    const selectedVoiceURI = voiceSelect.selectedOptions[0]?.dataset.voiceURI;
    availableVoices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'System default voice';
    voiceSelect.appendChild(defaultOption);

    availableVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' - Default' : ''}`;
        option.dataset.voiceURI = voice.voiceURI;
        voiceSelect.appendChild(option);
    });

    const selectedVoiceIndex = availableVoices.findIndex(
        voice => voice.voiceURI === selectedVoiceURI
    );
    voiceSelect.value = selectedVoiceIndex === -1 ? '' : String(selectedVoiceIndex);
}

function speakText() {
    const text = textBox.value;

    if (text === '') {
        alert('Please enter some text to speak.');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Number(rateControl.value);
    utterance.pitch = Number(pitchControl.value);
    utterance.volume = Number(volumeControl.value);

    const selectedVoiceIndex = voiceSelect.value;

    if (selectedVoiceIndex !== '') {
        utterance.voice = availableVoices[Number(selectedVoiceIndex)];
    }

    speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    speechSynthesis.cancel();
};

function pauseSpeaking() {
    speechSynthesis.pause();
}

function resumeSpeaking() {
    speechSynthesis.resume();
}

function updateCharacterCount() {
    characterCount.textContent = `${textBox.value.length} characters`;
}

function createImportError(message, type) {
    const error = new Error(message);
    error.importErrorType = type;
    return error;
}

function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(
            createImportError('The text file could not be read.', 'unreadable')
        );
        reader.readAsText(file);
    });
}

async function extractPdfText(file) {
    if (!window.pdfjsLib) {
        throw createImportError('PDF reading is unavailable because PDF.js did not load.', 'failure');
    }

    try {
        const documentData = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: documentData }).promise;
        const pageTexts = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const pageText = content.items
                .map(item => `${item.str}${item.hasEOL ? '\n' : ' '}`)
                .join('')
                .replace(/[ \t]+\n/g, '\n')
                .trim();
            pageTexts.push(pageText);
        }

        return pageTexts.join('\n\n');
    } catch (error) {
        if (error.importErrorType) {
            throw error;
        }
        throw createImportError('The PDF is corrupt or could not be read.', 'unreadable');
    }
}

async function extractDocxText(file) {
    if (!window.mammoth) {
        throw createImportError('DOCX reading is unavailable because Mammoth.js did not load.', 'failure');
    }

    try {
        const documentData = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: documentData });
        return result.value;
    } catch (error) {
        throw createImportError('The DOCX file is corrupt or could not be read.', 'unreadable');
    }
}

async function importDocument() {
    const file = documentInput.files[0];

    if (!file) {
        return;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'pdf', 'docx'].includes(extension)) {
        importError.textContent = 'Unsupported file. Choose a .txt, .pdf, or .docx file.';
        importError.hidden = false;
        documentInput.value = '';
        return;
    }

    importError.hidden = true;
    importStatus.textContent = `Reading ${file.name}...`;
    importStatus.hidden = false;
    documentInput.disabled = true;

    try {
        let extractedText;

        if (extension === 'txt') {
            extractedText = await readTextFile(file);
        } else if (extension === 'pdf') {
            extractedText = await extractPdfText(file);
        } else {
            extractedText = await extractDocxText(file);
        }

        if (!extractedText || !extractedText.trim()) {
            importError.textContent = 'No readable text was found in this document.';
            importError.hidden = false;
            return;
        }

        speechSynthesis.cancel();
        textBox.value = extractedText;
        updateCharacterCount();
        importStatus.textContent = `Imported ${file.name}`;
    } catch (error) {
        importError.textContent = error.importErrorType === 'unreadable'
            ? 'This document is corrupt or unreadable. Try another file.'
            : 'Text extraction failed. Check that the file is valid and try again.';
        importError.hidden = false;
        importStatus.hidden = true;
    } finally {
        documentInput.disabled = false;
        documentInput.value = '';
    }
}

function clearText() {
    textBox.value = '';
    updateCharacterCount();
}

speakButton.addEventListener('click', speakText);
pauseButton.addEventListener('click', pauseSpeaking);
resumeButton.addEventListener('click', resumeSpeaking);
stopButton.addEventListener('click', stopSpeaking);
clearButton.addEventListener('click', clearText);
speechSynthesis.addEventListener('voiceschanged', populateVoiceList);
populateVoiceList();

rateControl.addEventListener('input', function () {
    rateValue.textContent = `${Number(rateControl.value).toFixed(1)}x`;
});

pitchControl.addEventListener('input', function () {
    pitchValue.textContent = Number(pitchControl.value).toFixed(1);
});

volumeControl.addEventListener('input', function () {
    volumeValue.textContent = `${Math.round(Number(volumeControl.value) * 100)}%`;
});

textBox.addEventListener('input', function () {
    updateCharacterCount();
});

documentInput.addEventListener('change', importDocument);
