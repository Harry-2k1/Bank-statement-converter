const DATE_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/;
const AMOUNT_RE = /\d{1,3}(?:,\d{2,3})*(?:\.\d{2})|\d+\.\d{2}/g;
const BF_RE = /^B\/F\.{0,3}\s+([\d,]+\.\d{2})\s*$/i;

const SKIP_PATTERNS = [
  /^account statement/i,
  /^messrs\b/i,
  /^account summary/i,
  /^opening balance/i,
  /^count of cr/i,
  /^transactions$/i,
  /^statement of a\/c/i,
  /^txn$/i,
  /^date$/i,
  /^value$/i,
  /^brn$/i,
  /^code$/i,
  /^particulars\b/i,
  /^karur\s+vysya/i,
  /^email, phone/i,
  /^statements are sent/i,
  /^unless the constituent/i,
  /^we would like/i,
  /^to any one/i,
  /^eservice@/i,
  /^\*+acronyms/i,
  /^brn\s*->/i,
  /^to clg\s*->/i,
  /^csw\s*->/i,
  /^home branch/i,
  /^address\s*:/i,
  /^customer id$/i,
  /^acc\.type$/i,
  /^st\.date$/i,
  /^st\.period$/i,
  /^mobile no/i,
  /^email id$/i,
  /^tamil nadu$/i,
  /^\d{6}$/,
  /^--\s*\d+\s+of\s+\d+\s*--/,
  /^\+\s*-\s*=$/,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^:+$/.test(trimmed)) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function extractTrailingAmounts(text) {
  const matches = text.match(AMOUNT_RE) || [];
  if (matches.length < 2) return null;
  return {
    amounts: matches.map(parseAmount),
    raw: matches,
  };
}

function splitParticularsAndRef(beforeAmounts) {
  const trimmed = beforeAmounts.replace(/\s+/g, ' ').trim();
  // Ref no is typically 4-6 digits (or 000000) at the end
  const refMatch = trimmed.match(/^(.*?)(?:\s+(\d{4,6}|000000))$/);
  if (refMatch && refMatch[1].trim()) {
    return {
      particulars: refMatch[1].trim(),
      refNo: refMatch[2],
    };
  }
  return { particulars: trimmed, refNo: '' };
}

function classifyByBalance(movement, balance, prevBalance) {
  if (prevBalance === null || !Number.isFinite(prevBalance)) return null;
  const delta = Number((balance - prevBalance).toFixed(2));
  if (Math.abs(delta - movement) < 0.05) {
    return { debit: null, credit: movement };
  }
  if (Math.abs(delta + movement) < 0.05) {
    return { debit: movement, credit: null };
  }
  return null;
}

function classifyByDescription(particulars, movement) {
  const upper = particulars.toUpperCase();
  if (
    /\bFT\s*-\s*CR\b|\bNEFT\s*CR\b|\bIMPS\b.*\bCR\b|\bCREDIT\b|CASH DEP|BY CLG|INT\b|INTEREST/.test(
      upper,
    ) &&
    !/CHARGES|TAX|DEBIT|\bDR\b|TO CLG/.test(upper)
  ) {
    return { debit: null, credit: movement };
  }
  if (
    /\bFT\s*-\s*DR\b|\bNEFT\s*DR\b|TO CLG|CHARGES|TAX|DEBIT|\bDR\b|WITHDRAW|CSW/.test(
      upper,
    )
  ) {
    return { debit: movement, credit: null };
  }
  return { debit: movement, credit: null };
}

/**
 * Parse Karur Vysya Bank latest-format statement text.
 */
export function parseKvbLatestStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let prevBalance = null;
  let pending = null;

  const flushPending = () => {
    if (!pending) return;

    const amountInfo = extractTrailingAmounts(pending.tail);
    if (!amountInfo || amountInfo.amounts.length < 2) {
      pending = null;
      return;
    }

    const balance = amountInfo.amounts[amountInfo.amounts.length - 1];
    const movement = amountInfo.amounts[amountInfo.amounts.length - 2];
    // Rebuild "before" using the second-last amount occurrence
    const secondLast = amountInfo.raw[amountInfo.raw.length - 2];
    const beforeIdx = pending.tail.lastIndexOf(secondLast);
    const before = pending.tail.slice(0, beforeIdx).trim();
    const { particulars, refNo } = splitParticularsAndRef(before);

    const classified =
      classifyByBalance(movement, balance, prevBalance) ||
      classifyByDescription(particulars, movement);

    rows.push({
      txnDate: pending.txnDate,
      valueDate: pending.valueDate,
      branchCode: pending.branchCode,
      particulars,
      refNo,
      debit: classified.debit,
      credit: classified.credit,
      balance,
    });
    prevBalance = balance;
    pending = null;
  };

  for (const raw of lines) {
    if (shouldSkip(raw)) continue;

    const dateMatch = raw.match(DATE_RE);
    if (dateMatch) {
      flushPending();

      const txnDate = dateMatch[1];
      const valueDate = dateMatch[2];
      const rest = dateMatch[3].trim();

      const bf = rest.match(BF_RE);
      if (bf) {
        prevBalance = parseAmount(bf[1]);
        continue;
      }

      const withBranch = rest.match(/^(\d{3,5})\s+(.+)$/);
      if (!withBranch) continue;

      const branchCode = withBranch[1];
      const tail = withBranch[2].trim();
      const amountInfo = extractTrailingAmounts(tail);

      if (amountInfo && amountInfo.amounts.length >= 2) {
        pending = { txnDate, valueDate, branchCode, tail };
        flushPending();
      } else {
        // Multi-line particulars; wait for amount continuation
        pending = { txnDate, valueDate, branchCode, tail };
      }
      continue;
    }

    if (!pending) continue;

    // Continuation line(s) for wrapped particulars / amounts
    pending.tail = `${pending.tail} ${raw}`.replace(/\s+/g, ' ').trim();
    const amountInfo = extractTrailingAmounts(pending.tail);
    if (amountInfo && amountInfo.amounts.length >= 2) {
      // Prefer flushing when the continuation looks amount-heavy
      if (!/[A-Za-z]{4,}/.test(raw) || amountInfo.amounts.length >= 2) {
        flushPending();
      }
    }
  }

  flushPending();
  return rows;
}

export const KVB_LATEST_COLUMNS = [
  { key: 'txnDate', header: 'Txn Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'branchCode', header: 'Brn Code' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'refNo', header: 'Ref. No' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
];
