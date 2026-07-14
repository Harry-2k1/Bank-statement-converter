import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '';
  return value;
}

/**
 * Build and download an .xlsx workbook from parsed statement rows.
 */
export function exportTransactionsToExcel({
  rows,
  columns,
  bankLabel,
  fileName,
  summaryDetails = [],
}) {
  if (!rows?.length) {
    throw new Error('No transactions found to export.');
  }

  const header = columns.map((c) => c.header);
  const data = rows.map((row) => columns.map((c) => formatCell(row[c.key])));

  const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);

  sheet['!cols'] = columns.map((col) => {
    if (/narration|details/i.test(col.header)) return { wch: 56 };
    if (/balance|withdrawal|deposit|debit|credit/i.test(col.header)) return { wch: 16 };
    if (/date/i.test(col.header)) return { wch: 12 };
    if (/ref|chq/i.test(col.header)) return { wch: 22 };
    return { wch: 14 };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');

  const summaryRows = [
    ['Field', 'Value'],
    ['Bank', bankLabel],
    ['Transactions', rows.length],
    ['Generated At', new Date().toLocaleString()],
  ];

  if (summaryDetails.length) {
    summaryRows.push(['', '']);
    summaryRows.push(['Account / Statement Details', '']);
    for (const [label, value] of summaryDetails) {
      summaryRows.push([label, value ?? '']);
    }
  }

  const meta = XLSX.utils.aoa_to_sheet(summaryRows);
  meta['!cols'] = [{ wch: 28 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(workbook, meta, 'Summary');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const safeName = fileName.replace(/\.pdf$/i, '') || 'statement';
  saveAs(blob, `${safeName}_${bankLabel.replace(/\s+/g, '_')}.xlsx`);
}
