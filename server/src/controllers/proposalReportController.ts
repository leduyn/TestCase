import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProposalReportService } from '../services/proposalReportService';

export class ProposalReportController {
  static async getProposalsByType(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const result = await ProposalReportService.getProposalsByType({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching proposals by type report:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xuất báo cáo theo loại đề xuất' });
    }
  }

  static async getProposalsByStatus(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, proposalTypeId } = req.query;
      const result = await ProposalReportService.getProposalsByStatus({
        startDate: startDate as string,
        endDate: endDate as string,
        proposalTypeId: proposalTypeId as string,
      });
      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching proposals by status report:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xuất báo cáo theo trạng thái' });
    }
  }

  static async getProposalsByApprover(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const result = await ProposalReportService.getProposalsByApprover({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching proposals by approver report:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xuất báo cáo theo người duyệt' });
    }
  }

  static async getApprovalTimeStats(req: AuthRequest, res: Response) {
    try {
      const { proposalTypeId } = req.query;
      const result = await ProposalReportService.getApprovalTimeStats({
        proposalTypeId: proposalTypeId as string,
      });
      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching approval time report:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xuất báo cáo thời gian duyệt' });
    }
  }

  static async getOverdueProposals(req: AuthRequest, res: Response) {
    try {
      const result = await ProposalReportService.getOverdueProposals();
      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching overdue proposals report:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xuất danh sách đề xuất quá hạn' });
    }
  }
}
