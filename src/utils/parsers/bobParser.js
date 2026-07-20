const TXN_LINE_RE =
  /^(\d{2}-\d{2}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(\S+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+(?:\.\d{2})?)\s*$/;
const OPENING_BALANCE_RE = /^Opening\s+Balance\s*:\s*([\d,]+\.\d{2})Cr/i;
const BF_BALANCE_RE = /^B\/F\s+Balance\s*:\s*([\d,]+\.\d{2})Cr/i;

const SKIP_PATTERNS = [
  /^rep31/i,
  /^report to/i,
  /^solid/i,
  /^set id/i,
  /^gl sub head code/i,
  /^acct\s+range/i,
  /^currency code/i,
  /^account\s+label/i,
  /^open\/closed/i,
  /^period\s*:/i,
  /^limit details/i,
  /^order by gl/i,
  /^bank\s+of\s+baroda/i,
  /^service\s+outlet/i,
  /^account\s+no/i,
  /^peg review date/i,
  /^-{5,}/,
  /^gl\.\s+value/i,
  /^date\s+date/i,
  /^page total/i,
  /^total\s+credit/i,
  /^total\s+debit/i,
  /^closing\s+balance/i,
  /^signature/i,
  /^\*{5,}/,
  /^page \d+ of \d+ transaction details/i,
  /^https?:\/\//i,
  /^customer\s+account\s+ledger/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function normalizeDate(token) {
  const [day, month, year] = token.split('-');
  return `${day}/${month}/${year}`;
}

function classifyMovement(particulars, movement, prevBalance, parsedBalance) {
  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((parsedBalance - prevBalance).toFixed(2));
    if (Math.abs(Math.abs(delta) - movement) < 0.05) {
      return delta >= 0
        ? { debit: null, credit: movement }
        : { debit: movement, credit: null };
    }

    const afterDebit = Number((prevBalance - movement).toFixed(2));
    const afterCredit = Number((prevBalance + movement).toFixed(2));
    if (Math.abs(afterDebit - parsedBalance) < 1.01) {
      return { debit: movement, credit: null };
    }
    if (Math.abs(afterCredit - parsedBalance) < 1.01) {
      return { debit: null, credit: movement };
    }
  }

  const upper = particulars.toUpperCase();
  if (
    /^NEFT-|^RTGS-|^IMPS\/|^ACHCR|^RTN:NEFT|^RTN:RTGS/i.test(upper) &&
    !/^RTN:/i.test(upper)
  ) {
    return { debit: null, credit: movement };
  }
  if (/^RTN:/i.test(upper)) {
    return { debit: null, credit: movement };
  }
  if (/^TO\s|^CHARGES|^SMS CHARGES|^CHEQUE BOOK|^TDS U\/S|^RTGS-|^NEFT-|^RTN:/i.test(upper)) {
    return { debit: movement, credit: null };
  }

  return { debit: movement, credit: null };
}

/**
 * Parse Bank of Baroda (REP31 ledger) statement text into transaction rows.
 */
export function parseBobStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let runningBalance = null;

  for (const raw of lines) {
    if (shouldSkip(raw)) continue;

    const opening = raw.match(OPENING_BALANCE_RE);
    if (opening) {
      runningBalance = parseAmount(opening[1]);
      continue;
    }

    const bf = raw.match(BF_BALANCE_RE);
    if (bf) {
      runningBalance = parseAmount(bf[1]);
      continue;
    }

    const match = raw.match(TXN_LINE_RE);
    if (!match) continue;

    const glDate = normalizeDate(match[1]);
    const valueDate = normalizeDate(match[2]);
    const tranId = match[3];
    const particulars = match[4].replace(/\s+/g, ' ').trim();
    const movement = parseAmount(match[5]);
    const parsedBalance = parseAmount(match[6]);

    const { debit, credit } = classifyMovement(
      particulars,
      movement,
      runningBalance,
      parsedBalance,
    );

    if (runningBalance !== null) {
      runningBalance = debit
        ? Number((runningBalance - movement).toFixed(2))
        : Number((runningBalance + movement).toFixed(2));
    } else {
      runningBalance = parsedBalance;
    }

    rows.push({
      date: glDate,
      valueDate,
      tranId,
      particulars,
      debit,
      credit,
      balance: runningBalance,
    });
  }

  return rows;
}

export const BOB_COLUMNS = [
  { key: 'date', header: 'GL Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'tranId', header: 'Tran Id' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'debit', header: 'Debit Amount' },
  { key: 'credit', header: 'Credit Amount' },
  { key: 'balance', header: 'Balance' },
];
