const TXN_START_RE = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}-[A-Za-z]{3}-\d{4})(?:\s+(.+))?$/i;
const FOOTER_RE = /([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;

const SKIP_PATTERNS = [
  /^private & confidential/i,
  /^customer no\./i,
  /^ifsc code:/i,
  /^micr code:/i,
  /^branch address:/i,
  /^dear customer/i,
  /^your bank has been recognized/i,
  /^as we seek to become/i,
  /^for safety of your bank/i,
  /^team dbs/i,
  /^save with the safest/i,
  /^summary of account/i,
  /^account type\s+account no/i,
  /^savings account/i,
  /^\*\*\* end of summary/i,
  /^important abbreviations/i,
  /^atd\s+withdrawal/i,
  /^taxes as per/i,
  /^please update your gstin/i,
  /^in order to help us serve/i,
  /^registered office:/i,
  /^closing balance includes/i,
  /^ipsos research/i,
  /^dbs bank india limited from time to time/i,
  /^debit card/i,
  /^account name:/i,
  /^account no\./i,
  /^statement period:/i,
  /^transaction date\s+value date/i,
  /^opening balance\s+[\d,]/i,
  /^page\s+\d+ of/i,
  /^currency:/i,
  /^account balance/i,
  /^nomination registered/i,
  /^status\s+nomination/i,
  /^vijay nangagoundan$/i,
  /^no 644/i,
  /^pagalpatti/i,
  /^salem -/i,
  /^tamilnadu/i,
  /^dbs bank india limited$/i,
  /^chellapillaikuttai/i,
  /^land adj/i,
  /^omalur tk/i,
  /^https?:\/\//i,
  /^i"/,
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
  const match = text.match(FOOTER_RE);
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
  if (/^BY OWCLG|^NEFTIN|^IMPS-\d|^IMPS-P2A.*ENGINEER|^BY OWCLG\/|^CREDIT INTEREST/i.test(upper)) {
    return { debit: null, credit: movement };
  }
  if (/^IMPS-P2A|^CASH\s+WITHDRAWAL|^TRANSFER-|^RTGS-|^FEE|^.*GST ON/i.test(upper)) {
    return { debit: movement, credit: null };
  }

  return { debit: movement, credit: null };
}

/**
 * Parse DBS Bank India account statement text into transaction rows.
 */
export function parseDbsStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let prevBalance = null;

  const openingMatch = text.match(/Opening Balance\s+([\d,]+\.\d{2})/i);
  if (openingMatch) {
    prevBalance = parseAmount(openingMatch[1]);
  }

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
      txnDate: pending.txnDate,
      valueDate: pending.valueDate,
      description: footer.particulars.replace(/\s+/g, ' ').trim(),
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

      pending = {
        txnDate: start[1],
        valueDate: start[2],
        lines: start[3] ? [start[3].trim()] : [],
      };

      const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
      if (joined && extractFooter(joined)) {
        flush();
      }
      continue;
    }

    if (!pending) continue;

    pending.lines.push(raw);
    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (extractFooter(joined)) {
      flush();
    }
  }

  flush();
  return rows;
}

export const DBS_COLUMNS = [
  { key: 'txnDate', header: 'Transaction Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'description', header: 'Details' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
];
