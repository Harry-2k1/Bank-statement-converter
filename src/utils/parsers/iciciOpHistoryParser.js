const TXN_START_RE = /^(\d+)\s+(\d{2}\.\d{2}\.\d{4})\s*(.*)$/;
const FOOTER_RE = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

const SKIP_PATTERNS = [
  /^s no\./i,
  /^transaction$/i,
  /^date$/i,
  /^cheque number/i,
  /^transaction remarks/i,
  /^withdrawal/i,
  /^deposit/i,
  /^balance$/i,
  /^never share your otp/i,
  /^www\.icici/i,
  /^please call from your registered/i,
  /^dial your bank/i,
  /^your base branch/i,
  /^statement of transactions in saving account/i,
  /^, , , , , in,/i,
  /^tamil nadu - india/i,
  /^maramangalathupatti/i,
  /^258a,/i,
  /^salem$/i,
  /^mokan nagar/i,
  /^kureche/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\d{1,2}$/.test(trimmed)) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function normalizeDate(token) {
  return token.replace(/\./g, '/');
}

function classifyMovement(particulars, movement, balance, prevBalance) {
  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((balance - prevBalance).toFixed(2));
    if (Math.abs(delta) < 0.05) {
      return { withdrawal: null, deposit: null };
    }
    if (Math.abs(Math.abs(delta) - movement) < 0.05) {
      return delta >= 0
        ? { withdrawal: null, deposit: movement }
        : { withdrawal: movement, deposit: null };
    }
    if (Math.abs(delta) > 0.05) {
      const amt = Math.abs(delta);
      return delta >= 0
        ? { withdrawal: null, deposit: amt }
        : { withdrawal: amt, deposit: null };
    }
  }

  const upper = particulars.toUpperCase();
  if (/^NEFT-|^RTGS-|^MMT\/IMPS|^INF\/INFT|^RDVBEST|^MERWINCOIR/i.test(upper)) {
    return { withdrawal: null, deposit: movement };
  }

  return { withdrawal: movement, deposit: null };
}

/**
 * Parse ICICI Bank OpTransactionHistory / savings account statement PDFs.
 */
export function parseIciciOpHistoryStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let prevBalance = null;

  const flush = () => {
    if (!pending) return;

    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const footer = joined.match(FOOTER_RE);
    if (!footer) {
      pending = null;
      return;
    }

    const movement = parseAmount(footer[1]);
    const balance = parseAmount(footer[2]);
    const particulars = joined.slice(0, footer.index).replace(/\s+/g, ' ').trim();

    const { withdrawal, deposit } = classifyMovement(
      particulars,
      movement,
      balance,
      prevBalance,
    );

    rows.push({
      sno: pending.sno,
      date: normalizeDate(pending.date),
      particulars,
      withdrawal,
      deposit,
      balance,
    });

    prevBalance = balance;
    pending = null;
  };

  for (const raw of lines) {
    if (shouldSkip(raw)) continue;

    const start = raw.match(TXN_START_RE);
    if (start) {
      flush();

      pending = {
        sno: start[1],
        date: start[2],
        lines: start[3] ? [start[3].trim()] : [],
      };

      const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
      if (joined && FOOTER_RE.test(joined)) {
        flush();
      }
      continue;
    }

    if (!pending) continue;

    pending.lines.push(raw);
    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (FOOTER_RE.test(joined)) {
      flush();
    }
  }

  flush();
  return rows;
}

export const ICICI_OP_HISTORY_COLUMNS = [
  { key: 'sno', header: 'S No.' },
  { key: 'date', header: 'Transaction Date' },
  { key: 'particulars', header: 'Transaction Remarks' },
  { key: 'withdrawal', header: 'Withdrawal Amount (INR)' },
  { key: 'deposit', header: 'Deposit Amount (INR)' },
  { key: 'balance', header: 'Balance (INR)' },
];

export function isIciciOpHistoryFormat(text) {
  return (
    (/Statement of Transactions in Saving Account/i.test(text) ||
      /Withdrawal\s*Amount \(INR\)/i.test(text)) &&
    /Transaction\s*Remarks/i.test(text) &&
    /\d+\s+\d{2}\.\d{2}\.\d{4}/.test(text)
  );
}
