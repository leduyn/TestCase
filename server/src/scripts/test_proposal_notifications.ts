import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/database';
import { ProposalNotificationService } from '../services/proposalNotificationService';
import { ProposalWorkflowService } from '../services/proposalWorkflowService';
import { CronService } from '../services/cronService';

async function runStep4Tests() {
  console.log('🚀 Bắt đầu kiểm thử Bước 4: Backend Notification & Scheduler...');

  // 1. Setup Users
  console.log('\n--- 1. Chuẩn bị Users ---');
  let user = await prisma.user.findFirst({ where: { email: 'notif_user@test.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'notif_user@test.com',
        fullName: 'Notification Test User',
        passwordHash: 'dummy_hash',
        role: 'USER',
      },
    });
  }

  let approver = await prisma.user.findFirst({ where: { email: 'notif_approver@test.com' } });
  if (!approver) {
    approver = await prisma.user.create({
      data: {
        email: 'notif_approver@test.com',
        fullName: 'Notification Test Approver',
        passwordHash: 'dummy_hash',
        role: 'MANAGER',
      },
    });
  }

  console.log(`✅ Users: User (${user.id}), Approver (${approver.id})`);

  // Tạo ProposalType test
  const pType = await prisma.proposalType.create({
    data: {
      name: 'Loại Đề xuất Hạn chót Test',
      code: `DEADLINE_TEST_${Date.now()}`,
      defaultApproverIds: [approver.id],
      approvalWorkflow: 'PARALLEL',
      createdById: user.id,
    },
  });

  // 2. Kiểm thử ProposalNotification CRUD & Unread Count
  console.log('\n--- 2. Kiểm thử ProposalNotificationService CRUD & Unread Count ---');
  const dummyProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: pType.id,
      title: 'Đề xuất kiểm thử thông báo',
      creatorId: user.id,
      status: 'DRAFT',
    },
  });

  // Tạo notification
  const notif1 = await ProposalNotificationService.createNotification({
    proposalId: dummyProposal.id,
    recipientId: user.id,
    type: 'SUBMITTED',
    title: 'Thông báo 1: Đề xuất đã được gửi',
    content: 'Chi tiết đề xuất đã được gửi',
  });

  const notif2 = await ProposalNotificationService.createNotification({
    proposalId: dummyProposal.id,
    recipientId: user.id,
    type: 'COMMENT',
    title: 'Thông báo 2: Có bình luận mới',
    content: 'Ai đó đã bình luận vào đề xuất',
  });

  console.log(`- Đã tạo 2 thông báo: Notif1 (${notif1.id}), Notif2 (${notif2.id})`);

  // Kiểm tra số lượng chưa đọc
  let unreadCount = await ProposalNotificationService.getUnreadCount(user.id);
  console.log(`- Số thông báo chưa đọc: ${unreadCount} (kỳ vọng >= 2)`);
  if (unreadCount < 2) throw new Error('Unread count không đúng');

  // Đánh dấu 1 thông báo đã đọc
  await ProposalNotificationService.markAsRead(notif1.id, user.id);
  const notif1Updated = await prisma.proposalNotification.findUnique({ where: { id: notif1.id } });
  console.log(`- Notif1 isRead sau markAsRead: ${notif1Updated?.isRead} (kỳ vọng: true)`);
  if (!notif1Updated?.isRead) throw new Error('markAsRead thất bại');

  // Đánh dấu tất cả đã đọc
  await ProposalNotificationService.markAllAsRead(user.id);
  unreadCount = await ProposalNotificationService.getUnreadCount(user.id);
  console.log(`- Số thông báo chưa đọc sau markAllAsRead: ${unreadCount} (kỳ vọng: 0)`);
  if (unreadCount !== 0) throw new Error('markAllAsRead thất bại');

  // 3. Kiểm thử Scheduler: Quá hạn (EXPIRED)
  console.log('\n--- 3. Kiểm thử Scheduler: Quá hạn (EXPIRED) ---');
  const pastDate = new Date();
  pastDate.setHours(pastDate.getHours() - 2); // Quá hạn 2 tiếng trước

  const expiredProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: pType.id,
      title: 'Đề xuất cần hết hạn tự động',
      creatorId: user.id,
      status: 'PENDING',
      submittedAt: new Date(Date.now() - 24 * 3600 * 1000),
      deadline: pastDate,
      approvals: {
        create: [
          {
            approverId: approver.id,
            order: 1,
            action: 'PENDING',
          },
        ],
      },
    },
  });

  // Chạy checkDeadlines
  const checkResult = await ProposalNotificationService.checkDeadlines();
  console.log(`- Kết quả checkDeadlines: Đã hết hạn = ${checkResult.expired}`);

  const pAfterCheck = await prisma.proposal.findUnique({
    where: { id: expiredProposal.id },
    include: { approvals: true, histories: true },
  });

  console.log(`- Trạng thái đề xuất sau quét deadline: ${pAfterCheck?.status} (kỳ vọng: EXPIRED)`);
  if (pAfterCheck?.status !== 'EXPIRED') throw new Error('Đề xuất quá hạn phải chuyển sang EXPIRED');

  const approvalAction = pAfterCheck?.approvals[0]?.action;
  console.log(`- Trạng thái lượt duyệt: ${approvalAction} (kỳ vọng: CANCELLED)`);
  if (approvalAction !== 'CANCELLED') throw new Error('Lượt duyệt của đề xuất hết hạn phải chuyển sang CANCELLED');

  const expiredHistory = pAfterCheck?.histories.find((h) => h.changeType === 'CANCELLED');
  console.log(`- Lịch sử ghi nhận hết hạn: "${expiredHistory?.changeDescription}"`);
  if (!expiredHistory) throw new Error('Phải có lịch sử CANCELLED');

  const creatorExpiredNotif = await prisma.proposalNotification.findFirst({
    where: { proposalId: expiredProposal.id, recipientId: user.id, type: 'REMINDER' },
  });
  console.log(`- Người tạo nhận thông báo hết hạn: "${creatorExpiredNotif?.title}"`);
  if (!creatorExpiredNotif) throw new Error('Người tạo phải nhận thông báo hết hạn');

  // 4. Kiểm thử Scheduler: Nhắc nhở sắp hết hạn (75% - 90%)
  console.log('\n--- 4. Kiểm thử Scheduler: Nhắc nhở sắp hết hạn (Reminder Escalation) ---');
  const submittedAt = new Date(Date.now() - 8 * 3600 * 1000); // Đã trôi qua 8 giờ
  const deadline = new Date(Date.now() + 2 * 3600 * 1000); // Hết hạn sau 2 giờ nữa (tổng 10 giờ, trôi qua 80%)

  const remindingProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: pType.id,
      title: 'Đề xuất cần nhắc nhở hạn chót',
      creatorId: user.id,
      status: 'PENDING',
      submittedAt,
      deadline,
      approvals: {
        create: [
          {
            approverId: approver.id,
            order: 1,
            action: 'PENDING',
            reminderCount: 0,
          },
        ],
      },
    },
  });

  const remindResult = await ProposalNotificationService.checkDeadlines();
  console.log(`- Số nhắc nhở đã gửi: ${remindResult.remindersSent} (kỳ vọng >= 1)`);

  const updatedApproval = await prisma.proposalApproval.findFirst({
    where: { proposalId: remindingProposal.id, approverId: approver.id },
  });
  console.log(`- reminderCount sau quét: ${updatedApproval?.reminderCount} (kỳ vọng >= 1)`);
  if (!updatedApproval || updatedApproval.reminderCount < 1) throw new Error('reminderCount phải được tăng lên');

  const reminderNotif = await prisma.proposalNotification.findFirst({
    where: { proposalId: remindingProposal.id, recipientId: approver.id, type: 'REMINDER' },
  });
  console.log(`- Nội dung nhắc nhở: "${reminderNotif?.content}"`);
  if (!reminderNotif) throw new Error('Người duyệt phải nhận được thông báo nhắc nhở');

  // 5. Kiểm thử CronService tích hợp
  console.log('\n--- 5. Kiểm thử CronService.checkProposalDeadlines ---');
  await CronService.checkProposalDeadlines();
  console.log('✅ CronService.checkProposalDeadlines thực thi bình thường không lỗi.');

  // 6. Dọn dẹp dữ liệu test
  console.log('\n--- 6. Dọn dẹp dữ liệu test Bước 4 ---');
  const testProposalIds = [dummyProposal.id, expiredProposal.id, remindingProposal.id];
  await prisma.proposalNotification.deleteMany({ where: { proposalId: { in: testProposalIds } } });
  await prisma.proposalHistory.deleteMany({ where: { proposalId: { in: testProposalIds } } });
  await prisma.proposalApproval.deleteMany({ where: { proposalId: { in: testProposalIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: testProposalIds } } });
  await prisma.proposalType.deleteMany({ where: { id: pType.id } });

  console.log('✅ Đã dọn dẹp sạch dữ liệu test Bước 4.');
  console.log('\n🎉 TOÀN BỘ CÁC DỊCH VỤ & SCHEDULER BƯỚC 4 ĐÃ VƯỢT QUA KIỂM THỬ THÀNH CÔNG 100%!');
}

runStep4Tests()
  .catch((err) => {
    console.error('❌ Lỗi kiểm thử Bước 4:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
