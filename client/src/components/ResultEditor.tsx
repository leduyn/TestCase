import { forwardRef, useImperativeHandle, useState } from 'react';
import { RichTextEditor } from './RichTextEditor';
import type { TestExecutionImage } from '../types';

export interface ResultEditorHandle {
  getValue: () => string;
}

interface ResultEditorProps {
  initialValue?: string;
  placeholder?: string;
  minHeight?: string;
  isFailed?: boolean;
  availableImages?: TestExecutionImage[];
  onUploadImage?: (file: File) => Promise<string>;
}

// Trình soạn thảo kết quả thực tế được cô lập: state nội bộ,
// chỉ component này re-render khi gõ (không làm re-render component cha).
export const ResultEditor = forwardRef<ResultEditorHandle, ResultEditorProps>(
  ({ initialValue = '', placeholder, minHeight, isFailed, availableImages, onUploadImage }, ref) => {
    const [value, setValue] = useState(initialValue);

    useImperativeHandle(ref, () => ({ getValue: () => value }), [value]);

    return (
      <RichTextEditor
        value={value}
        onChange={(val) => setValue(val)}
        placeholder={placeholder}
        minHeight={minHeight}
        isFailed={isFailed}
        availableImages={availableImages}
        onUploadImage={onUploadImage}
      />
    );
  }
);

ResultEditor.displayName = 'ResultEditor';
