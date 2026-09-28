# Text to Voice Converter

A browser-based reader that speaks typed or imported text using the Web Speech API. The reading view follows speech progress with highlighting and automatic scrolling.

## Run Locally

This is a static ES-module project with no build step or package manifest. From the project root, start a local server:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000>. A local HTTP server is recommended because browsers restrict JavaScript modules when opened directly from the filesystem.

PDF.js and Mammoth are loaded from CDNs in `index.html`; importing PDF or DOCX files therefore requires network access. Speech output and available voices come from the browser and operating system. Voice availability and playback behavior vary by device/browser.

## Project Structure

- `index.html` defines the controls and loads the external document libraries and `js/app.js`.
- `styles.css` contains the application layout and reading-highlight styling.
- `js/app.js` wires UI events and coordinates speech, reading progress, and document imports.
- `js/ui.js` reads and updates DOM controls, settings, voice options, and import status.
- `js/speech.js` wraps `speechSynthesis`, splits long text into chunks (up to 1,800 characters, preferring paragraph, sentence, and word boundaries), and reports playback progress.
- `js/reader.js` renders document text, applies speech highlights, and scrolls the current passage into view.
- `js/documents.js` extracts text from TXT, PDF, and DOCX files.

## Important State Contracts

- `app.js` owns the `readingSessionId`. Progress callbacks must be ignored when their captured ID is stale, such as after Stop, Clear, an edit, or a new Speak request.
- Document extraction is asynchronous. The import request ID protects the current text and import UI from stale results. Clear and edits invalidate a pending import; only the current request may apply content, report errors, or run completion cleanup.
- Editing the textarea stops speech, invalidates its progress callbacks, and synchronizes the reader to the edited text. A user can press Speak to start a new session.
- `speech.js` owns the active speech session and chunk progression. Keep chunk boundaries and callback/session checks consistent with `reader.js`, which maps chunk character offsets onto the currently rendered text.
- Imported text is copied to both the textarea and reader. If changing import or text synchronization, update both views and consider active playback and pending imports.

## Manual Regression Checklist

After changing speech, reader, import, or app state handling, verify in a real browser:

1. Type text, Speak, Pause, Resume, Stop, then Speak again.
2. Edit the textarea during active speech. Playback should stop, prior highlighting should disappear, and the reader should show the new text.
3. Change voice, rate, pitch, and volume; confirm the selected settings are used by new speech.
4. Clear during a pending large import; the import must not restore text after Clear.
5. Start import A, then B while A is pending (or use a controlled test if the file chooser is disabled during extraction). B must remain the final document.
6. Import TXT, PDF, and DOCX files. Verify text and reading view agree, imported speech works, Pause/Resume works, and Stop clears highlighting.
7. Test empty and very short text, multiple paragraphs, punctuation, quotes, numbers, and special characters.
8. Test a large multi-page document, including extraction through its final page, speech start, Pause/Resume, and Stop cleanup.
9. Check the browser console for unexpected errors and verify text, reader, speech session, and import status do not become inconsistent.

There is currently no automated test or build command configured in this repository; use browser-level regression checks for behavior changes.
