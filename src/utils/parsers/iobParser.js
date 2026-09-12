const TXN_START_RE = /^(\d{2}-\d{2}-\d{4})\s*([A-Z]{0,3}\d+)\s+(.+)$/i;
const BALANCE_RE = /([\d,]+\.\d{2})\s*(CR|DR)\.?\s*$/i;
const OPENING_BALANCE_RE = /Account\s+Opening\s+balance\s*:\s*([\d,]+\.\d{2})\s*(CR|DR)/i;
const BF_BALANCE_RE = /Brought\s+Forward\s*:\s*([\d,]+\.\d{2})/i;

const SKIP_PATTERNS = [
  /^rep27/i,
  /^report to/i,
  /^service outlet/i,
  /^account number/i,
  /^report for the period/i,
  /^report\s+for\s+the\s+period/i,
  /^-{5,}/,
  /^date tran ref num/i,
  /^id date$/i,
  /^indian overseas bank/i,
  /^page \d+$/i,
  /^total\(curr/i,
  /^manager\/chief/i,
  /^date\s*:\s*\d{2}-\d{2}-\d{4}$/i,
  /^\*\*\*/i,
  /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}/i,
];

const STOP_PATTERNS = [/^total\(curr/i, /^\*\*\*/i];

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

function classifyMovement(movement, prevBalance, balanceVal) {
  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((balanceVal - prevBalance).toFixed(2));
    if (Math.abs(delta - movement) < 0.05) {
      return delta >= 0
        ? { debit: null, credit: movement }
        : { debit: movement, credit: null };
    }
    if (Math.abs(delta + movement) < 0.05) {
      return { debit: movement, credit: null };
    }
    if (delta >= 0) return { debit: null, credit: movement };
    return { debit: movement, credit: null };
  }

  return { debit: null, credit: movement };
}

function parseTxnLine(raw, prevBalance) {
  const balanceMatch = raw.match(BALANCE_RE);
  if (!balanceMatch) return null;

  const balanceSide = balanceMatch[2].toUpperCase();
  const balanceVal =
    parseAmount(balanceMatch[1]) * (balanceSide === 'DR' ? -1 : 1);
  const balanceDisplay = `${balanceMatch[1]} ${balanceSide}`;

  const beforeBalance = raw.slice(0, balanceMatch.index).trim();
  const start = beforeBalance.match(TXN_START_RE);
  if (!start) return null;

  let particulars = start[3].trim();
  const amounts = [];

  while (true) {
    const match = particulars.match(/\s([\d,]+\.\d{2})\s*$/);
    if (!match) break;
    amounts.unshift(parseAmount(match[1]));
    particulars = particulars.slice(0, match.index).trim();
  }

  if (!amounts.length || !particulars) return null;

  let debit = null;
  let credit = null;

  if (amounts.length >= 2) {
    debit = amounts[0];
    credit = amounts[1];
  } else {
    ({ debit, credit } = classifyMovement(amounts[0], prevBalance, balanceVal));
  }

  return {
    date: normalizeDate(start[1]),
    tranRef: start[2],
    particulars: particulars.replace(/\s+/g, ' ').trim(),
    debit,
    credit,
    balance: balanceDisplay,
    balanceVal,
  };
}

/**
 * Parse Indian Overseas Bank (REP27) statement text into transaction rows.
 */
export function parseIobStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let prevBalance = null;

  for (const raw of lines) {
    if (STOP_PATTERNS.some((re) => re.test(raw))) break;
    if (shouldSkip(raw)) continue;

    const opening = raw.match(OPENING_BALANCE_RE);
    if (opening) {
      prevBalance =
        parseAmount(opening[1]) * (opening[2].toUpperCase() === 'DR' ? -1 : 1);
      continue;
    }

    const bf = raw.match(BF_BALANCE_RE);
    if (bf) {
      prevBalance = parseAmount(bf[1]);
      continue;
    }

    const txn = parseTxnLine(raw, prevBalance);
    if (!txn) continue;

    rows.push({
      date: txn.date,
      tranRef: txn.tranRef,
      particulars: txn.particulars,
      debit: txn.debit,
      credit: txn.credit,
      balance: txn.balance,
    });

    prevBalance = txn.balanceVal;
  }

  return rows;
}

export const IOB_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'tranRef', header: 'Tran Ref Num' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'debit', header: 'Debit Amt.' },
  { key: 'credit', header: 'Credit Amt.' },
  { key: 'balance', header: 'Balance Amt.' },
];
