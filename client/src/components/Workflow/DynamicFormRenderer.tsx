import React, { useMemo, useEffect } from 'react';
import type { CustomFieldDefinition, ProcessStep } from '../../types/workflow';
import type { User } from '../../types';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { Sparkles, Layers, Lock } from 'lucide-react';

export interface DynamicFormRendererProps {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  onBulkChange?: (newValues: Record<string, any>) => void;
  readOnly?: boolean;
  errors?: Record<string, string>;
  users?: User[];
  currentStepId?: string | null;
  steps?: ProcessStep[];
  groupByStep?: boolean;
}

/**
 * Đánh giá điều kiện hiển thị ở phía Client
 */
export function evaluateVisibilityCondition(
  condition: any,
  currentValues: Record<string, any>
): boolean {
  if (!condition || !condition.field || !condition.operator) {
    return true;
  }

  const { field, operator, value: targetValue } = condition;
  const actualValue = currentValues[field];

  switch (operator) {
    case 'equals':
      if (Array.isArray(actualValue)) {
        return actualValue.includes(targetValue);
      }
      return String(actualValue ?? '') === String(targetValue ?? '');

    case 'not_equals':
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(targetValue);
      }
      return String(actualValue ?? '') !== String(targetValue ?? '');

    case 'contains':
      if (Array.isArray(actualValue)) {
        return actualValue.includes(targetValue);
      }
      return String(actualValue ?? '')
        .toLowerCase()
        .includes(String(targetValue ?? '').toLowerCase());

    case 'not_contains':
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(targetValue);
      }
      return !String(actualValue ?? '')
        .toLowerCase()
        .includes(String(targetValue ?? '').toLowerCase());

    case 'greater_than':
      return Number(actualValue) > Number(targetValue);

    case 'less_than':
      return Number(actualValue) < Number(targetValue);

    case 'greater_or_equal':
      return Number(actualValue) >= Number(targetValue);

    case 'less_or_equal':
      return Number(actualValue) <= Number(targetValue);

    case 'is_empty':
      return (
        actualValue === null ||
        actualValue === undefined ||
        actualValue === '' ||
        (Array.isArray(actualValue) && actualValue.length === 0)
      );

    case 'is_not_empty':
      return !(
        actualValue === null ||
        actualValue === undefined ||
        actualValue === '' ||
        (Array.isArray(actualValue) && actualValue.length === 0)
      );

    case 'in_array':
      if (Array.isArray(targetValue)) {
        return targetValue.includes(actualValue);
      }
      return false;

    case 'not_in_array':
      if (Array.isArray(targetValue)) {
        return !targetValue.includes(actualValue);
      }
      return true;

    default:
      return true;
  }
}

/**
 * Tính toán công thức an toàn phía Client
 */
export function evaluateFormulaClient(
  expression: string,
  currentValues: Record<string, any>,
  decimalPlaces: number = 2
): number | null {
  if (!expression || typeof expression !== 'string') return null;

  try {
    let sanitizedExpr = expression;
    const variableMatches = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    const allowedMathFunctions = ['round', 'floor', 'ceil', 'abs', 'min', 'max', 'sqrt', 'pow'];

    for (const varName of variableMatches) {
      if (allowedMathFunctions.includes(varName) || varName.startsWith('Math')) {
        continue;
      }
      const rawVal = currentValues[varName];
      const numVal = rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal)) ? Number(rawVal) : 0;
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      sanitizedExpr = sanitizedExpr.replace(regex, `(${numVal})`);
    }

    const safeMathPattern = /^[0-9+\-*/%().\s,Math.round|floor|ceil|abs|min|max|sqrt|pow]+$/;
    if (!safeMathPattern.test(sanitizedExpr)) {
      return null;
    }

    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${sanitizedExpr});`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      const factor = Math.pow(10, decimalPlaces);
      return Math.round(result * factor) / factor;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  fields = [],
  values = {},
  onChange,
  onBulkChange,
  readOnly = false,
  errors = {},
  users = [],
  currentStepId = null,
  steps = [],
  groupByStep = true,
}) => {
  // Lọc và sắp xếp các trường
  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [fields]);

  // Tự động tính toán các trường formula khi các trường liên quan thay đổi
  useEffect(() => {
    const formulaFields = sortedFields.filter((f) => f.fieldType === 'formula');
    let hasChanges = false;
    const newComputedValues = { ...values };

    formulaFields.forEach((f) => {
      const config = (f.fieldConfig as any) || {};
      const expr = config.expression;
      const decimals = config.decimal_places ?? 2;
      if (expr) {
        const result = evaluateFormulaClient(expr, values, decimals);
        if (result !== null && result !== values[f.fieldKey]) {
          newComputedValues[f.fieldKey] = result;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      if (onBulkChange) {
        onBulkChange(newComputedValues);
      } else {
        Object.keys(newComputedValues).forEach((k) => {
          if (newComputedValues[k] !== values[k]) {
            onChange(k, newComputedValues[k]);
          }
        });
      }
    }
  }, [values, sortedFields]);

  // Gom nhóm fields theo step nếu có yêu cầu
  const groupedSections = useMemo(() => {
    if (!groupByStep || steps.length === 0) {
      return [{ title: 'Trường dữ liệu tùy chỉnh', stepId: null, fields: sortedFields }];
    }

    const sections: Array<{
      title: string;
      stepId: string | null;
      isCurrent: boolean;
      fields: CustomFieldDefinition[];
    }> = [];

    // 1. Global fields (Áp dụng cho toàn bộ quy trình)
    const globalFields = sortedFields.filter((f) => !f.stepId);
    if (globalFields.length > 0) {
      sections.push({
        title: 'Trường chung quy trình (Toàn bộ bước)',
        stepId: null,
        isCurrent: true,
        fields: globalFields,
      });
    }

    // 2. Từng Step
    steps.forEach((s) => {
      const stepFields = sortedFields.filter((f) => f.stepId === s.id);
      if (stepFields.length > 0) {
        sections.push({
          title: `Bước ${s.order}: ${s.name}`,
          stepId: s.id,
          isCurrent: s.id === currentStepId,
          fields: stepFields,
        });
      }
    });

    return sections;
  }, [sortedFields, steps, currentStepId, groupByStep]);

  if (sortedFields.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
        <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Chưa có trường dữ liệu tùy chỉnh nào được định nghĩa
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Bạn có thể cấu hình các trường Custom Fields trong cài đặt quy trình.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedSections.map((section, sIdx) => {
        // Lọc các fields hiển thị theo visibility condition
        const visibleFields = section.fields.filter((f) =>
          evaluateVisibilityCondition(f.visibilityCondition, values)
        );

        if (visibleFields.length === 0) return null;

        const isCurrentSection = section.stepId === null || section.stepId === currentStepId;
        const sectionReadOnly = readOnly || !isCurrentSection;

        return (
          <div
            key={sIdx}
            className={`rounded-2xl border transition-all ${
              isCurrentSection
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 opacity-90'
            }`}
          >
            {/* Section Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {section.title}
                </span>
                {isCurrentSection ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                    <Sparkles className="w-3 h-3" /> Bước hiện tại
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
                    <Lock className="w-3 h-3" /> Chỉ xem
                  </span>
                )}
              </div>

              <span className="text-[11px] text-slate-400">
                {visibleFields.length} trường dữ liệu
              </span>
            </div>

            {/* Section Fields Grid */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleFields.map((f) => {
                const isFullWidth = ['textarea', 'richtext', 'multifile', 'checkbox'].includes(
                  f.fieldType
                );

                return (
                  <div
                    key={f.id}
                    className={isFullWidth ? 'sm:col-span-2' : 'sm:col-span-1'}
                  >
                    <DynamicFieldRenderer
                      field={f}
                      value={values[f.fieldKey] !== undefined ? values[f.fieldKey] : f.defaultValue}
                      onChange={(val) => onChange(f.fieldKey, val)}
                      readOnly={sectionReadOnly}
                      error={errors[f.fieldKey]}
                      users={users}
                      allValues={values}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
