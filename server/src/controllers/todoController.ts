import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TodoService } from '../services/todoService';

export class TodoController {
  static async createTodo(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.user!.id;
      const { description, executorId, deadline, watcherIds, files } = req.body;

      if (!description) {
        return res.status(400).json({ message: 'Nội dung đầu việc không được để trống' });
      }

      const todo = await TodoService.createTodo(
        taskId,
        { description, executorId, deadline, watcherIds, files },
        userId
      );

      return res.status(201).json({
        message: 'Thêm đầu việc thành công',
        todo,
      });
    } catch (error: any) {
      console.error('Error creating todo:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi thêm đầu việc' });
    }
  }

  static async getTodosByTaskId(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const todos = await TodoService.getTodosByTaskId(taskId);
      return res.json(todos);
    } catch (error: any) {
      console.error('Error fetching todos:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách đầu việc' });
    }
  }

  static async updateTodo(req: AuthRequest, res: Response) {
    try {
      const { todoId } = req.params;
      const userId = req.user!.id;
      const { description, executorId, deadline, watcherIds, files, isCompleted } = req.body;

      const todo = await TodoService.updateTodo(
        todoId,
        { description, executorId, deadline, watcherIds, files, isCompleted },
        userId
      );

      return res.json({
        message: 'Cập nhật đầu việc thành công',
        todo,
      });
    } catch (error: any) {
      console.error('Error updating todo:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi cập nhật đầu việc' });
    }
  }

  static async deleteTodo(req: AuthRequest, res: Response) {
    try {
      const { todoId } = req.params;
      await TodoService.deleteTodo(todoId);
      return res.json({ message: 'Xóa đầu việc thành công' });
    } catch (error: any) {
      console.error('Error deleting todo:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xóa đầu việc' });
    }
  }

  static async toggleTodo(req: AuthRequest, res: Response) {
    try {
      const { todoId } = req.params;
      const userId = req.user!.id;

      const todo = await TodoService.toggleTodo(todoId, userId);

      return res.json({
        message: todo.isCompleted ? 'Đã hoàn thành đầu việc' : 'Đã mở lại đầu việc',
        todo,
      });
    } catch (error: any) {
      console.error('Error toggling todo:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi thay đổi trạng thái đầu việc' });
    }
  }
}
