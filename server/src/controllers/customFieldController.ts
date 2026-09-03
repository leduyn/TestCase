import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CustomFieldService } from '../services/customFieldService';

export class CustomFieldController {
  /**
   * Lấy danh sách các loại trường hỗ trợ
   * GET /api/custom-fields/types
   */
  static async getSupportedTypes(_req: AuthRequest, res: Response) {
    try {
      const types = CustomFieldService.getSupportedFieldTypes();
      return res.json(types);
    } catch (error: any) {
      console.error('Error fetching supported field types:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách loại trường' });
    }
  }

  /**
   * Tạo Custom Field mới cho Process / Step
   * POST /api/processes/:processId/custom-fields
   * hoặc POST /api/custom-fields
   */
  static async createCustomField(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const processId = req.params.processId || req.body.processId;
      const {
        stepId,
        fieldKey,
        fieldLabel,
        fieldType,
        fieldConfig,
        isRequired,
        defaultValue,
        placeholder,
        helpText,
        order,
        isVisible,
        visibilityCondition,
        validationRules,
      } = req.body;

      if (!processId) {
        return res.status(400).json({ message: 'Quy trình (processId) là bắt buộc' });
      }

      if (!fieldKey || !fieldLabel || !fieldType) {
        return res.status(400).json({ message: 'Mã trường (fieldKey), tên hiển thị (fieldLabel) và loại trường (fieldType) là bắt buộc' });
      }

      const field = await CustomFieldService.createCustomField(
        {
          processId,
          stepId,
          fieldKey,
          fieldLabel,
          fieldType,
          fieldConfig,
          isRequired,
          defaultValue,
          placeholder,
          helpText,
          order,
          isVisible,
          visibilityCondition,
          validationRules,
        },
        userId
      );

      return res.status(201).json({
        message: 'Tạo trường tùy chỉnh thành công',
        field,
      });
    } catch (error: any) {
      console.error('Error creating custom field:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi tạo trường tùy chỉnh' });
    }
  }

  /**
   * Lấy danh sách Custom Fields của Process
   * GET /api/processes/:processId/custom-fields
   */
  static async getCustomFieldsByProcess(req: AuthRequest, res: Response) {
    try {
      const { processId } = req.params;
      const { stepId } = req.query;

      if (!processId) {
        return res.status(400).json({ message: 'processId là bắt buộc' });
      }

      const fields = await CustomFieldService.getCustomFieldsByProcess(
        processId,
        stepId as string | undefined
      );

      return res.json(fields);
    } catch (error: any) {
      console.error('Error getting custom fields by process:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách trường tùy chỉnh' });
    }
  }

  /**
   * Lấy chi tiết 1 Custom Field
   * GET /api/custom-fields/:id
   */
  static async getCustomFieldById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const field = await CustomFieldService.getCustomFieldById(id);

      if (!field) {
        return res.status(404).json({ message: 'Không tìm thấy trường tùy chỉnh' });
      }

      return res.json(field);
    } catch (error: any) {
      console.error('Error getting custom field by id:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy chi tiết trường tùy chỉnh' });
    }
  }

  /**
   * Cập nhật Custom Field
   * PUT /api/custom-fields/:id
   */
  static async updateCustomField(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const {
        stepId,
        fieldLabel,
        fieldConfig,
        isRequired,
        defaultValue,
        placeholder,
        helpText,
        order,
        isVisible,
        visibilityCondition,
        validationRules,
      } = req.body;

      const field = await CustomFieldService.updateCustomField(
        id,
        {
          stepId,
          fieldLabel,
          fieldConfig,
          isRequired,
          defaultValue,
          placeholder,
          helpText,
          order,
          isVisible,
          visibilityCondition,
          validationRules,
        },
        userId
      );

      return res.json({
        message: 'Cập nhật trường tùy chỉnh thành công',
        field,
      });
    } catch (error: any) {
      console.error('Error updating custom field:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật trường tùy chỉnh' });
    }
  }

  /**
   * Xóa Custom Field
   * DELETE /api/custom-fields/:id
   */
  static async deleteCustomField(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await CustomFieldService.deleteCustomField(id);

      return res.json({
        message: 'Xóa trường tùy chỉnh thành công',
      });
    } catch (error: any) {
      console.error('Error deleting custom field:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi xóa trường tùy chỉnh' });
    }
  }

  /**
   * Sắp xếp lại thứ tự Custom Fields
   * POST /api/processes/:processId/custom-fields/reorder
   * hoặc POST /api/custom-fields/reorder
   */
  static async reorderCustomFields(req: AuthRequest, res: Response) {
    try {
      const processId = req.params.processId || req.body.processId;
      const { fieldOrders } = req.body;

      if (!processId || !fieldOrders) {
        return res.status(400).json({ message: 'processId và danh sách fieldOrders là bắt buộc' });
      }

      await CustomFieldService.reorderCustomFields(processId, fieldOrders);

      return res.json({
        message: 'Cập nhật thứ tự trường tùy chỉnh thành công',
      });
    } catch (error: any) {
      console.error('Error reordering custom fields:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi sắp xếp lại thứ tự trường tùy chỉnh' });
    }
  }

  /**
   * Nhân bản Custom Field
   * POST /api/custom-fields/:id/duplicate
   */
  static async duplicateCustomField(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const field = await CustomFieldService.duplicateCustomField(id, userId);

      return res.status(201).json({
        message: 'Nhân bản trường tùy chỉnh thành công',
        field,
      });
    } catch (error: any) {
      console.error('Error duplicating custom field:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi nhân bản trường tùy chỉnh' });
    }
  }

  /**
   * Validate cấu hình field trước khi lưu
   * POST /api/custom-fields/validate-config
   */
  static async validateConfig(req: AuthRequest, res: Response) {
    try {
      const { fieldType, fieldConfig } = req.body;
      const check = CustomFieldService.validateFieldConfig(fieldType, fieldConfig);
      return res.json(check);
    } catch (error: any) {
      console.error('Error validating field config:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi kiểm tra cấu hình trường' });
    }
  }
}
