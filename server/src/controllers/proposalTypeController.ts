import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProposalTypeService } from '../services/proposalTypeService';

export class ProposalTypeController {
  static async getProposalTypes(req: AuthRequest, res: Response) {
    try {
      const { search, isActive, forCreation, page, limit } = req.query;

      const result = await ProposalTypeService.getProposalTypes({
        search: search as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        forUser: forCreation === 'true' && req.user ? {
          id: req.user.id,
          role: req.user.role,
          department: (req.user as any).department,
        } : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching proposal types:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách loại đề xuất' });
    }
  }

  static async getProposalTypeById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const proposalType = await ProposalTypeService.getProposalTypeById(id);
      return res.json(proposalType);
    } catch (error: any) {
      console.error('Error fetching proposal type by id:', error);
      return res.status(404).json({ message: error.message || 'Không tìm thấy loại đề xuất' });
    }
  }

  static async createProposalType(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { name, code } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Tên loại đề xuất không được để trống' });
      }

      if (!code || !code.trim()) {
        return res.status(400).json({ message: 'Mã loại đề xuất không được để trống' });
      }

      const proposalType = await ProposalTypeService.createProposalType(req.body, userId);
      return res.status(201).json({
        message: 'Tạo loại đề xuất thành công',
        proposalType,
      });
    } catch (error: any) {
      console.error('Error creating proposal type:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi tạo loại đề xuất' });
    }
  }

  static async updateProposalType(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const proposalType = await ProposalTypeService.updateProposalType(id, req.body, userId);
      return res.json({
        message: 'Cập nhật loại đề xuất thành công',
        proposalType,
      });
    } catch (error: any) {
      console.error('Error updating proposal type:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật loại đề xuất' });
    }
  }

  static async toggleActive(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const proposalType = await ProposalTypeService.toggleActive(id, userId);
      return res.json({
        message: `Đã ${proposalType.isActive ? 'kích hoạt' : 'khóa'} loại đề xuất thành công`,
        proposalType,
      });
    } catch (error: any) {
      console.error('Error toggling proposal type active status:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi thay đổi trạng thái' });
    }
  }

  static async deleteProposalType(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await ProposalTypeService.deleteProposalType(id, userId);
      return res.json({ message: 'Đã xóa loại đề xuất thành công' });
    } catch (error: any) {
      console.error('Error deleting proposal type:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi xóa loại đề xuất' });
    }
  }
}
