import prisma from '../config/database';
import { ProposalStatus, ProposalPriority, Prisma } from '@prisma/client';
import { ProposalWorkflowService } from './proposalWorkflowService';

export interface CreateProposalDto {
  proposalTypeId: string;
  title: string;
  content?: string;
  formData?: any;
  optionalApprovers?: string[];
  directManagerId?: string;
  priority?: ProposalPriority;
  attachments?: any[];
  tags?: string[];
  isSubmit?: boolean; // Nếu true: gửi duyệt ngay lập tức (DRAFT -> PENDING)
}

export interface UpdateProposalDto {
  title?: string;
  content?: string;
  formData?: any;
  optionalApprovers?: string[];
  directManagerId?: string;
  priority?: ProposalPriority;
  attachments?: any[];
  tags?: string[];
}

export class ProposalService {
  /**
   * Lấy danh sách đề xuất với bộ lọc đa dạng
   */
  static async getProposals(options?: {
    status?: ProposalStatus;
    proposalTypeId?: string;
    priority?: ProposalPriority;
    creatorId?: string;
    approverId?: string;
    approverAction?: string;
    search?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      proposalTypeId,
      priority,
      creatorId,
      approverId,
      approverAction,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = options || {};

    const where: Prisma.ProposalWhereInput = {};

    if (status) where.status = status;
    if (proposalTypeId) where.proposalTypeId = proposalTypeId;
    if (priority) where.priority = priority;
    if (creatorId) where.creatorId = creatorId;

    if (approverId) {
      where.approvals = {
        some: {
          approverId,
          ...(approverAction ? { action: approverAction as any } : {}),
        },
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { content: { contains: search.trim(), mode: 'insensitive' } },
        { creator: { fullName: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        include: {
          proposalType: {
            select: { id: true, name: true, code: true, icon: true, color: true, approvalWorkflow: true },
          },
          creator: {
            select: { id: true, fullName: true, email: true, department: true },
          },
          approvals: {
            select: {
              id: true,
              approverId: true,
              order: true,
              action: true,
              decidedAt: true,
              approver: {
                select: { id: true, fullName: true, email: true },
              },
            },
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    return { proposals, total, page, limit };
  }

  /**
   * Lấy chi tiết đề xuất kèm toàn bộ quan hệ và tính quyền canApprove
   */
  static async getProposalById(id: string, currentUserId?: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalType: {
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
              select: { id: true, name: true },
            },
          },
        },
        creator: {
          select: { id: true, fullName: true, email: true, department: true },
        },
        directManager: {
          select: { id: true, fullName: true, email: true },
        },
        linkedTask: {
          select: { id: true, name: true, status: true, processId: true },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, fullName: true, email: true, department: true },
            },
          },
          orderBy: { order: 'asc' },
        },
        comments: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        histories: {
          include: {
            changedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        followers: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, department: true, role: true },
            },
            addedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!proposal) {
      throw new Error('Không tìm thấy đề xuất');
    }

    // Kiểm tra xem user hiện tại có quyền duyệt hay không
    let approvalPermission: { canApprove: boolean; reason?: string; approvalId?: string; order?: number } = {
      canApprove: false,
    };
    if (currentUserId) {
      approvalPermission = await ProposalWorkflowService.canUserApprove(id, currentUserId);
    }

    const isFollower = currentUserId
      ? proposal.followers.some((f) => f.userId === currentUserId)
      : false;

    return {
      ...proposal,
      isFollower,
      currentUserApproval: approvalPermission,
    };
  }

  /**
   * Tạo đề xuất mới (DRAFT hoặc SUBMITTED ngay)
   */
  static async createProposal(data: CreateProposalDto, userId: string) {
    const {
      proposalTypeId,
      title,
      content,
      formData,
      optionalApprovers,
      directManagerId,
      priority,
      attachments,
      tags,
      isSubmit = false,
    } = data;

    const proposalType = await prisma.proposalType.findFirst({
      where: { id: proposalTypeId, deletedAt: null },
    });

    if (!proposalType) throw new Error('Loại đề xuất không tồn tại');
    if (!proposalType.isActive) throw new Error('Loại đề xuất này hiện đang bị khóa');

    // Kiểm tra quyền tạo của user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Người dùng không tồn tại');

    if (user.role !== 'ADMIN') {
      const creatorIds = (proposalType.creatorIds as string[]) || [];
      const creatorRoles = (proposalType.creatorRoles as string[]) || [];
      const creatorDepts = (proposalType.creatorDepartments as string[]) || [];

      if (creatorIds.length > 0 || creatorRoles.length > 0 || creatorDepts.length > 0) {
        const hasId = creatorIds.includes(userId);
        const hasRole = creatorRoles.includes(user.role);
        const hasDept = user.department ? creatorDepts.includes(user.department) : false;

        if (!hasId && !hasRole && !hasDept) {
          throw new Error('Bạn không có quyền tạo đề xuất loại này');
        }
      }
    }

    // Xác định directManagerId nếu user có cấu hình manager
    const effectiveDirectManagerId = directManagerId || user.managerId || null;

    // Tạo Proposal ở trạng thái DRAFT
    const proposal = await prisma.$transaction(async (tx) => {
      const newProposal = await tx.proposal.create({
        data: {
          proposalTypeId,
          title: title.trim(),
          content: content || null,
          creatorId: userId,
          formData: formData || {},
          defaultApprovers: proposalType.defaultApproverIds as any,
          optionalApprovers: optionalApprovers || [],
          directManagerId: effectiveDirectManagerId,
          status: 'DRAFT',
          priority: priority || 'NORMAL',
          attachments: attachments || [],
          tags: tags || [],
          createdById: userId,
          updatedById: userId,
        },
      });

      // Ghi lịch sử tạo
      await tx.proposalHistory.create({
        data: {
          proposalId: newProposal.id,
          version: 1,
          changedById: userId,
          changeType: 'CREATED',
          changeDescription: 'Đã tạo đề xuất mới (Bản nháp)',
          snapshot: { title: newProposal.title, status: 'DRAFT' },
          createdById: userId,
        },
      });

      return newProposal;
    });

    // Nếu người dùng chọn "Gửi duyệt ngay"
    if (isSubmit) {
      const submitResult = await ProposalWorkflowService.initializeApprovals(proposal.id, userId);
      return submitResult.proposal;
    }

    return proposal;
  }

  /**
   * Cập nhật đề xuất (chỉ DRAFT hoặc khi allowEditAfterSubmit = true)
   */
  static async updateProposal(id: string, data: UpdateProposalDto, userId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { proposalType: true },
    });

    if (!proposal) throw new Error('Không tìm thấy đề xuất');

    if (proposal.creatorId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Bạn không có quyền chỉnh sửa đề xuất này');
      }
    }

    if (proposal.status !== 'DRAFT') {
      if (!proposal.proposalType.allowEditAfterSubmit || !['PENDING', 'IN_REVIEW'].includes(proposal.status)) {
        throw new Error('Đề xuất này hiện không thể chỉnh sửa');
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id },
        data: {
          title: data.title ? data.title.trim() : undefined,
          content: data.content !== undefined ? data.content : undefined,
          formData: data.formData !== undefined ? data.formData : undefined,
          optionalApprovers: data.optionalApprovers !== undefined ? data.optionalApprovers : undefined,
          directManagerId: data.directManagerId !== undefined ? data.directManagerId : undefined,
          priority: data.priority !== undefined ? data.priority : undefined,
          attachments: data.attachments !== undefined ? data.attachments : undefined,
          tags: data.tags !== undefined ? data.tags : undefined,
          updatedById: userId,
        },
        include: {
          proposalType: true,
          creator: true,
        },
      });

      const historyCount = await tx.proposalHistory.count({ where: { proposalId: id } });
      await tx.proposalHistory.create({
        data: {
          proposalId: id,
          version: historyCount + 1,
          changedById: userId,
          changeType: 'UPDATED',
          changeDescription: 'Cập nhật nội dung đề xuất',
          snapshot: { title: updated.title, formData: updated.formData },
          createdById: userId,
        },
      });

      return updated;
    });
  }

  /**
   * Xóa đề xuất (chỉ khi DRAFT hoặc là Admin)
   */
  static async deleteProposal(id: string, userId: string) {
    const proposal = await prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new Error('Không tìm thấy đề xuất');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';

    if (proposal.status !== 'DRAFT' && !isAdmin) {
      throw new Error('Chỉ có thể xóa đề xuất ở trạng thái Nháp');
    }

    if (proposal.creatorId !== userId && !isAdmin) {
      throw new Error('Bạn không có quyền xóa đề xuất này');
    }

    return prisma.proposal.delete({ where: { id } });
  }

  /**
   * Thêm bình luận vào đề xuất
   */
  static async addComment(proposalId: string, userId: string, content: string, attachments?: any[]) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        approvals: { select: { approverId: true } },
      },
    });

    if (!proposal) throw new Error('Không tìm thấy đề xuất');

    return prisma.$transaction(async (tx) => {
      const comment = await tx.proposalComment.create({
        data: {
          proposalId,
          userId,
          content: content.trim(),
          attachments: attachments || [],
          createdById: userId,
          updatedById: userId,
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      // Thông báo bình luận đến người tạo, approvers và người theo dõi (trừ người gửi bình luận)
      const notifyIds = new Set<string>();
      if (proposal.creatorId !== userId) notifyIds.add(proposal.creatorId);
      for (const a of proposal.approvals) {
        if (a.approverId !== userId) notifyIds.add(a.approverId);
      }

      // Lấy danh sách người theo dõi để gửi thông báo
      const followers = await tx.proposalFollower.findMany({
        where: { proposalId },
        select: { userId: true },
      });
      for (const f of followers) {
        if (f.userId !== userId) notifyIds.add(f.userId);
      }

      await Promise.all(
        Array.from(notifyIds).map((recipientId) =>
          tx.proposalNotification.create({
            data: {
              proposalId,
              recipientId,
              type: 'COMMENT',
              title: `Bình luận mới trên đề xuất "${proposal.title}"`,
              content: `${comment.user.fullName}: "${content.length > 60 ? content.substring(0, 60) + '...' : content}"`,
            },
          })
        )
      );

      return comment;
    });
  }

  /**
   * Lấy danh sách người theo dõi đề xuất
   */
  static async getFollowers(proposalId: string) {
    return prisma.proposalFollower.findMany({
      where: { proposalId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, department: true, role: true },
        },
        addedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Bổ sung người theo dõi vào đề xuất (hỗ trợ tại mọi trạng thái của đề xuất)
   */
  static async addFollowers(proposalId: string, userIds: string[], actorId: string) {
    if (!userIds || userIds.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một người để theo dõi');
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, title: true },
    });

    if (!proposal) {
      throw new Error('Không tìm thấy đề xuất');
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, fullName: true, email: true },
    });

    if (!actor) {
      throw new Error('Không tìm thấy người thực hiện');
    }

    // Lọc ra các user chưa có trong danh sách theo dõi
    const existingFollowers = await prisma.proposalFollower.findMany({
      where: { proposalId },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingFollowers.map((f) => f.userId));
    const toAddUserIds = userIds.filter((uid) => !existingUserIds.has(uid));

    if (toAddUserIds.length === 0) {
      return this.getFollowers(proposalId);
    }

    const newUsers = await prisma.user.findMany({
      where: { id: { in: toAddUserIds } },
      select: { id: true, fullName: true, email: true },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Tạo các bản ghi người theo dõi
      await Promise.all(
        toAddUserIds.map((uid) =>
          tx.proposalFollower.create({
            data: {
              proposalId,
              userId: uid,
              addedById: actorId,
            },
          })
        )
      );

      // 2. Gửi thông báo đến những người được thêm (nếu không phải tự thêm chính mình)
      const notifyUsers = newUsers.filter((u) => u.id !== actorId);
      if (notifyUsers.length > 0) {
        await Promise.all(
          notifyUsers.map((u) =>
            tx.proposalNotification.create({
              data: {
                proposalId,
                recipientId: u.id,
                type: 'FOLLOWER_ADDED',
                title: `Bạn được thêm vào theo dõi đề xuất "${proposal.title}"`,
                content: `${actor.fullName} đã thêm bạn vào danh sách người theo dõi. Bạn có thể xem thông tin chi tiết và tham gia thảo luận trong đề xuất.`,
              },
            })
          )
        );
      }

      // 3. Ghi lại lịch sử đề xuất
      const addedNames = newUsers.map((u) => u.fullName).join(', ');
      await tx.proposalHistory.create({
        data: {
          proposalId,
          changedById: actorId,
          changeType: 'FOLLOWER_ADDED',
          changeDescription:
            toAddUserIds.length === 1 && toAddUserIds[0] === actorId
              ? `${actor.fullName} đã tự theo dõi đề xuất`
              : `${actor.fullName} đã thêm người theo dõi: ${addedNames}`,
          snapshot: { addedUserIds: toAddUserIds, addedNames },
          createdById: actorId,
        },
      });
    });

    return this.getFollowers(proposalId);
  }

  /**
   * Gỡ người theo dõi khỏi đề xuất
   */
  static async removeFollower(
    proposalId: string,
    targetUserId: string,
    actorId: string,
    actorRole?: string
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, title: true, creatorId: true },
    });

    if (!proposal) {
      throw new Error('Không tìm thấy đề xuất');
    }

    const follower = await prisma.proposalFollower.findUnique({
      where: {
        proposalId_userId: {
          proposalId,
          userId: targetUserId,
        },
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    if (!follower) {
      throw new Error('Người dùng này không có trong danh sách theo dõi');
    }

    // Kiểm tra quyền gỡ:
    // - Chính người đó tự bỏ theo dõi
    // - Người tạo đề xuất
    // - Người đã trực tiếp thêm follower này
    // - ADMIN / MANAGER
    const isSelf = targetUserId === actorId;
    const isCreator = proposal.creatorId === actorId;
    const isAddedByActor = follower.addedById === actorId;
    const isAdminOrManager = actorRole === 'ADMIN' || actorRole === 'MANAGER';

    if (!isSelf && !isCreator && !isAddedByActor && !isAdminOrManager) {
      throw new Error('Bạn không có quyền xóa người theo dõi này khỏi đề xuất');
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, fullName: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.proposalFollower.delete({
        where: {
          proposalId_userId: {
            proposalId,
            userId: targetUserId,
          },
        },
      });

      // Ghi lịch sử thay đổi
      await tx.proposalHistory.create({
        data: {
          proposalId,
          changedById: actorId,
          changeType: 'FOLLOWER_REMOVED',
          changeDescription: isSelf
            ? `${actor?.fullName || 'Người dùng'} đã bỏ theo dõi đề xuất`
            : `${actor?.fullName || 'Người dùng'} đã gỡ ${follower.user.fullName} khỏi danh sách theo dõi`,
          snapshot: { removedUserId: targetUserId, removedName: follower.user.fullName },
          createdById: actorId,
        },
      });
    });

    return { success: true, message: 'Đã xóa người theo dõi thành công' };
  }

  /**
   * Lấy danh sách bình luận
   */
  static async getComments(proposalId: string) {
    return prisma.proposalComment.findMany({
      where: { proposalId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Lấy lịch sử đề xuất
   */
  static async getHistory(proposalId: string) {
    return prisma.proposalHistory.findMany({
      where: { proposalId },
      include: {
        changedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
