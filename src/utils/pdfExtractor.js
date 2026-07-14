import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extract plain text from every page of a PDF file.
 */
export async function extractTextFromPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean);

    // Preserve reading order with spaces; keep newlines between Y-shifted runs when available
    let pageText = '';
    let lastY = null;
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const y = item.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(lastY - y) > 2) {
        pageText += '\n';
      } else if (pageText && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
        pageText += ' ';
      }
      pageText += item.str;
      if (y !== undefined) lastY = y;
    }

    pages.push(pageText || strings.join(' '));
  }

  return pages.join('\n');
}
