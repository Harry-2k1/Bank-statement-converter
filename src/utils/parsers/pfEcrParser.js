import { pdfjsLib } from '../pdfjsClient';

function groupRows(items) {
  const rows = [];

  for (const item of items) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= 3);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  rows.sort((a, b) => b.y - a.y);
  return rows;
}

function parseAmount(value) {
  if (!value || value === '-' || value === 'N.A.') return null;
  const num = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

function columnText(rows, x, yMin, yMax, pred = (s) => Boolean(s) && s !== '-') {
  for (const row of rows) {
    if (row.y < yMin || row.y > yMax) continue;
    const hits = row.items
      .filter((i) => Math.abs(i.x - x) <= 14 && pred(i.str))
      .sort((a, b) => a.x - b.x)
      .map((i) => i.str);
    if (hits.length) return hits.join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

function parseMemberPage(rows) {
  const uanRow = rows.find((r) => r.items.filter((i) => /^\d{12}$/.test(i.str)).length >= 3);
  if (!uanRow) return [];

  return uanRow.items
    .filter((i) => /^\d{12}$/.test(i.str))
    .map((uanItem) => {
      const x = uanItem.x;

      return {
        slNo: columnText(rows, x, 20, 45, (s) => /^\d+$/.test(s)),
        uan: uanItem.str,
        nameEcr: columnText(rows, x, 100, 130, (s) => /[A-Za-z]/.test(s)),
        nameUanRepository: columnText(rows, x, 130, 190, (s) => /[A-Za-z]/.test(s)),
        grossWages: parseAmount(columnText(rows, x, 220, 245, (s) => /^[\d,]+$/.test(s))),
        epfWages: parseAmount(columnText(rows, x, 265, 285, (s) => /^[\d,]+$/.test(s))),
        epsWages: parseAmount(columnText(rows, x, 305, 325, (s) => /^[\d,]+$/.test(s))),
        edliWages: parseAmount(columnText(rows, x, 340, 360, (s) => /^[\d,]+$/.test(s))),
        eeShare: parseAmount(columnText(rows, x, 395, 415, (s) => /^[\d,]+$/.test(s))),
        erEpsShare: parseAmount(columnText(rows, x, 455, 475, (s) => /^[\d,]+$/.test(s))),
        erPfShare: parseAmount(columnText(rows, x, 655, 690, (s) => /^[\d,]+$/.test(s))),
        epsPensionShare: parseAmount(columnText(rows, x, 505, 525, (s) => /^[\d,]+$/.test(s))),
        ncpDays: parseAmount(columnText(rows, x, 545, 565, (s) => /^\d+$/.test(s))),
        refunds: columnText(rows, x, 570, 605, (s) => s !== '-' && s !== '0'),
        pmrpyBenefit: parseAmount(columnText(rows, x, 600, 640, (s) => /^[\d,]+$/.test(s))),
        postingLocation: columnText(rows, x, 760, 790, (s) => s !== '-' && !/^N\.A\.$/i.test(s)),
      };
    });
}

/**
 * Parse PF ECR member rows from coordinate-grouped PDF text items.
 */
export function parsePfEcrPages(pages) {
  const rows = [];

  for (const pageItems of pages) {
    const items = pageItems
      .filter((i) => i.str?.trim())
      .map((i) => ({ str: i.str.trim(), x: i.x, y: i.y }));
    rows.push(...parseMemberPage(groupRows(items)));
  }

  return rows.sort((a, b) => Number(a.slNo || 0) - Number(b.slNo || 0));
}

/**
 * Extract plain text from page 1 for ECR summary/header fields.
 */
export function extractPfEcrHeaderText(pagesText) {
  return pagesText.join('\n');
}

export const PF_ECR_COLUMNS = [
  { key: 'slNo', header: 'Sl. No.' },
  { key: 'uan', header: 'UAN' },
  { key: 'nameEcr', header: 'Name (ECR)' },
  { key: 'nameUanRepository', header: 'Name as per UAN Repository' },
  { key: 'grossWages', header: 'Gross Wages' },
  { key: 'epfWages', header: 'EPF Wages' },
  { key: 'epsWages', header: 'EPS Wages' },
  { key: 'edliWages', header: 'EDLI Wages' },
  { key: 'eeShare', header: 'Employee PF Share' },
  { key: 'erEpsShare', header: 'Employer EPS Share' },
  { key: 'erPfShare', header: 'Employer PF Share' },
  { key: 'epsPensionShare', header: 'EPS Pension Share' },
  { key: 'ncpDays', header: 'NCP Days' },
  { key: 'refunds', header: 'Refunds' },
  { key: 'pmrpyBenefit', header: 'PMRPY / ABRY Benefit' },
  { key: 'postingLocation', header: 'Posting Location' },
];

/**
 * Read PF ECR PDF using text positions and return member rows.
 */
export async function parsePfEcrPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  const pagesText = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => 'str' in item && item.str?.trim())
      .map((item) => ({
        str: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5],
      }));

    pagesText.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' '),
    );

    if (i === 1) continue;
    pages.push(items);
  }

  const rows = parsePfEcrPages(pages);
  return { rows, headerText: extractPfEcrHeaderText(pagesText) };
}
