const TXN_START_RE = /^([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})(?:\s+(.+))?$/i;

const SKIP_PATTERNS = [
  /^statement of account/i,
  /^branch:/i,
  /^city union bank/i,
  /^dial your bank/i,
  /^visit www/i,
  /^ref no/i,
  /^account no/i,
  /^current account/i,
  /^account type/i,
  /^date of opening/i,
  /^mode of operation/i,
  /^ckyc no/i,
  /^date\s+balance/i,
  /^particulars\s+debit/i,
  /^opening balance as on/i,
  /^amt brought forward/i,
  /^page \d+ of/i,
  /^regd\. office/i,
  /^telephone no/i,
  /^no \d+/i,
  /^dharmmapuri/i,
  /^omalur tk/i,
  /^authsgandany/i,
  /^sri venkateswara/i,
  /^\d{7}\s+customer/i,
  /^customer no$/i,
  /^:\s*:$/,
  /^0\.00$/,
  /^inr$/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function parseTxnBody(body, prevBalance, rowBalance) {
  const trimmed = body.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;

  const withChq = trimmed.match(/^(.*?)\s(\d{1,6})\s+([\d,]+\.\d{2})\s*$/);
  const amountOnly = trimmed.match(/^(.*?)\s([\d,]+\.\d{2})\s*$/);

  let particulars;
  let chqNo = '';
  let movement;

  if (withChq) {
    particulars = withChq[1].trim();
    chqNo = withChq[2];
    movement = parseAmount(withChq[3]);
  } else if (amountOnly) {
    particulars = amountOnly[1].trim();
    movement = parseAmount(amountOnly[2]);
  } else {
    return null;
  }

  let debit = null;
  let credit = null;

  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((rowBalance - prevBalance).toFixed(2));
    if (Math.abs(Math.abs(delta) - movement) < 0.05) {
      if (delta >= 0) credit = movement;
      else debit = movement;
    } else if (Math.abs(delta) > 0.05) {
      const amt = Math.abs(delta);
      if (delta >= 0) credit = amt;
      else debit = amt;
    }
  }

  if (debit === null && credit === null) {
    const upper = particulars.toUpperCase();
    if (/^BY\b|UPI\/CR|CREDIT|\bCR\b/.test(upper) && !/^TO\b/.test(upper)) {
      credit = movement;
    } else {
      debit = movement;
    }
  }

  return { particulars, chqNo, debit, credit };
}

/**
 * Parse City Union Bank (CUB) statement text into transaction rows.
 */
export function parseCubStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let prevBalance = null;

  const flush = () => {
    if (!pending) return;

    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const parsed = parseTxnBody(joined, prevBalance, pending.balance);
    if (!parsed) {
      pending = null;
      return;
    }

    rows.push({
      date: pending.date,
      balance: pending.balance,
      particulars: parsed.particulars,
      chqNo: parsed.chqNo,
      debit: parsed.debit,
      credit: parsed.credit,
    });

    prevBalance = pending.balance;
    pending = null;
  };

  for (const raw of lines) {
    if (shouldSkip(raw)) continue;

    const start = raw.match(TXN_START_RE);
    if (start) {
      flush();

      pending = {
        balance: parseAmount(start[1]),
        date: start[2].toUpperCase(),
        lines: start[3] ? [start[3].trim()] : [],
      };

      if (start[3] && parseTxnBody(start[3].trim(), prevBalance, pending.balance)) {
        flush();
      }
      continue;
    }

    if (!pending) continue;

    pending.lines.push(raw);
    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (parseTxnBody(joined, prevBalance, pending.balance)) {
      flush();
    }
  }

  flush();
  return rows;
}

export const CUB_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'chqNo', header: 'Chq No' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
];
