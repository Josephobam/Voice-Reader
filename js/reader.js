export function createReader(readingView) {
	let documentText = '';
	let activeRange = null;
	let activeHighlight = null;
	let remainingTextNode = null;
	let remainingStart = 0;

	function renderPlainText(resetScroll = false) {
		remainingTextNode = document.createTextNode(documentText);
		readingView.replaceChildren(remainingTextNode);
		readingView.hidden = documentText.length === 0;
		activeRange = null;
		activeHighlight = null;
		remainingStart = 0;

		if (resetScroll) {
			readingView.scrollTop = 0;
		}
	}

	function scrollHighlightIntoView(highlight) {
		const viewRect = readingView.getBoundingClientRect();
		const highlightRect = highlight.getBoundingClientRect();
		const currentTop = readingView.scrollTop;
		const highlightTop = highlightRect.top - viewRect.top + currentTop;
		const highlightBottom = highlightTop + highlightRect.height;
		const margin = 20;

		if (highlightTop >= currentTop + margin
			&& highlightBottom <= currentTop + readingView.clientHeight - margin) {
			return;
		}

		const centeredTop = highlightTop - (readingView.clientHeight - highlightRect.height) / 2;
		const targetTop = Math.max(0, centeredTop);
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (reduceMotion || document.visibilityState !== 'visible') {
			readingView.scrollTop = targetTop;
		} else {
			readingView.scrollTo({ top: targetTop, behavior: 'smooth' });
		}
	}

	return {
		setText(text) {
			documentText = typeof text === 'string' ? text : '';
			renderPlainText(true);
		},
		updateProgress(progress) {
			const start = Math.max(0, Math.min(documentText.length, Math.trunc(
				progress.chunkStart ?? progress.chunkStartCharacterOffset
			)));
			const end = Math.max(start, Math.min(documentText.length, Math.trunc(
				progress.chunkEnd ?? progress.chunkEndCharacterOffset
			)));

			if (progress.currentChunk < 1 || end <= start) {
				return;
			}

			if (activeRange?.start === start && activeRange.end === end) {
				return;
			}

			if (activeRange && start === activeRange.end && remainingTextNode?.isConnected) {
				activeHighlight.replaceWith(activeHighlight.firstChild);
				activeHighlight = null;
				activeRange = null;
			} else if (activeRange || start < remainingStart || start > documentText.length) {
				renderPlainText();
			}

			if (start > remainingStart) {
				remainingTextNode = remainingTextNode.splitText(start - remainingStart);
				remainingStart = start;
			}

			const activeTextNode = remainingTextNode;
			remainingTextNode = activeTextNode.splitText(end - start);
			remainingStart = end;

			const highlight = document.createElement('span');
			highlight.className = 'reading-highlight';
			activeTextNode.replaceWith(highlight);
			highlight.append(activeTextNode);
			readingView.hidden = documentText.length === 0;
			activeRange = { start, end };
			activeHighlight = highlight;
			scrollHighlightIntoView(highlight);
		},
		clearHighlight() {
			renderPlainText();
		},
		clear() {
			documentText = '';
			renderPlainText(true);
		}
	};
}