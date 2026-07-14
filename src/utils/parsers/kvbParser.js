const TXN_START_RE =
  /^(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(\d{2}-\d{2}-\d{4})\s+(\S+)\s+(?:(\d{6,})\s+)?(.+)$/;
const AMOUNT_RE = /\d{1,3}(?:,\d{2,3})*(?:\.\d{2})|\d+\.\d{2}/g;

const SKIP_PATTERNS = [
  /^account statement/i,
  /^as of\b/i,
  /^account name\b/i,
  /^account holder/i,
  /^account number\b/i,
  /^branch\b/i,
  /^customer id\b/i,
  /^account currency\b/i,
  /^opening balance/i,
  /^closing balance/i,
  /^searched by\b/i,
  /^from date\b/i,
  /^to date\b/i,
  /^transaction date\b/i,
  /^page no\.?/i,
  /^note\s*:-/i,
  /^--\s*\d+\s+of\s+\d+\s*--/,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function extractTrailingAmounts(text) {
  const matches = text.match(AMOUNT_RE) || [];
  if (matches.length < 2) return null;
  return {
    movement: parseAmount(matches[matches.length - 2]),
    balance: parseAmount(matches[matches.length - 1]),
    before: text.slice(0, text.lastIndexOf(matches[matches.length - 2])).trim(),
  };
}

function classifyByBalance(movement, balance, balanceBefore) {
  if (balanceBefore === null || !Number.isFinite(balanceBefore)) return null;
  const delta = Number((balance - balanceBefore).toFixed(2));
  if (Math.abs(delta - movement) < 0.05) {
    return { debit: null, credit: movement };
  }
  if (Math.abs(delta + movement) < 0.05) {
    return { debit: movement, credit: null };
  }
  return null;
}

function classifyByDescription(description, movement) {
  const upper = description.toUpperCase();
  if (/\bFT\s*-\s*CR\b|\bCR\b|CREDIT|INT PAYOUT|INTEREST|SALARY/.test(upper)) {
    return { debit: null, credit: movement };
  }
  if (
    /\bFT\s*-\s*DR\b|\bNEFT\s*DR\b|DEBIT|CHARGES|TAX RECOVERED|SWEEP-IN DEBIT|WITHDRAW/.test(
      upper,
    )
  ) {
    return { debit: movement, credit: null };
  }
  return { debit: movement, credit: null };
}

function readOpeningBalance(text) {
  const match = text.match(/Opening Balance[^\n]*?[ \t]+([\d,]+\.\d{2})/i);
  return match ? parseAmount(match[1]) : null;
}

/**
 * Parse Karur Vysya Bank statement text into transaction rows.
 */
export function parseKvbStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const openingBalance = readOpeningBalance(text);
  const draft = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const joined = current.detailLines.join(' ').replace(/\s+/g, ' ').trim();
    const amountInfo =
      current.amountInfo || extractTrailingAmounts(joined);
    if (!amountInfo) {
      current = null;
      return;
    }

    let description = current.amountInfo
      ? current.detailLines.join(' ').replace(/\s+/g, ' ').trim()
      : amountInfo.before;

    description = description
      .replace(AMOUNT_RE, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    draft.push({
      transactionDate: `${current.txnDate} ${current.txnTime}`,
      valueDate: current.valueDate,
      branch: current.branch,
      chequeNo: current.chequeNo || '',
      description,
      movement: amountInfo.movement,
      balance: amountInfo.balance,
    });
    current = null;
  };

  for (const raw of lines) {
    if (shouldSkip(raw)) {
      if (current?.amountInfo) flush();
      continue;
    }

    const start = raw.match(TXN_START_RE);
    if (start) {
      flush();
      const remainder = start[6].trim();
      const inlineAmounts = extractTrailingAmounts(remainder);
      current = {
        txnDate: start[1],
        txnTime: start[2],
        valueDate: start[3],
        branch: start[4],
        chequeNo: start[5] || '',
        detailLines: [],
        amountInfo: null,
      };

      if (inlineAmounts) {
        const desc = inlineAmounts.before.trim();
        if (desc) current.detailLines.push(desc);
        current.amountInfo = {
          movement: inlineAmounts.movement,
          balance: inlineAmounts.balance,
        };
      } else {
        current.detailLines.push(remainder);
      }
      continue;
    }

    if (!current) continue;

    const amounts = extractTrailingAmounts(raw);
    if (amounts && !/[A-Za-z]/.test(amounts.before)) {
      // Pure amount line (optional leading junk without letters)
      current.amountInfo = {
        movement: amounts.movement,
        balance: amounts.balance,
      };
      continue;
    }

    if (amounts && amounts.before) {
      current.detailLines.push(amounts.before);
      current.amountInfo = {
        movement: amounts.movement,
        balance: amounts.balance,
      };
      continue;
    }

    current.detailLines.push(raw);
  }

  flush();

  // Statement is newest-first; classify using the next older row's balance.
  return draft.map((row, index) => {
    const balanceBefore =
      index < draft.length - 1 ? draft[index + 1].balance : openingBalance;
    const classified =
      classifyByBalance(row.movement, row.balance, balanceBefore) ||
      classifyByDescription(row.description, row.movement);

    return {
      transactionDate: row.transactionDate,
      valueDate: row.valueDate,
      branch: row.branch,
      chequeNo: row.chequeNo,
      description: row.description,
      debit: classified.debit,
      credit: classified.credit,
      balance: row.balance,
    };
  });
}

export const KVB_COLUMNS = [
  { key: 'transactionDate', header: 'Transaction Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'branch', header: 'Branch' },
  { key: 'chequeNo', header: 'Cheque No' },
  { key: 'description', header: 'Description' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
];
