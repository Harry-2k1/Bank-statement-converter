const TXN_START_RE = /^(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2})(?:\s+(.+))?$/;
const FOOTER_RE = /(\d{2,4})\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;

const OD_TXN_START_RE =
  /^(\d{2}-[A-Z]{3}-\d{2})\s+(\d{2}-[A-Z]{3}-\d{2})\s+(\d+)\s+(.+)$/i;
const OD_FOOTER_RE = /^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;
const OD_INLINE_FOOTER_RE =
  /^(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;
const OD_REF_RE = /^(\d{10,12})\s+(.+)$/;

const OD_MONTHS = {
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

const OD_SKIP_PATTERNS = [
  /^statement of account$/i,
  /^canara bank$/i,
  /^trans$/i,
  /^date\s*:/i,
  /^value$/i,
  /^branch\s+ref\/chq\.no/i,
  /^description$/i,
  /^withdraws$/i,
  /^deposit$/i,
  /^balance$/i,
  /^ref\/chq\.no$/i,
  /^period\s*:/i,
  /^customer id/i,
  /^customer name/i,
  /^account no/i,
  /^account branch/i,
  /^account title/i,
  /^product name/i,
  /^ifsc\s*:/i,
  /^micr\s*:/i,
  /^swift code/i,
  /^branch address/i,
  /^email id/i,
  /^contact number/i,
  /^bank toll free/i,
  /^whatsapp banking/i,
  /^address\s*:/i,
  /^vpa id/i,
  /^joint holder/i,
  /^ckyc identifier/i,
  /^nominee id/i,
  /^name currency/i,
  /^clear balance may be/i,
  /^insurance advisory/i,
  /^unless the constituent/i,
  /^entries in such pass/i,
  /^beware of phishing/i,
  /^imb facility users/i,
  /^always login through/i,
  /^change in the address/i,
  /^do not share atm pin/i,
  /^fort glacis$/i,
  /^details of ombudsman/i,
  /^office of banking ombudsman/i,
  /^reserve bank of india/i,
  /^chandigarh$/i,
  /^tel:/i,
  /^e-mail:/i,
  /^are you a merchant/i,
  /^computer output does not/i,
  /^\*{6}end of statement/i,
  /^omalur$/i,
  /^salem$/i,
  /^tamil nadu$/i,
  /^in$/i,
  /^636455$/,
];

function shouldSkipOd(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\d{1,3}$/.test(trimmed)) return true;
  return OD_SKIP_PATTERNS.some((re) => re.test(trimmed));
}

function normalizeOdDate(token) {
  const match = token.match(/^(\d{2})-([A-Z]{3})-(\d{2})$/i);
  if (!match) return token;

  const month = OD_MONTHS[match[2].toUpperCase()];
  const year = Number(match[3]) >= 50 ? `19${match[3]}` : `20${match[3]}`;
  return month ? `${match[1]}/${month}/${year}` : token;
}

function splitOdStartRest(rest) {
  const inline = rest.match(OD_INLINE_FOOTER_RE);
  if (inline) {
    return {
      description: inline[1].trim(),
      footer: {
        withdraw: parseAmount(inline[2]),
        deposit: parseAmount(inline[3]),
        balance: parseAmount(inline[4]),
      },
      refNo: '',
    };
  }

  const refMatch = rest.match(OD_REF_RE);
  if (refMatch) {
    return {
      description: refMatch[2].trim(),
      footer: null,
      refNo: refMatch[1],
    };
  }

  return {
    description: rest.trim(),
    footer: null,
    refNo: '',
  };
}

/**
 * Parse Canara Bank OD account statements (DD-MMM-YY, Withdraws/Deposit columns).
 */
export function parseCanaraOdStatement(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const rows = [];

  let pending = null;

  const flush = () => {
    if (!pending?.footer) {
      pending = null;
      return;
    }

    const description = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
    const withdraw = pending.footer.withdraw;
    const deposit = pending.footer.deposit;
    const balance = pending.footer.balance;

    rows.push({
      txnDate: pending.txnDate,
      txnTime: '',
      valueDate: pending.valueDate,
      description,
      chqNo: pending.refNo,
      branchCode: pending.branchCode,
      debit: withdraw > 0 ? withdraw : null,
      credit: deposit > 0 ? deposit : null,
      balance,
    });

    pending = null;
  };

  for (const raw of lines) {
    if (shouldSkipOd(raw)) continue;

    const footerMatch = raw.match(OD_FOOTER_RE);
    if (footerMatch && pending) {
      pending.footer = {
        withdraw: parseAmount(footerMatch[1]),
        deposit: parseAmount(footerMatch[2]),
        balance: parseAmount(footerMatch[3]),
      };
      flush();
      continue;
    }

    const start = raw.match(OD_TXN_START_RE);
    if (start) {
      flush();

      const parsed = splitOdStartRest(start[4].trim());
      pending = {
        txnDate: normalizeOdDate(start[1]),
        valueDate: normalizeOdDate(start[2]),
        branchCode: start[3],
        refNo: parsed.refNo,
        lines: parsed.description ? [parsed.description] : [],
        footer: parsed.footer,
      };

      if (pending.footer) {
        flush();
      }
      continue;
    }

    if (pending) {
      pending.lines.push(raw);
    }
  }

  flush();
  return rows;
}

export function isCanaraOdFormat(text) {
  return (
    /STATEMENT OF ACCOUNT/i.test(text) &&
    /BRANCH\s+REF\/CHQ\.NO\s+DESCRIPTION\s+WITHDRAWS/i.test(text)
  );
}

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

  if (isCanaraOdFormat(text)) {
    return parseCanaraOdStatement(text);
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
