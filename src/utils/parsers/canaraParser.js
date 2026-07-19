const TXN_START_RE = /^(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2})(?:\s+(.+))?$/;
const FOOTER_RE = /(\d{2,4})\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;

const SKIP_PATTERNS = [
  /^current & saving account statement/i,
  /^account statement as of/i,
  /^account holders name/i,
  /^customer id/i,
  /^branch name/i,
  /^micr code/i,
  /^ifsc code/i,
  /^searched by/i,
  /^account number/i,
  /^account currency/i,
  /^product name/i,
  /^opening balance/i,
  /^closing balance/i,
  /^txn date/i,
  /^value date/i,
  /^cheque no\./i,
  /^description/i,
  /^branch\s*code/i,
  /^debit\s+credit/i,
  /^balance$/i,
  /^page \d+ of/i,
  /^sri venkateswara/i,
  /^omalur$/i,
  /^salem$/i,
  /^22\/1 w/i,
  /^dhar?mapuri main/i,
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

  const branchCode = match[1];
  const movement = parseAmount(match[2]);
  const balance = parseAmount(match[3]);
  const before = text.slice(0, match.index).trim();

  let chqNo = '';
  let particulars = before;
  const chqMatch = before.match(/\s(\d{10,12})\s+(\d{2,4})\s*$/);
  if (chqMatch) {
    chqNo = chqMatch[1];
    particulars = before.slice(0, chqMatch.index).trim();
  }

  return { particulars, chqNo, branchCode, movement, balance };
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
  const creditHints = /\bCR-|\bCR\b|NEFT CR|IMPS-CR|INET-IMPS-CR|UPI\/CR|CREDIT/i;
  const debitHints = /\bDR-|\bDR\b|RTGS DR|IMPS-DR|CHQ PAID|DEBIT|GSTN|IB ITG|COMM -|SL - GST|PROC CHGS|ATM \/ IMPS/i;

  if (creditHints.test(upper) && !debitHints.test(upper)) {
    return { debit: null, credit: movement };
  }
  return { debit: movement, credit: null };
}

/**
 * Parse Canara Bank account statement text into transaction rows.
 */
export function parseCanaraStatement(text) {
  if (/Statement for A\/c/i.test(text) || /Date\s+Particulars\s+Deposits/i.test(text)) {
    return parseCanaraPassbookStatement(text);
  }

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
      txnDate: pending.txnDate,
      txnTime: pending.txnTime,
      valueDate: pending.valueDate,
      description: footer.particulars.replace(/\s+/g, ' ').trim(),
      chqNo: footer.chqNo,
      branchCode: footer.branchCode,
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

      const rest = (start[3] || '').trim();
      const valueDateMatch = rest.match(
        /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{2}-\d{2}-\d{4})(?:\s+(.*))?$/,
      );
      const valueDate = valueDateMatch ? valueDateMatch[1] : '';
      const afterValueDate = valueDateMatch ? (valueDateMatch[2] || '').trim() : rest;

      pending = {
        txnDate: start[1],
        txnTime: start[2],
        valueDate,
        lines: afterValueDate ? [afterValueDate] : [],
      };

      if (afterValueDate && extractFooter(afterValueDate)) {
        flush();
      }
      continue;
    }

    if (!pending) continue;

    pending.lines.push(raw);
    if (extractFooter(pending.lines.join(' ').replace(/\s+/g, ' ').trim())) {
      flush();
    }
  }

  flush();
  return rows;
}

const PASSBOOK_DATE_RE = /^(\d{2}-\d{2}-\d{4})$/;
const PASSBOOK_FOOTER_RE = /^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
const PASSBOOK_CHQ_RE = /^Chq:\s*(\S*)\s*$/i;

const PASSBOOK_SKIP = [
  /^Statement for A\/c/i,
  /^Customer Id/i,
  /^Name\s+/i,
  /^Phone\s+/i,
  /^Address\s+/i,
  /^Branch Code/i,
  /^Branch Name/i,
  /^IFSC Code/i,
  /^Date\s+Particulars/i,
  /^Opening Balance\s+[\d,]/i,
  /^page \d+$/i,
  /^#\d+/i,
  /^s\/o /i,
  /^tamil nadu$/i,
  /^suramangalam/i,
  /^junction main/i,
  /^between \d/i,
];

function shouldSkipPassbook(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return PASSBOOK_SKIP.some((re) => re.test(trimmed));
}

/**
 * Parse Canara Bank passbook / internet banking statement (Date + Particulars format).
 */
export function parseCanaraPassbookStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];
  let pending = null;
  let prevBalance = null;

  const openingMatch = text.match(/^Opening Balance\s+([\d,]+\.\d{2})/im);
  if (openingMatch) {
    prevBalance = parseAmount(openingMatch[1]);
  }

  const flush = () => {
    if (!pending?.footer) {
      pending = null;
      return;
    }

    const particulars = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const movement = pending.footer.movement;
    const balance = pending.footer.balance;

    const { debit, credit } = classifyMovement(particulars, movement, balance, prevBalance);

    rows.push({
      txnDate: pending.date,
      txnTime: '',
      valueDate: '',
      description: particulars,
      chqNo: pending.chqNo || '',
      branchCode: '',
      debit,
      credit,
      balance,
    });

    prevBalance = balance;
    pending = null;
  };

  for (const raw of lines) {
    if (shouldSkipPassbook(raw)) continue;

    const dateMatch = raw.match(PASSBOOK_DATE_RE);
    if (dateMatch) {
      flush();
      pending = { date: dateMatch[1], lines: [], chqNo: '', footer: null };
      continue;
    }

    const footerMatch = raw.match(PASSBOOK_FOOTER_RE);
    if (footerMatch && pending) {
      pending.footer = {
        movement: parseAmount(footerMatch[1]),
        balance: parseAmount(footerMatch[2]),
      };
      flush();
      continue;
    }

    const chqMatch = raw.match(PASSBOOK_CHQ_RE);
    if (chqMatch && pending) {
      pending.chqNo = chqMatch[1] === '0' ? '' : chqMatch[1];
      continue;
    }

    if (pending) {
      pending.lines.push(raw);
    }
  }

  flush();
  return rows;
}

export const CANARA_COLUMNS = [
  { key: 'txnDate', header: 'Txn Date' },
  { key: 'txnTime', header: 'Txn Time' },
  { key: 'valueDate', header: 'Value Date' },
  { key: 'description', header: 'Description' },
  { key: 'chqNo', header: 'Cheque No.' },
  { key: 'branchCode', header: 'Branch Code' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
];
