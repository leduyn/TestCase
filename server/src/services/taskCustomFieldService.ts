import prisma from '../config/database';
import { TaskHistoryChangeType, Prisma } from '@prisma/client';

export interface TaskFieldValueInput {
  fieldDefinitionId?: string;
  fieldKey?: string;
  value: any;
  stepId?: string | null;
}

export class TaskCustomFieldService {
  /**
   * Đánh giá điều kiện hiển thị (Visibility Condition)
   */
  static evaluateVisibility(
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
        return String(actualValue ?? '').toLowerCase().includes(String(targetValue ?? '').toLowerCase());

      case 'not_contains':
        if (Array.isArray(actualValue)) {
          return !actualValue.includes(targetValue);
        }
        return !String(actualValue ?? '').toLowerCase().includes(String(targetValue ?? '').toLowerCase());

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
   * Tính toán giá trị công thức an toàn
   */
  static evaluateFormula(
    expression: string,
    currentValues: Record<string, any>,
    decimalPlaces: number = 2
  ): number | null {
    if (!expression || typeof expression !== 'string') return null;

    try {
      // Thay thế tên biến các field bằng giá trị số tương ứng
      let sanitizedExpr = expression;

      // Tìm tất cả các biến dạng [a-zA-Z0-9_]+
      const variableMatches = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];

      // Các hàm toán học cho phép
      const allowedMathFunctions = ['round', 'floor', 'ceil', 'abs', 'min', 'max', 'sqrt', 'pow'];

      for (const varName of variableMatches) {
        if (allowedMathFunctions.includes(varName) || varName.startsWith('Math')) {
          continue;
        }

        const rawVal = currentValues[varName];
        const numVal = rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal)) ? Number(rawVal) : 0;
        // Thay thế an toàn bằng regex word boundary
        const regex = new RegExp(`\\b${varName}\\b`, 'g');
        sanitizedExpr = sanitizedExpr.replace(regex, `(${numVal})`);
      }

      // Chỉ cho phép các ký tự toán học an toàn: số, dấu +, -, *, /, %, (, ), ., khoảng trắng
      const safeMathPattern = /^[0-9+\-*/%().\s,Math.round|floor|ceil|abs|min|max|sqrt|pow]+$/;
      if (!safeMathPattern.test(sanitizedExpr)) {
        return null;
      }

      // Đánh giá biểu thức toán học
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitizedExpr});`)();

      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        const factor = Math.pow(10, decimalPlaces);
        return Math.round(result * factor) / factor;
      }
      return null;
    } catch (e) {
      console.warn('Error evaluating formula expression:', expression, e);
      return null;
    }
  }

  /**
   * Validate giá trị 1 trường theo định nghĩa
   */
  static validateSingleValue(
    def: any,
    value: any,
    isVisible: boolean
  ): { isValid: boolean; error?: string } {
    // Nếu trường không hiển thị thì không bắt buộc validate
    if (!isVisible) {
      return { isValid: true };
    }

    const isValueEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (def.isRequired && isValueEmpty) {
      return { isValid: false, error: `Trường '${def.fieldLabel}' là bắt buộc` };
    }

    if (isValueEmpty) {
      return { isValid: true };
    }

    const config = (def.fieldConfig as any) || {};
    const rules = (def.validationRules as any) || {};

    // Validate theo fieldType
    switch (def.fieldType) {
      case 'number':
      case 'slider': {
        const num = Number(value);
        if (isNaN(num)) {
          return { isValid: false, error: `Trường '${def.fieldLabel}' phải là số hợp lệ` };
        }
        if (config.min !== undefined && num < Number(config.min)) {
          return { isValid: false, error: `Trường '${def.fieldLabel}' không được nhỏ hơn ${config.min}` };
        }
        if (config.max !== undefined && num > Number(config.max)) {
          return { isValid: false, error: `Trường '${def.fieldLabel}' không được lớn hơn ${config.max}` };
        }
        break;
      }

      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value !== 'string' || !emailRegex.test(value.trim())) {
          return { isValid: false, error: `Trường '${def.fieldLabel}' phải là email hợp lệ` };
        }
        if (config.domain_restriction && typeof config.domain_restriction === 'string') {
          const domain = value.trim().split('@')[1];
          if (domain !== config.domain_restriction.trim()) {
            return { isValid: false, error: `Email phải có tên miền @${config.domain_restriction}` };
          }
        }
        break;
      }

      case 'phone': {
        const phoneRegex = /^[0-9+()\-.\s]{7,20}$/;
        if (typeof value !== 'string' || !phoneRegex.test(value.trim())) {
          return { isValid: false, error: `Trường '${def.fieldLabel}' không phải số điện thoại hợp lệ` };
        }
        break;
      }

      case 'url': {
        try {
          new URL(value);
        } catch {
          return { isValid: false, error: `Trường '${def.fieldLabel}' phải là URL hợp lệ (bắt đầu bằng http:// hoặc https://)` };
        }
        break;
      }

      case 'rating': {
        const rating = Number(value);
        const maxStars = config.max_stars || 5;
        if (isNaN(rating) || rating < 0 || rating > maxStars) {
          return { isValid: false, error: `Đánh giá phải từ 1 đến ${maxStars} sao` };
        }
        break;
      }

      case 'select':
      case 'radio': {
        if (config.options && Array.isArray(config.options) && config.options.length > 0) {
          const validOptions = config.options.map((o: any) => String(o.value));
          if (!validOptions.includes(String(value))) {
            return { isValid: false, error: `Giá trị '${value}' không nằm trong danh sách lựa chọn hợp lệ` };
          }
        }
        break;
      }

      case 'multiselect':
      case 'checkbox': {
        if (!Array.isArray(value)) {
          return { isValid: false, error: `Trường '${def.fieldLabel}' phải là một danh sách lựa chọn` };
        }
        const minChecked = config.min_checked ?? config.min_selected;
        const maxChecked = config.max_checked ?? config.max_selected;
        if (minChecked !== undefined && value.length < Number(minChecked)) {
          return { isValid: false, error: `Vui lòng chọn tối thiểu ${minChecked} mục cho '${def.fieldLabel}'` };
        }
        if (maxChecked !== undefined && value.length > Number(maxChecked)) {
          return { isValid: false, error: `Vui lòng chọn tối đa ${maxChecked} mục cho '${def.fieldLabel}'` };
        }
        break;
      }

      case 'file': {
        if (typeof value === 'object' && value !== null) {
          if (config.max_size_mb && value.file_size) {
            const sizeMb = value.file_size / (1024 * 1024);
            if (sizeMb > Number(config.max_size_mb)) {
              return { isValid: false, error: `Tệp đính kèm vượt quá dung lượng cho phép (${config.max_size_mb} MB)` };
            }
          }
        }
        break;
      }

      case 'multifile': {
        if (Array.isArray(value)) {
          if (config.max_files && value.length > Number(config.max_files)) {
            return { isValid: false, error: `Số lượng tệp đính kèm không được vượt quá ${config.max_files}` };
          }
        }
        break;
      }

      case 'text':
      case 'textarea': {
        if (typeof value === 'string') {
          if (rules.min_length && value.length < Number(rules.min_length)) {
            return { isValid: false, error: `Trường '${def.fieldLabel}' phải có tối thiểu ${rules.min_length} ký tự` };
          }
          if (rules.max_length && value.length > Number(rules.max_length)) {
            return { isValid: false, error: `Trường '${def.fieldLabel}' không được vượt quá ${rules.max_length} ký tự` };
          }
          if (rules.pattern) {
            try {
              const reg = new RegExp(rules.pattern);
              if (!reg.test(value)) {
                return { isValid: false, error: rules.pattern_message || `Định dạng '${def.fieldLabel}' không hợp lệ` };
              }
            } catch (e) {
              // Bỏ qua lỗi regex rule không hợp lệ
            }
          }
        }
        break;
      }
    }

    return { isValid: true };
  }

  /**
   * Lấy danh sách Custom Fields cho Task (gồm cả định nghĩa + giá trị đã lưu + tính toán công thức)
   */
  static async getTaskCustomFields(taskId: string, stepId?: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        process: true,
        currentStep: true,
      },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    // Lấy tất cả field definitions của Process
    const definitions = await prisma.customFieldDefinition.findMany({
      where: {
        processId: task.processId,
        isVisible: true,
      },
      orderBy: [{ stepId: 'asc' }, { order: 'asc' }],
      include: {
        step: {
          select: { id: true, name: true, order: true },
        },
      },
    });

    // Lấy các giá trị đã lưu cho task này
    const savedValues = await prisma.taskCustomFieldValue.findMany({
      where: { taskId },
      include: {
        filledBy: { select: { id: true, fullName: true, email: true } },
        updatedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    const valuesMap = new Map<string, any>();
    savedValues.forEach((v) => {
      valuesMap.set(v.fieldDefinitionId, v);
    });

    // Tạo object key -> value cho công thức và điều kiện hiển thị
    const fieldValuesByKey: Record<string, any> = {};
    definitions.forEach((def) => {
      const saved = valuesMap.get(def.id);
      fieldValuesByKey[def.fieldKey] = saved ? saved.value : def.defaultValue;
    });

    // Ghép dữ liệu và đánh giá điều kiện
    const effectiveStepId = stepId || task.currentStepId;

    const fieldsWithValues = definitions.map((def) => {
      const saved = valuesMap.get(def.id);
      const isVisible = this.evaluateVisibility(def.visibilityCondition, fieldValuesByKey);

      let computedValue = saved ? saved.value : def.defaultValue;

      // Nếu là trường formula, tự động tính toán lại
      if (def.fieldType === 'formula') {
        const config = (def.fieldConfig as any) || {};
        const expr = config.expression || '';
        const decimals = config.decimal_places ?? 2;
        const formulaRes = this.evaluateFormula(expr, fieldValuesByKey, decimals);
        if (formulaRes !== null) {
          computedValue = formulaRes;
        }
      }

      const isCurrentStep = def.stepId === null || def.stepId === effectiveStepId;

      return {
        definition: def,
        value: computedValue,
        savedValue: saved?.value ?? null,
        filledBy: saved?.filledBy ?? null,
        filledAt: saved?.filledAt ?? null,
        updatedBy: saved?.updatedBy ?? null,
        updatedAt: saved?.updatedAt ?? null,
        stepId: def.stepId,
        isCurrentStep,
        isVisible,
      };
    });

    return {
      taskId: task.id,
      taskName: task.name,
      processId: task.processId,
      currentStepId: task.currentStepId,
      fields: fieldsWithValues,
      valuesByKey: fieldValuesByKey,
    };
  }

  /**
   * Lưu / Cập nhật bulk giá trị Custom Fields cho Task
   */
  static async saveTaskCustomFieldValues(
    taskId: string,
    inputs: TaskFieldValueInput[],
    userId: string
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        process: true,
        currentStep: true,
        histories: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    // Lấy toàn bộ definitions của quy trình này
    const definitions = await prisma.customFieldDefinition.findMany({
      where: { processId: task.processId },
    });

    const defByKey = new Map<string, any>();
    const defById = new Map<string, any>();
    definitions.forEach((d) => {
      defByKey.set(d.fieldKey, d);
      defById.set(d.id, d);
    });

    // Lấy các giá trị hiện có trong DB
    const existingValues = await prisma.taskCustomFieldValue.findMany({
      where: { taskId },
    });

    const currentValuesByKey: Record<string, any> = {};
    definitions.forEach((d) => {
      const exist = existingValues.find((ev) => ev.fieldDefinitionId === d.id);
      currentValuesByKey[d.fieldKey] = exist ? exist.value : d.defaultValue;
    });

    // Áp dụng các input mới vào currentValuesByKey
    for (const item of inputs) {
      let def = item.fieldDefinitionId ? defById.get(item.fieldDefinitionId) : null;
      if (!def && item.fieldKey) {
        def = defByKey.get(item.fieldKey);
      }
      if (def) {
        currentValuesByKey[def.fieldKey] = item.value;
      }
    }

    // Tự động tính toán các trường formula
    const formulaDefinitions = definitions.filter((d) => d.fieldType === 'formula');
    for (const fDef of formulaDefinitions) {
      const config = (fDef.fieldConfig as any) || {};
      const expr = config.expression || '';
      const decimals = config.decimal_places ?? 2;
      const res = this.evaluateFormula(expr, currentValuesByKey, decimals);
      if (res !== null) {
        currentValuesByKey[fDef.fieldKey] = res;
      }
    }

    // Validate các giá trị
    const validationErrors: string[] = [];
    for (const def of definitions) {
      const isVisible = this.evaluateVisibility(def.visibilityCondition, currentValuesByKey);
      const val = currentValuesByKey[def.fieldKey];

      // Chỉ validate nếu trường thuộc bước hiện tại hoặc đã được nhập
      const isRelevant =
        def.stepId === null ||
        def.stepId === task.currentStepId ||
        inputs.some((inp) => inp.fieldKey === def.fieldKey || inp.fieldDefinitionId === def.id);

      if (isRelevant) {
        const valCheck = this.validateSingleValue(def, val, isVisible);
        if (!valCheck.isValid && valCheck.error) {
          validationErrors.push(valCheck.error);
        }
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(`Xác thực trường dữ liệu thất bại: ${validationErrors.join('; ')}`);
    }

    // Transaction lưu giá trị và ghi snapshot lịch sử
    const latestVersion = task.histories[0]?.version || 1;
    const nextVersion = latestVersion + 1;

    return await prisma.$transaction(async (tx) => {
      // 1. Lưu các giá trị được gửi lên
      for (const item of inputs) {
        let def = item.fieldDefinitionId ? defById.get(item.fieldDefinitionId) : null;
        if (!def && item.fieldKey) {
          def = defByKey.get(item.fieldKey);
        }
        if (!def) continue;

        const effectiveValue =
          def.fieldType === 'formula' ? currentValuesByKey[def.fieldKey] : item.value;
        const jsonValue =
          effectiveValue !== undefined && effectiveValue !== null ? effectiveValue : Prisma.DbNull;

        await tx.taskCustomFieldValue.upsert({
          where: {
            taskId_fieldDefinitionId: {
              taskId,
              fieldDefinitionId: def.id,
            },
          },
          create: {
            taskId,
            fieldDefinitionId: def.id,
            value: jsonValue,
            stepId: item.stepId || def.stepId || task.currentStepId,
            filledById: userId,
            filledAt: new Date(),
            updatedById: userId,
          },
          update: {
            value: jsonValue,
            stepId: item.stepId || def.stepId || task.currentStepId,
            updatedById: userId,
          },
        });
      }

      // 2. Lưu cả các trường formula đã tính toán
      for (const fDef of formulaDefinitions) {
        const fVal = currentValuesByKey[fDef.fieldKey];
        if (fVal !== undefined && fVal !== null) {
          await tx.taskCustomFieldValue.upsert({
            where: {
              taskId_fieldDefinitionId: {
                taskId,
                fieldDefinitionId: fDef.id,
              },
            },
            create: {
              taskId,
              fieldDefinitionId: fDef.id,
              value: fVal,
              stepId: fDef.stepId || task.currentStepId,
              filledById: userId,
              filledAt: new Date(),
              updatedById: userId,
            },
            update: {
              value: fVal,
              updatedById: userId,
            },
          });
        }
      }

      // 3. Cập nhật task.customFields JSON column để tối ưu truy vấn nhanh
      await tx.task.update({
        where: { id: taskId },
        data: {
          customFields: currentValuesByKey,
          updatedById: userId,
        },
      });

      // 4. Tạo snapshot cho Task History
      const fullTaskSnapshot = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          process: { select: { id: true, name: true } },
          currentStep: true,
          todos: true,
          comments: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          customFieldValues: {
            include: {
              fieldDefinition: true,
            },
          },
        },
      });

      await tx.taskHistory.create({
        data: {
          taskId,
          version: nextVersion,
          changedById: userId,
          changeType: TaskHistoryChangeType.FIELD_UPDATED,
          changeDescription: `Cập nhật dữ liệu trường tùy chỉnh (${inputs.length} trường)`,
          snapshot: fullTaskSnapshot ? JSON.parse(JSON.stringify(fullTaskSnapshot)) : {},
          createdById: userId,
        },
      });

      return {
        success: true,
        updatedFieldsCount: inputs.length,
        values: currentValuesByKey,
      };
    });
  }

  /**
   * Validate trước khi lưu (Dry-run validate)
   */
  static async validateTaskCustomFields(
    taskId: string,
    inputs: TaskFieldValueInput[]
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { process: true },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    const definitions = await prisma.customFieldDefinition.findMany({
      where: { processId: task.processId },
    });

    const defByKey = new Map<string, any>();
    const defById = new Map<string, any>();
    definitions.forEach((d) => {
      defByKey.set(d.fieldKey, d);
      defById.set(d.id, d);
    });

    const existingValues = await prisma.taskCustomFieldValue.findMany({
      where: { taskId },
    });

    const currentValuesByKey: Record<string, any> = {};
    definitions.forEach((d) => {
      const exist = existingValues.find((ev) => ev.fieldDefinitionId === d.id);
      currentValuesByKey[d.fieldKey] = exist ? exist.value : d.defaultValue;
    });

    for (const item of inputs) {
      let def = item.fieldDefinitionId ? defById.get(item.fieldDefinitionId) : null;
      if (!def && item.fieldKey) {
        def = defByKey.get(item.fieldKey);
      }
      if (def) {
        currentValuesByKey[def.fieldKey] = item.value;
      }
    }

    const errors: Array<{ fieldKey: string; fieldLabel: string; error: string }> = [];

    for (const def of definitions) {
      const isVisible = this.evaluateVisibility(def.visibilityCondition, currentValuesByKey);
      const val = currentValuesByKey[def.fieldKey];

      const valCheck = this.validateSingleValue(def, val, isVisible);
      if (!valCheck.isValid && valCheck.error) {
        errors.push({
          fieldKey: def.fieldKey,
          fieldLabel: def.fieldLabel,
          error: valCheck.error,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Lấy lịch sử thay đổi trường custom field của task
   */
  static async getTaskCustomFieldHistory(taskId: string) {
    const histories = await prisma.taskHistory.findMany({
      where: {
        taskId,
        changeType: TaskHistoryChangeType.FIELD_UPDATED,
      },
      orderBy: { version: 'desc' },
      include: {
        changedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return histories.map((h) => ({
      id: h.id,
      version: h.version,
      changeDescription: h.changeDescription,
      changedBy: h.changedBy,
      createdAt: h.createdAt,
      snapshot: (h.snapshot as any)?.customFieldValues || (h.snapshot as any)?.customFields || null,
    }));
  }
}
