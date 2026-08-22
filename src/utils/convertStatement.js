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
import { parseCanaraStatement, CANARA_COLUMNS } from './parsers/canaraParser';
import { parseCubStatement, CUB_COLUMNS } from './parsers/cubParser';
import { parseSibStatement, SIB_COLUMNS } from './parsers/sibParser';
import { parseFederalStatement, FEDERAL_COLUMNS } from './parsers/federalParser';
import {
  parseFederalMobileStatement,
  FEDERAL_MOBILE_COLUMNS,
} from './parsers/federalMobileParser';
import {
  parseFederalLatestStatement,
  FEDERAL_LATEST_COLUMNS,
  isFederalLatestFormat,
} from './parsers/federalLatestParser';
import { parseDbsStatement, DBS_COLUMNS } from './parsers/dbsParser';
import { parseTmbStatement, TMB_COLUMNS } from './parsers/tmbParser';
import { parseBobStatement, BOB_COLUMNS } from './parsers/bobParser';
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
  extractCanaraSummary,
  extractCubSummary,
  extractSibSummary,
  extractFederalSummary,
  extractFederalMobileSummary,
  extractFederalLatestSummary,
  extractDbsSummary,
  extractTmbSummary,
  extractBobSummary,
} from './parsers/summaryExtractor';
import { exportTransactionsToExcel } from './excelExporter';

export const BANK_GROUPS = [
  { id: 'public', label: 'Public sector banks' },
  { id: 'private', label: 'Private sector banks' },
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
  canara: {
    id: 'canara',
    label: 'Canara Bank',
    short: 'Canara',
    group: 'public',
    description: 'Canara Bank current/savings and OD account statements.',
    accent: '#0084C7',
  },
  bob: {
    id: 'bob',
    label: 'Bank of Baroda',
    short: 'BOB',
    group: 'public',
    description: 'Bank of Baroda REP31 customer account ledger statements.',
    accent: '#F15A22',
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
  cub: {
    id: 'cub',
    label: 'City Union Bank (CUB)',
    short: 'CUB',
    group: 'private',
    description: 'City Union Bank account statements (balance-first format).',
    accent: '#1B365D',
  },
  sib: {
    id: 'sib',
    label: 'South Indian Bank (SIB)',
    short: 'SIB',
    group: 'private',
    description: 'South Indian Bank statements (particulars + date format).',
    accent: '#0054A6',
  },
  federal: {
    id: 'federal',
    label: 'Federal Bank',
    short: 'Federal',
    group: 'private',
    description:
      'Federal Bank PDF statements (auto-detects desktop, latest branch, and mobile formats).',
    accent: '#004F9F',
  },
  federalLatest: {
    id: 'federalLatest',
    label: 'Federal Bank (Latest)',
    short: 'Federal Latest',
    group: 'private',
    description: 'Federal Bank branch PDFs (DD-MM-YYYY, reversed column layout).',
    accent: '#003870',
  },
  federalMobile: {
    id: 'federalMobile',
    label: 'Federal Bank (Mobile)',
    short: 'Federal Mobile',
    group: 'private',
    description: 'Federal Bank mobile app statements (DD-MMM-YYYY, Tran ID).',
    accent: '#003D7A',
  },
  dbs: {
    id: 'dbs',
    label: 'DBS Bank India',
    short: 'DBS',
    group: 'private',
    description: 'DBS Bank India digibank account statements.',
    accent: '#C02026',
  },
  tmb: {
    id: 'tmb',
    label: 'Tamilnad Mercantile Bank (TMB)',
    short: 'TMB',
    group: 'private',
    description: 'TMB internet banking transaction list exports (OD/current).',
    accent: '#006B3F',
  },
  axis: {
    id: 'axis',
    label: 'Axis Bank (Retail)',
    short: 'Axis Retail',
    group: 'private',
    description: 'Standard Axis retail/corporate statement (Tran Date format).',
    accent: '#97144D',
  },
  axisNeo: {
    id: 'axisNeo',
    label: 'Axis Bank (Neo)',
    short: 'Axis Neo',
    group: 'private',
    description: 'Axis Neo corporate statements (DD/MM/YYYY, DR/CR columns).',
    accent: '#7B1040',
  },
  kvb: {
    id: 'kvb',
    label: 'Karur Vysya Bank (Classic)',
    short: 'KVB Classic',
    group: 'private',
    description: 'Older KVB online statement format (Transaction Date with time).',
    accent: '#C45C26',
  },
  kvbLatest: {
    id: 'kvbLatest',
    label: 'Karur Vysya Bank (Latest)',
    short: 'KVB Latest',
    group: 'private',
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
  canara: {
    parse: parseCanaraStatement,
    columns: CANARA_COLUMNS,
    summary: extractCanaraSummary,
  },
  cub: {
    parse: parseCubStatement,
    columns: CUB_COLUMNS,
    summary: extractCubSummary,
  },
  sib: {
    parse: parseSibStatement,
    columns: SIB_COLUMNS,
    summary: extractSibSummary,
  },
  federal: {
    parse: parseFederalStatement,
    columns: FEDERAL_COLUMNS,
    summary: extractFederalSummary,
  },
  federalMobile: {
    parse: parseFederalMobileStatement,
    columns: FEDERAL_MOBILE_COLUMNS,
    summary: extractFederalMobileSummary,
  },
  federalLatest: {
    parse: parseFederalLatestStatement,
    columns: FEDERAL_LATEST_COLUMNS,
    summary: extractFederalLatestSummary,
  },
  dbs: {
    parse: parseDbsStatement,
    columns: DBS_COLUMNS,
    summary: extractDbsSummary,
  },
  tmb: {
    parse: parseTmbStatement,
    columns: TMB_COLUMNS,
    summary: extractTmbSummary,
  },
  bob: {
    parse: parseBobStatement,
    columns: BOB_COLUMNS,
    summary: extractBobSummary,
  },
};

function resolveFederalConversion(text) {
  const desktopRows = parseFederalStatement(text);
  if (desktopRows.length) {
    return {
      rows: desktopRows,
      columns: FEDERAL_COLUMNS,
      summary: extractFederalSummary(text),
    };
  }

  if (isFederalLatestFormat(text)) {
    const rows = parseFederalLatestStatement(text);
    if (rows.length) {
      return {
        rows,
        columns: FEDERAL_LATEST_COLUMNS,
        summary: extractFederalLatestSummary(text),
      };
    }
  }

  const mobileRows = parseFederalMobileStatement(text);
  if (mobileRows.length) {
    return {
      rows: mobileRows,
      columns: FEDERAL_MOBILE_COLUMNS,
      summary: extractFederalMobileSummary(text),
    };
  }

  return {
    rows: [],
    columns: FEDERAL_COLUMNS,
    summary: extractFederalSummary(text),
  };
}

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

  let rows;
  let summaryDetails;
  let columns;

  if (bankId === 'federal') {
    const resolved = resolveFederalConversion(text);
    rows = resolved.rows;
    summaryDetails = resolved.summary;
    columns = resolved.columns;
  } else {
    rows = handler.parse(text);
    summaryDetails = handler.summary(text);
    columns = handler.columns;
  }

  if (!rows.length) {
    throw new Error(
      `No transactions were detected for ${bank.label}. Confirm you selected the correct bank.`,
    );
  }

  exportTransactionsToExcel({
    rows,
    columns,
    bankLabel: bank.label,
    fileName: file.name,
    summaryDetails,
  });

  return {
    count: rows.length,
    preview: rows.slice(0, 8),
    columns,
    bankLabel: bank.label,
    summaryDetails,
  };
}
