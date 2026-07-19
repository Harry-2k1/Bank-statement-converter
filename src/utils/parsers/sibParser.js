const TXN_START_RE = /^(\d{2}-\d{2}-\d{2})\s+(.+)$/;
const FOOTER_RE = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})Cr\s*$/i;
const INLINE_FOOTER_RE = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})Cr\s*$/i;

const SKIP_PATTERNS = [
  /^sibl\d+/i,
  /^ifsc:/i,
  /^ph:/i,
  /^mode of opr/i,
  /^a\/c no/i,
  /^customer id/i,
  /^date:\s*\d/i,
  /^page:/i,
  /^statement of account for the period/i,
  /^particulars\s+date/i,
  /^n vijay engineer/i,
  /^type\s*:\s*current account/i,
  /^currency code/i,
  /^@\w+/i,
  /^pin:/i,
  /^pagalpatti/i,
  /^kuttakadu/i,
  /^tamil nadu/i,
  /^salem$/i,
  /^india$/i,
  /^page total/i,
  /^\d+\s+page \d+ of/i,
  /^visit us at/i,
  /^7,96,553/i,
  /^smr building/i,
  /^kakkapalayam/i,
  /^natraj/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function extractFooter(text) {
  const match = text.match(INLINE_FOOTER_RE);
  if (!match) return null;

  const movement = parseAmount(match[1]);
  const balance = parseAmount(match[2]);
  const particulars = text.slice(0, match.index).replace(/\s+/g, ' ').trim();

  return { particulars, movement, balance };
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
  if (/^IMPS\/|^MOB\/RRN.*\/CR|NEFT CR|\/CR\//i.test(upper)) {
    return { debit: null, credit: movement };
  }
  if (/CHARGES|NACH_DR|DIRECT DEBIT|NEFT TO|MOB\/RRN.*\/IMPS/i.test(upper)) {
    return { debit: movement, credit: null };
  }

  return { debit: movement, credit: null };
}

/**
 * Parse South Indian Bank (SIB) account statement text into transaction rows.
 */
export function parseSibStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let prevBalance = null;

  const flush = () => {
    if (!pending) return;

    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const footer = extractFooter(joined);
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
      date: pending.date,
      particulars: footer.particulars.replace(/\s+/g, ' ').trim(),
      chqNo: '',
      debit,
      credit,
      balance: footer.balance,
    });

    prevBalance = footer.balance;
    pending = null;
  };

  for (const raw of lines) {
    if (shouldSkip(raw)) continue;

    const start = raw.match(TXN_START_RE);
    if (start) {
      flush();

      const rest = start[2].trim();
      pending = { date: start[1], lines: [rest] };

      if (extractFooter(rest)) {
        flush();
      }
      continue;
    }

    if (!pending) continue;

    if (FOOTER_RE.test(raw)) {
      pending.lines.push(raw);
      flush();
      continue;
    }

    pending.lines.push(raw);
    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (extractFooter(joined)) {
      flush();
    }
  }

  flush();
  return rows;
}

export const SIB_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'chqNo', header: 'Chq No.' },
  { key: 'debit', header: 'Withdrawals' },
  { key: 'credit', header: 'Deposits' },
  { key: 'balance', header: 'Balance' },
];
