import prisma from '../config/database';
import {
  ProposalStatus,
  ApprovalAction,
  ApprovalWorkflowType,
  ProposalHistoryType,
  ProposalNotificationType,
  TaskStatus,
  TaskHistoryChangeType,
} from '@prisma/client';

/**
 * ProposalWorkflowService - Core engine xử lý quy trình phê duyệt đề xuất.
 * Hỗ trợ 3 chế độ: PARALLEL, SEQUENTIAL, ANY_ONE.
 */
export class ProposalWorkflowService {
  /**
   * Khởi tạo danh sách phê duyệt khi đề xuất được gửi (DRAFT -> PENDING).
   * Tập hợp approvers từ:
   * 1. defaultApproverIds (người duyệt mặc định từ ProposalType)
   * 2. optionalApprovers (người duyệt bổ sung do người tạo chọn)
   * 3. directManagerId (quản lý trực tiếp nếu được cấu hình)
   */
  static async initializeApprovals(proposalId: string, userId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        proposalType: true,
      },
    });

    if (!proposal) throw new Error('Không tìm thấy đề xuất');
    if (proposal.status !== 'DRAFT' && proposal.status !== 'PENDING') {
      throw new Error('Đề xuất không ở trạng thái có thể gửi duyệt');
    }

    const proposalType = proposal.proposalType;
    const workflowType = proposalType.approvalWorkflow;

    // Tập hợp tất cả approver IDs
    const defaultIds = (proposalType.defaultApproverIds as string[]) || [];
    const optionalIds = (proposal.optionalApprovers as string[]) || [];
    const allApproverIds = [...new Set([...defaultIds, ...optionalIds])];

    // Thêm direct manager nếu có
    if (proposal.directManagerId && !allApproverIds.includes(proposal.directManagerId)) {
      allApproverIds.unshift(proposal.directManagerId);
    }

    if (allApproverIds.length === 0) {
      throw new Error('Không có người duyệt nào được cấu hình cho loại đề xuất này');
    }

    // Tạo bản ghi trong transaction
    const result = await prisma.$transaction(async (tx) => {
      // Xóa approvals cũ nếu có (trường hợp resubmit)
      await tx.proposalApproval.deleteMany({
        where: { proposalId },
      });

      // Tạo ProposalApproval cho mỗi approver
      const approvals = await Promise.all(
        allApproverIds.map((approverId, index) =>
          tx.proposalApproval.create({
            data: {
              proposalId,
              approverId,
              order: index + 1,
              action: workflowType === 'SEQUENTIAL' && index > 0 ? 'PENDING' : 'PENDING',
              createdById: userId,
            },
          })
        )
      );

      // Cập nhật snapshot approvalList trên Proposal
      const approvalList = approvals.map((a) => ({
        id: a.id,
        approverId: a.approverId,
        order: a.order,
        action: a.action,
      }));

      // Tính deadline nếu ProposalType có cấu hình
      let deadline: Date | undefined;
      if (proposalType.deadlineHours > 0) {
        deadline = new Date();
        deadline.setHours(deadline.getHours() + proposalType.deadlineHours);
      }

      // Cập nhật trạng thái Proposal
      const updatedProposal = await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: 'PENDING',
          approvalList: approvalList as any,
          defaultApprovers: defaultIds as any,
          submittedAt: new Date(),
          deadline: deadline || proposal.deadline,
          updatedById: userId,
        },
      });

      // Ghi lịch sử
      await tx.proposalHistory.create({
        data: {
          proposalId,
          version: 1,
          changedById: userId,
          changeType: 'SUBMITTED',
          changeDescription: 'Đề xuất đã được gửi duyệt',
          snapshot: { approvalList, status: 'PENDING' },
          createdById: userId,
        },
      });

      // Gửi thông báo cho approvers
      const notifyApproverIds =
        workflowType === 'SEQUENTIAL'
          ? [allApproverIds[0]] // Chỉ notify người đầu tiên
          : allApproverIds; // PARALLEL & ANY_ONE: notify tất cả

      await Promise.all(
        notifyApproverIds.map((approverId) =>
          tx.proposalNotification.create({
            data: {
              proposalId,
              recipientId: approverId,
              type: 'SUBMITTED',
              title: `Đề xuất mới cần phê duyệt: ${updatedProposal.title}`,
              content: `Bạn có một đề xuất mới cần phê duyệt từ hệ thống.`,
            },
          })
        )
      );

      return { proposal: updatedProposal, approvals };
    });

    return result;
  }

  /**
   * Xử lý quyết định phê duyệt/từ chối từ một approver.
   */
  static async processDecision(
    proposalId: string,
    approverId: string,
    action: 'APPROVED' | 'REJECTED',
    comment?: string,
    attachments?: any[],
    userId?: string
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        proposalType: true,
        approvals: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!proposal) throw new Error('Không tìm thấy đề xuất');
    if (proposal.status !== 'PENDING' && proposal.status !== 'IN_REVIEW') {
      throw new Error('Đề xuất không ở trạng thái đang chờ duyệt');
    }

    const approval = proposal.approvals.find(
      (a) => a.approverId === approverId && a.action === 'PENDING'
    );
    if (!approval) {
      throw new Error('Bạn không có quyền phê duyệt đề xuất này hoặc đã xử lý');
    }

    const workflowType = proposal.proposalType.approvalWorkflow;

    // Kiểm tra thứ tự phê duyệt đối với luồng SEQUENTIAL
    if (workflowType === 'SEQUENTIAL') {
      const priorUnapproved = proposal.approvals.find(
        (a) => a.order < approval.order && a.action !== 'APPROVED'
      );
      if (priorUnapproved) {
        throw new Error('Chưa đến lượt bạn phê duyệt đề xuất này');
      }
    }

    // Bắt buộc nhập nhận xét/lý do nếu từ chối
    if (action === 'REJECTED' && (!comment || !comment.trim())) {
      throw new Error('Vui lòng nhập lý do từ chối đề xuất');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Cập nhật quyết định của approver
      await tx.proposalApproval.update({
        where: { id: approval.id },
        data: {
          action,
          comment,
          attachments: attachments || [],
          decidedAt: new Date(),
        },
      });

      // Tính toán trạng thái đề xuất theo workflow type
      let newStatus: ProposalStatus = proposal.status;
      let shouldNotifyNext = false;
      let nextApproverId: string | null = null;

      switch (workflowType) {
        case 'PARALLEL':
          newStatus = await this.processParallel(tx, proposal, action);
          break;
        case 'SEQUENTIAL':
          const seqResult = await this.processSequential(tx, proposal, approval, action);
          newStatus = seqResult.status;
          shouldNotifyNext = seqResult.shouldNotifyNext;
          nextApproverId = seqResult.nextApproverId;
          break;
        case 'ANY_ONE':
          newStatus = await this.processAnyOne(tx, proposal, action);
          break;
      }

      // Cập nhật trạng thái Proposal
      const updateData: any = {
        status: newStatus,
        updatedById: userId || approverId,
      };

      if (newStatus === 'APPROVED') {
        updateData.approvedAt = new Date();
      } else if (newStatus === 'REJECTED') {
        updateData.rejectedAt = new Date();
      }

      // Cập nhật approvalList snapshot
      const updatedApprovals = await tx.proposalApproval.findMany({
        where: { proposalId },
        orderBy: { order: 'asc' },
      });
      updateData.approvalList = updatedApprovals.map((a) => ({
        id: a.id,
        approverId: a.approverId,
        order: a.order,
        action: a.action,
      }));

      const updatedProposal = await tx.proposal.update({
        where: { id: proposalId },
        data: updateData,
      });

      // Ghi lịch sử
      const historyCount = await tx.proposalHistory.count({ where: { proposalId } });
      await tx.proposalHistory.create({
        data: {
          proposalId,
          version: historyCount + 1,
          changedById: approverId,
          changeType: action === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          changeDescription: `${action === 'APPROVED' ? 'Đã phê duyệt' : 'Đã từ chối'}${comment ? `: ${comment}` : ''}`,
          snapshot: { action, comment, approverOrder: approval.order },
          createdById: approverId,
        },
      });

      // Thông báo cho người tạo nếu đề xuất kết thúc
      if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
        await tx.proposalNotification.create({
          data: {
            proposalId,
            recipientId: proposal.creatorId,
            type: newStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED',
            title: `Đề xuất "${proposal.title}" đã ${newStatus === 'APPROVED' ? 'được phê duyệt' : 'bị từ chối'}`,
            content: comment || `Đề xuất của bạn đã ${newStatus === 'APPROVED' ? 'được phê duyệt' : 'bị từ chối'}.`,
          },
        });
      }

      // Thông báo cho approver tiếp theo (SEQUENTIAL)
      if (shouldNotifyNext && nextApproverId) {
        await tx.proposalNotification.create({
          data: {
            proposalId,
            recipientId: nextApproverId,
            type: 'SUBMITTED',
            title: `Đề xuất cần phê duyệt: ${proposal.title}`,
            content: `Bạn có đề xuất mới cần phê duyệt (lượt duyệt tiếp theo).`,
          },
        });
      }

      // Tự động kích hoạt Workflow nếu APPROVED + autoStartWorkflow
      if (newStatus === 'APPROVED' && proposal.proposalType.autoStartWorkflow) {
        await this.triggerLinkedWorkflow(tx, updatedProposal, approverId);
      }

      return updatedProposal;
    });

    return result;
  }

  /**
   * PARALLEL: Tất cả phải đồng ý. Nếu 1 từ chối -> REJECTED ngay.
   */
  private static async processParallel(
    tx: any,
    proposal: any,
    currentAction: 'APPROVED' | 'REJECTED'
  ): Promise<ProposalStatus> {
    if (currentAction === 'REJECTED') {
      // Hủy tất cả pending approvals
      await tx.proposalApproval.updateMany({
        where: {
          proposalId: proposal.id,
          action: 'PENDING',
        },
        data: { action: 'CANCELLED' },
      });
      return 'REJECTED';
    }

    // Kiểm tra tất cả đã APPROVED chưa (tất cả các approver đều phải đạt APPROVED)
    const notApprovedCount = await tx.proposalApproval.count({
      where: {
        proposalId: proposal.id,
        action: { not: 'APPROVED' },
      },
    });

    if (notApprovedCount > 0) {
      return 'IN_REVIEW';
    }

    return 'APPROVED';
  }

  /**
   * SEQUENTIAL: Duyệt tuần tự. Nếu từ chối -> REJECTED ngay. Nếu APPROVED -> chuyển cho người tiếp theo.
   */
  private static async processSequential(
    tx: any,
    proposal: any,
    currentApproval: any,
    currentAction: 'APPROVED' | 'REJECTED'
  ): Promise<{ status: ProposalStatus; shouldNotifyNext: boolean; nextApproverId: string | null }> {
    if (currentAction === 'REJECTED') {
      // Hủy tất cả pending approvals
      await tx.proposalApproval.updateMany({
        where: {
          proposalId: proposal.id,
          action: 'PENDING',
        },
        data: { action: 'CANCELLED' },
      });
      return { status: 'REJECTED', shouldNotifyNext: false, nextApproverId: null };
    }

    // Tìm approver tiếp theo (order lớn hơn order hiện tại)
    const nextApproval = await tx.proposalApproval.findFirst({
      where: {
        proposalId: proposal.id,
        order: { gt: currentApproval.order },
        action: 'PENDING',
      },
      orderBy: { order: 'asc' },
    });

    if (nextApproval) {
      // Còn người tiếp theo -> IN_REVIEW
      return {
        status: 'IN_REVIEW',
        shouldNotifyNext: true,
        nextApproverId: nextApproval.approverId,
      };
    }

    // Không còn ai -> APPROVED
    return { status: 'APPROVED', shouldNotifyNext: false, nextApproverId: null };
  }

  /**
   * ANY_ONE: Chỉ cần 1 người APPROVED hoặc REJECTED -> kết thúc.
   */
  private static async processAnyOne(
    tx: any,
    proposal: any,
    currentAction: 'APPROVED' | 'REJECTED'
  ): Promise<ProposalStatus> {
    // Hủy tất cả pending approvals còn lại
    await tx.proposalApproval.updateMany({
      where: {
        proposalId: proposal.id,
        action: 'PENDING',
      },
      data: { action: 'SKIPPED' },
    });

    return currentAction === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  }

  /**
   * Kích hoạt Workflow liên kết: Tạo Task mới trong Process khi đề xuất được APPROVED.
   * Ánh xạ formData sang customFields của Task và tạo các bản ghi TaskCustomFieldValue, TaskHistory.
   */
  private static async triggerLinkedWorkflow(tx: any, proposal: any, userId: string) {
    const proposalType = await tx.proposalType.findUnique({
      where: { id: proposal.proposalTypeId },
    });

    if (!proposalType?.linkedProcessId) return;

    const process = await tx.process.findFirst({
      where: { id: proposalType.linkedProcessId, deletedAt: null },
      include: {
        steps: { orderBy: { order: 'asc' } },
        customFields: true,
      },
    });

    if (!process || !process.steps || process.steps.length === 0) return;

    // Ánh xạ formData sang customFields
    const formData = (proposal.formData as Record<string, any>) || {};
    const mappedCustomFields: Record<string, any> = {};

    for (const field of process.customFields) {
      if (formData[field.fieldKey] !== undefined) {
        mappedCustomFields[field.fieldKey] = formData[field.fieldKey];
      }
    }

    try {
      // Tạo Task trong Process liên kết
      const firstStep = process.steps[0];
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + (firstStep?.timeLimitHours || 24));

      const task = await tx.task.create({
        data: {
          processId: process.id,
          name: `[Đề xuất] ${proposal.title}`,
          content: proposal.content || `Nhiệm vụ sinh từ đề xuất: ${proposal.title}`,
          customFields: mappedCustomFields,
          currentStepId: firstStep.id,
          executorIds: (firstStep.executorIds as string[]) || [],
          watcherIds: [proposal.creatorId],
          startedAt: new Date(),
          deadline,
          status: TaskStatus.IN_PROGRESS,
          fileUploads: (proposal.attachments as any[]) || [],
          createdById: userId,
          updatedById: userId,
        },
      });

      // Tạo các bản ghi TaskCustomFieldValue
      for (const def of process.customFields) {
        const val = mappedCustomFields[def.fieldKey];
        if (val !== undefined && val !== null) {
          await tx.taskCustomFieldValue.create({
            data: {
              taskId: task.id,
              fieldDefinitionId: def.id,
              value: val,
              stepId: def.stepId || firstStep.id,
              filledById: userId,
              filledAt: new Date(),
              updatedById: userId,
            },
          });
        }
      }

      // Tạo TaskHistory
      await tx.taskHistory.create({
        data: {
          taskId: task.id,
          version: 1,
          changedById: userId,
          changeType: TaskHistoryChangeType.CREATED,
          changeDescription: `Khởi tạo tự động từ đề xuất "${proposal.title}" tại bước "${firstStep.name}"`,
          snapshot: {
            task,
            fromProposalId: proposal.id,
          },
          createdById: userId,
        },
      });

      // Cập nhật linkedTaskId trên Proposal
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { linkedTaskId: task.id },
      });

      // Ghi lịch sử đề xuất
      await tx.proposalHistory.create({
        data: {
          proposalId: proposal.id,
          version: 0,
          changedById: userId,
          changeType: 'WORKFLOW_STARTED',
          changeDescription: `Quy trình "${process.name}" đã được khởi chạy. Nhiệm vụ: "${task.name}" (ID: ${task.id})`,
          snapshot: { taskId: task.id, processId: process.id, processName: process.name },
          createdById: userId,
        },
      });

      // Thông báo cho người tạo
      await tx.proposalNotification.create({
        data: {
          proposalId: proposal.id,
          recipientId: proposal.creatorId,
          type: 'WORKFLOW_STARTED',
          title: `Quy trình "${process.name}" đã được khởi chạy`,
          content: `Đề xuất "${proposal.title}" đã được duyệt và quy trình liên kết đã tự động bắt đầu.`,
        },
      });
    } catch (error) {
      console.error('Error triggering linked workflow:', error);
      // Không throw error để không ảnh hưởng đến việc approve proposal
    }
  }

  /**
   * Khởi chạy workflow thủ công (khi autoStartWorkflow = false).
   */
  static async manualStartWorkflow(proposalId: string, userId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { proposalType: true },
    });

    if (!proposal) throw new Error('Không tìm thấy đề xuất');
    if (proposal.status !== 'APPROVED') {
      throw new Error('Chỉ có thể khởi chạy quy trình cho đề xuất đã được phê duyệt');
    }
    if (proposal.linkedTaskId) {
      throw new Error('Quy trình đã được khởi chạy trước đó');
    }
    if (!proposal.proposalType.linkedProcessId) {
      throw new Error('Loại đề xuất không được liên kết với quy trình nào');
    }

    const result = await prisma.$transaction(async (tx) => {
      await this.triggerLinkedWorkflow(tx, proposal, userId);
      return prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
          proposalType: true,
          approvals: { orderBy: { order: 'asc' } },
          linkedTask: true,
        },
      });
    });

    return result;
  }

  /**
   * Kiểm tra xem người dùng có quyền phê duyệt đề xuất này tại thời điểm hiện tại hay không.
   */
  static async canUserApprove(proposalId: string, userId: string): Promise<{
    canApprove: boolean;
    reason?: string;
    approvalId?: string;
    order?: number;
  }> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        proposalType: true,
        approvals: { orderBy: { order: 'asc' } },
      },
    });

    if (!proposal) {
      return { canApprove: false, reason: 'Không tìm thấy đề xuất' };
    }

    if (proposal.status !== 'PENDING' && proposal.status !== 'IN_REVIEW') {
      return { canApprove: false, reason: 'Đề xuất không ở trạng thái chờ duyệt' };
    }

    const approval = proposal.approvals.find(
      (a) => a.approverId === userId && a.action === 'PENDING'
    );

    if (!approval) {
      return { canApprove: false, reason: 'Bạn không có lượt duyệt nào đang chờ xử lý' };
    }

    const workflowType = proposal.proposalType.approvalWorkflow;
    if (workflowType === 'SEQUENTIAL') {
      const priorUnapproved = proposal.approvals.find(
        (a) => a.order < approval.order && a.action !== 'APPROVED'
      );
      if (priorUnapproved) {
        return { canApprove: false, reason: 'Chưa đến lượt bạn phê duyệt' };
      }
    }

    return {
      canApprove: true,
      approvalId: approval.id,
      order: approval.order,
    };
  }

  /**
   * Hủy đề xuất (người tạo hoặc Admin).
   */
  static async cancelProposal(proposalId: string, userId: string, reason?: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        proposalType: true,
        approvals: true,
      },
    });

    if (!proposal) throw new Error('Không tìm thấy đề xuất');

    if (proposal.creatorId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Bạn không có quyền hủy đề xuất này');
      }
    }

    if (!['DRAFT', 'PENDING', 'IN_REVIEW'].includes(proposal.status)) {
      throw new Error('Chỉ có thể hủy đề xuất đang ở trạng thái Nháp hoặc Đang chờ duyệt');
    }

    if (!proposal.proposalType.allowCancel && proposal.status !== 'DRAFT') {
      throw new Error('Loại đề xuất này không cho phép hủy sau khi gửi');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Hủy tất cả pending approvals
      await tx.proposalApproval.updateMany({
        where: { proposalId, action: 'PENDING' },
        data: { action: 'CANCELLED' },
      });

      // Cập nhật trạng thái proposal
      const updated = await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: 'CANCELLED',
          updatedById: userId,
        },
      });

      // Ghi lịch sử
      const historyCount = await tx.proposalHistory.count({ where: { proposalId } });
      await tx.proposalHistory.create({
        data: {
          proposalId,
          version: historyCount + 1,
          changedById: userId,
          changeType: 'CANCELLED',
          changeDescription: `Đề xuất đã bị hủy${reason ? `: ${reason}` : ''}`,
          snapshot: { status: 'CANCELLED', reason },
          createdById: userId,
        },
      });

      // Thông báo cho approvers nếu đã gửi duyệt
      if (proposal.status !== 'DRAFT') {
        const approverIds = proposal.approvals
          .filter((a) => a.action === 'PENDING')
          .map((a) => a.approverId);

        await Promise.all(
          approverIds.map((approverId) =>
            tx.proposalNotification.create({
              data: {
                proposalId,
                recipientId: approverId,
                type: 'SUBMITTED',
                title: `Đề xuất đã bị hủy: ${proposal.title}`,
                content: `Người tạo đã hủy đề xuất "${proposal.title}"${reason ? `. Lý do: ${reason}` : ''}.`,
              },
            })
          )
        );
      }

      return updated;
    });

    return result;
  }
}
