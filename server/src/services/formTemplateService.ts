import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export interface CreateFormFieldDto {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldConfig?: any;
  isRequired?: boolean;
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  order?: number;
  isVisible?: boolean;
  visibilityCondition?: any;
  validationRules?: any;
  sectionId?: string;
}

export interface CreateFormTemplateDto {
  name: string;
  description?: string;
  proposalTypeId?: string;
  isDefault?: boolean;
  formStructure?: any;
  fields?: CreateFormFieldDto[];
}

export interface UpdateFormTemplateDto {
  name?: string;
  description?: string;
  proposalTypeId?: string;
  isDefault?: boolean;
  formStructure?: any;
}

export class FormTemplateService {
  /**
   * Lấy danh sách form templates
   */
  static async getFormTemplates(options?: {
    search?: string;
    proposalTypeId?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, proposalTypeId, page = 1, limit = 50 } = options || {};

    const where: Prisma.FormTemplateWhereInput = {};

    if (proposalTypeId) {
      where.proposalTypeId = proposalTypeId;
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.formTemplate.findMany({
        where,
        include: {
          _count: {
            select: { fields: true, selectedByProposalTypes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.formTemplate.count({ where }),
    ]);

    return { templates, total, page, limit };
  }

  /**
   * Lấy chi tiết form template kèm tất cả các fields
   */
  static async getFormTemplateById(id: string) {
    const template = await prisma.formTemplate.findUnique({
      where: { id },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
        selectedByProposalTypes: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!template) {
      throw new Error('Không tìm thấy form mẫu');
    }

    return template;
  }

  /**
   * Tạo form template mới kèm các fields khởi tạo
   */
  static async createFormTemplate(data: CreateFormTemplateDto, userId: string) {
    const { name, description, proposalTypeId, isDefault, formStructure, fields = [] } = data;

    return prisma.$transaction(async (tx) => {
      const template = await tx.formTemplate.create({
        data: {
          name: name.trim(),
          description: description || null,
          proposalTypeId: proposalTypeId || null,
          isDefault: isDefault ?? false,
          formStructure: formStructure || {},
          createdById: userId,
          updatedById: userId,
        },
      });

      if (fields.length > 0) {
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          await tx.formFieldDefinition.create({
            data: {
              formTemplateId: template.id,
              fieldKey: f.fieldKey.trim(),
              fieldLabel: f.fieldLabel.trim(),
              fieldType: f.fieldType || 'text',
              fieldConfig: f.fieldConfig || {},
              isRequired: f.isRequired ?? false,
              defaultValue: f.defaultValue || null,
              placeholder: f.placeholder || null,
              helpText: f.helpText || null,
              order: f.order !== undefined ? f.order : i + 1,
              isVisible: f.isVisible ?? true,
              visibilityCondition: f.visibilityCondition || null,
              validationRules: f.validationRules || null,
              sectionId: f.sectionId || null,
              createdById: userId,
              updatedById: userId,
            },
          });
        }
      }

      return tx.formTemplate.findUnique({
        where: { id: template.id },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
    });
  }

  /**
   * Cập nhật thông tin form template
   */
  static async updateFormTemplate(id: string, data: UpdateFormTemplateDto, userId: string) {
    const template = await prisma.formTemplate.findUnique({ where: { id } });
    if (!template) throw new Error('Không tìm thấy form mẫu');

    return prisma.formTemplate.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        description: data.description !== undefined ? data.description : undefined,
        proposalTypeId: data.proposalTypeId !== undefined ? data.proposalTypeId : undefined,
        isDefault: data.isDefault !== undefined ? data.isDefault : undefined,
        formStructure: data.formStructure !== undefined ? data.formStructure : undefined,
        updatedById: userId,
      },
      include: {
        fields: { orderBy: { order: 'asc' } },
      },
    });
  }

  /**
   * Xóa form template (cascade fields)
   */
  static async deleteFormTemplate(id: string) {
    const template = await prisma.formTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { selectedByProposalTypes: true } },
      },
    });

    if (!template) throw new Error('Không tìm thấy form mẫu');
    if (template._count.selectedByProposalTypes > 0) {
      throw new Error('Form mẫu này đang được liên kết với loại đề xuất, không thể xóa');
    }

    return prisma.formTemplate.delete({ where: { id } });
  }

  /**
   * Nhân bản form template kèm toàn bộ fields
   */
  static async duplicateFormTemplate(id: string, newName: string, userId: string) {
    const original = await prisma.formTemplate.findUnique({
      where: { id },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    if (!original) throw new Error('Không tìm thấy form mẫu gốc');

    return prisma.$transaction(async (tx) => {
      const duplicated = await tx.formTemplate.create({
        data: {
          name: newName || `${original.name} (Bản sao)`,
          description: original.description,
          proposalTypeId: null,
          isDefault: false,
          formStructure: original.formStructure as any,
          createdById: userId,
          updatedById: userId,
        },
      });

      for (const field of original.fields) {
        await tx.formFieldDefinition.create({
          data: {
            formTemplateId: duplicated.id,
            fieldKey: field.fieldKey,
            fieldLabel: field.fieldLabel,
            fieldType: field.fieldType,
            fieldConfig: field.fieldConfig as any,
            isRequired: field.isRequired,
            defaultValue: field.defaultValue as any,
            placeholder: field.placeholder,
            helpText: field.helpText,
            order: field.order,
            isVisible: field.isVisible,
            visibilityCondition: field.visibilityCondition as any,
            validationRules: field.validationRules as any,
            sectionId: field.sectionId,
            createdById: userId,
            updatedById: userId,
          },
        });
      }

      return tx.formTemplate.findUnique({
        where: { id: duplicated.id },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
    });
  }

  /**
   * Thêm trường mới vào form template
   */
  static async addField(templateId: string, data: CreateFormFieldDto, userId: string) {
    const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Không tìm thấy form mẫu');

    const existingKey = await prisma.formFieldDefinition.findUnique({
      where: {
        formTemplateId_fieldKey: {
          formTemplateId: templateId,
          fieldKey: data.fieldKey.trim(),
        },
      },
    });
    if (existingKey) {
      throw new Error(`Mã trường "${data.fieldKey}" đã tồn tại trong form mẫu này`);
    }

    const fieldCount = await prisma.formFieldDefinition.count({
      where: { formTemplateId: templateId },
    });

    return prisma.formFieldDefinition.create({
      data: {
        formTemplateId: templateId,
        fieldKey: data.fieldKey.trim(),
        fieldLabel: data.fieldLabel.trim(),
        fieldType: data.fieldType || 'text',
        fieldConfig: data.fieldConfig || {},
        isRequired: data.isRequired ?? false,
        defaultValue: data.defaultValue || null,
        placeholder: data.placeholder || null,
        helpText: data.helpText || null,
        order: data.order !== undefined ? data.order : fieldCount + 1,
        isVisible: data.isVisible ?? true,
        visibilityCondition: data.visibilityCondition || null,
        validationRules: data.validationRules || null,
        sectionId: data.sectionId || null,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  /**
   * Cập nhật trường trong form template
   */
  static async updateField(fieldId: string, data: Partial<CreateFormFieldDto>, userId: string) {
    const field = await prisma.formFieldDefinition.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Không tìm thấy trường dữ liệu');

    // Nếu thay đổi fieldKey, kiểm tra trùng trong cùng form template
    if (data.fieldKey && data.fieldKey.trim() !== field.fieldKey) {
      const existing = await prisma.formFieldDefinition.findUnique({
        where: {
          formTemplateId_fieldKey: {
            formTemplateId: field.formTemplateId,
            fieldKey: data.fieldKey.trim(),
          },
        },
      });
      if (existing) {
        throw new Error(`Mã trường "${data.fieldKey}" đã tồn tại trong form này`);
      }
    }

    return prisma.formFieldDefinition.update({
      where: { id: fieldId },
      data: {
        fieldKey: data.fieldKey ? data.fieldKey.trim() : undefined,
        fieldLabel: data.fieldLabel ? data.fieldLabel.trim() : undefined,
        fieldType: data.fieldType || undefined,
        fieldConfig: data.fieldConfig !== undefined ? data.fieldConfig : undefined,
        isRequired: data.isRequired !== undefined ? data.isRequired : undefined,
        defaultValue: data.defaultValue !== undefined ? data.defaultValue : undefined,
        placeholder: data.placeholder !== undefined ? data.placeholder : undefined,
        helpText: data.helpText !== undefined ? data.helpText : undefined,
        order: data.order !== undefined ? data.order : undefined,
        isVisible: data.isVisible !== undefined ? data.isVisible : undefined,
        visibilityCondition: data.visibilityCondition !== undefined ? data.visibilityCondition : undefined,
        validationRules: data.validationRules !== undefined ? data.validationRules : undefined,
        sectionId: data.sectionId !== undefined ? data.sectionId : undefined,
        updatedById: userId,
      },
    });
  }

  /**
   * Xóa trường
   */
  static async deleteField(fieldId: string) {
    const field = await prisma.formFieldDefinition.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Không tìm thấy trường dữ liệu');
    return prisma.formFieldDefinition.delete({ where: { id: fieldId } });
  }

  /**
   * Sắp xếp lại thứ tự các trường
   */
  static async reorderFields(templateId: string, fieldOrders: { id: string; order: number }[]) {
    return prisma.$transaction(
      fieldOrders.map(({ id, order }) =>
        prisma.formFieldDefinition.update({
          where: { id, formTemplateId: templateId },
          data: { order },
        })
      )
    );
  }
}
