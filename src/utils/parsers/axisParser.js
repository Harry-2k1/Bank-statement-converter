const DATE_RE = /^(\d{2}-\d{2}-\d{4})(?:\s+(.*))?$/;
const AMOUNT_TOKEN_RE = /[\d,]+\.\d{2}|\b0\b/g;
const OPENING_BALANCE_RE = /^OPENING BALANCE\s+([\d,]+\.\d{2})\s*$/i;

const SKIP_PATTERNS = [
  /^joint holder/i,
  /^customer id\s*:/i,
  /^ifsc code\s*:/i,
  /^micr code\s*:/i,
  /^nominee registered/i,
  /^registered mobile/i,
  /^registered email/i,
  /^scheme\s*:/i,
  /^statement of account no/i,
  /^tran date/i,
  /^chq no/i,
  /^particulars/i,
  /^debit\s+credit/i,
  /^init\.\s*br/i,
  /^charge statement/i,
  /^sr\.\s*no\./i,
  /^legends\s*:/i,
  /^registered office/i,
  /^branch address/i,
  /^unless the constituent/i,
  /^the closing balance/i,
  /^we would like/i,
  /^with effect from/i,
  /^deposit insurance/i,
  /^in compliance with/i,
  /^to ensure you never/i,
  /^this is a system generated/i,
  /^pan\s*:/i,
  /^nominee name/i,
  /^\d{1,2}\.\s+the 'charges'/i,
  /^\d{1,2}\.\s+the chargeable/i,
  /^period\s+recover date/i,
  /^monthly service\s*$/i,
  /^charge\s*$/i,
  /^---page---$/i,
  /^sri\s+/i,
  /^\d+\s+[a-z].*(?:purath|post|tk|dist)/i,
  /^sale?m\s+\d/i,
  /^tamil nadu\s+\d/i,
  /^\d{6}\s+nominee/i,
];

const STOP_PATTERNS = [
  /^transaction total/i,
  /^closing balance/i,
  /^charge statement of axis/i,
  /^\+\+\+\+\s*end of statement/i,
  /^legends\s*:/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmount(token) {
  if (token === undefined || token === null || token === '') return null;
  return Number(String(token).replace(/,/g, ''));
}

function extractAmountSuffix(line) {
  const branchMatch = line.match(/\s(\d{2,4})\s*$/);
  if (!branchMatch) return null;

  const branch = branchMatch[1];
  const beforeBranch = line.slice(0, branchMatch.index).trim();
  const amounts = beforeBranch.match(AMOUNT_TOKEN_RE) || [];
  if (amounts.length < 2) return null;

  const parsed = amounts.map(parseAmount);
  const balance = parsed[parsed.length - 1];
  const particulars = beforeBranch
    .slice(0, beforeBranch.lastIndexOf(amounts[amounts.length - 1]))
    .replace(new RegExp(`${amounts[amounts.length - 2]}\\s*$`), '')
    .trim();

  if (parsed.length >= 3) {
    const debit = parsed[parsed.length - 3];
    const credit = parsed[parsed.length - 2];
    return { particulars, debit, credit, balance, branch };
  }

  const movement = parsed[parsed.length - 2];
  return { particulars, debit: null, credit: null, movement, balance, branch };
}

function classifyMovement(particulars, debit, credit, movement, balance, prevBalance) {
  if (debit !== null && credit !== null) {
    if (debit === 0 && credit > 0) {
      return { debit: null, credit };
    }
    if (credit === 0 && debit > 0) {
      return { debit, credit: null };
    }
    if (prevBalance !== null && Number.isFinite(prevBalance)) {
      const delta = Number((balance - prevBalance).toFixed(2));
      if (Math.abs(delta - credit) < 0.05) {
        return { debit: null, credit };
      }
      if (Math.abs(delta + debit) < 0.05) {
        return { debit, credit: null };
      }
    }
  }

  const amount = movement ?? debit ?? credit;
  if (amount === null || amount === undefined) {
    return { debit: null, credit: null };
  }

  if (prevBalance !== null && Number.isFinite(prevBalance)) {
    const delta = Number((balance - prevBalance).toFixed(2));
    if (Math.abs(delta - amount) < 0.05) {
      return { debit: null, credit: amount };
    }
    if (Math.abs(delta + amount) < 0.05) {
      return { debit: amount, credit: null };
    }
  }

  const upper = particulars.toUpperCase();
  if (
    /NEFT\/|IMPS\/|TRF\/|CASH DEP|CREDIT|INTEREST PAID|SALARY/.test(upper) &&
    !/SERVICE CHRGS|GST @|AVG BAL CHRGS|CARD CHARGES|DR CARD/.test(upper)
  ) {
    return { debit: null, credit: amount };
  }
  if (/CHRGS|CHARGES|GST @|NEFT\/MB\/|IMPS\/P2A\/|DR CARD|AVG BAL/.test(upper)) {
    return { debit: amount, credit: null };
  }

  return balance >= (prevBalance ?? 0)
    ? { debit: null, credit: amount }
    : { debit: amount, credit: null };
}

/**
 * Parse Axis Bank account statement text into transaction rows.
 */
export function parseAxisStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let prevBalance = null;
  let current = null;

  const flush = () => {
    if (!current) return;

    const joined = [current.inlineParticulars, ...current.lines]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const suffix = extractAmountSuffix(joined);
    if (!suffix) {
      current = null;
      return;
    }

    const particulars = [current.inlineParticulars, suffix.particulars]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const { debit, credit } = classifyMovement(
      particulars,
      suffix.debit,
      suffix.credit,
      suffix.movement,
      suffix.balance,
      prevBalance,
    );

    rows.push({
      tranDate: current.tranDate,
      chqNo: current.chqNo,
      particulars,
      debit,
      credit,
      balance: suffix.balance,
      initBranch: suffix.branch,
    });

    prevBalance = suffix.balance;
    current = null;
  };

  for (const raw of lines) {
    if (STOP_PATTERNS.some((re) => re.test(raw))) {
      flush();
      break;
    }
    if (shouldSkip(raw)) continue;

    const opening = raw.match(OPENING_BALANCE_RE);
    if (opening) {
      flush();
      prevBalance = parseAmount(opening[1]);
      continue;
    }

    const dateMatch = raw.match(DATE_RE);
    if (dateMatch) {
      flush();

      const tranDate = dateMatch[1];
      const rest = (dateMatch[2] || '').trim();
      current = {
        tranDate,
        chqNo: '',
        inlineParticulars: '',
        lines: [],
      };

      if (rest) {
        const suffix = extractAmountSuffix(rest);
        if (suffix) {
          current.lines.push(rest);
          flush();
        } else {
          current.inlineParticulars = rest;
        }
      }
      continue;
    }

    if (!current) continue;

    current.lines.push(raw);
    const joined = [current.inlineParticulars, ...current.lines].join(' ').replace(/\s+/g, ' ').trim();
    if (extractAmountSuffix(joined)) {
      flush();
    }
  }

  flush();
  return rows;
}

export const AXIS_COLUMNS = [
  { key: 'tranDate', header: 'Tran Date' },
  { key: 'chqNo', header: 'Chq No' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
  { key: 'initBranch', header: 'Init. Br' },
];
