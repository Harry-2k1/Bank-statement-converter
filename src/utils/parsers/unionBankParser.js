const DATE_RE = /^(\d{2}-\d{2}-\d{4})\s+(.+)$/;
const INDIAN_AMOUNT_RE = /[\d,]+\.\d{2}/g;
const BALANCE_RE = /([\d,]+\.\d{2})\s*(Dr|Cr)\.?\s*$/i;
const OPENING_BALANCE_RE =
  /^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*(Dr|Cr)\.?\s*$/i;

const SKIP_PATTERNS = [
  /^union bank of india/i,
  /^statement\s+of account/i,
  /^date\s+particulars/i,
  /^-{5,}/,
  /^to:\s*date:/i,
  /^m\/s\s+/i,
  /^page\s+\d+\s+of\s+\d+/i,
  /^https?:\/\//i,
  /^cumulative totals/i,
  /^\d{5},powappsrv/i,
  /^unless constituent/i,
  /^to strengthen your aadhaar/i,
  /^fastest mode of funds/i,
  /^ifsc\/micr code for/i,
  /^contact all india toll/i,
  /^please visit your branch/i,
  /^manager$/i,
  /^utr number/i,
  /^benefic?iary/i,
  /^sender (account|ifsc|bank|branch)/i,
  /^village\s*:/i,
  /^ckyc\s*no/i,
  /^cust\s*id\s*:/i,
  /^email id:/i,
  /^phone:/i,
  /^tamil nadu/i,
  /^salem-/i,
  /^na,/i,
  /^transaction details$/i,
  /^---page---$/i,
];

const STOP_PATTERNS = [
  /^unless constituent notifies/i,
  /^to strengthen your aadhaar/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseIndianAmount(token) {
  return Number(String(token).replace(/,/g, ''));
}

function classifyMovement(particulars, movement, prevBalance, balanceValue) {
  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((balanceValue - prevBalance).toFixed(2));
    if (Math.abs(Math.abs(delta) - movement) < 0.05) {
      return delta >= 0
        ? { withdrawal: movement, deposit: null }
        : { withdrawal: null, deposit: movement };
    }
  }

  const upper = particulars.toUpperCase();
  if (
    /DISBURSEMENT\s+CREDIT|REPAYMENT\s+CREDIT|^NEFT:[^T]|^NEFT\s+[A-Z]/i.test(upper) &&
    !/NEFT TO|NEFTO-|RTGSO-|YOURSELF|INT\.COLL|SMS CHARGES|TO [A-Z]/i.test(upper)
  ) {
    return { withdrawal: null, deposit: movement };
  }
  if (/NEFT TO|NEFTO-|RTGSO-|YOURSELF|INT\.COLL|SMS CHARGES|\bTO [A-Z]|NEFT BULK/i.test(upper)) {
    return { withdrawal: movement, deposit: null };
  }

  return { withdrawal: movement, deposit: null };
}

function parseTxnRest(rest) {
  const balMatch = rest.match(BALANCE_RE);
  if (!balMatch) return null;

  const balanceValue = parseIndianAmount(balMatch[1]);
  const balanceDisplay = `${balMatch[1]} ${balMatch[2]}`;
  const beforeBal = rest.slice(0, balMatch.index).trim();
  const amounts = beforeBal.match(INDIAN_AMOUNT_RE) || [];
  if (!amounts.length) return null;

  const movement = parseIndianAmount(amounts[amounts.length - 1]);
  const beforeMovement = beforeBal.slice(0, beforeBal.lastIndexOf(amounts[amounts.length - 1])).trim();

  let chqNo = '';
  let particulars = beforeMovement;
  const chqMatch = beforeMovement.match(/\s(\d{5,8})\s*$/);
  if (chqMatch) {
    chqNo = chqMatch[1];
    particulars = beforeMovement.slice(0, beforeMovement.lastIndexOf(chqMatch[1])).trim();
  }

  return {
    particulars: particulars.replace(/\s+/g, ' ').trim(),
    chqNo,
    movement,
    balanceValue,
    balanceDisplay,
  };
}

/**
 * Parse Union Bank of India statement text into transaction rows.
 */
export function parseUnionBankStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let prevBalance = null;

  for (const raw of lines) {
    if (STOP_PATTERNS.some((re) => re.test(raw))) break;
    if (shouldSkip(raw)) continue;

    const opening = raw.match(OPENING_BALANCE_RE);
    if (opening) {
      prevBalance = parseIndianAmount(opening[2]);
      continue;
    }

    const dateMatch = raw.match(DATE_RE);
    if (!dateMatch) continue;

    const parsed = parseTxnRest(dateMatch[2]);
    if (!parsed) continue;

    const { withdrawal, deposit } = classifyMovement(
      parsed.particulars,
      parsed.movement,
      prevBalance,
      parsed.balanceValue,
    );

    rows.push({
      date: dateMatch[1],
      particulars: parsed.particulars,
      chqNo: parsed.chqNo,
      withdrawal,
      deposit,
      balance: parsed.balanceDisplay,
    });

    prevBalance = parsed.balanceValue;
  }

  return rows;
}

export const UNION_BANK_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'chqNo', header: 'Chq.No.' },
  { key: 'withdrawal', header: 'Withdrawals' },
  { key: 'deposit', header: 'Deposits' },
  { key: 'balance', header: 'Balance' },
];
