import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/database';
import { ProcessService } from '../src/services/processService';
import { TaskService } from '../src/services/taskService';
import { TodoService } from '../src/services/todoService';
import { CommentService } from '../src/services/commentService';
import { WorkflowReportService } from '../src/services/workflowReportService';
import { CronService } from '../src/services/cronService';
import { TaskStatus, TaskHistoryChangeType } from '@prisma/client';

async function runTests() {
  console.log('🧪 Bắt đầu kiểm thử tự động toàn diện cho Workflow & Task Management...');

  // 1. Lấy thông tin user Admin, Manager, User1
  const admin = await prisma.user.findUnique({ where: { email: 'it@tanthinh68.vn' } });
  const manager = await prisma.user.findUnique({ where: { email: 'manager@tanthinh68.vn' } });
  const user1 = await prisma.user.findUnique({ where: { email: 'user1@tanthinh68.vn' } });

  if (!admin || !manager || !user1) {
    throw new Error('Chưa tìm thấy người dùng mẫu! Hãy chạy npm run seed trước.');
  }

  console.log('✅ 1. Đã kết nối cơ sở dữ liệu và tải thông tin người dùng mẫu.');

  // 2. Tạo Process mới
  const testProcess = await ProcessService.createProcess(
    {
      name: `Quy trình Test Tự Động ${Date.now()}`,
      description: 'Quy trình phục vụ kiểm thử tự động giai đoạn 5',
      managerId: manager.id,
      watcherIds: [admin.id],
      steps: [
        {
          name: 'Bước 1: Tiếp nhận yêu cầu',
          order: 1,
          timeLimitHours: 24,
          instructions: 'Ghi nhận và phân tích yêu cầu',
          executorIds: [user1.id],
        },
        {
          name: 'Bước 2: Phê duyệt giải pháp',
          order: 2,
          timeLimitHours: 48,
          instructions: 'Xem xét tính khả thi kỹ thuật',
          executorIds: [manager.id],
        },
        {
          name: 'Bước 3: Triển khai & Bàn giao',
          order: 3,
          timeLimitHours: 24,
          instructions: 'Deploy và bàn giao hệ thống',
          executorIds: [admin.id],
        },
      ],
    },
    admin.id
  );

  console.log(`✅ 2. Đã tạo quy trình thành công: "${testProcess.name}" (ID: ${testProcess.id}) với 3 bước.`);

  // 3. Tạo Task từ Process
  const testTask = await TaskService.createTask(
    {
      processId: testProcess.id,
      name: 'Nhiệm vụ Test Luồng Tự Động',
      content: 'Kiểm tra vòng đời hoàn chỉnh của một nhiệm vụ',
      customFields: { priority: 'HIGH', env: 'STAGING' },
    },
    user1.id
  );

  console.log(`✅ 3. Đã khởi tạo nhiệm vụ thành công: "${testTask.name}" (ID: ${testTask.id}) - Trạng thái: ${testTask.status}`);

  // Kiểm tra Snapshot version 1
  const historyV1 = await TaskService.getTaskHistorySnapshot(testTask.id, 1);
  if (!historyV1 || historyV1.changeType !== TaskHistoryChangeType.CREATED) {
    throw new Error('Lỗi: Không tìm thấy snapshot version 1 của Task!');
  }
  console.log('✅ 4. Đã xác thực Snapshot version 1 (CREATED) được ghi nhận chính xác.');

  // 4. Thêm Todo và Toggle hoàn thành
  const todo = await TodoService.createTodo(
    testTask.id,
    {
      description: 'Công việc kiểm thử thành phần A',
      executorId: user1.id,
    },
    user1.id
  );
  console.log(`✅ 5. Đã tạo Todo: "${todo.description}" (ID: ${todo.id})`);

  const toggledTodo = await TodoService.toggleTodo(todo.id, user1.id);
  if (!toggledTodo.isCompleted) {
    throw new Error('Lỗi: Toggle Todo không chuyển sang trạng thái đã hoàn thành!');
  }
  console.log('✅ 6. Đã toggle Todo thành công (isCompleted: true).');

  // 5. Thêm Comment
  const comment = await CommentService.createComment(
    testTask.id,
    {
      content: 'Bình luận kiểm thử tự động tích hợp',
      files: [{ name: 'test.log', url: '/uploads/workflow/test.log', size: 1024 }],
    },
    user1.id
  );
  console.log(`✅ 7. Đã thêm Comment: "${comment.content}"`);

  // 6. Chuyển bước sang Bước 2 (Transition)
  const step2Task = await TaskService.transitionStep(testTask.id, user1.id);
  console.log(`✅ 8. Đã chuyển bước sang: "${step2Task.currentStep?.name}" (Bước ${step2Task.currentStep?.order})`);

  const historyV2 = await TaskService.getTaskHistorySnapshot(testTask.id, 2);
  if (!historyV2 || historyV2.changeType !== TaskHistoryChangeType.STEP_CHANGED) {
    throw new Error('Lỗi: Không tìm thấy snapshot version 2 (STEP_CHANGED)!');
  }
  console.log('✅ 9. Đã xác thực Snapshot version 2 (STEP_CHANGED) được ghi nhận chính xác.');

  // 7. Chuyển bước sang Bước 3
  const step3Task = await TaskService.transitionStep(testTask.id, manager.id);
  console.log(`✅ 10. Đã chuyển bước sang: "${step3Task.currentStep?.name}" (Bước ${step3Task.currentStep?.order})`);

  // 8. Chuyển bước từ Bước cuối cùng -> Tự động Hoàn thành Task
  const completedTask = await TaskService.transitionStep(testTask.id, admin.id);
  if (completedTask.status !== TaskStatus.COMPLETED) {
    throw new Error(`Lỗi: Chuyển bước cuối cùng không chuyển trạng thái sang COMPLETED (hiện tại: ${completedTask.status})`);
  }
  console.log('✅ 11. Đã chuyển bước cuối cùng -> Nhiệm vụ tự động chuyển trạng thái COMPLETED.');

  // 9. Kiểm tra Reports Service
  const tasksByStatus = await WorkflowReportService.getTasksByStatus();
  const tasksByProcess = await WorkflowReportService.getTasksByProcess();
  const tasksByExecutor = await WorkflowReportService.getTasksByExecutor();
  const overdueTasks = await WorkflowReportService.getOverdueTasks();

  console.log(`✅ 12. Báo cáo thống kê:
    - Tổng số nhiệm vụ: ${tasksByStatus.total} nhiệm vụ
    - Tổng quy trình: ${tasksByProcess.length} quy trình
    - Tổng người thực thi: ${tasksByExecutor.length} nhân sự
    - Số nhiệm vụ quá hạn: ${overdueTasks.length} nhiệm vụ`);

  // 10. Kiểm tra quét Overdue của Cron Job
  await CronService.checkOverdueTasks();
  console.log('✅ 13. Quét định kỳ Overdue Tasks của CronService hoạt động ổn định.');

  // 11. Dọn dẹp dữ liệu test
  await prisma.process.delete({ where: { id: testProcess.id } });
  console.log('✅ 14. Đã dọn dẹp quy trình kiểm thử tạm thời (Cascade delete test task, todos, comments, histories).');

  console.log('\n🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ GIAI ĐOẠN 5 ĐÃ HOÀN TẤT VÀ VƯỢT QUA 100%!');
}

runTests()
  .catch((err) => {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
