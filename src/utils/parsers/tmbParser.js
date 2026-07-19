const DATE_RE = /^(\d{2}\/\d{2}\/\d{4})\s*$/;
const AMOUNT_BALANCE_RE = /^([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;
const BALANCE_ONLY_RE = /^(-?[\d,]+\.\d{2})\s*$/;
const CHQ_ONLY_RE = /^\d{5,8}$/;

const SKIP_PATTERNS = [
  /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(AM|PM)/i,
  /^my transactions/i,
  /^transaction date from/i,
  /^transaction date to/i,
  /^statement of account/i,
  /^transactions list/i,
  /^cheque\s*no/i,
  /^txn\.?\s*date/i,
  /^transaction remarks/i,
  /^debit\s+credit/i,
  /^account balance/i,
  /^account number/i,
  /^cust id/i,
  /^branch id/i,
  /^branch name/i,
  /^branch address/i,
  /^email\s*:/i,
  /^mettur@/i,
  /^tmbl\d+/i,
  /^ifsc\s*:/i,
  /^page \d+ of/i,
  /^tamilnad mercantile bank/i,
  /^grand total/i,
  /^operative accounts/i,
  /^private limited/i,
  /^west main road/i,
  /^mettur-/i,
  /^no:\d+/i,
  /^1st floor/i,
  /^square market/i,
  /^tn$/i,
  /^in$/i,
  /^3\/6a\//i,
  /^rajaganapathy/i,
  /^mettur spr/i,
  /^mettur mettur/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, '').trim());
}

function stripTrailingAmount(text) {
  const match = text.match(/^(.*?)\s+([\d,]+\.\d{2})\s*$/);
  if (!match) return { particulars: text.trim(), movement: null };
  return {
    particulars: match[1].replace(/\s+/g, ' ').trim(),
    movement: parseAmount(match[2]),
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
    /^NEFT\/PHONEPE|^NEFT\/KR AND|^NEFT\/SALEM|^NEFT\/METTUR|^NEFT\/K|^CS\//i.test(upper)
  ) {
    return { debit: null, credit: movement };
  }
  if (
    /^EBANK\/TR TO|^ACH-TP|^RTGS\/HT|^INT\.COLL|^AA\d|^EBANK\/\d/i.test(upper)
  ) {
    return { debit: movement, credit: null };
  }

  return { debit: movement, credit: null };
}

function tryExtractFooter(joined) {
  const inline = joined.match(/([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/);
  if (inline) {
    return {
      particulars: joined.slice(0, inline.index).replace(/\s+/g, ' ').trim(),
      movement: parseAmount(inline[1]),
      balance: parseAmount(inline[2]),
    };
  }
  return null;
}

/**
 * Parse Tamilnad Mercantile Bank (TMB) statement text into transaction rows.
 */
export function parseTmbStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let prevBalance = null;

  const flush = (footer) => {
    if (!pending || !footer) {
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
      txnDate: pending.date,
      particulars: footer.particulars,
      chqNo: pending.chqNo || '',
      debit,
      credit,
      balance: footer.balance,
    });

    prevBalance = footer.balance;
    pending = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (shouldSkip(raw)) continue;

    if (CHQ_ONLY_RE.test(raw) && rows.length) {
      const last = rows[rows.length - 1];
      if (!last.chqNo) last.chqNo = raw;
      continue;
    }

    const dateMatch = raw.match(DATE_RE);
    if (dateMatch) {
      if (pending) {
        flush(tryExtractFooter(pending.lines.join(' ')));
      }
      pending = { date: dateMatch[1], lines: [], chqNo: '' };
      continue;
    }

    if (!pending) continue;

    const amountBalanceMatch = raw.match(AMOUNT_BALANCE_RE);
    if (amountBalanceMatch) {
      pending.lines.push(raw);
      flush({
        particulars: pending.lines.slice(0, -1).join(' ').replace(/\s+/g, ' ').trim(),
        movement: parseAmount(amountBalanceMatch[1]),
        balance: parseAmount(amountBalanceMatch[2]),
      });
      continue;
    }

    const balanceOnlyMatch = raw.match(BALANCE_ONLY_RE);
    if (balanceOnlyMatch) {
      const balance = parseAmount(balanceOnlyMatch[1]);
      const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
      const stripped = stripTrailingAmount(joined);
      if (stripped.movement !== null) {
        flush({
          particulars: stripped.particulars,
          movement: stripped.movement,
          balance,
        });
        continue;
      }
    }

    pending.lines.push(raw);
    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const footer = tryExtractFooter(joined);
    if (footer) {
      flush(footer);
    }
  }

  if (pending) {
    flush(tryExtractFooter(pending.lines.join(' ')));
  }

  return rows;
}

export const TMB_COLUMNS = [
  { key: 'txnDate', header: 'Txn Date' },
  { key: 'particulars', header: 'Transaction Remarks' },
  { key: 'chqNo', header: 'Cheque No.' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Account Balance' },
];
