function normalize(text) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function field(text, patterns) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  for (const pattern of list) {
    const match = text.match(pattern);
    if (match?.[1] !== undefined) {
      return match[1].replace(/[ \t]+/g, ' ').trim();
    }
  }
  return '';
}

/** Same-line value capture (do not let \s eat newlines). */
const V = String.raw`[ \t]*([^\n]*)`;

function push(rows, label, value) {
  rows.push([label, value ?? '']);
}

/**
 * Extract Indian Bank statement header / account details for the Summary sheet.
 */
export function extractIndianBankSummary(rawText) {
  if (/ACCOUNT ACTIVITY/i.test(rawText)) {
    return extractIndianBankActivitySummary(rawText);
  }

  const text = normalize(rawText);
  const rows = [];

  const headerBlock = text.match(
    /STATEMENT OF ACCOUNT\n([\s\S]*?)(?=\nAccount\s*No\s*:)/i,
  );
  if (headerBlock) {
    const lines = headerBlock[1]
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (lines[0]) push(rows, 'Account Holder', lines[0]);
    if (lines.length > 1) {
      push(rows, 'Address', lines.slice(1).join(', '));
    }
  }

  push(rows, 'Account No', field(text, new RegExp(`Account\\s*No\\s*:${V}`, 'i')));
  push(rows, 'Product', field(text, new RegExp(`Product\\s*:${V}`, 'i')));
  push(rows, 'Currency', field(text, new RegExp(`Currency\\s*:${V}`, 'i')));
  push(rows, 'Int Rate', field(text, new RegExp(`Int\\s*Rate\\s*:${V}`, 'i')));
  push(rows, 'Limit', field(text, new RegExp(`Limit\\s*:${V}`, 'i')));
  push(rows, 'Drawing Power', field(text, new RegExp(`Drawing\\s*Power\\s*:${V}`, 'i')));
  push(rows, 'Cleared Balance', field(text, new RegExp(`Cleared\\s*Balance\\s*:${V}`, 'i')));
  push(rows, 'Uncleared Amount', field(text, new RegExp(`Uncleared\\s*Amount\\s*:${V}`, 'i')));
  push(rows, 'Ckyc ID', field(text, new RegExp(`Ckyc\\s*ID\\s*:${V}`, 'i')));
  push(rows, 'Nominee Type', field(text, new RegExp(`Nominee\\s*Type\\s*:${V}`, 'i')));
  push(rows, 'Nominee Name1', field(text, new RegExp(`Nominee\\s*Name1\\s*:${V}`, 'i')));
  push(rows, 'Nominee Name2', field(text, new RegExp(`Nominee\\s*Name2\\s*:${V}`, 'i')));
  push(rows, 'Nominee Name3', field(text, new RegExp(`Nominee\\s*Name3\\s*:${V}`, 'i')));
  push(rows, 'Nominee Name4', field(text, new RegExp(`Nominee\\s*Name4\\s*:${V}`, 'i')));

  const branchBlock = text.match(
    /INDIAN\s+BANK\n([\s\S]*?)(?=\nBranch\s*Code\s*:)/i,
  );
  if (branchBlock) {
    const branchLines = branchBlock[1]
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (branchLines[0]) push(rows, 'Bank / Branch', `INDIAN BANK, ${branchLines[0]}`);
    if (branchLines.length > 1) {
      push(rows, 'Branch Address', branchLines.slice(1).join(', '));
    }
  } else {
    push(rows, 'Bank / Branch', 'INDIAN BANK');
  }

  push(rows, 'Branch Code', field(text, new RegExp(`Branch\\s*Code\\s*:${V}`, 'i')));
  push(rows, 'Phone No', field(text, new RegExp(`Phone\\s*No\\s*:${V}`, 'i')));
  push(rows, 'Email ID', field(text, new RegExp(`Email\\s*ID\\s*:${V}`, 'i')));
  push(rows, 'IFSC Code', field(text, new RegExp(`IFSC\\s*Code\\s*:${V}`, 'i')));
  push(rows, 'Statement Date', field(text, new RegExp(`Statement\\s*Date\\s*:${V}`, 'i')));
  push(rows, 'Statement From', field(text, new RegExp(`Statement\\s*From\\s*:${V}`, 'i')));
  push(
    rows,
    'Statement To',
    field(text, [
      new RegExp(`\\nTo\\s*:${V}`, 'i'),
      /Statement\s*From\s*:[^\n]*?[ \t]+To[ \t]*:[ \t]*([^\n]+)/i,
    ]),
  );
  push(rows, 'Statement Time', field(text, new RegExp(`Statement\\s*Time\\s*:${V}`, 'i')));

  return rows;
}

/**
 * Extract Indian Bank "Account Activity" statement header details.
 */
export function extractIndianBankActivitySummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Indian Bank');
  push(rows, 'Format', 'Account Activity');
  push(rows, 'Account Holder', field(text, /Account Holder Name\s+([\s\S]+?)\s+Account Type\s+/i));
  push(rows, 'Account Type', field(text, /Account Type\s+([^\n]+)/i));
  push(rows, 'Account Number', field(text, /Account Number\s+(\d+)/i));
  push(rows, 'Branch Name', field(text, /Branch Name\s+([^\n]+)/i));
  push(rows, 'IFSC', field(text, /\bIFSC\s+([A-Z0-9]+)/i));
  push(rows, 'Currency', field(text, /Account Currency\s+([A-Z]+)/i));
  push(rows, 'Statement Period', field(text, /For period:\s*([^\n]+)/i));
  push(rows, 'Opening Balance', field(text, /Opening Balance\s+INR\s+([\d,]+\.\d{2}\s*CR)/i));
  push(rows, 'Total Credits', field(text, /Total Credits\s+\+\s*INR\s+([\d,]+\.\d{2})/i));
  push(rows, 'Total Debits', field(text, /Total Debits\s+-\s*INR\s+([\d,]+\.\d{2})/i));
  push(
    rows,
    'Closing Balance',
    field(text, /Ending Balance\s+INR\s+([\d,]+\.\d{2}\s*CR)/i),
  );

  const address = field(text, /Customer'?s Address\s+([\s\S]+?)(?:Branch Name)/i);
  if (address) {
    push(rows, 'Address', address.replace(/\s+/g, ' ').trim());
  }

  return rows;
}

/**
 * Extract HDFC statement header / account details for the Summary sheet.
 */
export function extractHdfcSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  const accountBlock = text.match(
    /Statement of account\n([\s\S]*?)(?=\nJOINT HOLDERS\s*:|\nNomination\s*:|\nStatement From\s*:)/i,
  );
  if (accountBlock) {
    const lines = accountBlock[1]
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (lines[0]) push(rows, 'Account Holder', lines[0]);
    if (lines.length > 1) push(rows, 'Customer Address', lines.slice(1).join(', '));
  }

  push(rows, 'Joint Holders', field(text, new RegExp(`JOINT HOLDERS\\s*:${V}`, 'i')));
  push(rows, 'Nomination', field(text, new RegExp(`Nomination\\s*:${V}`, 'i')));
  push(rows, 'Statement From', field(text, /Statement From[ \t]*:[ \t]*([0-9/.-]+)/i));
  push(
    rows,
    'Statement To',
    field(text, /Statement From[^\n]*?[ \t]+To[ \t]*:[ \t]*([0-9/.-]+)/i),
  );
  push(rows, 'Account Branch', field(text, new RegExp(`Account Branch\\s*:${V}`, 'i')));

  const addressMatch = text.match(
    /Address[ \t]*:[ \t]*([^\n]+)\n([\s\S]*?)(?=\nCity[ \t]*:)/i,
  );
  if (addressMatch) {
    const addr = [addressMatch[1], ...addressMatch[2].split('\n')]
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join(', ');
    push(rows, 'Branch Address', addr);
  } else {
    push(rows, 'Branch Address', field(text, new RegExp(`Address\\s*:${V}`, 'i')));
  }

  push(rows, 'City', field(text, new RegExp(`City\\s*:${V}`, 'i')));
  push(rows, 'State', field(text, new RegExp(`State\\s*:${V}`, 'i')));
  push(rows, 'Phone No', field(text, new RegExp(`Phone no\\.?\\s*:${V}`, 'i')));
  push(
    rows,
    'OD Limit',
    field(text, /OD Limit[ \t]*:[ \t]*([^\n]+?)(?:[ \t]+Currency[ \t]*:|$)/i),
  );
  push(rows, 'Currency', field(text, new RegExp(`Currency\\s*:${V}`, 'i')));
  push(rows, 'Email', field(text, new RegExp(`Email\\s*:${V}`, 'i')));
  push(rows, 'Cust ID', field(text, new RegExp(`Cust ID\\s*:${V}`, 'i')));
  push(rows, 'Account No', field(text, /Account No[ \t]*:[ \t]*([0-9]+)/i));
  push(rows, 'A/C Open Date', field(text, new RegExp(`A\\/C Open Date\\s*:${V}`, 'i')));
  push(rows, 'Account Status', field(text, new RegExp(`Account Status\\s*:${V}`, 'i')));
  push(rows, 'RTGS/NEFT IFSC', field(text, /RTGS\/NEFT IFSC[ \t]*:[ \t]*([A-Z0-9]+)/i));
  push(rows, 'MICR', field(text, /MICR[ \t]*:[ \t]*([^\n]+)/i));
  push(rows, 'Branch Code', field(text, new RegExp(`Branch Code\\s*:${V}`, 'i')));
  push(rows, 'Account Type', field(text, new RegExp(`Account Type\\s*:${V}`, 'i')));

  return rows;
}

/**
 * Extract Karur Vysya Bank statement header / account details for the Summary sheet.
 */
export function extractKvbSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Karur Vysya Bank');
  push(rows, 'Statement As Of', field(text, /as of[ \t]+([^\n]+)/i));

  const addressBlock = text.match(
    /as of[^\n]*\n([\s\S]*?)(?=\nAccount Name\b)/i,
  );
  if (addressBlock) {
    const lines = addressBlock[1]
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean);
    if (lines[0]) push(rows, 'Account Holder', lines[0]);
    if (lines.length > 1) {
      push(
        rows,
        'Address',
        lines
          .slice(1)
          .join(', ')
          .replace(/,\s*,/g, ',')
          .replace(/\.\s*,/g, ',')
          .replace(/,\s*$/g, ''),
      );
    }
  }

  push(rows, 'Account Name', field(text, new RegExp(`Account Name${V}`, 'i')));
  push(
    rows,
    'Account Holder(s) Name',
    field(text, new RegExp(`Account Holder\\(s\\) Name${V}`, 'i')),
  );
  push(rows, 'Account Number', field(text, new RegExp(`Account Number${V}`, 'i')));
  push(rows, 'Branch', field(text, new RegExp(`^Branch${V}`, 'im')));
  push(rows, 'Customer Id', field(text, new RegExp(`Customer Id${V}`, 'i')));
  push(rows, 'Account Currency', field(text, new RegExp(`Account Currency${V}`, 'i')));
  push(
    rows,
    'Opening Balance (Balance B/F)',
    field(text, /Opening Balance[^\n]*?[ \t]+([\d,]+\.\d{2})/i),
  );
  push(
    rows,
    'Closing Balance',
    field(text, /Closing Balance[ \t]+([\d,]+\.\d{2})/i),
  );
  push(rows, 'Searched By', field(text, new RegExp(`Searched by${V}`, 'i')));
  push(rows, 'From Date', field(text, new RegExp(`From Date${V}`, 'i')));
  push(rows, 'To Date', field(text, new RegExp(`To Date${V}`, 'i')));

  return rows;
}

/**
 * Extract Karur Vysya Bank latest-format statement header details.
 */
export function extractKvbLatestSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Karur Vysya Bank');
  push(rows, 'Format', 'Latest');

  const title = text.match(/Messrs[ \t]+(.+?)[ \t]+Acc\.No\.[ \t]*:[ \t]*(\d+)/i);
  if (title) {
    push(rows, 'Account Holder', title[1].trim());
    push(rows, 'Account Number', title[2].trim());
  } else {
    push(rows, 'Account Number', field(text, /Acc\.No\.[ \t]*:[ \t]*(\d+)/i));
  }

  const addressBlock = text.match(
    /Acc\.No\.[^\n]*\n([\s\S]*?)(?=\n\d{6,}\nCA-|\nCustomer ID|\nAccount Summary)/i,
  );
  if (addressBlock) {
    const lines = addressBlock[1]
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .filter((l) => l && !/^:+$/.test(l));
    // Drop trailing meta values that sit above the label list
    const cleaned = [];
    for (const line of lines) {
      if (/^\d{6,}$/.test(line)) break;
      if (/^CA-/i.test(line)) break;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) break;
      if (/@/.test(line)) break;
      cleaned.push(line);
    }
    if (cleaned.length) push(rows, 'Address', cleaned.join(', '));
  }

  // Values appear above labels in this format
  const meta = text.match(
    /\n(\d{6,})\n([A-Z0-9-]+)\n(\d{2}\/\d{2}\/\d{4})\n([^\n]*?to[^\n]*)\n(\d{10,})\n([^\n]+@?[^\n]*)\n:+/i,
  );
  if (meta) {
    push(rows, 'Customer ID', meta[1]);
    push(rows, 'Acc. Type', meta[2]);
    push(rows, 'Statement Date', meta[3]);
    push(rows, 'Statement Period', meta[4].trim());
    push(rows, 'Mobile No', meta[5]);
    push(rows, 'Email Id', meta[6].trim());
  }

  const summaryLine = text.match(
    /Transactions\n([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(CR:\d+\/DR:\d+)/i,
  );
  if (summaryLine) {
    push(rows, 'Opening Balance', summaryLine[1]);
    push(rows, 'Total Credit Amount', summaryLine[2]);
    push(rows, 'Total Debit Amount', summaryLine[3]);
    push(rows, 'Closing Balance', summaryLine[4]);
    push(rows, 'Count of Cr. & Dr.', summaryLine[5]);
  }

  push(
    rows,
    'Home Branch',
    field(text, /HOME BRANCH[ \t]*:[ \t]*([^\n]+)/i),
  );
  const branchAddress = field(
    text,
    /ADDRESS[ \t]*:[ \t]*([\s\S]*?)(?=\n\*+|Statements are sent|$)/i,
  );
  if (branchAddress) {
    push(rows, 'Branch Address', branchAddress.replace(/\s+/g, ' ').trim());
  }
  push(rows, 'IFSC Code', field(text, /IFSC CODE\s*-\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR CODE\s*-\s*([0-9]+)/i));

  return rows;
}

/**
 * Extract Axis Bank statement header / account details for the Summary sheet.
 */
export function extractAxisSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Axis Bank');

  const headerBlock = text.match(
    /^([^\n]+)\nJoint Holder[\s\S]*?Statement of Account No\s*:\s*(\d+)/im,
  );
  if (headerBlock) {
    push(rows, 'Account Holder', headerBlock[1].replace(/\s+/g, ' ').trim());
    push(rows, 'Account No', headerBlock[2].trim());
  } else {
    push(rows, 'Account No', field(text, /Statement of Account No\s*:\s*(\d+)/i));
  }

  const addressBlock = text.match(
    /Joint Holder[^\n]*\n([\s\S]*?)(?=\nSALEM\s+Customer ID|\n[A-Z ]+\s+Customer ID)/i,
  );
  if (addressBlock) {
    const address = addressBlock[1]
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(', ');
    if (address) push(rows, 'Address', address);
  }

  push(rows, 'Customer ID', field(text, /Customer ID\s*:\s*(\d+)/i));
  push(rows, 'IFSC Code', field(text, /IFSC Code\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s*:\s*(\d+)/i));
  push(rows, 'Nominee Registered', field(text, /Nominee Registered\s*:\s*([YN])/i));
  push(rows, 'Registered Mobile No', field(text, /Registered Mobile No\s*:\s*([^\n]+)/i));
  push(
    rows,
    'Registered Email ID',
    field(text, /Registered Email ID\s*:\s*([^\n]+?)(?:\s+PAN\s*:|$)/i),
  );
  push(rows, 'Nominee Name', field(text, /Nominee Name\s*:\s*([^\n]+)/i));
  push(rows, 'PAN', field(text, /PAN\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'Scheme', field(text, /Scheme\s*:\s*([^\n]+)/i));

  const period = text.match(
    /Statement of Account No\s*:\s*\d+\s+for the period\s*\(\s*From\s*:\s*([^)]+?)\s+To\s*:\s*([^)]+)\)/i,
  );
  if (period) {
    push(rows, 'Statement From', period[1].trim());
    push(rows, 'Statement To', period[2].trim());
  }

  push(
    rows,
    'Opening Balance',
    field(text, /OPENING BALANCE\s+([\d,]+\.\d{2})/i),
  );
  push(
    rows,
    'Closing Balance',
    field(text, /^CLOSING BALANCE\s+([\d,]+\.\d{2})/im),
  );

  const totals = text.match(
    /TRANSACTION TOTAL\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i,
  );
  if (totals) {
    push(rows, 'Total Debit', totals[1]);
    push(rows, 'Total Credit', totals[2]);
  }

  const branchAddress = field(
    text,
    /BRANCH ADDRESS\s*-\s*([\s\S]*?)(?=\+\+\+\+\s*End of Statement)/i,
  );
  if (branchAddress) {
    push(rows, 'Branch Address', branchAddress.replace(/\s+/g, ' ').trim());
  }

  return rows;
}

/**
 * Extract Union Bank of India statement header / account details for the Summary sheet.
 */
export function extractUnionBankSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Union Bank of India');

  const branchBlock = text.match(/^UNION BANK OF INDIA\n([\s\S]*?)(?=\nTO:\s*DATE:)/im);
  if (branchBlock) {
    const branchLines = branchBlock[1]
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (branchLines[0]) push(rows, 'Branch', branchLines[0]);
    if (branchLines.length > 1) {
      push(rows, 'Branch Address', branchLines.slice(1).join(', '));
    }
  }

  const toBlock = text.match(
    /TO:\s*DATE:\s*([^\n]+)\n([\s\S]*?)(?=\nTAMIL NADU|\n[A-Z ]+,\s*INDIA)/i,
  );
  if (toBlock) {
    push(rows, 'Statement Date', toBlock[1].trim());
    const holderLines = toBlock[2]
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (holderLines[0]) push(rows, 'Account Holder', holderLines[0]);
    if (holderLines.length > 1) {
      push(rows, 'Address', holderLines.slice(1).join(', '));
    }
  }

  push(rows, 'Customer ID', field(text, /CUST\s*ID\s*:\s*(\d+)/i));
  push(rows, 'Email ID', field(text, /EMAIL ID:\s*([^\n]+)/i));
  push(rows, 'Village', field(text, /Village\s*:\s*([^\n]+)/i));
  push(rows, 'CKYC No', field(text, /CKYC\s*No\s*:\s*([A-Z0-9-]+)/i));

  const period = text.match(
    /STATEMENT\s+OF ACCOUNT\s+FOR THE PERIOD\s+FROM\s+([^\s]+)\s+to\s+([^\s]+)/i,
  );
  if (period) {
    push(rows, 'Statement From', period[1].trim());
    push(rows, 'Statement To', period[2].trim());
  }

  const acctField = text.match(/CCSUV-A\/C NO:\s*(\d+)/i) || text.match(/A\/C\s*:\s*(\d+)/i);
  if (acctField) push(rows, 'Account No', acctField[1]);

  push(
    rows,
    'Account Type',
    field(text, /CCSUV-A\/C NO:\s*\d+\s+([^\n]+)/i),
  );

  const opening = text.match(/^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*(Dr|Cr)/im);
  if (opening) {
    push(rows, 'Opening Balance', `${opening[2]} ${opening[3]}`);
  }

  const cumulativeMatches = [...text.matchAll(
    /Cumulative Totals:\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(Dr|Cr)/gi,
  )];
  const cumulative = cumulativeMatches[cumulativeMatches.length - 1];
  if (cumulative) {
    push(rows, 'Total Withdrawals', cumulative[1]);
    push(rows, 'Total Deposits', cumulative[2]);
    push(rows, 'Closing Balance', `${cumulative[3]} ${cumulative[4]}`);
  }

  const ifscMicr = text.match(/IFSC\/MICR code for[^\n]*is\s+([A-Z0-9]+)\/(\d+)/i);
  if (ifscMicr) {
    push(rows, 'IFSC Code', ifscMicr[1]);
    push(rows, 'MICR Code', ifscMicr[2]);
  }

  return rows;
}

/**
 * Extract ICICI Bank statement header details for the Summary sheet.
 */
export function extractIciciSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'ICICI Bank');
  push(rows, 'Account Name', field(text, /Name:\s*([^\n]+?)(?:\s+A\/C Branch:)/i));
  push(rows, 'Branch', field(text, /A\/C Branch:\s*([^\n]+)/i));
  push(rows, 'Account No', field(text, /A\/C No:\s*(\d+)/i));
  push(rows, 'Account Type', field(text, /A\/C Type:\s*([^\n]+)/i));
  push(rows, 'Customer ID', field(text, /Cust ID:\s*(\d+)/i));
  push(rows, 'IFSC Code', field(text, /IFSC Code:\s*([A-Z0-9]+)/i));
  push(rows, 'Branch Code', field(text, /Branch Code:\s*(\d+)/i));
  push(rows, 'Statement From', field(text, /Transaction Period:\s*From\s+([^\s]+)/i));
  push(rows, 'Statement To', field(text, /Transaction Period:[^\n]*?To\s+([^\s]+)/i));
  push(rows, 'Download Date', field(text, /Statement\s*Request\/Download\s*Date:\s*([^\n]+)/i));
  push(rows, 'Currency', field(text, /Account Currency:\s*([A-Z]+)/i));

  return rows;
}

/**
 * Extract SBI statement header details for the Summary sheet.
 */
export function extractSbiSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'State Bank of India');
  push(rows, 'Account Name', field(text, /Account Name\s*:\s*([^\n]+)/i));
  push(rows, 'Account Number', field(text, /Account Number\s*:\s*(\d+)/i));
  push(rows, 'Account Description', field(text, /Account Description\s*:\s*([^\n]+)/i));
  push(rows, 'Branch', field(text, /Branch\s*:\s*([^\n]+)/i));
  push(rows, 'CIF No', field(text, /CIF No\.?\s*:\s*(\d+)/i));
  push(rows, 'IFSC Code', field(text, /IFS Code\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s*:\s*(\d+)/i));
  push(rows, 'Opening Balance', field(text, /Balance as on[^\n]*:\s*([\d,]+\.\d{2})/i));
  push(rows, 'Statement Period', field(text, /Account Statement from\s+([^\n]+)/i));

  return rows;
}

/**
 * Extract Axis Bank Neo (corporate) statement header details.
 */
export function extractAxisNeoSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Axis Bank (Neo / Corporate)');
  push(rows, 'Format', 'Neo Corporate');

  const holder = text.match(/^([^\n]+)\nJoint Holder/i);
  if (holder) push(rows, 'Account Holder', holder[1].replace(/\s+/g, ' ').trim());

  push(rows, 'Customer No', field(text, /Customer No\s*:\s*(\d+)/i));
  push(rows, 'IFSC Code', field(text, /IFSC Code\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s*:\s*(\d+)/i));
  push(rows, 'Scheme', field(text, /Scheme\s*:\s*([^\n]+?)(?:\s+currency\s*:)/i));
  push(rows, 'Currency', field(text, /currency\s*:\s*([A-Z]+)/i));

  const acct = text.match(
    /Statement of Axis Bank Account No\s*:\s*(\d+)\s+for the period\s*\(\s*From\s*:\s*([^)]+?)\s+To\s*:\s*([^)]+)\)/i,
  );
  if (acct) {
    push(rows, 'Account No', acct[1]);
    push(rows, 'Statement From', acct[2].trim());
    push(rows, 'Statement To', acct[3].trim());
  }

  push(rows, 'Opening Balance', field(text, /Opening Balance:\s*INR\s*([\d,]+\.\d{2})/i));

  return rows;
}

/**
 * Extract Canara Bank statement header details for the Summary sheet.
 */
export function extractCanaraSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Canara Bank');

  if (/STATEMENT OF ACCOUNT/i.test(text)) {
    push(rows, 'Account Holder', field(text, /Customer Name\s*:\s*([^\n]+)/i));
    push(rows, 'Account Number', field(text, /Account No\s*:\s*(\d+)/i));
    push(rows, 'Customer Id', field(text, /Customer ID\s*:\s*(\d+)/i));
    push(rows, 'Branch Name', field(text, /Account Branch\s*:\s*(\d+-[^\n]+)/i));
    push(rows, 'IFSC Code', field(text, /IFSC\s*:\s*([A-Z0-9]+)/i));
    push(rows, 'MICR Code', field(text, /MICR\s*:\s*(\d+)/i));
    push(rows, 'Product Name', field(text, /Product Name\s*:\s*([^\n]+)/i));
    push(rows, 'Statement Period', field(text, /Period\s*:\s*([^\n]+)/i));
    push(rows, 'Statement As Of', field(text, /^DATE\s*:\s*([^\n]+)/im));
    return rows;
  }

  push(
    rows,
    'Account Holder',
    field(text, /Account Holders Name\s+([^\n]+)/i),
  );
  push(rows, 'Customer Id', field(text, /Customer Id\s+(\d+)/i));
  push(rows, 'Branch Name', field(text, /Branch Name\s+([^\n]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s+(\d+)/i));
  push(rows, 'IFSC Code', field(text, /IFSC Code\s+([A-Z0-9]+)/i));
  push(rows, 'Account Number', field(text, /Account Number\s+(\d+)/i));
  push(rows, 'Account Currency', field(text, /Account Currency\s+([A-Z]+)/i));
  push(rows, 'Product Name', field(text, /Product Name\s+([^\n]+)/i));
  push(
    rows,
    'Statement Period',
    field(text, /Searched By\s+From\s+([^\n]+)/i),
  );
  push(
    rows,
    'Statement As Of',
    field(text, /Account Statement as of\s+([^\n]+)/i),
  );
  push(
    rows,
    'Opening Balance',
    field(text, /Opening Balance\s+Rs\.\s*([^\n]+)/i),
  );
  push(
    rows,
    'Closing Balance',
    field(text, /Closing Balance\s+Rs\.\s*([^\n]+)/i),
  );

  if (!rows.some(([l, v]) => l === 'Account Number' && v)) {
    push(
      rows,
      'Account Number',
      field(text, /Statement for A\/c\s+(\d+)/i),
    );
  }
  if (!rows.some(([l, v]) => l === 'Statement Period' && v)) {
    push(
      rows,
      'Statement Period',
      field(text, /between\s+([^\n]+)/i),
    );
  }
  if (!rows.some(([l, v]) => l === 'Account Holder' && v)) {
    push(rows, 'Account Holder', field(text, /Name\s+([^\n]+)/i));
  }
  if (!rows.some(([l, v]) => l === 'Opening Balance' && v)) {
    push(
      rows,
      'Opening Balance',
      field(text, /^Opening Balance\s+([\d,]+\.\d{2})/im),
    );
  }

  return rows;
}

/**
 * Extract City Union Bank (CUB) statement header details for the Summary sheet.
 */
export function extractCubSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'City Union Bank (CUB)');
  push(rows, 'Branch', field(text, /Branch:(\d+:[^\n]+)/i));
  push(rows, 'Ref No', field(text, /Ref No\s*:\s*(\S+)/i));
  push(rows, 'Account No', field(text, /Account No\s+(\d+)/i));
  push(
    rows,
    'Statement Period',
    field(text, /Account No\s+\d+\s+(\d{2}-[A-Z]{3}-\d{4}[^\n]*)/i),
  );
  push(
    rows,
    'Account Type',
    field(text, /(Current Account[^0-9\n]+)/i),
  );
  push(
    rows,
    'Date of Opening',
    field(text, /Current Account[^\n]*?\s+(\d{2}-[A-Z]{3}-\d{4})/i),
  );
  push(rows, 'Customer No', field(text, /(\d+)\s+Customer No/i));
  push(
    rows,
    'Account Holder',
    field(text, /\n([A-Z][A-Z0-9 /&.-]{4,})\nAccount Type/i),
  );
  const ckyc = field(text, /CKYC No\s*:\s*(\d+)/i);
  if (ckyc) push(rows, 'CKYC No', ckyc);
  push(
    rows,
    'Opening Balance',
    field(text, /([\d,]+\.\d{2})\s*\nOpening Balance as on\s+\d{2}-[A-Z]{3}-\d{4}/i),
  );

  return rows;
}

/**
 * Extract South Indian Bank (SIB) statement header details.
 */
export function extractSibSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'South Indian Bank (SIB)');
  push(rows, 'IFSC Code', field(text, /(SIBL\d+)\s+IFSC:/i));
  push(rows, 'Account No', field(text, /A\/C NO\s*:\s*(\d+)/i));
  push(rows, 'Customer Id', field(text, /CUSTOMER ID\s*:\s*(\S+)/i));
  push(
    rows,
    'Statement Period',
    field(text, /STATEMENT OF ACCOUNT FOR THE PERIOD FROM\s+([^\n]+)/i),
  );
  push(rows, 'Account Type', field(text, /TYPE\s*:\s*([^\n]+)/i));
  push(rows, 'Mode of Operation', field(text, /MODE OF OPR\s*:\s*([^\n]+)/i));
  push(rows, 'Currency', field(text, /CURRENCY CODE:\s*(\w+)/i));

  const holder = text.match(/PARTICULARS DATE[\s\S]*?\n([A-Z][^\n]+)\n/i);
  if (holder) push(rows, 'Account Holder', holder[1].replace(/\s+/g, ' ').trim());

  return rows;
}

/**
 * Extract Federal Bank statement header details.
 */
export function extractFederalSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Federal Bank');
  push(rows, 'Account Holder', field(text, /^Name\s+([^\n]+)/im));
  push(rows, 'Account Number', field(text, /Account Number\s*:\s*(\d+)/i));
  push(rows, 'Customer Id', field(text, /Customer Id\s*:\s*(\d+)/i));
  push(rows, 'Account Type', field(text, /Type of Account\s*:\s*([^:]+?)(?:\s+Account Status\s*:)/i));
  push(rows, 'Scheme', field(text, /Scheme\s*:\s*([^:]+?)(?:\s+Mode of Operation\s*:)/i));
  push(rows, 'IFSC', field(text, /IFSC\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s*:\s*(\d+)/i));
  push(rows, 'Branch Name', field(text, /Branch Name\s*:\s*([^\n]+)/i));
  push(rows, 'Opening Balance', field(text, /Opening Balance\s*:\s*([\d,]+\.\d{2})/i));
  push(
    rows,
    'Statement Period',
    field(text, /Statement of Account for the period\s+([^\n]+)/i),
  );

  return rows;
}

/**
 * Extract Federal Bank mobile app statement header details.
 */
export function extractFederalMobileSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Federal Bank');
  push(rows, 'Format', 'Mobile');
  push(
    rows,
    'Account Holder',
    field(text, /Name\s*:\s*([^:]+?)(?:\s+Branch Name\s*:)/i),
  );
  push(rows, 'Account Number', field(text, /Account Number\s*:\s*(\d+)/i));
  push(rows, 'Customer Id', field(text, /Customer Id\s*:\s*(\d+)/i));
  push(rows, 'Account Type', field(text, /Type of Account\s*:\s*([^:]+?)(?:\s+Account Status\s*:)/i));
  push(rows, 'Scheme', field(text, /Scheme\s*:\s*([^:]+?)(?:\s+Mode of Operation\s*:)/i));
  push(rows, 'IFSC', field(text, /IFSC\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s*:\s*(\d+)/i));
  push(rows, 'Branch Name', field(text, /Branch Name\s*:\s*([^\n]+)/i));
  push(rows, 'Opening Balance', field(text, /^Opening Balance\s+([\d,]+\.\d{2})/im));
  push(
    rows,
    'Statement Period',
    field(text, /Statement of Account for the period\s+([^\n]+)/i),
  );

  return rows;
}

/**
 * Extract Federal Bank account statement PDF header details (Sl No layout).
 */
export function extractFederalAccountSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Federal Bank');
  push(rows, 'Format', 'Account Statement');
  push(
    rows,
    'Account Holder',
    field(text, /^Name\s*:\s*([^:]+?)(?:\s+Branch Name\s*:)/im),
  );
  push(
    rows,
    'Account Number',
    field(text, /Account Number\s*:\s*([^\s]+)/i),
  );
  push(rows, 'Customer Id', field(text, /Customer ID\s*:\s*(\d+)/i));
  push(
    rows,
    'Account Type',
    field(text, /Type Of Account\s*:\s*([^:]+?)(?:\s+Mode Of Operation\s*:)/i),
  );
  push(
    rows,
    'Scheme',
    field(text, /Scheme\s*:\s*([^:]+?)(?:\s+Joint Holders\s*:)/i),
  );
  push(rows, 'IFSC', field(text, /IFSC\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s*:\s*(\d+)/i));
  push(
    rows,
    'Branch Name',
    field(text, /Branch Name\s*:\s*([^:\n]+?)(?:\s+Branch Sol ID\s*:)/i),
  );
  push(
    rows,
    'Available Balance',
    field(text, /Effective Available Balance\s*:\s*([\d,]+\.\d{2})/i),
  );
  push(
    rows,
    'Statement Period',
    field(text, /Statement Of Account For The Period\s+([^\n]+)/i),
  );
  push(
    rows,
    'Total Withdrawals',
    field(text, /GRAND TOTAL\s+([\d,]+\.?\d*)/i),
  );
  push(
    rows,
    'Total Deposits',
    field(text, /GRAND TOTAL\s+[\d,]+\.?\d*\s*([\d,]+\.?\d*)/i),
  );

  return rows;
}

/**
 * Extract Federal Bank latest/branch PDF statement header details.
 */
export function extractFederalLatestSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Federal Bank');
  push(rows, 'Format', 'Latest');
  push(
    rows,
    'Account Holder',
    field(text, /^([^\n]+?)\s+Name/im) ||
      field(text, /Name\s*:\s*([^:\n]+?)(?:\s+Communication Address\s*:)/i),
  );
  push(rows, 'Account Number', field(text, /Account Number\s*:\s*(\d+)/i));
  push(rows, 'Customer Id', field(text, /Customer ID \(UCIC\)\s*(\d+)/i));
  push(rows, 'Account Type', field(text, /Type Of Account\s*:\s*([^\n]+)/i));
  push(rows, 'Scheme', field(text, /Scheme\s+([^\n]+)/i));
  push(rows, 'IFSC', field(text, /IFSC\s*:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code\s*:\s*(\d+)/i));
  push(rows, 'Branch Name', field(text, /Branch Name\s+([^\n]+)/i));
  push(rows, 'Opening Balance', field(text, /Opening Balance\s+CR\s+([\d,]+\.\d{2})/i));
  push(
    rows,
    'Available Balance',
    field(text, /Effective Available Balance\s*:\s*([\d,]+\.\d{2})/i),
  );
  push(
    rows,
    'Statement Period',
    field(text, /Statement of Account for the period\s+([^\n]+)/i),
  );
  push(rows, 'Total Withdrawals', field(text, /GRAND TOTAL\s+([\d,]+\.\d{2})\s+[\d,]+\.\d{2}/i));
  push(rows, 'Total Deposits', field(text, /GRAND TOTAL\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})/i));

  return rows;
}

/**
 * Extract DBS Bank India statement header details.
 */
export function extractDbsSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'DBS Bank India');
  push(rows, 'Account Name', field(text, /Account Name:\s*([^\n]+)/i));
  push(rows, 'Account No', field(text, /Account No\.?\s*:\s*(\d+)/i));
  push(rows, 'Customer No', field(text, /Customer No\.?\s*:\s*(\d+)/i));
  push(rows, 'Account Type', field(text, /Account Type:\s*([^\n]+)/i));
  push(rows, 'IFSC Code', field(text, /IFSC Code:\s*([A-Z0-9]+)/i));
  push(rows, 'MICR Code', field(text, /MICR Code:\s*(\d+)/i));
  push(
    rows,
    'Statement Period',
    field(text, /Statement Period:\s*([^\n]+)/i) ||
      field(text, /Statement Period\s+([\d-][^\n]+)/i),
  );
  push(rows, 'Currency', field(text, /Currency:\s*(\w+)/i));
  push(rows, 'Opening Balance', field(text, /Opening Balance\s+([\d,]+\.\d{2})/i));

  return rows;
}

/**
 * Extract Tamilnad Mercantile Bank (TMB) statement header details.
 */
export function extractTmbSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Tamilnad Mercantile Bank (TMB)');
  push(
    rows,
    'Account Holder',
    field(text, /Transactions List\s*-\s*[^-]+-\s*([^(]+)\(/i),
  );
  push(rows, 'Account Number', field(text, /Account Number\s*:\s*(\d+)/i));
  push(rows, 'Customer Id', field(text, /Cust Id\s*:\s*(\d+)/i));
  push(rows, 'Branch Id', field(text, /Branch Id\s*:\s*(\d+)/i));
  push(rows, 'Branch Name', field(text, /Branch Name\s*:\s*([^\n]+)/i));
  push(rows, 'IFSC Code', field(text, /(TMBL\d+)\s+IFSC/i));
  push(
    rows,
    'Statement From',
    field(text, /Transaction Date From:\(dd\/MM\/yyyy\):\s*(\d{2}\/\d{2}\/\d{4})/i),
  );
  push(
    rows,
    'Statement To',
    field(text, /Transaction Date To:\(dd\/MM\/yyyy\):\s*(\d{2}\/\d{2}\/\d{4})/i),
  );
  push(
    rows,
    'Account Type',
    field(text, /Transactions List\s*-\s*([^-]+)-/i),
  );
  push(
    rows,
    'Email',
    field(text, /([\w.-]+@tmbank\.in)/i) || field(text, /Email\s*:\s*([^\n]+)/i),
  );

  return rows;
}

/**
 * Extract Bank of Baroda REP31 ledger statement header details.
 */
export function extractBobSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Bank of Baroda');
  push(rows, 'Report', field(text, /(REP31[^\n]*)/i));
  push(
    rows,
    'Branch',
    field(text, /Service\s+OutLet\s*:\s*\d+\s+([^\n]+)/i) ||
      field(text, /BANK\s+OF\s+BARODA,?\s+([^,\n]+)/i),
  );
  push(
    rows,
    'Account No',
    field(text, /Account\s+No\s*:\s*(\d+)/i) ||
      field(text, /Acct\s+Range\s*:\s*(\d+)/i),
  );
  push(
    rows,
    'Account Holder',
    field(text, /Account\s+No\s*:\s*\d+\s+INR\s+([^\n]+)/i),
  );
  push(rows, 'Currency', field(text, /Account\s+No\s*:\s*\d+\s+(INR)/i));
  push(rows, 'Opening Balance', field(text, /Opening\s+Balance\s*:\s*([\d,]+\.\d{2})/i));
  push(rows, 'Closing Balance', field(text, /Closing\s+Balance\s*:\s*([\d,]+\.\d{2})/i));
  push(rows, 'Statement Period', field(text, /Period\s*:\s*([^\n]+)/i));
  push(rows, 'Total Credit', field(text, /^Total\s+Credit\s*:\s*([\d,]+\.\d{2})/im));
  push(rows, 'Total Debit', field(text, /^Total\s+Debit\s*:\s*([\d,]+\.\d{2})/im));

  return rows;
}

/**
 * Extract Indian Overseas Bank (REP27) statement header details.
 */
export function extractIobSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'Indian Overseas Bank');
  push(rows, 'Report', field(text, /(REP27[^\n]*)/i));
  push(
    rows,
    'Branch',
    field(text, /INDIAN OVERSEAS BANK,\s*([^\n]+?)(?:\s+Page|\s+REP27)/i) ||
      field(text, /Service OutLet\s*:\s*\d+\s+([^\n]+)/i),
  );
  push(
    rows,
    'Account Number',
    field(text, /Account Number\s*:\s*(\d+)/i),
  );
  push(
    rows,
    'Account Holder',
    field(text, /Account Number\s*:\s*\d+\/\w+\s+([^\n]+)/i),
  );
  push(rows, 'Currency', field(text, /Account Number\s*:\s*\d+\/(\w+)/i));
  push(
    rows,
    'Statement Period',
    field(text, /Report(?:\s+for the)?\s+Period\s*:\s*([^\n]+)/i),
  );
  push(
    rows,
    'Opening Balance',
    field(text, /Account\s+Opening\s+balance\s*:\s*([\d,]+\.\d{2}\s*CR?)/i),
  );
  push(
    rows,
    'Closing Balance',
    field(text, /Total\(Curr\.\s*\w+\)\s*:\s*[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2}\s*CR?)/i),
  );
  push(
    rows,
    'Total Debit',
    field(text, /Total\(Curr\.\s*\w+\)\s*:\s*([\d,]+\.\d{2})/i),
  );
  push(
    rows,
    'Total Credit',
    field(text, /Total\(Curr\.\s*\w+\)\s*:\s*[\d,]+\.\d{2}\s+([\d,]+\.\d{2})/i),
  );

  return rows;
}

/**
 * Extract ICICI Bank summary statement header details.
 */
export function extractIciciNewSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'ICICI Bank');
  push(rows, 'Format', 'Summary Statement');
  push(rows, 'Account Type', field(text, /Type of Account\s+Account Number\s+(\w+)/i));
  push(rows, 'Account Number', field(text, /Account Number\s+Balance[^\d]*(\d+)/i));
  push(rows, 'IFSC', field(text, /IFSC\s+(\S+)/i));
  push(rows, 'MICR', field(text, /MICR\s+(\d+)/i));
  push(
    rows,
    'Account Holder',
    field(text, /Your Details With Us:\s*([^\n]+)/i),
  );
  push(
    rows,
    'Statement Period',
    field(text, /For the period\s+([^\n]+)/i),
  );
  push(rows, 'Closing Balance', field(text, /Summary of Account as on\s+([^\n]+)/i));

  return rows;
}

/**
 * Extract ICICI Bank OpTransactionHistory statement header details.
 */
export function extractIciciOpHistorySummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Bank', 'ICICI Bank');
  push(rows, 'Format', 'OpTransactionHistory');
  push(rows, 'Account Holder', field(text, /^\s*([A-Z][A-Z\s\.]+)\s*, , , , , IN,/m));
  push(
    rows,
    'Account Number',
    field(text, /Saving Account no\.\s*(\d+)/i),
  );
  push(
    rows,
    'Statement Period',
    field(text, /for the period\s+([^\n]+)/i),
  );
  push(
    rows,
    'Base Branch',
    field(text, /Your Base Branch:\s*([^\n]+?)(?:\s+Never share)/i),
  );

  return rows;
}

/**
 * Extract PF ECR challan summary details.
 */
export function extractPfEcrSummary(rawText) {
  const text = normalize(rawText);
  const rows = [];

  push(rows, 'Form', 'EPF Electronic Challan cum Return (ECR)');
  push(
    rows,
    'Establishment Name',
    field(text, /Name of Establishment Establishment Id Wage Month Contribution Rate[^A-Z]*([A-Z][A-Z\s&\.]+?)\s+CBSLM/i),
  );
  push(rows, 'Establishment Id', field(text, /(CBSLM\d+)/));
  push(rows, 'Wage Month', field(text, /CBSLM\d+\s+(\d{1,2}\s+[A-Z]{3}-\d{4})/i));
  push(rows, 'Return Month', field(text, /ECR Type Return Month\s+\d+\s+ECR\s+([A-Z]{3}-\d{4})/i));
  push(rows, 'LIN', field(text, /(\d{10})\s+ECR Type/i));
  push(rows, 'Uploaded Date Time', field(text, /(\d{2}-[A-Z]{3}-\d{4}\s+\d{2}:\d{2})/i));
  push(
    rows,
    'Salary Disbursement Date',
    field(text, /Salary Disbursement Date\s+(\d{2}-[A-Z]{3}-\d{4})/i),
  );
  push(rows, 'TRRN Number', field(text, /TRRN Number ECR Id\s+(\d+)/i));
  push(rows, 'Total Members', field(text, /Total Members\s+(\d+)/i));
  push(
    rows,
    'Total EPF Contribution',
    field(text, /Total EPF Contribution Remitted\s+([\d,]+)/i),
  );
  push(
    rows,
    'Total EPS Contribution',
    field(text, /Total EPS Contribution Remitted\s+([\d,]+)/i),
  );
  push(
    rows,
    'Total EPF-EPS Contribution',
    field(text, /Total EPF-EPS Contribution Remitted\s+([\d,]+)/i),
  );
  push(rows, 'Total Refund Advance', field(text, /Total Refund Advance\s+([\d,]+)/i));
  push(rows, 'Exemption Status', field(text, /(Unexempted|Exempted)/i));

  return rows;
}
