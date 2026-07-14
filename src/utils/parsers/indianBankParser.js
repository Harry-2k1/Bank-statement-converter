const DATE_PAIR_RE = /^(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})(?:\s+(.*))?$/;
const BALANCE_RE = /(-?\d{1,3}(?:,\d{2,3})*(?:\.\d{2})|-?\d+\.\d{2})\s*(Cr|Dr)\.?$/i;
const AMOUNT_RE = /\d{1,3}(?:,\d{2,3})*(?:\.\d{2})|\d+\.\d{2}/g;

const SKIP_PATTERNS = [
  /^statement of account/i,
  /^indian bank/i,
  /^account no/i,
  /^product\s*:/i,
  /^currency\s*:/i,
  /^int rate/i,
  /^limit\s*:/i,
  /^drawing power/i,
  /^cleared balance/i,
  /^uncleared amount/i,
  /^ckyc/i,
  /^nominee/i,
  /^branch code/i,
  /^phone no/i,
  /^email id/i,
  /^ifsc code/i,
  /^statement date/i,
  /^statement from/i,
  /^statement time/i,
  /^page no/i,
  /^post date/i,
  /^carried forward/i,
  /^statement\s*$/i,
  /^summary/i,
  /^dr\.\s*count/i,
  /^in case your account/i,
  /^extra care/i,
  /^closing balance\s*:/i,
  /^\*\*\*\s*end of statement/i,
  /^--\s*\d+\s+of\s+\d+\s*--/,
  /^adhoc\s+/i,
  /^mettur dam branch/i,
  /^salem dist/i,
  /^\d{5,6}$/,
  /^to\s*:/i,
];

const STOP_PATTERNS = [
  /\*\*\*\s*end of statement/i,
  /^closing balance\s*:/i,
];

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^brought forward/i.test(trimmed)) return true;
  return SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function parseAmountToken(token) {
  if (!token) return null;
  return Number(String(token).replace(/,/g, ''));
}

function parseClosing(line) {
  const match = line.match(BALANCE_RE);
  if (!match) return null;
  const value = parseAmountToken(match[1]);
  const side = match[2].toLowerCase();
  return {
    raw: match[0],
    value: side === 'dr' ? -Math.abs(value) : Math.abs(value),
    display: `${match[1]}${match[2]}`,
    index: match.index,
  };
}

function extractTxnAmounts(line) {
  const closing = parseClosing(line);
  if (!closing) return null;

  const before = line.slice(0, closing.index).trim();
  const amounts = before.match(AMOUNT_RE) || [];
  let chqNo = '';
  let debit = null;
  let credit = null;

  // Cheque number often appears as a bare integer before amounts
  let amountPart = before;
  if (/^\d{5,}\s/.test(before)) {
    const parts = before.split(/\s+/);
    if (/^\d+$/.test(parts[0]) && parts.length > 1) {
      chqNo = parts[0];
      amountPart = parts.slice(1).join(' ');
    }
  }

  const txnAmounts = (amountPart.match(AMOUNT_RE) || []).map(parseAmountToken);

  if (txnAmounts.length === 0) {
    return null;
  }

  // Indian Bank lines typically have one movement amount + balance.
  // Infer debit vs credit from balance direction when possible via caller.
  return {
    chqNo,
    amounts: txnAmounts,
    balance: closing.value,
    balanceDisplay: closing.display,
  };
}

/**
 * Parse Indian Bank statement text into transaction rows.
 */
export function parseIndianBankStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim());
  const rows = [];
  let current = null;
  let prevBalance = null;

  // Capture opening brought-forward if present for first classification
  for (const line of lines) {
    const bf = line.match(/brought forward\s+(-?\d{1,3}(?:,\d{2,3})*(?:\.\d{2})|-?\d+\.\d{2})\s*(cr|dr)?/i);
    if (bf) {
      const value = parseAmountToken(bf[1]);
      const side = (bf[2] || 'cr').toLowerCase();
      prevBalance = side === 'dr' ? -Math.abs(value) : Math.abs(value);
      break;
    }
  }

  const flush = () => {
    if (!current) return;

    const joined = current.detailLines.join(' ').replace(/\s+/g, ' ').trim();
    const amountInfo = current.amountInfo;
    if (!amountInfo || !amountInfo.amounts.length) {
      current = null;
      return;
    }

    const movement = amountInfo.amounts[amountInfo.amounts.length - 1];
    let debit = null;
    let credit = null;

    if (prevBalance !== null && Number.isFinite(prevBalance)) {
      const delta = Number((amountInfo.balance - prevBalance).toFixed(2));
      if (Math.abs(delta - movement) < 0.05) {
        credit = movement;
      } else if (Math.abs(delta + movement) < 0.05) {
        debit = movement;
      } else if (delta >= 0) {
        credit = movement;
      } else {
        debit = movement;
      }
    } else {
      // Heuristic from details text
      const upper = joined.toUpperCase();
      if (/TRANSFER FROM|CASH DEP|CREDIT|INTEREST|SALARY|UPI.*FROM/i.test(upper) && !/COMMISSION|CHARGES|TRANSFER TO/i.test(upper)) {
        credit = movement;
      } else if (/TRANSFER TO|CHARGES|COMMISSION|WITHDRAW|DEBIT|CASH WDL/i.test(upper)) {
        debit = movement;
      } else if (amountInfo.balance >= (prevBalance ?? 0)) {
        credit = movement;
      } else {
        debit = movement;
      }
    }

    rows.push({
      postDate: current.postDate,
      valueDate: current.valueDate,
      details: joined,
      chqNo: amountInfo.chqNo || '',
      debit,
      credit,
      balance: amountInfo.balanceDisplay,
    });

    prevBalance = amountInfo.balance;
    current = null;
  };

  for (const raw of lines) {
    if (STOP_PATTERNS.some((re) => re.test(raw))) {
      flush();
      break;
    }
    if (shouldSkip(raw)) continue;

    // Truncate footer fragments glued onto detail lines
    const cleaned = raw
      .replace(/\s*CLOSING BALANCE\s*:.*$/i, '')
      .replace(/\s*\*\*\*\s*END OF STATEMENT.*$/i, '')
      .replace(/\s*Extra Care\..*$/i, '')
      .trim();
    if (!cleaned) continue;

    const datePair = cleaned.match(DATE_PAIR_RE);
    if (datePair) {
      flush();
      const postDate = datePair[1];
      const valueDate = datePair[2];
      const remainder = (datePair[3] || '').trim();

      current = {
        postDate,
        valueDate,
        detailLines: [],
        amountInfo: null,
      };

      if (remainder) {
        const inlineAmounts = extractTxnAmounts(remainder);
        if (inlineAmounts) {
          // Details may sit before amounts on the same line
          const closing = parseClosing(remainder);
          const detailsPart = remainder.slice(0, closing.index).replace(AMOUNT_RE, '').replace(/^\d{5,}\s*/, '').trim();
          if (detailsPart) current.detailLines.push(detailsPart);
          // Re-extract with cheque handling on amount segment
          current.amountInfo = inlineAmounts;
        } else {
          current.detailLines.push(remainder);
        }
      }
      continue;
    }

    if (!current) continue;

    const amountInfo = extractTxnAmounts(cleaned);
    if (amountInfo) {
      // Line may also include trailing details before amounts
      const closing = parseClosing(cleaned);
      const before = cleaned.slice(0, closing.index).trim();
      const withoutAmounts = before
        .replace(AMOUNT_RE, ' ')
        .replace(/^\d{5,}\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (withoutAmounts && !/^(txn amt\.|charges\.)/i.test(withoutAmounts)) {
        current.detailLines.push(withoutAmounts);
      } else if (/txn amt\./i.test(before)) {
        current.detailLines.push(before.replace(AMOUNT_RE, ' ').replace(/\s+/g, ' ').trim());
      }
      current.amountInfo = amountInfo;
      continue;
    }

    current.detailLines.push(cleaned);
  }

  flush();
  return rows;
}

export const INDIAN_BANK_COLUMNS = [
  { key: 'postDate', header: 'Post Date' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'details', header: 'Details' },
  { key: 'chqNo', header: 'Chq.No.' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
];
