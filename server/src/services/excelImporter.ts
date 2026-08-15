import ExcelJS from 'exceljs';

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
  { key: 'testCaseCode', label: 'Mã TC', required: false },
  { key: 'module', label: 'Module / Chức năng', required: true },
  { key: 'platform', label: 'Nền tảng (App/CMS/Web)', required: false },
  { key: 'title', label: 'Tiêu đề', required: true },
  { key: 'testType', label: 'Loại kiểm thử', required: false },
  { key: 'preconditions', label: 'Điều kiện tiên quyết', required: false },
  { key: 'steps', label: 'Các bước', required: false },
  { key: 'expectedResult', label: 'Kết quả mong đợi', required: false },
  { key: 'priority', label: 'Độ ưu tiên', required: false },
];

export interface MappedTestCase {
  testCaseCode: string;
  module: string;
  platform: string;
  title: string;
  testType: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: string;
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ImportPreviewResult {
  sheetName: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

export interface ImportParseResult {
  rows: MappedTestCase[];
  skipped: SkippedRow[];
}

// ---- Helpers ----

function removeDiacritics(input: string): string {
  return input
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const ALIASES: Record<string, string[]> = {
  testCaseCode: ['ma tc', 'ma test case', 'testcasecode', 'test case code', 'code', 'id', 'ma tc', 'ma test case', 'stt', 'tt'],
  module: ['module', 'chuc nang', 'ten chuc nang', 'chuc nang', 'chức năng', 'tên chức năng', 'phan he', 'phân hệ', 'chuc nang'],
  platform: ['nen tang', 'nền tảng', 'platform', 'nền tảng kiểm thử', 'nền tảng kt', 'nền tảng kiểm thử'],
  title: ['tieu de', 'tiêu đề', 'title', 'ten test case', 'tên test case', 'ten tc', 'tên tc', 'test case', 'mo ta', 'mô tả', 'mo tả', 'description', 'noi dung', 'nội dung'],
  testType: ['loai kiem thu', 'loại kiểm thử', 'test type', 'kieu kiem thu', 'kiểu kiểm thử', 'loai', 'type', 'loại kt', 'loại kiểm thử'],
  preconditions: ['dieu kien tien quyet', 'điều kiện tiên quyết', 'preconditions', 'precondition', 'dieu kien', 'điều kiện', 'pre-condition', 'dk tien quyet'],
  steps: ['cac buoc', 'các bước', 'steps', 'step', 'huong dan', 'hướng dẫn', 'thuc hien', 'thực hiện', 'cac buoc thuc hien', 'các bước thực hiện', 'thao tac', 'thao tác'],
  expectedResult: ['ket qua mong doi', 'kết quả mong đợi', 'expected result', 'expected', 'ket qua', 'kết quả', 'ket qua mong doi', 'kết quả mong đợi', 'du kien', 'dự kiến'],
  priority: ['do uu tien', 'độ ưu tiên', 'priority', 'uu tien', 'ưu tiên', 'muc do', 'mức độ', 'do uu tien', 'độ ưu tiên'],
};

function normalizePlatform(value: string): string {
  const v = removeDiacritics(value);
  if (!v) return 'App';
  if (v.includes('cms')) return 'CMS';
  if (v.includes('web') || v.includes('website')) return 'Web';
  if (v.includes('app') || v.includes('mobile') || v.includes('di dong') || v.includes('android') || v.includes('ios')) return 'App';
  if (v.includes('api')) return 'API';
  return 'App';
}

function normalizeTestType(value: string): string {
  const v = removeDiacritics(value);
  if (!v) return 'Luồng chuẩn';
  if (v.includes('ngoai le') || v.includes('negative') || v.includes('error') || v.includes('exception') || v.includes('sai') || v.includes('loi')) return 'Luồng ngoại lệ';
  if (v.includes('bien') || v.includes('boundary') || v.includes('edge') || v.includes('ranh')) return 'Giá trị biên';
  if (v.includes('chuan') || v.includes('normal') || v.includes('happy') || v.includes('positive') || v.includes('dung')) return 'Luồng chuẩn';
  return 'Luồng chuẩn';
}

function normalizePriority(value: string): string {
  const v = removeDiacritics(value);
  if (!v) return 'Cao';
  if (v.includes('cao') || v.includes('high')) return 'Cao';
  if (v.includes('trung binh') || v.includes('medium') || v.includes('tb')) return 'Trung bình';
  if (v.includes('thap') || v.includes('low')) return 'Thấp';
  return 'Cao';
}

function suggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: removeDiacritics(h) }));

  for (const field of IMPORT_FIELDS) {
    const aliases = ALIASES[field.key] || [];
    // Try exact normalized alias match
    let match = normalizedHeaders.find((h) => aliases.includes(h.norm));
    // Fallback: header contains an alias token or alias contains header token
    if (!match) {
      match = normalizedHeaders.find((h) =>
        aliases.some((a) => h.norm.includes(a) || a.includes(h.norm))
      );
    }
    if (match) {
      mapping[field.key] = match.raw;
    }
  }
  return mapping;
}

// ---- ExcelJS helpers ----

function cellToText(cell: ExcelJS.Cell): string {
  if (cell === undefined || cell === null) return '';
  if (cell.text !== undefined && cell.text !== null) {
    const t = String(cell.text).trim();
    if (t.length > 0) return t;
  }
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'text' in (v as any)) return String((v as any).text).trim();
  return String(v).trim();
}

function getHeaders(worksheet: ExcelJS.Worksheet): string[] {
  const headers: string[] = [];
  const row = worksheet.getRow(1);
  const maxCol = worksheet.columnCount || (row.cellCount || 0);
  for (let c = 1; c <= maxCol; c++) {
    const val = cellToText(row.getCell(c));
    headers[c] = val || `Cột ${c}`;
  }
  // shift to 0-indexed array
  return headers.slice(1);
}

function readRowObject(worksheet: ExcelJS.Worksheet, rowNumber: number, headers: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  const row = worksheet.getRow(rowNumber);
  for (let c = 0; c < headers.length; c++) {
    obj[headers[c]] = cellToText(row.getCell(c + 1));
  }
  return obj;
}

export class ExcelImporter {
  static async preview(buffer: Buffer): Promise<ImportPreviewResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('File Excel không chứa sheet nào để đọc');
    }

    const headers = getHeaders(worksheet);
    const totalRows = worksheet.rowCount || 0;
    const sampleCount = Math.min(totalRows - 1, 5);
    const sampleRows: Record<string, string>[] = [];

    for (let r = 2; r <= sampleCount + 1; r++) {
      sampleRows.push(readRowObject(worksheet, r, headers));
    }

    return {
      sheetName: worksheet.name,
      headers,
      sampleRows,
      suggestedMapping: suggestMapping(headers),
    };
  }

  static async parse(
    buffer: Buffer,
    mapping: Record<string, string>
  ): Promise<ImportParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('File Excel không chứa sheet nào để đọc');
    }

    const headers = getHeaders(worksheet);
    const totalRows = worksheet.rowCount || 0;
    const rows: MappedTestCase[] = [];
    const skipped: SkippedRow[] = [];

    for (let r = 2; r <= totalRows; r++) {
      const obj = readRowObject(worksheet, r, headers);
      const get = (field: string) => {
        const header = mapping[field];
        return header ? (obj[header] || '').trim() : '';
      };

      const title = get('title');
      const moduleName = get('module');

      // Skip fully empty rows
      const allEmpty = IMPORT_FIELDS.every((f) => !get(f.key));
      if (allEmpty) continue;

      if (!title) {
        skipped.push({ row: r, reason: 'Thiếu Tiêu đề' });
        continue;
      }
      if (!moduleName) {
        skipped.push({ row: r, reason: 'Thiếu Module / Chức năng' });
        continue;
      }

      const rawCode = get('testCaseCode');
      rows.push({
        testCaseCode: rawCode,
        module: moduleName,
        platform: normalizePlatform(get('platform')),
        title,
        testType: normalizeTestType(get('testType')),
        preconditions: get('preconditions'),
        steps: get('steps'),
        expectedResult: get('expectedResult'),
        priority: normalizePriority(get('priority')),
      });
    }

    return { rows, skipped };
  }
}

export { normalizePlatform, normalizeTestType, normalizePriority };
