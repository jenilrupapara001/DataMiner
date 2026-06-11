import * as XLSX from 'xlsx';

export interface ImportRowData {
    brandName: string;
    managerId?: string;
    managerName?: string;
    month: string;       // "Jan 2025", "January 2025", "01/2025", etc.
    achieved: number;
    target?: number;
    type: string;        // GMS, ADS, ACOS, etc.
    _rowIndex?: number;
    _errors?: string[];
}

export interface ParsedRow {
    brandName: string;
    managerId: string;
    managerName: string;
    year: number;
    month: number;
    achieved: number;
    target: number;
    goalType: string;
    rowIndex: number;
    errors: string[];
    isValid: boolean;
}

const MONTH_NAMES_MAP: Record<string, number> = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5, 'may-2025': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'sept': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
};

const VALID_GOAL_TYPES = [
    'GMS', 'ADS', 'ACOS', 'NEW_RC', 'RNR',
    'PO_FULFILMENT', 'PO_DAYS', 'SELLER_CENTRAL_BUSINESS'
];

/**
 * Parse a "Month" column value into { year, month }
 * Accepts: "Jan 2025", "January 2025", "01/2025", "2025-01", "1-2025", Excel date serial
 */
export function parseMonthValue(value: any): { year: number; month: number } | null {
    if (value === null || value === undefined || value === '') return null;

    // Excel date serial number
    if (typeof value === 'number' && value > 1000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + value * 86400000);
        if (!isNaN(date.getTime())) {
            return { year: date.getFullYear(), month: date.getMonth() + 1 };
        }
    }

    // Date object
    if (value instanceof Date && !isNaN(value.getTime())) {
        return { year: value.getFullYear(), month: value.getMonth() + 1 };
    }

    const str = String(value).trim();

    // "Jan 2025" / "January 2025" / "Jan-2025" / "Jan/2025"
    const namedMatch = str.match(/^([a-zA-Z]+)[\s\-\/]+(\d{2,4})$/);
    if (namedMatch) {
        const monthStr = namedMatch[1].toLowerCase();
        const year = parseInt(namedMatch[2], 10);
        const month = MONTH_NAMES_MAP[monthStr];
        if (month && year) {
            return { year: year < 100 ? 2000 + year : year, month };
        }
    }

    // "2025-01" / "2025/01"
    const isoMatch = str.match(/^(\d{4})[\-\/](\d{1,2})$/);
    if (isoMatch) {
        return { year: parseInt(isoMatch[1], 10), month: parseInt(isoMatch[2], 10) };
    }

    // "01/2025" / "01-2025" / "1/2025"
    const usMatch = str.match(/^(\d{1,2})[\-\/](\d{2,4})$/);
    if (usMatch) {
        const month = parseInt(usMatch[1], 10);
        const yearRaw = parseInt(usMatch[2], 10);
        const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
        if (month >= 1 && month <= 12) {
            return { year, month };
        }
    }

    // Try Date.parse fallback
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
    }

    return null;
}

/**
 * Validate and normalize goal type
 */
export function normalizeGoalType(value: any): string | null {
    if (!value) return null;
    const upper = String(value).toUpperCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');

    // Common aliases
    const aliases: Record<string, string> = {
        'NEW_RC': 'NEW_RC',
        'NEWRC': 'NEW_RC',
        'NEW': 'NEW_RC',
        'PO_FULFILMENT': 'PO_FULFILMENT',
        'POFULFILMENT': 'PO_FULFILMENT',
        'PO_FULFILLMENT': 'PO_FULFILMENT',
        'PO_DAYS': 'PO_DAYS',
        'PODAYS': 'PO_DAYS',
        'SELLER_CENTRAL_BUSINESS': 'SELLER_CENTRAL_BUSINESS',
        'SCBUSINESS': 'SELLER_CENTRAL_BUSINESS',
        'SC_BUSINESS': 'SELLER_CENTRAL_BUSINESS',
        'SC': 'SELLER_CENTRAL_BUSINESS',
    };

    if (VALID_GOAL_TYPES.includes(upper)) return upper;
    if (aliases[upper]) return aliases[upper];
    return null;
}

/**
 * Read Excel file and return raw rows
 */
export async function readExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, {
                    defval: '',
                    raw: false,
                    dateNF: 'yyyy-mm-dd',
                });
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Generate Excel template for download
 */
export function downloadTemplate() {
    const headers = [
        ['Brand Name', 'ManagerId', 'Month', 'Target', 'Achieved', 'Type']
    ];

    const sampleRows = [
        ['Lotus Premium', '', 'Jan 2025', 150000, 120000, 'GMS'],
        ['Lotus Premium', '', 'Jan 2025', 25000, 22000, 'ADS'],
        ['Lotus Premium', '', 'Jan 2025', 16.5, 17.2, 'ACOS'],
        ['Vardha Brand', 'mgr_001', 'Feb 2025', 280000, 290000, 'GMS'],
        ['Vardha Brand', 'mgr_001', 'Feb 2025', 45000, 42000, 'ADS'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);

    // Set column widths
    ws['!cols'] = [
        { wch: 25 }, // Brand Name
        { wch: 18 }, // ManagerId
        { wch: 14 }, // Month
        { wch: 14 }, // Target
        { wch: 14 }, // Achieved
        { wch: 12 }, // Type
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Target Achievements');

    // Add an instruction sheet
    const instructionData = [
        ['📋 IMPORT INSTRUCTIONS'],
        [''],
        ['Column', 'Required', 'Description', 'Example'],
        ['Brand Name', 'YES', 'Exact brand/seller name from database', 'Lotus Premium'],
        ['ManagerId', 'NO', 'Manager ID from database (auto-detected if blank)', 'mgr_001'],
        ['Month', 'YES', 'Month and year in any format', 'Jan 2025, 01/2025, 2025-01'],
        ['Target', 'YES', 'Numeric target value', '150000'],
        ['Achieved', 'YES', 'Numeric achievement value', '120000'],
        ['Type', 'YES', 'Goal type code', 'GMS, ADS, ACOS, RNR'],
        [''],
        ['📌 VALID GOAL TYPES:'],
        ['GMS', '- Gross Merchandise Sales (₹)'],
        ['ADS', '- Advertising Spend (₹)'],
        ['ACOS', '- Advertising Cost of Sales (%)'],
        ['NEW_RC', '- New Reviews Count (#)'],
        ['RNR', '- Rating & Reviews (#)'],
        ['PO_FULFILMENT', '- PO Fulfilment Rate (%)'],
        ['PO_DAYS', '- PO Fulfilment Days (days)'],
        ['SELLER_CENTRAL_BUSINESS', '- SC Business (₹)'],
        [''],
        ['📌 MONTH FORMAT EXAMPLES:'],
        ['Jan 2025', 'January 2025'],
        ['01/2025', 'JAN-2025'],
        ['2025-01', '2025/01'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionData);
    wsInstructions['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 40 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `target_achievements_template_${today}.xlsx`);
}

/**
 * Parse and validate all rows from imported Excel
 */
export function parseAndValidate(
    rawRows: any[],
    sellerMap: Map<string, string>,         // sellerId -> name
    sellerNameToId: Map<string, string>,    // lowercaseName -> sellerId
    managerSet: Set<string>                 // valid manager IDs
): ParsedRow[] {
    return rawRows.map((row, idx) => {
        const errors: string[] = [];

        // Normalize keys (handle different casing)
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach(k => {
            normalizedRow[k.toLowerCase().trim().replace(/\s+/g, '')] = row[k];
        });

        const brandName = String(
            normalizedRow['brandname'] ??
            normalizedRow['brand'] ??
            ''
        ).trim();

        const managerIdRaw = String(
            normalizedRow['managerid'] ??
            normalizedRow['manager'] ??
            ''
        ).trim();

                const monthRaw = normalizedRow['month'] ?? '';
        const targetRaw = normalizedRow['target'] ?? normalizedRow['targetvalue'] ?? '';
        const achievedRaw = normalizedRow['achieved'] ?? '';
        const typeRaw = normalizedRow['type'] ?? '';

        // ── Validate Brand Name ───────────────────────
        if (!brandName) errors.push('Brand Name is required');

        // Resolve sellerId from brand name
        let sellerId = '';
        let resolvedManagerId = managerIdRaw;
        let resolvedManagerName = '';

        if (brandName) {
            const lookupKey = brandName.toLowerCase();
            sellerId = sellerNameToId.get(lookupKey) || '';
            if (!sellerId) {
                errors.push(`Brand "${brandName}" not found in database`);
            }
        }

        // ── Validate Manager (optional) ───────────────
        if (managerIdRaw && !managerSet.has(managerIdRaw)) {
            // Don't fail — just warn (some systems use names directly)
            resolvedManagerName = managerIdRaw; // assume it's a name
            resolvedManagerId = '';
        } else {
            resolvedManagerId = managerIdRaw;
        }

        // ── Validate Month ────────────────────────────
        const parsedDate = parseMonthValue(monthRaw);
        let year = 0, month = 0;
        if (!parsedDate) {
            errors.push(`Invalid Month: "${monthRaw}"`);
        } else {
            year = parsedDate.year;
            month = parsedDate.month;
            if (year < 2020 || year > 2100) errors.push(`Year out of range: ${year}`);
            if (month < 1 || month > 12) errors.push(`Month out of range: ${month}`);
        }

        // ── Validate Target ───────────────────────────
        const target = Number(targetRaw);
        if (targetRaw !== '' && isNaN(target)) {
            errors.push(`Target value is invalid: "${targetRaw}"`);
        } else if (target < 0) {
            errors.push('Target value cannot be negative');
        }

        // ── Validate Achieved ─────────────────────────
        const achieved = Number(achievedRaw);
        if (achievedRaw === '' || isNaN(achieved)) {
            errors.push(`Achieved value is invalid: "${achievedRaw}"`);
        } else if (achieved < 0) {
            errors.push('Achieved value cannot be negative');
        }

        // ── Validate Type ─────────────────────────────
        const goalType = normalizeGoalType(typeRaw);
        if (!goalType) {
            errors.push(`Invalid Type: "${typeRaw}". Use GMS, ADS, ACOS, etc.`);
        }

        return {
            brandName,
            managerId: resolvedManagerId,
            managerName: resolvedManagerName,
            year,
            month,
            target: isNaN(target) ? 0 : target,
            achieved: isNaN(achieved) ? 0 : achieved,
            goalType: goalType || '',
            rowIndex: idx + 2, // +2 because Excel rows start at 1 and header is row 1
            errors,
            isValid: errors.length === 0,
        };
    });
}