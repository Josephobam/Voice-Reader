const MAX_CHUNK_LENGTH = 1800;

function findChunkEnd(text, start) {
    const hardEnd = Math.min(start + MAX_CHUNK_LENGTH, text.length);

    if (hardEnd === text.length) {
        return hardEnd;
    }

    const preferredBoundary = start + Math.floor((hardEnd - start) * 0.55);
    let paragraphEnd = 0;
    const paragraphPattern = /\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/g;
    paragraphPattern.lastIndex = start;

    let match;
    while ((match = paragraphPattern.exec(text)) !== null && match.index < hardEnd) {
        const boundary = match.index + match[0].length;
        if (boundary <= hardEnd) {
            paragraphEnd = boundary;
        }
    }

    if (paragraphEnd >= preferredBoundary) {
        return paragraphEnd;
    }

    let sentenceEnd = 0;
    const sentencePattern = /[.!?]+(?:["'’”)\]]*)?(?=\s|$)/g;
    sentencePattern.lastIndex = start;

    while ((match = sentencePattern.exec(text)) !== null && match.index < hardEnd) {
        const boundary = match.index + match[0].length;
        if (boundary <= hardEnd) {
            sentenceEnd = boundary;
        }
    }

    if (sentenceEnd >= preferredBoundary) {
        return sentenceEnd;
    }

    let wordEnd = hardEnd;
    while (wordEnd > start && !/\s/.test(text[wordEnd - 1])) {
        wordEnd -= 1;
    }

    if (wordEnd > start) {
        return wordEnd;
    }

    while (wordEnd < text.length && !/\s/.test(text[wordEnd])) {
        wordEnd += 1;
    }

    return wordEnd;
}

function countChunks(text) {
    let count = 0;
    let start = 0;

    while (start < text.length) {
        start = findChunkEnd(text, start);
        count += 1;
    }

    return count;
}

export function createSpeechController(onVoicesChanged = () => {}) {
    const synthesis = window.speechSynthesis;
    let availableVoices = [];
    let activeSession = null;

    function populateVoiceList() {
        availableVoices = synthesis.getVoices();
        onVoicesChanged(availableVoices);
    }

    function reportProgress(session, state, error = null) {
        if (!session.onProgress) {
            return;
        }

        try {
            session.onProgress({
                state,
                currentChunk: session.currentChunk,
                totalChunks: session.totalChunks,
                currentCharacterOffset: session.currentCharacterOffset,
                totalCharacters: session.totalCharacters,
                chunkStart: session.chunkStartCharacterOffset,
                chunkEnd: session.chunkEndCharacterOffset,
                chunkStartCharacterOffset: session.chunkStartCharacterOffset,
                chunkEndCharacterOffset: session.chunkEndCharacterOffset,
                error: error ? {
                    code: error.code || 'speech-error',
                    message: error.message || 'Speech playback failed.'
                } : null
            });
        } catch (callbackError) {
            console.error('Speech progress callback failed.', callbackError);
        }
    }

    function isCurrentSession(session) {
        return activeSession === session;
    }

    function failSession(session, error) {
        if (!isCurrentSession(session)) {
            return;
        }

        activeSession = null;
        session.currentCharacterOffset = Math.min(
            session.chunkEndCharacterOffset,
            session.currentCharacterOffset
        );
        reportProgress(session, 'error', error);
        synthesis.cancel();
    }

    function speakNextChunk(session) {
        if (!isCurrentSession(session)) {
            return;
        }

        if (session.currentChunk >= session.totalChunks) {
            session.currentCharacterOffset = session.totalCharacters;
            activeSession = null;
            reportProgress(session, 'completed');
            return;
        }

        const chunkStart = session.nextCharacterOffset;
        const chunkEnd = findChunkEnd(session.text, chunkStart);
        const utterance = new SpeechSynthesisUtterance(session.text.slice(chunkStart, chunkEnd));
        const settings = session.settings;

        session.currentChunk += 1;
        session.chunkStartCharacterOffset = chunkStart;
        session.chunkEndCharacterOffset = chunkEnd;
        session.currentCharacterOffset = chunkStart;
        session.nextCharacterOffset = chunkEnd;

        utterance.rate = Number(settings.rate ?? 1);
        utterance.pitch = Number(settings.pitch ?? 1);
        utterance.volume = Number(settings.volume ?? 1);

        if (settings.voiceIndex !== undefined && settings.voiceIndex !== '') {
            utterance.voice = availableVoices[Number(settings.voiceIndex)] || null;
        }

        utterance.onstart = () => {
            if (!isCurrentSession(session)) {
                return;
            }
            reportProgress(session, session.state === 'paused' ? 'paused' : 'speaking');
        };

        utterance.onboundary = event => {
            if (!isCurrentSession(session) || !Number.isFinite(event.charIndex)) {
                return;
            }
            const localOffset = Math.max(0, Math.min(event.charIndex, chunkEnd - chunkStart));
            session.currentCharacterOffset = chunkStart + localOffset;
            reportProgress(session, session.state);
        };

        utterance.onend = () => {
            if (!isCurrentSession(session)) {
                return;
            }
            session.currentCharacterOffset = chunkEnd;
            speakNextChunk(session);
        };

        utterance.onerror = event => {
            failSession(session, {
                code: event.error || 'speech-error',
                message: event.message || 'Speech playback failed.'
            });
        };

        try {
            synthesis.speak(utterance);
        } catch (error) {
            failSession(session, error);
        }
    }

    function stopSpeaking() {
        if (activeSession) {
            const session = activeSession;
            activeSession = null;
            reportProgress(session, 'stopped');
        }
        synthesis.cancel();
    }

    function pauseSpeaking() {
        if (activeSession && activeSession.state === 'speaking') {
            activeSession.state = 'paused';
            synthesis.pause();
            reportProgress(activeSession, 'paused');
        }
    }

    function resumeSpeaking() {
        if (activeSession && activeSession.state === 'paused') {
            activeSession.state = 'speaking';
            synthesis.resume();
            reportProgress(activeSession, 'speaking');
        }
    }

    function isSpeaking() {
        return activeSession !== null;
    }

    return {
        initialize() {
            synthesis.addEventListener('voiceschanged', populateVoiceList);
            populateVoiceList();
        },
        startSpeaking(text, settings, onProgress) {
            stopSpeaking();

            const safeText = typeof text === 'string' ? text : '';
            if (!safeText.trim()) {
                const emptySession = {
                    currentChunk: 0,
                    totalChunks: 0,
                    currentCharacterOffset: 0,
                    totalCharacters: safeText.length,
                    chunkStartCharacterOffset: 0,
                    chunkEndCharacterOffset: 0,
                    onProgress
                };
                reportProgress(emptySession, 'error', {
                    code: 'empty-text',
                    message: 'Please enter some text to speak.'
                });
                return false;
            }

            const session = {
                text: safeText,
                settings: settings || {},
                onProgress,
                state: 'speaking',
                currentChunk: 0,
                totalChunks: countChunks(safeText),
                currentCharacterOffset: 0,
                totalCharacters: safeText.length,
                chunkStartCharacterOffset: 0,
                chunkEndCharacterOffset: 0,
                nextCharacterOffset: 0
            };

            activeSession = session;
            reportProgress(session, 'speaking');
            speakNextChunk(session);
            return true;
        },
        stopSpeaking,
        pauseSpeaking,
        resumeSpeaking,
        isSpeaking
    };
}