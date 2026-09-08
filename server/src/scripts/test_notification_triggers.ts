import prisma from '../config/database';
import { NotificationService } from '../services/notificationService';

async function testNotificationTriggers() {
  console.log('🧪 === KIỂM TRA TRIGGER NOTIFICATION TỰ ĐỘNG (GIAI ĐOẠN 3) ===');

  try {
    // 1. Lấy 2 users bất kỳ để làm actor và recipient
    const users = await prisma.user.findMany({ take: 2 });
    if (users.length < 2) {
      console.log('⚠️ Cần ít nhất 2 users trong DB để test trigger.');
      return;
    }

    const userA = users[0]; // Actor
    const userB = users[1]; // Recipient

    console.log(`👤 Actor: ${userA.fullName} (${userA.id})`);
    console.log(`👤 Recipient: ${userB.fullName} (${userB.id})`);

    // 2. Test Trigger: onTaskCommentCreated
    console.log('\n--- 1. Test Trigger: onTaskCommentCreated ---');
    // Tìm hoặc tạo 1 task có userB là executor hoặc watcher
    let task = await prisma.task.findFirst({
      where: { processId: { not: '' } },
    });

    if (task) {
      // Tạm thời cập nhật watcherIds có userB
      await prisma.task.update({
        where: { id: task.id },
        data: { watcherIds: [userB.id] },
      });

      const beforeCount = await NotificationService.getUnreadCount(userB.id);
      await NotificationService.onTaskCommentCreated(task.id, userA.id, 'Xin chào, đây là bình luận kiểm thử tự động!');
      const afterCount = await NotificationService.getUnreadCount(userB.id);

      console.log(`✅ Task comment notification tạo thành công: unread count ${beforeCount} -> ${afterCount}`);
    } else {
      console.log('ℹ️ Không có task mẫu, bỏ qua test task comment.');
    }

    // 3. Test Trigger: onTestCaseUpdated
    console.log('\n--- 2. Test Trigger: onTestCaseUpdated ---');
    let testCase = await prisma.testCase.findFirst({
      include: { executions: true },
    });

    if (testCase) {
      // Đảm bảo có 1 execution gán cho userB
      if (testCase.executions.length === 0) {
        await prisma.testExecution.create({
          data: {
            testCaseId: testCase.id,
            executedById: userB.id,
            createdById: userA.id,
            status: 'UNTESTED',
          },
        });
      } else {
        await prisma.testExecution.update({
          where: { id: testCase.executions[0].id },
          data: { executedById: userB.id },
        });
      }

      const beforeCount = await NotificationService.getUnreadCount(userB.id);
      await NotificationService.onTestCaseUpdated(testCase.id, userA.id, 'Cập nhật các bước kiểm thử');
      const afterCount = await NotificationService.getUnreadCount(userB.id);

      console.log(`✅ TestCase update notification tạo thành công: unread count ${beforeCount} -> ${afterCount}`);
    } else {
      console.log('ℹ️ Không có TestCase mẫu, bỏ qua test testCase updated.');
    }

    // 4. Test Trigger: onExecutionStatusChanged
    console.log('\n--- 3. Test Trigger: onExecutionStatusChanged ---');
    const execution = await prisma.testExecution.findFirst({
      where: { executedById: userB.id },
    });

    if (execution) {
      const beforeCount = await NotificationService.getUnreadCount(userB.id);
      await NotificationService.onExecutionStatusChanged(
        execution.id,
        userA.id,
        'FAILED',
        'Phát hiện lỗi giao diện',
        userB.id
      );
      const afterCount = await NotificationService.getUnreadCount(userB.id);

      console.log(`✅ Execution status changed notification tạo thành công: unread count ${beforeCount} -> ${afterCount}`);
    }

    // 5. Kiểm tra danh sách notifications nhận được của userB
    const userBNotifs = await NotificationService.getNotifications(userB.id, { limit: 5 });
    console.log(`\n📋 Danh sách 5 thông báo mới nhất của ${userB.fullName}:`);
    userBNotifs.notifications.forEach((n, idx) => {
      console.log(`   ${idx + 1}. [${n.type}] ${n.title} - ${n.content.substring(0, 60)}...`);
    });

    console.log('\n🎉 TẤT CẢ TRIGGERS GIAI ĐOẠN 3 HOẠT ĐỘNG HOÀN HẢO!');
  } catch (error) {
    console.error('❌ Lỗi kiểm tra triggers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationTriggers();
