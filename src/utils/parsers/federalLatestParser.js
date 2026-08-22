const TXN_DATE_RE = /^(\d{2}-\d{2}-\d{4})\s*(.*)$/;
const FOOTER_RE =
  /\s(RTGS|IMPS|UPI|TRF|NEFT|ATM|POS|MB|FT|SBINT|CHRG|ECS|ACH|CLG|INT|REV|TDS|EFT)\s+(\d{2}-\d{2}-\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+CR\s+(\S+)\s*$/i;
const OPENING_BALANCE_RE = /^Opening Balance\s+CR\s+([\d,]+\.\d{2})/i;
const PAGE_FOOTER_RE = /\sPage \d+ of \d+.*$/i;
const END_MATTER_RE = /\sAbbreviations Used:.*$/i;

const SKIP_PATTERNS = [
  /^name$/i,
  /^communication address/i,
  /^address last updated/i,
  /^regd\. mobile/i,
  /^email id/i,
  /^type of account/i,
  /^scheme/i,
  /^ifsc/i,
  /^micr code/i,
  /^swift code/i,
  /^effective available/i,
  /^branch name/i,
  /^branch sol id/i,
  /^account number/i,
  /^customer id/i,
  /^account open date/i,
  /^account status/i,
  /^mode of operation/i,
  /^joint holders/i,
  /^nomination/i,
  /^currency/i,
  /^date of issue/i,
  /^statement of account for the period/i,
  /^date\s+value date/i,
  /^particulars/i,
  /^tran\s*type/i,
  /^tran id/i,
  /^cheque\s*details/i,
  /^withdrawals/i,
  /^deposits/i,
  /^balance$/i,
  /^type$/i,
  /^\(cr\/dr\)$/i,
  /^the federal bank/i,
  /^branch:/i,
  /^page \d+ of/i,
  /^website:/i,
  /^ph:/i,
  /^cin:/i,
  /^ckyc no/i,
  /^:$/,
  /^single$/i,
  /^nil$/i,
  /^active$/i,
  /^abbreviations used/i,
  /^disclaimer/i,
  /^grand total/i,
  /^\*{4} end of statement/i,
  /^cash\s*:/i,
  /^ft\s*:/i,
  /^sbint\s*:/i,
  /^tdint\s*:/i,
  /^trf\s*:/i,
  /^clg\s*:/i,
  /^mb\s*:/i,
  /^tds\s*:/i,
  /^this is a computer generated/i,
  /^contents of this statement/i,
  /^contact@/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}/.test(trimmed)) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function normalizeDate(token) {
  const match = token.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return token;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

function isTxnDateLine(line) {
  const match = line.match(TXN_DATE_RE);
  if (!match) return false;
  if (/^\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}/.test(line)) return false;
  return true;
}

function cleanJoined(text) {
  return text
    .replace(PAGE_FOOTER_RE, '')
    .replace(END_MATTER_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFooter(text) {
  const cleaned = cleanJoined(text);
  const match = cleaned.match(FOOTER_RE);
  if (!match) return null;

  const particulars = cleaned.slice(0, match.index).replace(/\s+/g, ' ').trim();

  return {
    particulars,
    tranType: match[1],
    valueDate: match[2],
    movement: parseAmount(match[3]),
    balance: parseAmount(match[4]),
    tranId: match[5],
  };
}

function classifyMovement(particulars, movement, balance, prevBalance) {
  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((balance - prevBalance).toFixed(2));
    if (Math.abs(Math.abs(delta) - movement) < 0.05) {
      return delta >= 0
        ? { debit: null, credit: movement }
        : { debit: movement, credit: null };
    }
    if (Math.abs(delta) > 0.05) {
      const amt = Math.abs(delta);
      return delta >= 0
        ? { debit: null, credit: amt }
        : { debit: amt, credit: null };
    }
  }

  const upper = particulars.toUpperCase();
  if (
    /^UPI IN|^IMPS CREDIT|^FT IMPS|^NEFT-|^NFT\/|^ACHCR|^SBINT:|^RTN:|^EFT\//i.test(upper)
  ) {
    return { debit: null, credit: movement };
  }
  if (/^UPIOUT|^TO ATM|^TO CBDT|^RTG\/P|^MB IMPS|^POS\/|^CHRG|^TDS|^NFT\//i.test(upper)) {
    return { debit: movement, credit: null };
  }
  if (/^FT IMPS\/IFI/i.test(upper)) {
    return { debit: null, credit: movement };
  }

  return { debit: movement, credit: null };
}

/**
 * Parse Federal Bank branch PDF statements (DD-MM-YYYY, reversed column layout).
 */
export function parseFederalLatestStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let prevBalance = null;

  const flush = () => {
    if (!pending) return;

    const footer = extractFooter(pending.lines.join(' '));
    if (!footer) {
      pending = null;
      return;
    }

    const { debit, credit } = classifyMovement(
      footer.particulars,
      footer.movement,
      footer.balance,
      prevBalance,
    );

    rows.push({
      date: normalizeDate(pending.date),
      valueDate: normalizeDate(footer.valueDate),
      particulars: footer.particulars.replace(/\s+/g, ' ').trim(),
      tranType: footer.tranType,
      tranId: footer.tranId,
      debit,
      credit,
      balance: footer.balance,
    });

    prevBalance = footer.balance;
    pending = null;
  };

  for (const raw of lines) {
    const opening = raw.match(OPENING_BALANCE_RE);
    if (opening) {
      flush();
      prevBalance = parseAmount(opening[1]);
      continue;
    }

    if (shouldSkip(raw)) continue;

    if (!isTxnDateLine(raw)) {
      if (pending) {
        pending.lines.push(raw);
        if (extractFooter(pending.lines.join(' '))) {
          flush();
        }
      }
      continue;
    }

    const start = raw.match(TXN_DATE_RE);
    flush();

    pending = {
      date: start[1],
      lines: start[2] ? [start[2].trim()] : [],
    };

    if (start[2] && extractFooter(pending.lines.join(' '))) {
      flush();
    }
  }

  flush();
  return rows;
}

export const FEDERAL_LATEST_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'tranType', header: 'Tran Type' },
  { key: 'tranId', header: 'Tran ID' },
  { key: 'debit', header: 'Withdrawals' },
  { key: 'credit', header: 'Deposits' },
  { key: 'balance', header: 'Balance' },
];

export function isFederalLatestFormat(text) {
  return /Opening Balance\s+CR/i.test(text) && FOOTER_RE.test(text);
}
