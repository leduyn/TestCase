import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TaskCustomFieldService } from '../services/taskCustomFieldService';

export class TaskCustomFieldController {
  /**
   * Lấy danh sách custom fields của task (kèm định nghĩa, giá trị đã nhập, và tính toán formula/visibility)
   * GET /api/tasks/:taskId/custom-fields
   */
  static async getTaskCustomFields(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const { stepId } = req.query;

      const result = await TaskCustomFieldService.getTaskCustomFields(
        taskId,
        stepId as string | undefined
      );

      return res.json(result);
    } catch (error: any) {
      console.error('Error getting task custom fields:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy dữ liệu trường tùy chỉnh của nhiệm vụ' });
    }
  }

  /**
   * Lưu / Cập nhật bulk giá trị custom fields cho task
   * PUT /api/tasks/:taskId/custom-fields
   */
  static async saveTaskCustomFields(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { taskId } = req.params;
      const { fields, values } = req.body;

      // Hỗ trợ cả 2 format input:
      // 1. { fields: [{ fieldDefinitionId/fieldKey, value, stepId }] }
      // 2. { values: { [fieldKey]: value } }
      let inputs: any[] = [];

      if (Array.isArray(fields)) {
        inputs = fields;
      } else if (values && typeof values === 'object') {
        inputs = Object.keys(values).map((key) => ({
          fieldKey: key,
          value: values[key],
        }));
      } else if (Array.isArray(req.body)) {
        inputs = req.body;
      } else {
        return res.status(400).json({ message: 'Dữ liệu cập nhật trường (fields hoặc values) không hợp lệ' });
      }

      const result = await TaskCustomFieldService.saveTaskCustomFieldValues(
        taskId,
        inputs,
        userId
      );

      return res.json({
        message: 'Lưu dữ liệu trường tùy chỉnh thành công',
        ...result,
      });
    } catch (error: any) {
      console.error('Error saving task custom fields:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi lưu dữ liệu trường tùy chỉnh' });
    }
  }

  /**
   * Dry-run validate các giá trị trước khi lưu
   * POST /api/tasks/:taskId/custom-fields/validate
   */
  static async validateTaskCustomFields(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const { fields, values } = req.body;

      let inputs: any[] = [];
      if (Array.isArray(fields)) {
        inputs = fields;
      } else if (values && typeof values === 'object') {
        inputs = Object.keys(values).map((key) => ({
          fieldKey: key,
          value: values[key],
        }));
      }

      const result = await TaskCustomFieldService.validateTaskCustomFields(taskId, inputs);
      return res.json(result);
    } catch (error: any) {
      console.error('Error validating task custom fields:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi kiểm tra dữ liệu trường' });
    }
  }

  /**
   * Lấy lịch sử thay đổi custom fields của nhiệm vụ
   * GET /api/tasks/:taskId/custom-fields/history
   */
  static async getTaskCustomFieldHistory(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const history = await TaskCustomFieldService.getTaskCustomFieldHistory(taskId);
      return res.json(history);
    } catch (error: any) {
      console.error('Error getting task custom field history:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy lịch sử trường tùy chỉnh' });
    }
  }
}
