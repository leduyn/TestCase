import { MappedTestCase, normalizePlatform, normalizeTestType, normalizePriority } from './excelImporter';

function normalizeSteps(value: any): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map((item, idx) => {
        const str = typeof item === 'object' ? JSON.stringify(item) : String(item).trim();
        if (/^\d+[\.\)]\s*/.test(str)) {
          return str;
        }
        return `${idx + 1}. ${str}`;
      })
      .join('\n');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  const str = String(value).trim();
  // If already has numbered lines with newlines, keep as is
  if (/^\d+[\.\)]\s*.+\n\d+[\.\)]/m.test(str)) {
    return str;
  }
  // If has numbered steps without newlines (e.g. "1. step 2. step 3. step"), add newlines before each number
  if (/^\d+[\.\)]\s/.test(str) && /\d+[\.\)]\s/.test(str.slice(str.indexOf(' ') + 1))) {
    return str.replace(/(\d+[\.\)]\s)/g, '\n$1').trim();
  }
  // Split by common delimiters and re-number
  const parts = str.split(/[\n\r]+|;|\. /).filter(p => p.trim());
  if (parts.length > 1) {
    return parts.map((p, i) => `${i + 1}. ${p.trim()}`).join('\n');
  }
  return str;
}

export interface GenerationResult {
  moduleName: string;
  summary?: string;
  assumptions?: string;
  testCases: {
    testCaseCode?: string;
    module: string;
    platform?: string;
    title: string;
    testType?: string;
    preconditions?: string;
    steps?: string | string[];
    expectedResult?: string;
    priority?: string;
  }[];
}

export interface JsonImportResult {
  rows: MappedTestCase[];
  skipped: { row: number; reason: string }[];
  moduleName: string;
  summary?: string;
  assumptions?: string;
}

export class JsonImporter {
  static parse(json: GenerationResult): JsonImportResult {
    if (!json || typeof json !== 'object') {
      throw new Error('JSON không hợp lệ: root phải là object');
    }

    if (!json.moduleName || typeof json.moduleName !== 'string') {
      throw new Error('Thiếu trường bắt buộc: moduleName (string)');
    }

    if (!Array.isArray(json.testCases) || json.testCases.length === 0) {
      throw new Error('Thiếu trường bắt buộc: testCases (mảng không rỗng)');
    }

    const rows: MappedTestCase[] = [];
    const skipped: { row: number; reason: string }[] = [];

    json.testCases.forEach((tc, index) => {
      const rowNum = index + 1;

      if (!tc || typeof tc !== 'object') {
        skipped.push({ row: rowNum, reason: 'Test case không phải object hợp lệ' });
        return;
      }

      const title = (tc.title || '').trim();
      const moduleName = (tc.module || '').trim();

      if (!title) {
        skipped.push({ row: rowNum, reason: 'Thiếu Tiêu đề (title)' });
        return;
      }
      if (!moduleName) {
        skipped.push({ row: rowNum, reason: 'Thiếu Module / Chức năng (module)' });
        return;
      }

      const rawCode = (tc.testCaseCode || '').trim();

      rows.push({
        testCaseCode: rawCode,
        module: moduleName,
        platform: normalizePlatform(tc.platform || ''),
        title,
        testType: normalizeTestType(tc.testType || ''),
        preconditions: (tc.preconditions || '').trim(),
        steps: normalizeSteps(tc.steps),
        expectedResult: (tc.expectedResult || '').trim(),
        priority: normalizePriority(tc.priority || ''),
      });
    });

    return {
      rows,
      skipped,
      moduleName: json.moduleName.trim(),
      summary: json.summary?.trim(),
      assumptions: json.assumptions?.trim(),
    };
  }
}