import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProposalService } from '../services/proposalService';
import { ProposalWorkflowService } from '../services/proposalWorkflowService';
import { ProposalStatus, ProposalPriority } from '@prisma/client';

export class ProposalController {
  static async getProposals(req: AuthRequest, res: Response) {
    try {
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
        page,
        limit,
      } = req.query;

      const result = await ProposalService.getProposals({
        status: status as ProposalStatus,
        proposalTypeId: proposalTypeId as string,
        priority: priority as ProposalPriority,
        creatorId: creatorId as string,
        approverId: approverId as string,
        approverAction: approverAction as string,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching proposals:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách đề xuất' });
    }
  }

  static async getProposalById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const proposal = await ProposalService.getProposalById(id, currentUserId);
      return res.json(proposal);
    } catch (error: any) {
      console.error('Error fetching proposal by id:', error);
      return res.status(404).json({ message: error.message || 'Không tìm thấy đề xuất' });
    }
  }

  static async createProposal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { proposalTypeId, title } = req.body;

      if (!proposalTypeId) {
        return res.status(400).json({ message: 'Vui lòng chọn loại đề xuất' });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ message: 'Tiêu đề đề xuất không được để trống' });
      }

      const proposal = await ProposalService.createProposal(req.body, userId);
      return res.status(201).json({
        message: req.body.isSubmit ? 'Gửi đề xuất phê duyệt thành công' : 'Lưu nháp đề xuất thành công',
        proposal,
      });
    } catch (error: any) {
      console.error('Error creating proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi tạo đề xuất' });
    }
  }

  static async updateProposal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const proposal = await ProposalService.updateProposal(id, req.body, userId);
      return res.json({
        message: 'Cập nhật đề xuất thành công',
        proposal,
      });
    } catch (error: any) {
      console.error('Error updating proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật đề xuất' });
    }
  }

  static async deleteProposal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await ProposalService.deleteProposal(id, userId);
      return res.json({ message: 'Đã xóa đề xuất thành công' });
    } catch (error: any) {
      console.error('Error deleting proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi xóa đề xuất' });
    }
  }

  static async submitProposal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await ProposalWorkflowService.initializeApprovals(id, userId);
      const fullProposal = await ProposalService.getProposalById(id, userId);

      return res.json({
        message: 'Đề xuất đã được gửi duyệt thành công',
        proposal: fullProposal,
      });
    } catch (error: any) {
      console.error('Error submitting proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi gửi duyệt đề xuất' });
    }
  }

  static async cancelProposal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { reason } = req.body;

      await ProposalWorkflowService.cancelProposal(id, userId, reason);
      const fullProposal = await ProposalService.getProposalById(id, userId);

      return res.json({
        message: 'Hủy đề xuất thành công',
        proposal: fullProposal,
      });
    } catch (error: any) {
      console.error('Error cancelling proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi hủy đề xuất' });
    }
  }

  static async approveProposal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { comment, attachments } = req.body;

      await ProposalWorkflowService.processDecision(
        id,
        userId,
        'APPROVED',
        comment,
        attachments,
        userId
      );

      const fullProposal = await ProposalService.getProposalById(id, userId);

      return res.json({
        message: 'Phê duyệt đề xuất thành công',
        proposal: fullProposal,
      });
    } catch (error: any) {
      console.error('Error approving proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi phê duyệt đề xuất' });
    }
  }

  static async rejectProposal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { comment, attachments } = req.body;

      if (!comment || !comment.trim()) {
        return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối đề xuất' });
      }

      await ProposalWorkflowService.processDecision(
        id,
        userId,
        'REJECTED',
        comment,
        attachments,
        userId
      );

      const fullProposal = await ProposalService.getProposalById(id, userId);

      return res.json({
        message: 'Từ chối đề xuất thành công',
        proposal: fullProposal,
      });
    } catch (error: any) {
      console.error('Error rejecting proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi từ chối đề xuất' });
    }
  }

  static async startWorkflow(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await ProposalWorkflowService.manualStartWorkflow(id, userId);
      const fullProposal = await ProposalService.getProposalById(id, userId);

      return res.json({
        message: 'Khởi chạy quy trình công việc thành công',
        proposal: fullProposal,
      });
    } catch (error: any) {
      console.error('Error starting workflow from proposal:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi khởi chạy quy trình' });
    }
  }

  static async getHistory(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const history = await ProposalService.getHistory(id);
      return res.json(history);
    } catch (error: any) {
      console.error('Error fetching proposal history:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy lịch sử đề xuất' });
    }
  }

  static async getComments(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const comments = await ProposalService.getComments(id);
      return res.json(comments);
    } catch (error: any) {
      console.error('Error fetching proposal comments:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách bình luận' });
    }
  }

  static async addComment(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { content, attachments } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      }

      const comment = await ProposalService.addComment(id, userId, content, attachments);
      return res.status(201).json({
        message: 'Thêm bình luận thành công',
        comment,
      });
    } catch (error: any) {
      console.error('Error adding comment:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi gửi bình luận' });
    }
  }

  static async getFollowers(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const followers = await ProposalService.getFollowers(id);
      return res.json(followers);
    } catch (error: any) {
      console.error('Error fetching followers:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách người theo dõi' });
    }
  }

  static async addFollowers(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user!.id;
      const { id } = req.params;
      const { userIds, userId } = req.body;

      const targetUserIds: string[] = userIds || (userId ? [userId] : []);
      if (targetUserIds.length === 0) {
        return res.status(400).json({ message: 'Vui lòng chọn ít nhất một người theo dõi' });
      }

      const followers = await ProposalService.addFollowers(id, targetUserIds, actorId);
      return res.status(201).json({
        message: 'Bổ sung người theo dõi thành công',
        followers,
      });
    } catch (error: any) {
      console.error('Error adding followers:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi thêm người theo dõi' });
    }
  }

  static async removeFollower(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user!.id;
      const actorRole = req.user?.role;
      const { id, userId } = req.params;

      const result = await ProposalService.removeFollower(id, userId, actorId, actorRole);
      return res.json(result);
    } catch (error: any) {
      console.error('Error removing follower:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi xóa người theo dõi' });
    }
  }
}
