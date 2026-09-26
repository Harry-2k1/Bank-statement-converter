const TXN_START_RE =
  /^\d+\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}-[A-Za-z]{3}-\d{4})(?:\s+(.+))?$/i;
const FOOTER_RE =
  /(?:^|\s)(TFR|CASH|FT|MB|SBINT|CLG|RTGS|IMPS|NEFT|ATM|POS|CHRG|ECS|ACH|INT|REV|TDS|EFT)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+CR\s*$/i;

const MONTHS = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

const SKIP_PATTERNS = [
  /^account statement$/i,
  /^statement of account for the period/i,
  /^branch\s*:/i,
  /^name\s*:/i,
  /^communication address/i,
  /^address last updated/i,
  /^regd\. mobile/i,
  /^email id/i,
  /^type of account/i,
  /^scheme\s*:/i,
  /^ifsc\s*:/i,
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
  /^currency\s*:/i,
  /^date of issue/i,
  /^sl no\s+date\s+value date/i,
  /^particulars/i,
  /^tran\s*type/i,
  /^cheque\s*details/i,
  /^withdrawals/i,
  /^deposits/i,
  /^balance$/i,
  /^dr\s*\/\s*cr/i,
  /^the federal bank/i,
  /^page \d+ of/i,
  /^website:/i,
  /^ph:/i,
  /^this is a computer-generated/i,
  /^contents of this statement/i,
  /^you unless you inform us/i,
  /^abbreviations used/i,
  /^disclaimer/i,
  /^grand total/i,
  /^cash\s*:/i,
  /^tfr\s*:/i,
  /^ft\s*:/i,
  /^sbint\s*:/i,
  /^clg\s*:/i,
  /^mb\s*:/i,
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
  const match = token.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/i);
  if (!match) return token;

  const month = MONTHS[match[2].toUpperCase()];
  return month ? `${match[1]}/${month}/${match[3]}` : token;
}

function extractFooter(text) {
  const match = text.match(FOOTER_RE);
  if (!match) return null;

  const particulars = text.slice(0, match.index).replace(/\s+/g, ' ').trim();

  return {
    particulars,
    tranType: match[1],
    movement: parseAmount(match[2]),
    balance: parseAmount(match[3]),
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
  if (/^UPI_IN|^ACHCR|^FT_IMPS\/IFI|^CASH:|^SBINT:/i.test(upper)) {
    return { debit: null, credit: movement };
  }
  if (/^UPIOUT|^NFT\/|^CHRG\/|^TO CBDT|^POS\/|^ACHDR/i.test(upper)) {
    return { debit: movement, credit: null };
  }

  return { debit: movement, credit: null };
}

/**
 * Parse Federal Bank account statement PDFs (Sl No, DD-MMM-YYYY, Cheque Details column).
 */
export function parseFederalAccountStatement(text) {
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
      valueDate: pending.valueDate,
      particulars: footer.particulars.replace(/\s+/g, ' ').trim(),
      tranType: footer.tranType,
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
        date: normalizeDate(start[1]),
        valueDate: normalizeDate(start[2]),
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

export const FEDERAL_ACCOUNT_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'tranType', header: 'Tran Type' },
  { key: 'debit', header: 'Withdrawals' },
  { key: 'credit', header: 'Deposits' },
  { key: 'balance', header: 'Balance' },
];

export function isFederalAccountFormat(text) {
  return (
    /Sl No\s+Date\s+Value Date\s+Particulars/i.test(text) &&
    /^\d+\s+\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}-[A-Za-z]{3}-\d{4}/im.test(text) &&
    /(?:^|\s)(TFR|CASH)\s+[\d,]+\.?\d*\s+[\d,]+\.?\d*\s+CR\s*$/im.test(text)
  );
}
