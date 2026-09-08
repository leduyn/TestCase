import prisma from '../config/database';
import { ProposalNotificationType, NotificationType } from '@prisma/client';

function mapToUnifiedType(type: ProposalNotificationType): NotificationType {
  const map: Record<ProposalNotificationType, NotificationType> = {
    SUBMITTED: 'PROPOSAL_SUBMITTED',
    APPROVED: 'PROPOSAL_APPROVED',
    REJECTED: 'PROPOSAL_REJECTED',
    REMINDER: 'PROPOSAL_REMINDER',
    COMMENT: 'PROPOSAL_COMMENT',
    WORKFLOW_STARTED: 'PROPOSAL_WORKFLOW_STARTED',
    FOLLOWER_ADDED: 'PROPOSAL_FOLLOWER_ADDED',
  };
  return map[type] || 'PROPOSAL_COMMENT';
}

async function runMigration() {
  console.log('🚀 === BẮT ĐẦU MIGRATION DỮ LIỆU PROPOSAL NOTIFICATIONS ===');

  try {
    // 1. Lấy toàn bộ thông báo đề xuất cũ
    const oldNotifications = await prisma.proposalNotification.findMany({
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📦 Tìm thấy tổng cộng ${oldNotifications.length} thông báo đề xuất trong bảng cũ.`);

    if (oldNotifications.length === 0) {
      console.log('ℹ️ Không có dữ liệu cũ cần chuyển đổi.');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const old of oldNotifications) {
      // Kiểm tra xem đã tồn tại trong bảng mới chưa (tránh trùng lặp)
      const existing = await prisma.notification.findFirst({
        where: {
          recipientId: old.recipientId,
          proposalId: old.proposalId,
          createdAt: old.createdAt,
          title: old.title,
        },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await prisma.notification.create({
        data: {
          recipientId: old.recipientId,
          type: mapToUnifiedType(old.type),
          title: old.title,
          content: old.content,
          isRead: old.isRead,
          readAt: old.readAt,
          proposalId: old.proposalId,
          createdAt: old.createdAt,
          metadata: {
            migratedFrom: 'proposal_notifications',
            originalId: old.id,
          },
        },
      });

      migratedCount++;
    }

    console.log('\n📊 KẾT QUẢ CHUYỂN ĐỔI DỮ LIỆU:');
    console.log(`   - Đã chuyển đổi thành công: ${migratedCount} thông báo`);
    console.log(`   - Bỏ qua do đã tồn tại:   ${skippedCount} thông báo`);
    console.log(`   - Tổng số thông báo cũ:     ${oldNotifications.length}`);

    // Kiểm tra tổng số bản ghi trong bảng mới
    const totalNew = await prisma.notification.count();
    console.log(`\n🎉 Bảng 'notifications' hiện có tổng cộng: ${totalNew} bản ghi.`);
  } catch (error) {
    console.error('❌ Lỗi trong quá trình migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
