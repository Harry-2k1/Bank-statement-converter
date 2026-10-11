import { pdfjsLib } from './pdfjsClient';

const OCR_MIN_TEXT_LENGTH = 40;
const OCR_RENDER_SCALE = 2.5;

async function ocrPdfPages(pdf) {
  const { recognize } = await import('tesseract.js');
  const parts = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const { data } = await recognize(canvas, 'eng');
    parts.push(data.text || '');
  }

  return parts.join('\n');
}

/**
 * Extract plain text from every page of a PDF file.
 * Falls back to OCR when the PDF has no text layer (scanned statements).
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

  const text = pages.join('\n');
  if (text.trim().length >= OCR_MIN_TEXT_LENGTH) {
    return text;
  }

  return ocrPdfPages(pdf);
}
