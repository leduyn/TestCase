import prisma from '../config/database';
import { NotificationService } from '../services/notificationService';

async function testNotificationService() {
  console.log('🧪 === BẮT ĐẦU KIỂM TRA NOTIFICATION SERVICE ===');

  try {
    // 1. Tìm hoặc lấy user mẫu để test
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('⚠️ Không có user nào trong DB để test.');
      return;
    }

    console.log(`👤 User test: ${user.fullName || user.email} (ID: ${user.id})`);

    // 2. Test tạo notification đơn lẻ
    const notif = await NotificationService.createNotification({
      recipientId: user.id,
      type: 'TASK_COMMENT',
      title: 'Kiểm tra thông báo đơn',
      content: 'Nội dung kiểm tra hệ thống thông báo hợp nhất.',
      metadata: { test: true },
    });
    console.log(`✅ 1. Tạo notification thành công: ID = ${notif.id}`);

    // 3. Test lấy unread count
    const unreadCount = await NotificationService.getUnreadCount(user.id);
    console.log(`✅ 2. Số lượng chưa đọc hiện tại: ${unreadCount}`);

    // 4. Test lấy danh sách notifications
    const list = await NotificationService.getNotifications(user.id, { page: 1, limit: 5 });
    console.log(`✅ 3. Lấy danh sách notifications: tìm thấy ${list.notifications.length}/${list.total} thông báo.`);

    // 5. Test markAsRead
    await NotificationService.markAsRead(notif.id, user.id);
    const countAfterRead = await NotificationService.getUnreadCount(user.id);
    console.log(`✅ 4. Đánh dấu đã đọc thành công: unread count còn ${countAfterRead}`);

    // 6. Test deleteNotification
    await NotificationService.deleteNotification(notif.id, user.id);
    console.log(`✅ 5. Xóa notification test thành công.`);

    console.log('\n🎉 TẤT CẢ KIỂM TRA GIAI ĐOẠN 2 ĐỀU THÀNH CÔNG!');
  } catch (error) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM TRA:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationService();
