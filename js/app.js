import { extractDocumentText, isSupportedDocument } from './documents.js';
import { createSpeechController } from './speech.js';
import { createReader } from './reader.js';
import { createUI } from './ui.js';

const ui = createUI();
const speech = createSpeechController(voices => ui.renderVoices(voices));
const { elements } = ui;
const reader = createReader(elements.readingView);
let readingSessionId = 0;
let importRequestId = 0;
let activeImportRequestId = null;

function reportSpeechProgress(sessionId, progress) {
    if (sessionId !== readingSessionId) {
        return;
    }

    if (progress.state === 'error') {
        console.error('Speech playback failed.', progress.error);
    }

    if (progress.state === 'completed'
        || progress.state === 'stopped'
        || progress.state === 'error') {
        reader.clearHighlight();
        return;
    }

    reader.updateProgress(progress);
}

function invalidatePendingImport() {
    if (activeImportRequestId === null) {
        return;
    }

    importRequestId += 1;
    activeImportRequestId = null;
    ui.setImportBusy(false);
    ui.resetDocumentInput();
    ui.hideImportStatus();
}

async function importDocument() {
    const file = elements.documentInput.files[0];

    if (!file) {
        return;
    }

    const requestId = ++importRequestId;
    activeImportRequestId = requestId;

    if (!isSupportedDocument(file)) {
        activeImportRequestId = null;
        ui.setImportBusy(false);
        ui.showImportError('Unsupported file. Choose a .txt, .pdf, or .docx file.');
        ui.resetDocumentInput();
        return;
    }

    ui.clearImportError();
    ui.setImportStatus(`Reading ${file.name}...`);
    ui.setImportBusy(true);

    try {
        const extractedText = await extractDocumentText(file);

        if (requestId !== importRequestId) {
            return;
        }

        if (!extractedText || !extractedText.trim()) {
            ui.showImportError('No readable text was found in this document.');
            return;
        }

        readingSessionId += 1;
        speech.stopSpeaking();
        ui.setText(extractedText);
        reader.setText(extractedText);
        ui.setImportStatus(`Imported ${file.name}`);
    } catch (error) {
        if (requestId !== importRequestId) {
            return;
        }

        ui.showImportError(error.type === 'unreadable'
            ? 'This document is corrupt or unreadable. Try another file.'
            : 'Text extraction failed. Check that the file is valid and try again.');
        ui.hideImportStatus();
    } finally {
        if (requestId === importRequestId) {
            activeImportRequestId = null;
            ui.setImportBusy(false);
            ui.resetDocumentInput();
        }
    }
}

elements.speakButton.addEventListener('click', () => {
    readingSessionId += 1;
    const sessionId = readingSessionId;
    const text = ui.getText();
    reader.setText(text);

    const started = speech.startSpeaking(
        text,
        ui.getSpeechSettings(),
        progress => reportSpeechProgress(sessionId, progress)
    );
    if (!started) {
        alert('Please enter some text to speak.');
    }
});
elements.pauseButton.addEventListener('click', () => speech.pauseSpeaking());
elements.resumeButton.addEventListener('click', () => speech.resumeSpeaking());
elements.stopButton.addEventListener('click', () => {
    speech.stopSpeaking();
    reader.clearHighlight();
});
elements.clearButton.addEventListener('click', () => {
    invalidatePendingImport();
    readingSessionId += 1;
    speech.stopSpeaking();
    ui.setText('');
    reader.clear();
});
elements.rateControl.addEventListener('input', event => ui.updateRateValue(event.currentTarget.value));
elements.pitchControl.addEventListener('input', event => ui.updatePitchValue(event.currentTarget.value));
elements.volumeControl.addEventListener('input', event => ui.updateVolumeValue(event.currentTarget.value));
elements.textBox.addEventListener('input', () => {
    invalidatePendingImport();
    readingSessionId += 1;
    speech.stopSpeaking();
    ui.updateCharacterCount();
    reader.setText(ui.getText());
});
elements.documentInput.addEventListener('change', importDocument);

speech.initialize();