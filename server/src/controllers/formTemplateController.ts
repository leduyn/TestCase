import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FormTemplateService } from '../services/formTemplateService';

export class FormTemplateController {
  static async getFormTemplates(req: AuthRequest, res: Response) {
    try {
      const { search, proposalTypeId, page, limit } = req.query;
      const result = await FormTemplateService.getFormTemplates({
        search: search as string,
        proposalTypeId: proposalTypeId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching form templates:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách form mẫu' });
    }
  }

  static async getFormTemplateById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = await FormTemplateService.getFormTemplateById(id);
      return res.json(template);
    } catch (error: any) {
      console.error('Error fetching form template by id:', error);
      return res.status(404).json({ message: error.message || 'Không tìm thấy form mẫu' });
    }
  }

  static async createFormTemplate(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Tên form mẫu không được để trống' });
      }

      const template = await FormTemplateService.createFormTemplate(req.body, userId);
      return res.status(201).json({
        message: 'Tạo form mẫu thành công',
        template,
      });
    } catch (error: any) {
      console.error('Error creating form template:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi tạo form mẫu' });
    }
  }

  static async updateFormTemplate(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const template = await FormTemplateService.updateFormTemplate(id, req.body, userId);
      return res.json({
        message: 'Cập nhật form mẫu thành công',
        template,
      });
    } catch (error: any) {
      console.error('Error updating form template:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật form mẫu' });
    }
  }

  static async deleteFormTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await FormTemplateService.deleteFormTemplate(id);
      return res.json({ message: 'Đã xóa form mẫu thành công' });
    } catch (error: any) {
      console.error('Error deleting form template:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi xóa form mẫu' });
    }
  }

  static async duplicateFormTemplate(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { name } = req.body;

      const template = await FormTemplateService.duplicateFormTemplate(id, name, userId);
      return res.status(201).json({
        message: 'Nhân bản form mẫu thành công',
        template,
      });
    } catch (error: any) {
      console.error('Error duplicating form template:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi nhân bản form mẫu' });
    }
  }

  static async addField(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { fieldKey, fieldLabel } = req.body;

      if (!fieldKey || !fieldKey.trim()) {
        return res.status(400).json({ message: 'Mã trường không được để trống' });
      }
      if (!fieldLabel || !fieldLabel.trim()) {
        return res.status(400).json({ message: 'Tên nhãn trường không được để trống' });
      }

      const field = await FormTemplateService.addField(id, req.body, userId);
      return res.status(201).json({
        message: 'Thêm trường vào form thành công',
        field,
      });
    } catch (error: any) {
      console.error('Error adding field:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi thêm trường vào form' });
    }
  }

  static async updateField(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { fieldId } = req.params;

      const field = await FormTemplateService.updateField(fieldId, req.body, userId);
      return res.json({
        message: 'Cập nhật trường thành công',
        field,
      });
    } catch (error: any) {
      console.error('Error updating field:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật trường' });
    }
  }

  static async deleteField(req: AuthRequest, res: Response) {
    try {
      const { fieldId } = req.params;
      await FormTemplateService.deleteField(fieldId);
      return res.json({ message: 'Đã xóa trường thành công' });
    } catch (error: any) {
      console.error('Error deleting field:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi xóa trường' });
    }
  }

  static async reorderFields(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { fieldOrders } = req.body;

      if (!Array.isArray(fieldOrders)) {
        return res.status(400).json({ message: 'fieldOrders phải là mảng các đối tượng { id, order }' });
      }

      await FormTemplateService.reorderFields(id, fieldOrders);
      return res.json({ message: 'Sắp xếp lại thứ tự trường thành công' });
    } catch (error: any) {
      console.error('Error reordering fields:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi sắp xếp lại trường' });
    }
  }
}
