import ExcelJS from 'exceljs';

export interface ExportTestCaseItem {
  testCaseCode: string;
  module: string;
  platform: string;
  title: string;
  testType: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: string;
  server?: string | null;
  os?: string | null;
  actualResult?: string | null;
  status?: string | null;
  notes?: string | null;
  executedById?: string | null;
  executedByName?: string | null;
}

export interface ExportTestSuiteData {
  title: string;
  moduleName: string;
  summary?: string | null;
  assumptions?: string | null;
  testCases: ExportTestCaseItem[];
}

export interface ConsolidatedTestCaseItem {
  testCaseCode: string;
  module: string;
  platform: string;
  title: string;
  testType: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: string;
  userResults: Map<string, { summary: string; status: string }>;
}

export interface ExecutingUser {
  id: string;
  fullName: string;
}

export interface ConsolidatedExportData {
  title: string;
  moduleName: string;
  summary?: string | null;
  assumptions?: string | null;
  testCases: ConsolidatedTestCaseItem[];
  executingUsers: ExecutingUser[];
}

export class ExcelExporter {
  static async generateExcelBuffer(data: ExportTestSuiteData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Test Case Generator';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Test Cases', {
      views: [{ showGridLines: true }],
    });

    // Palette Colors
    const COLOR_HEADER = '1F3864'; // Navy Blue
    const COLOR_APP = 'D9EAD3';    // Light Green
    const COLOR_CMS = 'FFF2CC';    // Light Yellow
    const COLOR_HAPPY = 'E2EFDA';  // Soft Green (Luồng chuẩn)
    const COLOR_NEGATIVE = 'FCE4D6'; // Soft Orange (Ngoại lệ)
    const COLOR_BOUNDARY = 'FFF2CC'; // Soft Yellow (Biên)
    const COLOR_PASSED = 'C6EFCE'; // Soft Green Passed
    const COLOR_FAILED = 'FFC7CE'; // Soft Red Failed
    const COLOR_BLOCKED = 'FFE699'; // Orange Blocked

    // Borders
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'BFBFBF' } },
      left: { style: 'thin', color: { argb: 'BFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'BFBFBF' } },
      right: { style: 'thin', color: { argb: 'BFBFBF' } },
    };

    // 1. Title Row
    worksheet.mergeCells('A1:N1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `BỘ TEST CASE – ${data.title.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 32;

    // 2. Summary Info (Rows 2 & 3 if available)
    let currentRow = 2;
    if (data.summary || data.assumptions) {
      worksheet.mergeCells(`A${currentRow}:N${currentRow}`);
      const infoCell = worksheet.getCell(`A${currentRow}`);
      infoCell.value = `Mô tả: ${data.summary || 'N/A'}${data.assumptions ? ` | Giả định: ${data.assumptions}` : ''}`;
      infoCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '333333' } };
      infoCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      worksheet.getRow(currentRow).height = 24;
      currentRow++;
    }

    // 3. Headers
      const headers = [
        { key: 'code', header: 'Mã TC', width: 13 },
        { key: 'module', header: 'Chức năng', width: 18 },
        { key: 'platform', header: 'Test trên', width: 12 },
        { key: 'title', header: 'Tiêu đề kịch bản', width: 36 },
        { key: 'testType', header: 'Loại kiểm thử', width: 15 },
        { key: 'preconditions', header: 'Điều kiện tiên quyết', width: 32 },
        { key: 'steps', header: 'Các bước thực hiện', width: 42 },
        { key: 'expectedResult', header: 'Kết quả mong đ� đợi', width: 42 },
        { key: 'priority', header: '�Ưu tiên', width: 12 },
        { key: 'server', header: 'Server', width: 14 },
        { key: 'os', header: 'Hệствие hành', width: 16 },
        { key: 'actualResult', header: 'Kết quả thực tế', width: 32 },
        { key: 'status', header: 'Đánh giá', width: 14 },
        { key: 'notes', header: 'Ghi chú', width: 26 },
        { key: 'executedBy', header: 'Người thực hiện', width: 20 },
      ];

    const headerRow = worksheet.getRow(currentRow);
    headerRow.height = 26;

    headers.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
      worksheet.getColumn(index + 1).width = col.width;
    });

    currentRow++;

    // 4. Data Rows
    // Helper to convert HTML to plain text with linebreaks for Excel
    const formatHtmlToPlainText = (html: string | null | undefined): string => {
      if (!html) return '';
      return html
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    };

     data.testCases.forEach((tc) => {
       const row = worksheet.getRow(currentRow);
       row.height = 36; // Dynamic wrap

       const cells = [
         tc.testCaseCode || '',
         tc.module || '',
         tc.platform || '',
         tc.title || '',
         tc.testType || '',
         tc.preconditions || '',
         tc.steps || '',
         tc.expectedResult || '',
         tc.priority || '',
         tc.server || '',
         tc.os || '',
         formatHtmlToPlainText(tc.actualResult),
         tc.status || 'UNTESTED',
         tc.notes || '',
         tc.executedByName || '', // New column for executed by name
       ];

       cells.forEach((val, idx) => {
         const cell = row.getCell(idx + 1);
         cell.value = val;
         cell.font = { name: 'Calibri', size: 10 };
         cell.border = thinBorder;
         cell.alignment = { vertical: 'top', wrapText: true };

         // Specific alignments & stylings
         if (idx === 0) { // Mã TC
           cell.alignment = { horizontal: 'center', vertical: 'middle' };
           cell.font = { name: 'Calibri', size: 10, bold: true };
         } else if (idx === 2) { // Platform (App / CMS / Web)
           cell.alignment = { horizontal: 'center', vertical: 'middle' };
           const p = (val || '').toUpperCase();
           if (p.includes('APP')) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_APP } };
           } else if (p.includes('CMS')) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CMS } };
           }
         } else if (idx === 4) { // Test Type
           cell.alignment = { horizontal: 'center', vertical: 'middle' };
           const t = (val || '').toLowerCase();
           if (t.includes('ngoại lệ') || t.includes('negative')) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NEGATIVE } };
           } else if (t.includes('biên') || t.includes('boundary')) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BOUNDARY } };
           } else {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HAPPY } };
           }
         } else if (idx === 8) { // Priority
           cell.alignment = { horizontal: 'center', vertical: 'middle' };
           const prio = (val || '').toLowerCase();
           if (prio === 'cao' || prio === 'high') {
             cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'C00000' } };
           } else if (prio === 'trung bình' || prio === 'medium') {
             cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'ED7D31' } };
           } else {
             cell.font = { name: 'Calibri', size: 10, color: { argb: '70AD47' } };
           }
         } else if (idx === 9 || idx === 10) { // Server & OS
           cell.alignment = { horizontal: 'center', vertical: 'middle' };
         } else if (idx === 12) { // Status (Passed / Failed / Blocked / Untested)
           cell.alignment = { horizontal: 'center', vertical: 'middle' };
           const s = (val || '').toUpperCase();
           if (s === 'PASSED') {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PASSED } };
             cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '276A3C' } };
           } else if (s === 'FAILED') {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FAILED } };
             cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '9C0006' } };
           } else if (s === 'BLOCKED') {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BLOCKED } };
             cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '9C6500' } };
           }
         } else if (idx === 14) { // Executed By
           cell.alignment = { horizontal: 'center', vertical: 'middle' };
           // No special styling needed
         }
       });

       currentRow++;
     });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  static mapStatusToVietnamese(status: string): string {
    const s = (status || 'UNTESTED').toUpperCase();
    switch (s) {
      case 'PASSED': return 'Đạt';
      case 'FAILED': return 'Thất bại';
      case 'BLOCKED': return 'Chặn';
      case 'UNTESTED': return 'Chưa test';
      default: return 'Chưa test';
    }
  }

  static async generateConsolidatedResultsExcelBuffer(data: ConsolidatedExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Test Case Generator';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Kết quả Test', {
      views: [{ showGridLines: true }],
    });

    // Palette Colors
    const COLOR_HEADER = '1F3864'; // Navy Blue
    const COLOR_APP = 'D9EAD3';    // Light Green
    const COLOR_CMS = 'FFF2CC';    // Light Yellow
    const COLOR_HAPPY = 'E2EFDA';  // Soft Green (Luồng chuẩn)
    const COLOR_NEGATIVE = 'FCE4D6'; // Soft Orange (Ngoại lệ)
    const COLOR_BOUNDARY = 'FFF2CC'; // Soft Yellow (Biên)
    const COLOR_PASSED = 'C6EFCE'; // Soft Green Passed
    const COLOR_FAILED = 'FFC7CE'; // Soft Red Failed
    const COLOR_BLOCKED = 'FFE699'; // Orange Blocked
    const COLOR_UNTESTED = 'F2F2F2'; // Light Gray

    // Borders
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'BFBFBF' } },
      left: { style: 'thin', color: { argb: 'BFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'BFBFBF' } },
      right: { style: 'thin', color: { argb: 'BFBFBF' } },
    };

    // 1. Title Row
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `KẾT QUẢ THỰC THI TEST CASE – ${data.title.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 32;

    // 2. Summary Info (Rows 2 & 3 if available)
    let currentRow = 2;
    if (data.summary || data.assumptions) {
      worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
      const infoCell = worksheet.getCell(`A${currentRow}`);
      infoCell.value = `Mô tả: ${data.summary || 'N/A'}${data.assumptions ? ` | Giả định: ${data.assumptions}` : ''}`;
      infoCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '333333' } };
      infoCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      worksheet.getRow(currentRow).height = 24;
      currentRow++;
    }

    // 3. Headers - Fixed columns (10) + Dynamic columns (2 per user)
    const fixedHeaders = [
      { key: 'code', header: 'Mã TC', width: 13 },
      { key: 'module', header: 'Chức năng', width: 18 },
      { key: 'platform', header: 'Test trên', width: 12 },
      { key: 'title', header: 'Tiêu đề kịch bản', width: 36 },
      { key: 'testType', header: 'Loại kiểm thử', width: 15 },
      { key: 'preconditions', header: 'Điều kiện tiên quyết', width: 32 },
      { key: 'steps', header: 'Các bước thực hiện', width: 42 },
      { key: 'expectedResult', header: 'Kết quả mong đợi', width: 42 },
      { key: 'priority', header: 'Ưu tiên', width: 12 },
    ];

    // Dynamic headers: 2 columns per user (Kết quả test + Trạng thái)
    const dynamicHeaders: { key: string; header: string; width: number; userId: string }[] = [];
    data.executingUsers.forEach((user) => {
      dynamicHeaders.push(
        { key: `result_${user.id}`, header: `Kết quả test ${user.fullName}`, width: 40, userId: user.id },
        { key: `status_${user.id}`, header: `Trạng thái ${user.fullName}`, width: 18, userId: user.id }
      );
    });

    const allHeaders = [...fixedHeaders, ...dynamicHeaders];
    const totalCols = allHeaders.length;

    const headerRow = worksheet.getRow(currentRow);
    headerRow.height = 26;

    allHeaders.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
      worksheet.getColumn(index + 1).width = col.width;
    });

    currentRow++;

    // Helper to convert HTML to plain text
    const formatHtmlToPlainText = (html: string | null | undefined): string => {
      if (!html) return '';
      return html
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    };

    // 4. Data Rows
    data.testCases.forEach((tc) => {
      const row = worksheet.getRow(currentRow);
      row.height = 36;

      // Fixed columns data - apply HTML formatting for text fields
      const fixedCells = [
        tc.testCaseCode || '',
        tc.module || '',
        tc.platform || '',
        tc.title || '',
        tc.testType || '',
        formatHtmlToPlainText(tc.preconditions),
        formatHtmlToPlainText(tc.steps),
        formatHtmlToPlainText(tc.expectedResult),
        tc.priority || '',
      ];

      // Dynamic columns data - for each user
      const dynamicCells: string[] = [];
      data.executingUsers.forEach((user) => {
        const userResult = tc.userResults.get(user.id);
        if (userResult) {
          dynamicCells.push(userResult.summary || '');     // Kết quả test
          dynamicCells.push(this.mapStatusToVietnamese(userResult.status)); // Trạng thái
        } else {
          dynamicCells.push(''); // Kết quả test
          dynamicCells.push('Chưa test'); // Trạng thái
        }
      });

      const allCells = [...fixedCells, ...dynamicCells];

      allCells.forEach((val, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'top', wrapText: true };

        // Specific alignments & stylings for fixed columns
        if (idx === 0) { // Mã TC
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10, bold: true };
        } else if (idx === 2) { // Platform (App / CMS / Web)
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          const p = (val || '').toUpperCase();
          if (p.includes('APP')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_APP } };
          } else if (p.includes('CMS')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CMS } };
          }
        } else if (idx === 4) { // Test Type
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          const t = (val || '').toLowerCase();
          if (t.includes('ngoại lệ') || t.includes('negative')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NEGATIVE } };
          } else if (t.includes('biên') || t.includes('boundary')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BOUNDARY } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HAPPY } };
          }
        } else if (idx === 8) { // Priority
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          const prio = (val || '').toLowerCase();
          if (prio === 'cao' || prio === 'high') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'C00000' } };
          } else if (prio === 'trung bình' || prio === 'medium') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'ED7D31' } };
          } else {
            cell.font = { name: 'Calibri', size: 10, color: { argb: '70AD47' } };
          }
        } else if (idx >= fixedHeaders.length) { // Dynamic columns
          // Even indices (0-based relative to dynamic) = Kết quả test columns
          // Odd indices = Trạng thái columns
          const dynamicIdx = idx - fixedHeaders.length;
          if (dynamicIdx % 2 === 0) {
            // Kết quả test column - wrap text
            cell.alignment = { vertical: 'top', wrapText: true };
          } else {
            // Trạng thái column - center align with color coding
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            const status = this.mapStatusToVietnamese(val);
            if (status === 'Đạt') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PASSED } };
              cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '276A3C' } };
            } else if (status === 'Thất bại') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FAILED } };
              cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '9C0006' } };
            } else if (status === 'Chặn') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BLOCKED } };
              cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '9C6500' } };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_UNTESTED } };
              cell.font = { name: 'Calibri', size: 10, color: { argb: '666666' } };
            }
          }
        }
      });

      currentRow++;
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }
}
