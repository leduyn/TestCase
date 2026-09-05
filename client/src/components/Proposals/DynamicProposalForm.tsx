import React, { useMemo } from 'react';
import type { FormFieldDefinition, FormTemplate } from '../../types/proposal';
import type { CustomFieldDefinition } from '../../types/workflow';
import type { User } from '../../types';
import { DynamicFieldRenderer } from '../Workflow/DynamicFieldRenderer';
import { Layers, FileText } from 'lucide-react';

export interface DynamicProposalFormProps {
  formTemplate?: FormTemplate | null;
  fields?: FormFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
  users?: User[];
  showFieldKey?: boolean;
}

export const DynamicProposalForm: React.FC<DynamicProposalFormProps> = ({
  formTemplate,
  fields: propFields,
  values,
  onChange,
  errors = {},
  readOnly = false,
  users = [],
  showFieldKey = false,
}) => {
  // Determine final list of fields
  const fields: FormFieldDefinition[] = useMemo(() => {
    if (propFields && propFields.length > 0) {
      return propFields;
    }
    if (formTemplate?.fields && formTemplate.fields.length > 0) {
      return formTemplate.fields;
    }
    return [];
  }, [propFields, formTemplate]);

  // Sort fields by order
  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [fields]);

  // Check if sections are defined
  const sections = useMemo(() => {
    return formTemplate?.formStructure?.sections || [];
  }, [formTemplate]);

  if (sortedFields.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
        <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Form mẫu này hiện chưa có trường dữ liệu nào
        </p>
        <p className="text-xs text-slate-400">
          Người tạo có thể gửi kèm nội dung chi tiết trong phần văn bản đề xuất
        </p>
      </div>
    );
  }

  // Render a single field wrapped in DynamicFieldRenderer
  const renderField = (field: FormFieldDefinition) => {
    // Map FormFieldDefinition to CustomFieldDefinition
    const customField: CustomFieldDefinition = {
      id: field.id,
      processId: formTemplate?.proposalTypeId || '',
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType as any,
      fieldConfig: field.fieldConfig || {},
      isRequired: field.isRequired,
      defaultValue: field.defaultValue,
      placeholder: field.placeholder || undefined,
      helpText: field.helpText || undefined,
      order: field.order,
      isVisible: field.isVisible,
      visibilityCondition: field.visibilityCondition,
      validationRules: field.validationRules,
      createdAt: field.createdAt || new Date().toISOString(),
      updatedAt: field.updatedAt || new Date().toISOString(),
    };

    const isFullWidth = ['textarea', 'richtext', 'file'].includes(field.fieldType);
    const fieldError = errors[field.fieldKey];

    return (
      <div
        key={field.id || field.fieldKey}
        className={isFullWidth ? 'col-span-1 md:col-span-2' : 'col-span-1'}
      >
        <DynamicFieldRenderer
          field={customField}
          value={values[field.fieldKey] !== undefined ? values[field.fieldKey] : field.defaultValue}
          onChange={(newVal) => onChange(field.fieldKey, newVal)}
          readOnly={readOnly}
          disabled={readOnly}
          error={fieldError}
          users={users}
          allValues={values}
          showFieldKey={showFieldKey}
        />
      </div>
    );
  };

  // If template has defined sections, group fields accordingly
  if (sections.length > 0) {
    return (
      <div className="space-y-6">
        {sections.map((section, sIdx) => {
          const sectionFields = sortedFields.filter(
            (f) =>
              (section.fieldKeys && section.fieldKeys.includes(f.fieldKey)) ||
              f.sectionId === section.id
          );

          if (sectionFields.length === 0) return null;

          return (
            <div
              key={section.id || sIdx}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {section.title}
                  </h4>
                </div>
                {section.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{section.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectionFields.map((f) => renderField(f))}
              </div>
            </div>
          );
        })}

        {/* Render fields not in any section */}
        {(() => {
          const unassignedFields = sortedFields.filter(
            (f) =>
              !sections.some(
                (s) =>
                  (s.fieldKeys && s.fieldKeys.includes(f.fieldKey)) ||
                  f.sectionId === s.id
              )
          );

          if (unassignedFields.length === 0) return null;

          return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/80 pb-2">
                Thông tin bổ sung
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unassignedFields.map((f) => renderField(f))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Standard responsive 2-column grid layout
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sortedFields.map((f) => renderField(f))}
      </div>
    </div>
  );
};
export default DynamicProposalForm;
