const TXN_START_RE = /^(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(.*))?$/;
const AMOUNT_LINE_RE =
  /([\d,]+\.\d{2})\s+(DR|CR)\s+([\d,]+\.\d{2})(?:\s+(\d{3,6}))?(?:\s|$)/i;

const SKIP_PATTERNS = [
  /^joint holder/i,
  /^scheme\s*:/i,
  /^currency\s*:/i,
  /^customer no/i,
  /^ifsc code/i,
  /^micr code/i,
  /^ckyc number/i,
  /^account statement report/i,
  /^statement of axis bank account/i,
  /^s\.no/i,
  /^transaction\s*date/i,
  /^value date/i,
  /^particulars/i,
  /^amount\(inr\)/i,
  /^debit\/credit/i,
  /^balance\(inr\)/i,
  /^cheque\s*number/i,
  /^branch name/i,
  /^dd\/mm\/yyyy/i,
  /^legends\s*:/i,
  /^registered office/i,
  /^branch address/i,
  /^unless the constituent/i,
  /^this is a system generated/i,
  /^---page---$/i,
  /^opening balance:/i,
];

const STOP_PATTERNS = [
  /^legends\s*:/i,
  /^\+\+\+\+\s*end of statement/i,
  /^transaction total/i,
  /^closing balance/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^mecheri,coimbatore/i.test(trimmed)) return true;
  if (/^\[tn\]\s*\(\d+\)$/i.test(trimmed)) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function extractAmountInfo(text) {
  const match = text.match(AMOUNT_LINE_RE);
  if (!match) return null;

  const amount = parseAmount(match[1]);
  const side = match[2].toUpperCase();
  const balance = parseAmount(match[3]);
  const chequeNo = match[4] || '';
  const amountIndex = match.index ?? text.indexOf(match[0]);
  const particulars = text.slice(0, amountIndex).replace(/\s+/g, ' ').trim();

  return { particulars, amount, side, balance, chequeNo };
}

/**
 * Parse Axis Bank Neo (corporate) statement text into transaction rows.
 */
export function parseAxisNeoStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;

  const flush = () => {
    if (!pending) return;

    const joined = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const info = extractAmountInfo(joined);
    if (!info) {
      pending = null;
      return;
    }

    rows.push({
      txnDate: pending.txnDate,
      valueDate: pending.valueDate,
      particulars: info.particulars,
      amount: info.amount,
      debitCredit: info.side,
      balance: info.balance,
      chequeNo: info.chequeNo,
      branch: pending.branch,
    });

    pending = null;
  };

  for (const raw of lines) {
    if (STOP_PATTERNS.some((re) => re.test(raw))) {
      flush();
      break;
    }
    if (shouldSkip(raw)) continue;

    if (/^mecheri,coimbatore/i.test(raw)) {
      if (pending) pending.branch = raw.replace(/\[TN\]\s*\(\d+\)\.?/i, '').trim();
      continue;
    }

    const startMatch = raw.match(TXN_START_RE);
    if (startMatch) {
      flush();
      pending = {
        txnDate: startMatch[2],
        valueDate: startMatch[3],
        lines: startMatch[4] ? [startMatch[4]] : [],
        branch: '',
      };

      if (startMatch[4] && extractAmountInfo(startMatch[4])) {
        flush();
      }
      continue;
    }

    if (!pending) continue;

    pending.lines.push(raw);
    if (extractAmountInfo(pending.lines.join(' ').replace(/\s+/g, ' ').trim())) {
      flush();
    }
  }

  flush();
  return rows;
}

export const AXIS_NEO_COLUMNS = [
  { key: 'txnDate', header: 'Transaction Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'amount', header: 'Amount (INR)' },
  { key: 'debitCredit', header: 'Debit/Credit' },
  { key: 'balance', header: 'Balance (INR)' },
  { key: 'chequeNo', header: 'Cheque Number' },
  { key: 'branch', header: 'Branch Name (SOL)' },
];
