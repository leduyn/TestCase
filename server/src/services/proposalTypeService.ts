import prisma from '../config/database';
import { ApprovalWorkflowType, Prisma } from '@prisma/client';

export interface CreateProposalTypeDto {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  defaultApproverIds?: string[];
  isOptionalApprover?: boolean;
  optionalApproverConfig?: any;
  approvalWorkflow?: ApprovalWorkflowType;
  deadlineHours?: number;
  creatorIds?: string[];
  creatorRoles?: string[];
  creatorDepartments?: string[];
  useCustomForm?: boolean;
  formTemplateId?: string;
  linkedProcessId?: string;
  autoStartWorkflow?: boolean;
  isActive?: boolean;
  allowDraft?: boolean;
  allowCancel?: boolean;
  allowEditAfterSubmit?: boolean;
}

export interface UpdateProposalTypeDto extends Partial<CreateProposalTypeDto> {}

export class ProposalTypeService {
  /**
   * Lấy danh sách Proposal Types có phân trang, tìm kiếm và lọc phân quyền người dùng
   */
  static async getProposalTypes(options?: {
    search?: string;
    isActive?: boolean;
    forUser?: { id: string; role: string; department?: string | null };
    page?: number;
    limit?: number;
  }) {
    const { search, isActive, forUser, page = 1, limit = 50 } = options || {};

    const where: Prisma.ProposalTypeWhereInput = {
      deletedAt: null,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [types, total] = await Promise.all([
      prisma.proposalType.findMany({
        where,
        include: {
          formTemplate: {
            select: { id: true, name: true, isDefault: true },
          },
          linkedProcess: {
            select: { id: true, name: true },
          },
          _count: {
            select: { proposals: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposalType.count({ where }),
    ]);

    // Nếu lọc theo quyền người tạo (cho dropdown chọn loại khi tạo đề xuất)
    let filteredTypes = types;
    if (forUser && forUser.role !== 'ADMIN') {
      filteredTypes = types.filter((t) => {
        const creatorIds = (t.creatorIds as string[]) || [];
        const creatorRoles = (t.creatorRoles as string[]) || [];
        const creatorDepts = (t.creatorDepartments as string[]) || [];

        // Nếu tất cả cấu hình trống => mở cho tất cả mọi người
        if (creatorIds.length === 0 && creatorRoles.length === 0 && creatorDepts.length === 0) {
          return true;
        }

        // Kiểm tra user ID
        if (creatorIds.length > 0 && creatorIds.includes(forUser.id)) {
          return true;
        }

        // Kiểm tra role
        if (creatorRoles.length > 0 && creatorRoles.includes(forUser.role)) {
          return true;
        }

        // Kiểm tra department
        if (
          forUser.department &&
          creatorDepts.length > 0 &&
          creatorDepts.includes(forUser.department)
        ) {
          return true;
        }

        return false;
      });
    }

    return {
      types: filteredTypes,
      total: forUser && forUser.role !== 'ADMIN' ? filteredTypes.length : total,
      page,
      limit,
    };
  }

  /**
   * Lấy chi tiết Proposal Type theo ID kèm form template và cấu hình liên kết
   */
  static async getProposalTypeById(id: string) {
    const proposalType = await prisma.proposalType.findFirst({
      where: { id, deletedAt: null },
      include: {
        formTemplate: {
          include: {
            fields: {
              where: { isVisible: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        linkedProcess: {
          select: {
            id: true,
            name: true,
            steps: { orderBy: { order: 'asc' } },
            customFields: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!proposalType) {
      throw new Error('Không tìm thấy loại đề xuất');
    }

    return proposalType;
  }

  /**
   * Tạo mới Proposal Type
   */
  static async createProposalType(data: CreateProposalTypeDto, userId: string) {
    const existing = await prisma.proposalType.findFirst({
      where: { code: data.code.trim().toUpperCase(), deletedAt: null },
    });

    if (existing) {
      throw new Error(`Mã loại đề xuất "${data.code}" đã tồn tại`);
    }

    // Xác thực form template nếu có
    if (data.formTemplateId) {
      const template = await prisma.formTemplate.findUnique({
        where: { id: data.formTemplateId },
      });
      if (!template) {
        throw new Error('Form template không tồn tại');
      }
    }

    // Xác thực process liên kết nếu có
    if (data.linkedProcessId) {
      const process = await prisma.process.findFirst({
        where: { id: data.linkedProcessId, deletedAt: null },
      });
      if (!process) {
        throw new Error('Quy trình liên kết không tồn tại');
      }
    }

    return prisma.proposalType.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        description: data.description || null,
        icon: data.icon || null,
        color: data.color || null,
        defaultApproverIds: data.defaultApproverIds || [],
        isOptionalApprover: data.isOptionalApprover ?? false,
        optionalApproverConfig: data.optionalApproverConfig || null,
        approvalWorkflow: data.approvalWorkflow || 'PARALLEL',
        deadlineHours: data.deadlineHours ?? 0,
        creatorIds: data.creatorIds || [],
        creatorRoles: data.creatorRoles || [],
        creatorDepartments: data.creatorDepartments || [],
        useCustomForm: data.useCustomForm ?? false,
        formTemplateId: data.formTemplateId || null,
        linkedProcessId: data.linkedProcessId || null,
        autoStartWorkflow: data.autoStartWorkflow ?? false,
        isActive: data.isActive ?? true,
        allowDraft: data.allowDraft ?? true,
        allowCancel: data.allowCancel ?? true,
        allowEditAfterSubmit: data.allowEditAfterSubmit ?? false,
        createdById: userId,
        updatedById: userId,
      },
      include: {
        formTemplate: true,
        linkedProcess: true,
      },
    });
  }

  /**
   * Cập nhật Proposal Type
   */
  static async updateProposalType(id: string, data: UpdateProposalTypeDto, userId: string) {
    const current = await prisma.proposalType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!current) {
      throw new Error('Không tìm thấy loại đề xuất');
    }

    // Nếu thay đổi code, kiểm tra trùng
    if (data.code && data.code.trim().toUpperCase() !== current.code) {
      const existing = await prisma.proposalType.findFirst({
        where: {
          code: data.code.trim().toUpperCase(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (existing) {
        throw new Error(`Mã loại đề xuất "${data.code}" đã được sử dụng`);
      }
    }

    return prisma.proposalType.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        code: data.code ? data.code.trim().toUpperCase() : undefined,
        description: data.description !== undefined ? data.description : undefined,
        icon: data.icon !== undefined ? data.icon : undefined,
        color: data.color !== undefined ? data.color : undefined,
        defaultApproverIds: data.defaultApproverIds !== undefined ? data.defaultApproverIds : undefined,
        isOptionalApprover: data.isOptionalApprover !== undefined ? data.isOptionalApprover : undefined,
        optionalApproverConfig: data.optionalApproverConfig !== undefined ? data.optionalApproverConfig : undefined,
        approvalWorkflow: data.approvalWorkflow !== undefined ? data.approvalWorkflow : undefined,
        deadlineHours: data.deadlineHours !== undefined ? data.deadlineHours : undefined,
        creatorIds: data.creatorIds !== undefined ? data.creatorIds : undefined,
        creatorRoles: data.creatorRoles !== undefined ? data.creatorRoles : undefined,
        creatorDepartments: data.creatorDepartments !== undefined ? data.creatorDepartments : undefined,
        useCustomForm: data.useCustomForm !== undefined ? data.useCustomForm : undefined,
        formTemplateId: data.formTemplateId !== undefined ? data.formTemplateId : undefined,
        linkedProcessId: data.linkedProcessId !== undefined ? data.linkedProcessId : undefined,
        autoStartWorkflow: data.autoStartWorkflow !== undefined ? data.autoStartWorkflow : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        allowDraft: data.allowDraft !== undefined ? data.allowDraft : undefined,
        allowCancel: data.allowCancel !== undefined ? data.allowCancel : undefined,
        allowEditAfterSubmit: data.allowEditAfterSubmit !== undefined ? data.allowEditAfterSubmit : undefined,
        updatedById: userId,
      },
      include: {
        formTemplate: true,
        linkedProcess: true,
      },
    });
  }

  /**
   * Bật / tắt trạng thái isActive
   */
  static async toggleActive(id: string, userId: string) {
    const current = await prisma.proposalType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!current) {
      throw new Error('Không tìm thấy loại đề xuất');
    }

    return prisma.proposalType.update({
      where: { id },
      data: {
        isActive: !current.isActive,
        updatedById: userId,
      },
    });
  }

  /**
   * Soft delete Proposal Type
   */
  static async deleteProposalType(id: string, userId: string) {
    const current = await prisma.proposalType.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { proposals: true } },
      },
    });

    if (!current) {
      throw new Error('Không tìm thấy loại đề xuất');
    }

    return prisma.proposalType.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: userId,
      },
    });
  }
}
