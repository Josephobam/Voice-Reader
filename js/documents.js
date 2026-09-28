class DocumentImportError extends Error {
    constructor(message, type) {
        super(message);
        this.name = 'DocumentImportError';
        this.type = type;
    }
}

function createImportError(message, type) {
    return new DocumentImportError(message, type);
}

function getFileExtension(file) {
    return file.name.split('.').pop().toLowerCase();
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
        const pdf = await window.pdfjsLib.getDocument({ data: documentData }).promise;
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
        if (error.type) {
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
        const result = await window.mammoth.extractRawText({ arrayBuffer: documentData });
        return result.value;
    } catch (error) {
        throw createImportError('The DOCX file is corrupt or could not be read.', 'unreadable');
    }
}

if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export function isSupportedDocument(file) {
    return ['txt', 'pdf', 'docx'].includes(getFileExtension(file));
}

export async function extractDocumentText(file) {
    const extension = getFileExtension(file);

    if (extension === 'txt') {
        return readTextFile(file);
    }
    if (extension === 'pdf') {
        return extractPdfText(file);
    }
    if (extension === 'docx') {
        return extractDocxText(file);
    }

    throw createImportError('Unsupported file type.', 'unsupported');
}