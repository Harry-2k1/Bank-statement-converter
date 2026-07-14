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
import {
  extractHdfcSummary,
  extractIndianBankSummary,
  extractKvbSummary,
  extractKvbLatestSummary,
  extractAxisSummary,
} from './parsers/summaryExtractor';
import { exportTransactionsToExcel } from './excelExporter';

export const BANKS = {
  hdfc: {
    id: 'hdfc',
    label: 'HDFC Bank',
    short: 'HDFC',
    description: 'Convert HDFC account statement PDFs into Excel.',
    accent: '#004C8F',
  },
  indian: {
    id: 'indian',
    label: 'Indian Bank',
    short: 'Indian Bank',
    description: 'Convert Indian Bank account statement PDFs into Excel.',
    accent: '#B71C1C',
  },
  kvb: {
    id: 'kvb',
    label: 'KVB (Classic)',
    short: 'KVB Classic',
    description: 'Older KVB online statement format (Transaction Date with time).',
    accent: '#C45C26',
  },
  kvbLatest: {
    id: 'kvbLatest',
    label: 'KVB (Latest)',
    short: 'KVB Latest',
    description: 'Latest KVB statement format (Txn Date / Value Date / Ref. No).',
    accent: '#A3451F',
  },
  axis: {
    id: 'axis',
    label: 'Axis Bank',
    short: 'Axis',
    description: 'Convert Axis Bank account statement PDFs into Excel.',
    accent: '#97144D',
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

  let rows;
  let columns;
  let bankLabel;
  let summaryDetails = [];

  if (bankId === 'hdfc') {
    rows = parseHdfcStatement(text);
    columns = HDFC_COLUMNS;
    bankLabel = BANKS.hdfc.label;
    summaryDetails = extractHdfcSummary(text);
  } else if (bankId === 'indian') {
    rows = parseIndianBankStatement(text);
    columns = INDIAN_BANK_COLUMNS;
    bankLabel = BANKS.indian.label;
    summaryDetails = extractIndianBankSummary(text);
  } else if (bankId === 'kvb') {
    rows = parseKvbStatement(text);
    columns = KVB_COLUMNS;
    bankLabel = BANKS.kvb.label;
    summaryDetails = extractKvbSummary(text);
  } else if (bankId === 'kvbLatest') {
    rows = parseKvbLatestStatement(text);
    columns = KVB_LATEST_COLUMNS;
    bankLabel = BANKS.kvbLatest.label;
    summaryDetails = extractKvbLatestSummary(text);
  } else if (bankId === 'axis') {
    rows = parseAxisStatement(text);
    columns = AXIS_COLUMNS;
    bankLabel = BANKS.axis.label;
    summaryDetails = extractAxisSummary(text);
  } else {
    throw new Error('Unsupported bank selected.');
  }

  if (!rows.length) {
    throw new Error(
      `No transactions were detected for ${bankLabel}. Confirm you selected the correct bank.`,
    );
  }

  exportTransactionsToExcel({
    rows,
    columns,
    bankLabel,
    fileName: file.name,
    summaryDetails,
  });

  return {
    count: rows.length,
    preview: rows.slice(0, 8),
    columns,
    bankLabel,
    summaryDetails,
  };
}
