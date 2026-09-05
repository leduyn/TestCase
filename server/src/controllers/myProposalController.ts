import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { ProposalService } from '../services/proposalService';
import { ProposalWorkflowService } from '../services/proposalWorkflowService';

export class MyProposalController {
  /**
   * GET /api/my/proposals: Đề xuất do tôi tạo
   */
  static async getMyProposals(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { status, proposalTypeId, priority, search, page, limit } = req.query;

      const result = await ProposalService.getProposals({
        creatorId: userId,
        status: status as any,
        proposalTypeId: proposalTypeId as string,
        priority: priority as any,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching my proposals:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy đề xuất của tôi' });
    }
  }

  /**
   * GET /api/my/approvals: Đề xuất đang chờ tôi phê duyệt
   */
  static async getMyPendingApprovals(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { search, proposalTypeId, priority, page = 1, limit = 20 } = req.query;

      // Lấy tất cả đề xuất có lượt duyệt PENDING của user
      const candidateProposals = await prisma.proposal.findMany({
        where: {
          status: { in: ['PENDING', 'IN_REVIEW'] },
          proposalTypeId: proposalTypeId ? (proposalTypeId as string) : undefined,
          priority: priority ? (priority as any) : undefined,
          approvals: {
            some: {
              approverId: userId,
              action: 'PENDING',
            },
          },
          ...(search && (search as string).trim()
            ? {
                OR: [
                  { title: { contains: (search as string).trim(), mode: 'insensitive' } },
                  { creator: { fullName: { contains: (search as string).trim(), mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
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
            },
            orderBy: { order: 'asc' },
          },
          _count: { select: { comments: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });

      // Lọc lại: Với SEQUENTIAL, chỉ lấy đề xuất mà người dùng ĐÃ ĐẾN LƯỢT DUYỆT
      const validProposals: any[] = [];
      for (const p of candidateProposals) {
        const canApproveResult = await ProposalWorkflowService.canUserApprove(p.id, userId);
        if (canApproveResult.canApprove) {
          validProposals.push({
            ...p,
            userApprovalId: canApproveResult.approvalId,
            userApprovalOrder: canApproveResult.order,
          });
        }
      }

      const pNum = Number(page);
      const lNum = Number(limit);
      const paginated = validProposals.slice((pNum - 1) * lNum, pNum * lNum);

      return res.json({
        proposals: paginated,
        total: validProposals.length,
        page: pNum,
        limit: lNum,
      });
    } catch (error: any) {
      console.error('Error fetching pending approvals for user:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy đề xuất chờ duyệt' });
    }
  }

  /**
   * GET /api/my/approved: Đề xuất tôi đã chấp thuận
   */
  static async getMyApproved(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { search, proposalTypeId, page, limit } = req.query;

      const result = await ProposalService.getProposals({
        approverId: userId,
        approverAction: 'APPROVED',
        proposalTypeId: proposalTypeId as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching approved proposals by user:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách đã duyệt' });
    }
  }

  /**
   * GET /api/my/rejected: Đề xuất tôi đã từ chối
   */
  static async getMyRejected(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { search, proposalTypeId, page, limit } = req.query;

      const result = await ProposalService.getProposals({
        approverId: userId,
        approverAction: 'REJECTED',
        proposalTypeId: proposalTypeId as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching rejected proposals by user:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách đã từ chối' });
    }
  }

  /**
   * GET /api/my/following: Đề xuất tôi đang theo dõi
   */
  static async getMyFollowing(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { search, proposalTypeId, status, priority, page = 1, limit = 20 } = req.query;

      const where: any = {
        followers: {
          some: { userId },
        },
      };

      if (status) where.status = status;
      if (proposalTypeId) where.proposalTypeId = proposalTypeId;
      if (priority) where.priority = priority;

      if (search && (search as string).trim()) {
        const term = (search as string).trim();
        where.OR = [
          { title: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
          { creator: { fullName: { contains: term, mode: 'insensitive' } } },
        ];
      }

      const pNum = Number(page);
      const lNum = Number(limit);

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
              select: { comments: true, followers: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pNum - 1) * lNum,
          take: lNum,
        }),
        prisma.proposal.count({ where }),
      ]);

      return res.json({ proposals, total, page: pNum, limit: lNum });
    } catch (error: any) {
      console.error('Error fetching followed proposals:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách đề xuất đang theo dõi' });
    }
  }
}
