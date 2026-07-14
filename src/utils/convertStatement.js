import { extractTextFromPdf } from './pdfExtractor';
import { parseHdfcStatement, HDFC_COLUMNS } from './parsers/hdfcParser';
import {
  parseIndianBankStatement,
  INDIAN_BANK_COLUMNS,
} from './parsers/indianBankParser';
import { parseKvbStatement, KVB_COLUMNS } from './parsers/kvbParser';
import {
  parseKvbLatestStatement,
  KVB_LATEST_COLUMNS,
} from './parsers/kvbLatestParser';
import { parseAxisStatement, AXIS_COLUMNS } from './parsers/axisParser';
import { parseAxisNeoStatement, AXIS_NEO_COLUMNS } from './parsers/axisNeoParser';
import {
  parseUnionBankStatement,
  UNION_BANK_COLUMNS,
} from './parsers/unionBankParser';
import { parseIciciStatement, ICICI_COLUMNS } from './parsers/iciciParser';
import { parseSbiStatement, SBI_COLUMNS } from './parsers/sbiParser';
import {
  extractHdfcSummary,
  extractIndianBankSummary,
  extractKvbSummary,
  extractKvbLatestSummary,
  extractAxisSummary,
  extractAxisNeoSummary,
  extractUnionBankSummary,
  extractIciciSummary,
  extractSbiSummary,
} from './parsers/summaryExtractor';
import { exportTransactionsToExcel } from './excelExporter';

export const BANK_GROUPS = [
  { id: 'public', label: 'Public sector banks' },
  { id: 'private', label: 'Private & other banks' },
  { id: 'axis', label: 'Axis Bank formats' },
  { id: 'kvb', label: 'Karur Vysya Bank' },
];

export const BANKS = {
  sbi: {
    id: 'sbi',
    label: 'State Bank of India',
    short: 'SBI',
    group: 'public',
    description: 'SBI account statement PDFs with multi-line transaction details.',
    accent: '#22409A',
  },
  indian: {
    id: 'indian',
    label: 'Indian Bank',
    short: 'Indian Bank',
    group: 'public',
    description: 'Indian Bank account statement PDFs into Excel.',
    accent: '#B71C1C',
  },
  union: {
    id: 'union',
    label: 'Union Bank of India',
    short: 'Union Bank',
    group: 'public',
    description: 'Union Bank of India account statement PDFs into Excel.',
    accent: '#0051A5',
  },
  hdfc: {
    id: 'hdfc',
    label: 'HDFC Bank',
    short: 'HDFC',
    group: 'private',
    description: 'HDFC account statement PDFs into Excel.',
    accent: '#004C8F',
  },
  icici: {
    id: 'icici',
    label: 'ICICI Bank',
    short: 'ICICI',
    group: 'private',
    description: 'ICICI detailed statement export with tran IDs and remarks.',
    accent: '#F58220',
  },
  axis: {
    id: 'axis',
    label: 'Axis Bank (Retail)',
    short: 'Axis Retail',
    group: 'axis',
    description: 'Standard Axis retail/corporate statement (Tran Date format).',
    accent: '#97144D',
  },
  axisNeo: {
    id: 'axisNeo',
    label: 'Axis Bank (Neo)',
    short: 'Axis Neo',
    group: 'axis',
    description: 'Axis Neo corporate statements (DD/MM/YYYY, DR/CR columns).',
    accent: '#7B1040',
  },
  kvb: {
    id: 'kvb',
    label: 'KVB (Classic)',
    short: 'KVB Classic',
    group: 'kvb',
    description: 'Older KVB online statement format (Transaction Date with time).',
    accent: '#C45C26',
  },
  kvbLatest: {
    id: 'kvbLatest',
    label: 'KVB (Latest)',
    short: 'KVB Latest',
    group: 'kvb',
    description: 'Latest KVB statement format (Txn Date / Value Date / Ref. No).',
    accent: '#A3451F',
  },
};

const BANK_HANDLERS = {
  hdfc: {
    parse: parseHdfcStatement,
    columns: HDFC_COLUMNS,
    summary: extractHdfcSummary,
  },
  indian: {
    parse: parseIndianBankStatement,
    columns: INDIAN_BANK_COLUMNS,
    summary: extractIndianBankSummary,
  },
  kvb: {
    parse: parseKvbStatement,
    columns: KVB_COLUMNS,
    summary: extractKvbSummary,
  },
  kvbLatest: {
    parse: parseKvbLatestStatement,
    columns: KVB_LATEST_COLUMNS,
    summary: extractKvbLatestSummary,
  },
  axis: {
    parse: parseAxisStatement,
    columns: AXIS_COLUMNS,
    summary: extractAxisSummary,
  },
  axisNeo: {
    parse: parseAxisNeoStatement,
    columns: AXIS_NEO_COLUMNS,
    summary: extractAxisNeoSummary,
  },
  union: {
    parse: parseUnionBankStatement,
    columns: UNION_BANK_COLUMNS,
    summary: extractUnionBankSummary,
  },
  icici: {
    parse: parseIciciStatement,
    columns: ICICI_COLUMNS,
    summary: extractIciciSummary,
  },
  sbi: {
    parse: parseSbiStatement,
    columns: SBI_COLUMNS,
    summary: extractSbiSummary,
  },
};

/**
 * Parse a bank statement PDF and download a formatted Excel file.
 */
export async function convertStatementPdf(file, bankId) {
  const text = await extractTextFromPdf(file);

  if (!text || text.trim().length < 40) {
    throw new Error('Could not read text from this PDF. It may be scanned or image-only.');
  }

  const bank = BANKS[bankId];
  const handler = BANK_HANDLERS[bankId];

  if (!bank || !handler) {
    throw new Error('Unsupported bank selected.');
  }

  const rows = handler.parse(text);
  const summaryDetails = handler.summary(text);

  if (!rows.length) {
    throw new Error(
      `No transactions were detected for ${bank.label}. Confirm you selected the correct bank.`,
    );
  }

  exportTransactionsToExcel({
    rows,
    columns: handler.columns,
    bankLabel: bank.label,
    fileName: file.name,
    summaryDetails,
  });

  return {
    count: rows.length,
    preview: rows.slice(0, 8),
    columns: handler.columns,
    bankLabel: bank.label,
    summaryDetails,
  };
}
