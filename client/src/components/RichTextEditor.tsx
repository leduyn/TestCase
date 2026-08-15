import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Undo,
  Redo,
  RemoveFormatting,
  Sparkles,
  Maximize2,
  Minimize2,
  Code2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Palette,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  isFailed?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Nhập kết quả thực tế khi kiểm thử...',
  minHeight = '180px',
  isFailed = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const isUpdatingRef = useRef(false);

  // Sync value from props to editor contentEditable
  useEffect(() => {
    if (!editorRef.current) return;
    if (isUpdatingRef.current) return;

    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    isUpdatingRef.current = true;
    const html = editorRef.current.innerHTML;
    onChange(html === '<p><br></p>' || html === '<br>' ? '' : html);
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 50);
  };

  const execCmd = (command: string, arg: string | undefined = undefined) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const insertLink = () => {
    const url = prompt('Nhập đường dẫn liên kết (URL):', 'https://');
    if (url && url !== 'https://') {
      execCmd('createLink', url);
    }
  };

  const insertImage = () => {
    const url = prompt('Nhập đường dẫn ảnh (URL hoặc Data URL):', 'https://');
    if (url && url !== 'https://') {
      execCmd('insertImage', url);
    }
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 8px 0; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; text-align: left;">Trường hợp</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; text-align: left;">Dữ liệu nhập</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; text-align: left;">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Dòng 1</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Dữ liệu test</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Thành công / Lỗi</td>
          </tr>
        </tbody>
      </table>
      <p></p>
    `;
    execCmd('insertHTML', tableHtml);
  };

  const applyColor = (color: string) => {
    execCmd('foreColor', color);
    setShowColorPicker(false);
  };

  const applyTemplate = (type: 'pass' | 'bug' | 'blocked') => {
    let tpl = '';
    if (type === 'pass') {
      tpl = `
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 8px 12px; margin: 8px 0; border-radius: 4px; color: #065f46;">
          <strong>✅ KẾT QUẢ ĐẠT (PASSED):</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            <li>Hệ thống phản hồi đúng 100% so với đặc tả mong đợi.</li>
            <li>Giao diện hiển thị chuẩn xác, không phát sinh lỗi giao diện hay console.</li>
          </ul>
        </div>
        <p></p>
      `;
    } else if (type === 'bug') {
      tpl = `
        <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 8px 12px; margin: 8px 0; border-radius: 4px; color: #9f1239;">
          <strong>❌ PHÁT HIỆN LỖI (BUG FOUND):</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            <li><strong>Thực tế xảy ra:</strong> Ứng dụng báo lỗi / không chuyển trang / sai dữ liệu...</li>
            <li><strong>Mã lỗi / Log:</strong> HTTP 500 / Crash null pointer...</li>
            <li><strong>Ticket liên quan:</strong> [Jira-XXX]</li>
          </ul>
        </div>
        <p></p>
      `;
    } else if (type === 'blocked') {
      tpl = `
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 8px 12px; margin: 8px 0; border-radius: 4px; color: #92400e;">
          <strong>⚠️ BỊ CHẶN (BLOCKED):</strong>
          <p style="margin: 4px 0 0 0;">Không thể thực hiện test case do phụ thuộc API / môi trường chưa sẵn sàng.</p>
        </div>
        <p></p>
      `;
    }

    execCmd('insertHTML', tpl);
    setShowTemplateMenu(false);
  };

  return (
    <div
      className={`rounded-xl border transition-all flex flex-col bg-white dark:bg-slate-900 ${
        isFullscreen
          ? 'fixed inset-4 z-[9999] shadow-2xl ring-1 ring-slate-900/10'
          : isFailed
          ? 'border-rose-300 dark:border-rose-800 shadow-sm shadow-rose-500/5'
          : 'border-slate-300 dark:border-slate-700 shadow-sm'
      }`}
    >
      {/* CKEditor-style Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 rounded-t-xl select-none">
        {/* Undo / Redo */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => execCmd('undo')}
            title="Hoàn tác (Undo - Ctrl+Z)"
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('redo')}
            title="Làm lại (Redo - Ctrl+Y)"
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Heading Dropdown */}
        <select
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'p') execCmd('formatBlock', '<p>');
            else if (val === 'h2') execCmd('formatBlock', '<h2>');
            else if (val === 'h3') execCmd('formatBlock', '<h3>');
            e.target.value = '';
          }}
          defaultValue=""
          className="h-7 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 focus:outline-none"
          title="Định dạng tiêu đề / đoạn văn"
        >
          <option value="" disabled>
            Kiểu chữ
          </option>
          <option value="p">Văn bản thường</option>
          <option value="h2">Tiêu đề lớn (H2)</option>
          <option value="h3">Tiêu đề vừa (H3)</option>
        </select>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Text Formattings */}
        <button
          type="button"
          onClick={() => execCmd('bold')}
          title="In đậm (Bold - Ctrl+B)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors font-bold"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCmd('italic')}
          title="In nghiêng (Italic - Ctrl+I)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCmd('underline')}
          title="Gạch chân (Underline - Ctrl+U)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <Underline className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCmd('strikeThrough')}
          title="Gạch ngang chữ (Strikethrough)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        {/* Color Picker Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Màu chữ"
            className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
          >
            <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </button>

          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => applyColor('#000000')}
                className="w-5 h-5 rounded-full bg-slate-900 border border-slate-300"
                title="Đen / Mặc định"
              />
              <button
                type="button"
                onClick={() => applyColor('#10b981')}
                className="w-5 h-5 rounded-full bg-emerald-500 border border-emerald-600"
                title="Xanh lá (Pass)"
              />
              <button
                type="button"
                onClick={() => applyColor('#ef4444')}
                className="w-5 h-5 rounded-full bg-rose-500 border border-rose-600"
                title="Đỏ (Lỗi / Bug)"
              />
              <button
                type="button"
                onClick={() => applyColor('#f59e0b')}
                className="w-5 h-5 rounded-full bg-amber-500 border border-amber-600"
                title="Vàng cam (Cảnh báo)"
              />
              <button
                type="button"
                onClick={() => applyColor('#2563eb')}
                className="w-5 h-5 rounded-full bg-blue-600 border border-blue-700"
                title="Xanh dương"
              />
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Lists & Quotes */}
        <button
          type="button"
          onClick={() => execCmd('insertUnorderedList')}
          title="Danh sách dấu chấm (Bullet List)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCmd('insertOrderedList')}
          title="Danh sách số thứ tự (Numbered List)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCmd('formatBlock', '<blockquote>')}
          title="Khối trích dẫn (Blockquote)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <Quote className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCmd('formatBlock', '<pre>')}
          title="Đoạn mã code (Code Block)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Inserts: Link, Image, Table */}
        <button
          type="button"
          onClick={insertLink}
          title="Chèn liên kết web (Link)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={insertImage}
          title="Chèn ảnh / screenshot"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={insertTable}
          title="Chèn bảng dữ liệu test"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <TableIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCmd('removeFormat')}
          title="Xóa định dạng (Clear formatting)"
          className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
        >
          <RemoveFormatting className="w-4 h-4" />
        </button>

        {/* Templates Quick Insert */}
        <div className="relative ml-auto flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-blue-100/70 hover:bg-blue-200/80 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 transition-colors"
              title="Chèn mẫu nhanh kết quả kiểm thử"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mẫu nhanh</span>
            </button>

            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => applyTemplate('pass')}
                  className="w-full px-3 py-2 text-left text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mẫu: Đạt (Passed)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('bug')}
                  className="w-full px-3 py-2 text-left text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Mẫu: Lỗi (Bug Report)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('blocked')}
                  className="w-full px-3 py-2 text-left text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 flex items-center gap-2"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Mẫu: Bị chặn (Blocked)
                </button>
              </div>
            )}
          </div>

          {/* Toggle HTML Source Code */}
          <button
            type="button"
            onClick={() => setIsHtmlMode(!isHtmlMode)}
            className={`p-1.5 rounded transition-colors ${
              isHtmlMode
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700'
            }`}
            title="Xem / Sửa mã nguồn HTML"
          >
            <Code2 className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="relative flex-1 flex flex-col min-h-[140px]">
        {isHtmlMode ? (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="<html> Nhập mã HTML tại đây... </html>"
            style={{ minHeight }}
            className="w-full flex-1 p-3.5 font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-none rounded-b-xl resize-y"
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            style={{ minHeight }}
            data-placeholder={placeholder}
            className="rich-text-content w-full flex-1 p-3.5 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none rounded-b-xl overflow-y-auto leading-relaxed"
          />
        )}
      </div>

      {/* Editor Footer / Character Stats */}
      <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between rounded-b-xl select-none">
        <span>CKEditor Rich Text • Hỗ trợ Copy/Paste ảnh & bảng biểu</span>
        <span>
          {value ? value.replace(/<[^>]*>/g, '').trim().length : 0} ký tự
        </span>
      </div>
    </div>
  );
};
