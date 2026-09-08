import { extractTextFromPdf } from './pdfExtractor';
import { parseHdfcStatement, HDFC_COLUMNS } from './parsers/hdfcParser';
import {
  parseIndianBankStatement,
  INDIAN_BANK_COLUMNS,
} from './parsers/indianBankParser';
import {
  parseIndianBankActivityStatement,
  INDIAN_BANK_ACTIVITY_COLUMNS,
  isIndianBankActivityFormat,
} from './parsers/indianBankActivityParser';
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
import {
  parseIciciNewStatement,
  ICICI_NEW_COLUMNS,
  isIciciNewFormat,
} from './parsers/iciciNewParser';
import {
  parseIciciOpHistoryStatement,
  ICICI_OP_HISTORY_COLUMNS,
  isIciciOpHistoryFormat,
} from './parsers/iciciOpHistoryParser';
import { parsePfEcrPdf, PF_ECR_COLUMNS } from './parsers/pfEcrParser';
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
  extractIciciNewSummary,
  extractIciciOpHistorySummary,
  extractPfEcrSummary,
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
import { BANKS, BANK_GROUPS } from './bankConfig';

export { BANKS, BANK_GROUPS };

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
  iciciNew: {
    parse: parseIciciNewStatement,
    columns: ICICI_NEW_COLUMNS,
    summary: extractIciciNewSummary,
  },
  iciciOpHistory: {
    parse: parseIciciOpHistoryStatement,
    columns: ICICI_OP_HISTORY_COLUMNS,
    summary: extractIciciOpHistorySummary,
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
  pfEcr: {
    parseFromPdf: parsePfEcrPdf,
    columns: PF_ECR_COLUMNS,
    summary: extractPfEcrSummary,
  },
};

function resolveIndianConversion(text) {
  if (isIndianBankActivityFormat(text)) {
    const rows = parseIndianBankActivityStatement(text);
    if (rows.length) {
      return {
        rows,
        columns: INDIAN_BANK_ACTIVITY_COLUMNS,
        summary: extractIndianBankSummary(text),
      };
    }
  }

  const rows = parseIndianBankStatement(text);
  return {
    rows,
    columns: INDIAN_BANK_COLUMNS,
    summary: extractIndianBankSummary(text),
  };
}

function resolveIciciConversion(text) {
  if (isIciciOpHistoryFormat(text)) {
    const rows = parseIciciOpHistoryStatement(text);
    if (rows.length) {
      return {
        rows,
        columns: ICICI_OP_HISTORY_COLUMNS,
        summary: extractIciciOpHistorySummary(text),
      };
    }
  }

  if (isIciciNewFormat(text)) {
    const rows = parseIciciNewStatement(text);
    if (rows.length) {
      return {
        rows,
        columns: ICICI_NEW_COLUMNS,
        summary: extractIciciNewSummary(text),
      };
    }
  }

  const rows = parseIciciStatement(text);
  return {
    rows,
    columns: ICICI_COLUMNS,
    summary: extractIciciSummary(text),
  };
}

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
  const bank = BANKS[bankId];
  const handler = BANK_HANDLERS[bankId];

  if (!bank || !handler) {
    throw new Error('Unsupported bank selected.');
  }

  let rows;
  let summaryDetails;
  let columns;

  try {
    if (handler.parseFromPdf) {
      const parsed = await handler.parseFromPdf(file);
      rows = parsed.rows;
      summaryDetails = handler.summary(parsed.headerText || '');
      columns = handler.columns;
    } else {
      const text = await extractTextFromPdf(file);

      if (!text || text.trim().length < 40) {
        throw new Error('Could not read text from this PDF. It may be scanned or image-only.');
      }

      if (bankId === 'federal') {
        const resolved = resolveFederalConversion(text);
        rows = resolved.rows;
        summaryDetails = resolved.summary;
        columns = resolved.columns;
      } else if (bankId === 'icici') {
        const resolved = resolveIciciConversion(text);
        rows = resolved.rows;
        summaryDetails = resolved.summary;
        columns = resolved.columns;
      } else if (bankId === 'indian') {
        const resolved = resolveIndianConversion(text);
        rows = resolved.rows;
        summaryDetails = resolved.summary;
        columns = resolved.columns;
      } else {
        rows = handler.parse(text);
        summaryDetails = handler.summary(text);
        columns = handler.columns;
      }
    }
  } catch (err) {
    const message = err?.message || String(err);
    if (/worker|pdfjs|GlobalWorkerOptions/i.test(message)) {
      throw new Error(
        'PDF reader failed to start. Refresh the page and try again in Chrome, Edge, or Firefox.',
      );
    }
    if (/Invalid PDF|password|encrypted/i.test(message)) {
      throw new Error('This PDF could not be opened. Check that it is not password-protected.');
    }
    throw err;
  }

  if (!rows.length) {
    const unit = bank.recordLabel || 'transactions';
    throw new Error(
      `No ${unit} were detected for ${bank.label}. Confirm you selected the correct format.`,
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
    recordLabel: bank.recordLabel || 'transactions',
  };
}
