export function createUI() {
    const elements = {
        textBox: document.getElementById('text-input'),
        speakButton: document.getElementById('speak-button'),
        stopButton: document.getElementById('stop-button'),
        clearButton: document.getElementById('clear-button'),
        voiceSelect: document.getElementById('voice-select'),
        rateControl: document.getElementById('rate-control'),
        pitchControl: document.getElementById('pitch-control'),
        volumeControl: document.getElementById('volume-control'),
        rateValue: document.getElementById('rate-value'),
        pitchValue: document.getElementById('pitch-value'),
        volumeValue: document.getElementById('volume-value'),
        pauseButton: document.getElementById('pause-button'),
        resumeButton: document.getElementById('resume-button'),
        readingView: document.getElementById('reading-view'),
        characterCount: document.getElementById('character-count'),
        documentInput: document.getElementById('document-input'),
        importStatus: document.getElementById('import-status'),
        importError: document.getElementById('import-error')
    };

    return {
        elements,
        getText() {
            return elements.textBox.value;
        },
        setText(text) {
            elements.textBox.value = text;
            this.updateCharacterCount();
        },
        getSpeechSettings() {
            return {
                rate: Number(elements.rateControl.value),
                pitch: Number(elements.pitchControl.value),
                volume: Number(elements.volumeControl.value),
                voiceIndex: elements.voiceSelect.value
            };
        },
        getSelectedVoiceURI() {
            return elements.voiceSelect.selectedOptions[0]?.dataset.voiceURI;
        },
        renderVoices(voices) {
            const selectedVoiceURI = this.getSelectedVoiceURI();
            elements.voiceSelect.innerHTML = '';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'System default voice';
            elements.voiceSelect.appendChild(defaultOption);

            voices.forEach((voice, index) => {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' - Default' : ''}`;
                option.dataset.voiceURI = voice.voiceURI;
                elements.voiceSelect.appendChild(option);
            });

            const selectedVoiceIndex = voices.findIndex(
                voice => voice.voiceURI === selectedVoiceURI
            );
            elements.voiceSelect.value = selectedVoiceIndex === -1
                ? ''
                : String(selectedVoiceIndex);
        },
        updateCharacterCount() {
            elements.characterCount.textContent = `${elements.textBox.value.length} characters`;
        },
        updateRateValue(value) {
            elements.rateValue.textContent = `${Number(value).toFixed(1)}x`;
        },
        updatePitchValue(value) {
            elements.pitchValue.textContent = Number(value).toFixed(1);
        },
        updateVolumeValue(value) {
            elements.volumeValue.textContent = `${Math.round(Number(value) * 100)}%`;
        },
        clearImportError() {
            elements.importError.hidden = true;
        },
        showImportError(message) {
            elements.importError.textContent = message;
            elements.importError.hidden = false;
        },
        setImportStatus(message) {
            elements.importStatus.textContent = message;
            elements.importStatus.hidden = false;
        },
        hideImportStatus() {
            elements.importStatus.hidden = true;
        },
        setImportBusy(isBusy) {
            elements.documentInput.disabled = isBusy;
        },
        resetDocumentInput() {
            elements.documentInput.value = '';
        }
    };
}