import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export const SUPPORTED_FIELD_TYPES = [
  'text',
  'textarea',
  'richtext',
  'number',
  'date',
  'datetime',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'toggle',
  'file',
  'multifile',
  'user',
  'multiuser',
  'email',
  'phone',
  'url',
  'rating',
  'slider',
  'color',
  'formula',
] as const;

export type SupportedFieldType = (typeof SUPPORTED_FIELD_TYPES)[number];

export interface CreateCustomFieldDto {
  processId: string;
  stepId?: string | null;
  fieldKey: string;
  fieldLabel: string;
  fieldType: SupportedFieldType | string;
  fieldConfig?: Record<string, any>;
  isRequired?: boolean;
  defaultValue?: any;
  placeholder?: string | null;
  helpText?: string | null;
  order?: number;
  isVisible?: boolean;
  visibilityCondition?: Record<string, any> | null;
  validationRules?: Record<string, any> | null;
}

export interface UpdateCustomFieldDto {
  stepId?: string | null;
  fieldLabel?: string;
  fieldConfig?: Record<string, any>;
  isRequired?: boolean;
  defaultValue?: any;
  placeholder?: string | null;
  helpText?: string | null;
  order?: number;
  isVisible?: boolean;
  visibilityCondition?: Record<string, any> | null;
  validationRules?: Record<string, any> | null;
}

export class CustomFieldService {
  /**
   * Danh sách các loại trường hỗ trợ cùng metadata mô tả
   */
  static getSupportedFieldTypes() {
    return [
      { type: 'text', label: 'Văn bản (1 dòng)', category: 'text', icon: 'Type' },
      { type: 'textarea', label: 'Đoạn văn (nhiều dòng)', category: 'text', icon: 'AlignLeft' },
      { type: 'richtext', label: 'Soạn thảo Rich Text', category: 'text', icon: 'FileText' },
      { type: 'number', label: 'Số liệu', category: 'number', icon: 'Hash' },
      { type: 'date', label: 'Ngày', category: 'date', icon: 'Calendar' },
      { type: 'datetime', label: 'Ngày & Giờ', category: 'date', icon: 'Clock' },
      { type: 'select', label: 'Chọn 1 (Dropdown)', category: 'choice', icon: 'ChevronDown' },
      { type: 'multiselect', label: 'Chọn nhiều (Dropdown)', category: 'choice', icon: 'ListFilter' },
      { type: 'radio', label: 'Chọn 1 (Radio)', category: 'choice', icon: 'CircleDot' },
      { type: 'checkbox', label: 'Chọn nhiều (Checkbox)', category: 'choice', icon: 'CheckSquare' },
      { type: 'toggle', label: 'Bật / Tắt (Switch)', category: 'choice', icon: 'ToggleRight' },
      { type: 'file', label: 'Tệp đính kèm (1 tệp)', category: 'file', icon: 'FileUp' },
      { type: 'multifile', label: 'Nhiều tệp đính kèm', category: 'file', icon: 'Files' },
      { type: 'user', label: 'Chọn 1 Người dùng', category: 'user', icon: 'User' },
      { type: 'multiuser', label: 'Chọn nhiều Người dùng', category: 'user', icon: 'Users' },
      { type: 'email', label: 'Email', category: 'format', icon: 'Mail' },
      { type: 'phone', label: 'Số điện thoại', category: 'format', icon: 'Phone' },
      { type: 'url', label: 'Đường dẫn liên kết (URL)', category: 'format', icon: 'Link' },
      { type: 'rating', label: 'Đánh giá sao', category: 'advanced', icon: 'Star' },
      { type: 'slider', label: 'Thanh trượt (Slider)', category: 'advanced', icon: 'Sliders' },
      { type: 'color', label: 'Bảng chọn màu', category: 'advanced', icon: 'Palette' },
      { type: 'formula', label: 'Công thức tính toán tự động', category: 'advanced', icon: 'Calculator' },
    ];
  }

  /**
   * Validate cấu hình field tùy theo loại
   */
  static validateFieldConfig(fieldType: string, config: any = {}): { isValid: boolean; error?: string } {
    if (!SUPPORTED_FIELD_TYPES.includes(fieldType as SupportedFieldType)) {
      return { isValid: false, error: `Loại trường '${fieldType}' không được hỗ trợ` };
    }

    if (['select', 'multiselect', 'radio', 'checkbox'].includes(fieldType)) {
      if (config.options && !Array.isArray(config.options)) {
        return { isValid: false, error: 'Danh sách tùy chọn (options) phải là mảng' };
      }
      if (Array.isArray(config.options)) {
        for (const opt of config.options) {
          if (typeof opt !== 'object' || opt === null || opt.value === undefined || opt.value === '') {
            return { isValid: false, error: 'Mỗi tùy chọn phải có label và value hợp lệ' };
          }
        }
      }
    }

    if (['number', 'slider'].includes(fieldType)) {
      if (config.min !== undefined && config.max !== undefined && Number(config.min) > Number(config.max)) {
        return { isValid: false, error: 'Giá trị tối thiểu (min) không được lớn hơn tối đa (max)' };
      }
    }

    if (fieldType === 'rating') {
      if (config.max_stars !== undefined && (Number(config.max_stars) < 1 || Number(config.max_stars) > 10)) {
        return { isValid: false, error: 'Số sao tối đa phải từ 1 đến 10' };
      }
    }

    if (fieldType === 'formula') {
      if (config.expression && typeof config.expression !== 'string') {
        return { isValid: false, error: 'Biểu thức công thức (expression) phải là chuỗi' };
      }
    }

    if (['file', 'multifile'].includes(fieldType)) {
      if (config.max_size_mb !== undefined && Number(config.max_size_mb) <= 0) {
        return { isValid: false, error: 'Dung lượng tối đa (max_size_mb) phải lớn hơn 0' };
      }
      if (fieldType === 'multifile' && config.max_files !== undefined && Number(config.max_files) < 1) {
        return { isValid: false, error: 'Số lượng file tối đa (max_files) phải từ 1 trở lên' };
      }
    }

    return { isValid: true };
  }

  /**
   * Tạo Custom Field mới cho Process / ProcessStep
   */
  static async createCustomField(data: CreateCustomFieldDto, userId?: string) {
    const {
      processId,
      stepId,
      fieldKey,
      fieldLabel,
      fieldType,
      fieldConfig = {},
      isRequired = false,
      defaultValue = null,
      placeholder = null,
      helpText = null,
      order,
      isVisible = true,
      visibilityCondition = null,
      validationRules = null,
    } = data;

    // Validate key
    const normalizedKey = fieldKey?.trim();
    if (!normalizedKey || !/^[a-zA-Z0-9_]+$/.test(normalizedKey)) {
      throw new Error('Mã trường (fieldKey) chỉ được chứa chữ cái, số và dấu gạch dưới (_)');
    }

    if (!fieldLabel || fieldLabel.trim().length === 0) {
      throw new Error('Tên hiển thị trường (fieldLabel) không được để trống');
    }

    // Validate process
    const process = await prisma.process.findFirst({
      where: { id: processId, deletedAt: null },
    });
    if (!process) {
      throw new Error('Không tìm thấy quy trình');
    }

    // Validate step nếu có
    if (stepId) {
      const step = await prisma.processStep.findFirst({
        where: { id: stepId, processId },
      });
      if (!step) {
        throw new Error('Không tìm thấy bước thực thi tương ứng trong quy trình này');
      }
    }

    // Validate type & config
    const configCheck = this.validateFieldConfig(fieldType, fieldConfig);
    if (!configCheck.isValid) {
      throw new Error(configCheck.error || 'Cấu hình trường không hợp lệ');
    }

    // Check unique (processId, fieldKey)
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { processId, fieldKey: normalizedKey },
    });
    if (existing) {
      throw new Error(`Mã trường '${normalizedKey}' đã tồn tại trong quy trình này`);
    }

    // Calculate order
    let targetOrder = order;
    if (targetOrder === undefined || targetOrder === null) {
      const maxOrderField = await prisma.customFieldDefinition.findFirst({
        where: { processId, stepId: stepId || null },
        orderBy: { order: 'desc' },
      });
      targetOrder = (maxOrderField?.order ?? -1) + 1;
    }

    const field = await prisma.customFieldDefinition.create({
      data: {
        processId,
        stepId: stepId || null,
        fieldKey: normalizedKey,
        fieldLabel: fieldLabel.trim(),
        fieldType,
        fieldConfig: fieldConfig || {},
        isRequired: !!isRequired,
        defaultValue: defaultValue !== undefined && defaultValue !== null ? defaultValue : Prisma.DbNull,
        placeholder: placeholder || null,
        helpText: helpText || null,
        order: targetOrder,
        isVisible: isVisible !== undefined ? isVisible : true,
        visibilityCondition: visibilityCondition ? visibilityCondition : Prisma.DbNull,
        validationRules: validationRules ? validationRules : Prisma.DbNull,
        createdById: userId || null,
        updatedById: userId || null,
      },
      include: {
        step: {
          select: { id: true, name: true, order: true },
        },
      },
    });

    return field;
  }

  /**
   * Lấy danh sách Custom Fields của Process (hỗ trợ lọc theo stepId)
   */
  static async getCustomFieldsByProcess(processId: string, stepId?: string) {
    const where: any = { processId };

    if (stepId !== undefined) {
      if (stepId === 'all') {
        // Lấy tất cả bao gồm global và từng step
      } else if (stepId === 'global' || stepId === 'null') {
        where.stepId = null;
      } else {
        where.OR = [{ stepId }, { stepId: null }];
      }
    }

    return await prisma.customFieldDefinition.findMany({
      where,
      orderBy: [{ stepId: 'asc' }, { order: 'asc' }],
      include: {
        step: {
          select: { id: true, name: true, order: true },
        },
      },
    });
  }

  /**
   * Lấy chi tiết 1 Custom Field
   */
  static async getCustomFieldById(id: string) {
    const field = await prisma.customFieldDefinition.findUnique({
      where: { id },
      include: {
        process: {
          select: { id: true, name: true },
        },
        step: {
          select: { id: true, name: true, order: true },
        },
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return field;
  }

  /**
   * Cập nhật Custom Field
   */
  static async updateCustomField(id: string, data: UpdateCustomFieldDto, userId?: string) {
    const existing = await prisma.customFieldDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Không tìm thấy trường tùy chỉnh');
    }

    // Validate step nếu thay đổi stepId
    if (data.stepId !== undefined && data.stepId !== null) {
      const step = await prisma.processStep.findFirst({
        where: { id: data.stepId, processId: existing.processId },
      });
      if (!step) {
        throw new Error('Không tìm thấy bước thực thi tương ứng trong quy trình');
      }
    }

    // Validate config nếu cập nhật
    if (data.fieldConfig !== undefined) {
      const configCheck = this.validateFieldConfig(existing.fieldType, data.fieldConfig);
      if (!configCheck.isValid) {
        throw new Error(configCheck.error || 'Cấu hình trường không hợp lệ');
      }
    }

    const updated = await prisma.customFieldDefinition.update({
      where: { id },
      data: {
        ...(data.stepId !== undefined && { stepId: data.stepId || null }),
        ...(data.fieldLabel !== undefined && { fieldLabel: data.fieldLabel.trim() }),
        ...(data.fieldConfig !== undefined && { fieldConfig: data.fieldConfig }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.defaultValue !== undefined && {
          defaultValue: data.defaultValue !== null ? data.defaultValue : Prisma.DbNull,
        }),
        ...(data.placeholder !== undefined && { placeholder: data.placeholder }),
        ...(data.helpText !== undefined && { helpText: data.helpText }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
        ...(data.visibilityCondition !== undefined && {
          visibilityCondition: data.visibilityCondition ? data.visibilityCondition : Prisma.DbNull,
        }),
        ...(data.validationRules !== undefined && {
          validationRules: data.validationRules ? data.validationRules : Prisma.DbNull,
        }),
        updatedById: userId || null,
      },
      include: {
        step: {
          select: { id: true, name: true, order: true },
        },
      },
    });

    return updated;
  }

  /**
   * Xóa Custom Field (và dọn dẹp các giá trị đã lưu)
   */
  static async deleteCustomField(id: string) {
    const existing = await prisma.customFieldDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Không tìm thấy trường tùy chỉnh');
    }

    return await prisma.$transaction(async (tx) => {
      // Xóa các giá trị task custom field liên quan
      await tx.taskCustomFieldValue.deleteMany({
        where: { fieldDefinitionId: id },
      });

      return await tx.customFieldDefinition.delete({
        where: { id },
      });
    });
  }

  /**
   * Sắp xếp lại thứ tự (Reorder) các Custom Fields
   */
  static async reorderCustomFields(
    processId: string,
    fieldOrders: Array<{ id: string; order: number }>
  ) {
    if (!Array.isArray(fieldOrders) || fieldOrders.length === 0) {
      throw new Error('Danh sách thứ tự trường không hợp lệ');
    }

    return await prisma.$transaction(
      fieldOrders.map((item) =>
        prisma.customFieldDefinition.update({
          where: { id: item.id, processId },
          data: { order: item.order },
        })
      )
    );
  }

  /**
   * Nhân bản (Duplicate) Custom Field
   */
  static async duplicateCustomField(id: string, userId?: string) {
    const existing = await prisma.customFieldDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Không tìm thấy trường tùy chỉnh');
    }

    // Tìm key mới không trùng
    let newKey = `${existing.fieldKey}_copy`;
    let counter = 1;
    while (
      await prisma.customFieldDefinition.findFirst({
        where: { processId: existing.processId, fieldKey: newKey },
      })
    ) {
      counter++;
      newKey = `${existing.fieldKey}_copy_${counter}`;
    }

    const maxOrderField = await prisma.customFieldDefinition.findFirst({
      where: { processId: existing.processId, stepId: existing.stepId },
      orderBy: { order: 'desc' },
    });

    const newOrder = (maxOrderField?.order ?? existing.order) + 1;

    return await prisma.customFieldDefinition.create({
      data: {
        processId: existing.processId,
        stepId: existing.stepId,
        fieldKey: newKey,
        fieldLabel: `${existing.fieldLabel} (Bản sao)`,
        fieldType: existing.fieldType,
        fieldConfig: (existing.fieldConfig as any) || {},
        isRequired: existing.isRequired,
        defaultValue: (existing.defaultValue as any) || Prisma.DbNull,
        placeholder: existing.placeholder,
        helpText: existing.helpText,
        order: newOrder,
        isVisible: existing.isVisible,
        visibilityCondition: (existing.visibilityCondition as any) || Prisma.DbNull,
        validationRules: (existing.validationRules as any) || Prisma.DbNull,
        createdById: userId || null,
        updatedById: userId || null,
      },
      include: {
        step: {
          select: { id: true, name: true, order: true },
        },
      },
    });
  }
}
