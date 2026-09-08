import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/database';
import { ProposalWorkflowService } from '../services/proposalWorkflowService';

async function runTests() {
  console.log('🚀 Bắt đầu kiểm thử ProposalWorkflowService (Bước 2)...');

  // 1. Chuẩn bị User test
  console.log('\n--- 1. Chuẩn bị Users test ---');
  let creator = await prisma.user.findFirst({ where: { email: 'creator_test@test.com' } });
  if (!creator) {
    creator = await prisma.user.create({
      data: {
        email: 'creator_test@test.com',
        fullName: 'Creator Test',
        passwordHash: 'dummy_hash',
        department: 'Engineering',
      },
    });
  }

  let approver1 = await prisma.user.findFirst({ where: { email: 'approver1_test@test.com' } });
  if (!approver1) {
    approver1 = await prisma.user.create({
      data: {
        email: 'approver1_test@test.com',
        fullName: 'Approver One',
        passwordHash: 'dummy_hash',
        department: 'Management',
      },
    });
  }

  let approver2 = await prisma.user.findFirst({ where: { email: 'approver2_test@test.com' } });
  if (!approver2) {
    approver2 = await prisma.user.create({
      data: {
        email: 'approver2_test@test.com',
        fullName: 'Approver Two',
        passwordHash: 'dummy_hash',
        department: 'HR',
      },
    });
  }

  console.log(`✅ Users: Creator (${creator.id}), Approver 1 (${approver1.id}), Approver 2 (${approver2.id})`);

  // 2. Kịch bản 1: PARALLEL Workflow
  console.log('\n--- 2. Kịch bản 1: PARALLEL Workflow (Duyệt đồng thời) ---');
  const parallelType = await prisma.proposalType.create({
    data: {
      name: 'Đề xuất Mua sắm (Parallel Test)',
      code: `PARALLEL_TEST_${Date.now()}`,
      approvalWorkflow: 'PARALLEL',
      defaultApproverIds: [approver1.id, approver2.id],
      deadlineHours: 48,
      createdById: creator.id,
    },
  });

  const parallelProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: parallelType.id,
      title: 'Yêu cầu cấp phát Laptop',
      content: 'Cần cấp Macbook Pro M3',
      creatorId: creator.id,
      createdById: creator.id,
      status: 'DRAFT',
    },
  });

  // Submit proposal
  await ProposalWorkflowService.initializeApprovals(parallelProposal.id, creator.id);
  let p1 = await prisma.proposal.findUnique({ where: { id: parallelProposal.id } });
  console.log(`- Sau khi gửi: status = ${p1?.status} (kỳ vọng: PENDING)`);
  if (p1?.status !== 'PENDING') throw new Error('Trạng thái sau submit phải là PENDING');

  // Approver 1 duyệt
  await ProposalWorkflowService.processDecision(parallelProposal.id, approver1.id, 'APPROVED', 'Đồng ý cấp thiết bị', [], approver1.id);
  p1 = await prisma.proposal.findUnique({ where: { id: parallelProposal.id } });
  console.log(`- Sau khi Approver 1 duyệt: status = ${p1?.status} (kỳ vọng: IN_REVIEW)`);
  if (p1?.status !== 'IN_REVIEW') throw new Error('Trạng thái sau khi 1 người duyệt phải là IN_REVIEW');

  // Approver 2 duyệt
  await ProposalWorkflowService.processDecision(parallelProposal.id, approver2.id, 'APPROVED', 'Duyệt cấp ngân sách', [], approver2.id);
  p1 = await prisma.proposal.findUnique({ where: { id: parallelProposal.id } });
  console.log(`- Sau khi Approver 2 duyệt: status = ${p1?.status} (kỳ vọng: APPROVED)`);
  if (p1?.status !== 'APPROVED') throw new Error('Trạng thái sau khi tất cả duyệt phải là APPROVED');
  console.log('✅ Kịch bản 1 (PARALLEL) thành công!');

  // 3. Kịch bản 2: SEQUENTIAL Workflow
  console.log('\n--- 3. Kịch bản 2: SEQUENTIAL Workflow (Duyệt tuần tự) ---');
  const seqType = await prisma.proposalType.create({
    data: {
      name: 'Đề xuất Nghỉ phép (Sequential Test)',
      code: `SEQ_TEST_${Date.now()}`,
      approvalWorkflow: 'SEQUENTIAL',
      defaultApproverIds: [approver1.id, approver2.id],
      deadlineHours: 24,
      createdById: creator.id,
    },
  });

  const seqProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: seqType.id,
      title: 'Xin nghỉ phép thường niên',
      content: 'Nghỉ 3 ngày từ thứ 2',
      creatorId: creator.id,
      createdById: creator.id,
      status: 'DRAFT',
    },
  });

  await ProposalWorkflowService.initializeApprovals(seqProposal.id, creator.id);

  // Thử duyệt vượt cấp: Approver 2 duyệt trước Approver 1
  let blockedOutOfOrder = false;
  try {
    await ProposalWorkflowService.processDecision(seqProposal.id, approver2.id, 'APPROVED', 'Duyệt trước', [], approver2.id);
  } catch (err: any) {
    if (err.message.includes('Chưa đến lượt')) {
      blockedOutOfOrder = true;
    } else {
      throw err;
    }
  }
  console.log(`- Approver 2 duyệt trước: chặn thành công = ${blockedOutOfOrder}`);
  if (!blockedOutOfOrder) throw new Error('Hệ thống phải chặn duyệt vượt cấp trong SEQUENTIAL');

  // canUserApprove check
  const checkApp2 = await ProposalWorkflowService.canUserApprove(seqProposal.id, approver2.id);
  console.log(`- canUserApprove(Approver 2): canApprove = ${checkApp2.canApprove} (kỳ vọng: false, reason: "${checkApp2.reason}")`);
  if (checkApp2.canApprove) throw new Error('canUserApprove phải trả về false cho Approver 2 khi chưa tới lượt');

  const checkApp1 = await ProposalWorkflowService.canUserApprove(seqProposal.id, approver1.id);
  console.log(`- canUserApprove(Approver 1): canApprove = ${checkApp1.canApprove} (kỳ vọng: true)`);
  if (!checkApp1.canApprove) throw new Error('canUserApprove phải trả về true cho Approver 1');

  // Approver 1 duyệt
  await ProposalWorkflowService.processDecision(seqProposal.id, approver1.id, 'APPROVED', 'Leader duyệt', [], approver1.id);
  let p2 = await prisma.proposal.findUnique({ where: { id: seqProposal.id } });
  console.log(`- Sau khi Approver 1 duyệt: status = ${p2?.status} (kỳ vọng: IN_REVIEW)`);
  if (p2?.status !== 'IN_REVIEW') throw new Error('Trạng thái phải là IN_REVIEW');

  // Giờ Approver 2 duyệt
  await ProposalWorkflowService.processDecision(seqProposal.id, approver2.id, 'APPROVED', 'HR duyệt', [], approver2.id);
  p2 = await prisma.proposal.findUnique({ where: { id: seqProposal.id } });
  console.log(`- Sau khi Approver 2 duyệt: status = ${p2?.status} (kỳ vọng: APPROVED)`);
  if (p2?.status !== 'APPROVED') throw new Error('Trạng thái phải là APPROVED');
  console.log('✅ Kịch bản 2 (SEQUENTIAL) thành công!');

  // 4. Kịch bản 3: ANY_ONE Workflow & Rejection
  console.log('\n--- 4. Kịch bản 3: ANY_ONE Workflow & Từ chối ---');
  const anyType = await prisma.proposalType.create({
    data: {
      name: 'Đề xuất Chi tiêu khẩn (AnyOne Test)',
      code: `ANY_TEST_${Date.now()}`,
      approvalWorkflow: 'ANY_ONE',
      defaultApproverIds: [approver1.id, approver2.id],
      deadlineHours: 12,
      createdById: creator.id,
    },
  });

  const anyProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: anyType.id,
      title: 'Chi phí mua thiết bị khẩn cấp',
      creatorId: creator.id,
      createdById: creator.id,
      status: 'DRAFT',
    },
  });

  await ProposalWorkflowService.initializeApprovals(anyProposal.id, creator.id);

  // Từ chối không có lý do -> phải lỗi
  let rejectedWithoutReason = false;
  try {
    await ProposalWorkflowService.processDecision(anyProposal.id, approver1.id, 'REJECTED', '', [], approver1.id);
  } catch (err: any) {
    if (err.message.includes('lý do từ chối')) {
      rejectedWithoutReason = true;
    }
  }
  console.log(`- Từ chối không lý do: chặn thành công = ${rejectedWithoutReason}`);
  if (!rejectedWithoutReason) throw new Error('Bắt buộc phải có lý do khi từ chối');

  // Từ chối có lý do
  await ProposalWorkflowService.processDecision(anyProposal.id, approver1.id, 'REJECTED', 'Ngân sách không đủ', [], approver1.id);
  const p3 = await prisma.proposal.findUnique({
    where: { id: anyProposal.id },
    include: { approvals: true },
  });
  console.log(`- Sau khi Approver 1 từ chối: status = ${p3?.status} (kỳ vọng: REJECTED)`);
  if (p3?.status !== 'REJECTED') throw new Error('Trạng thái phải là REJECTED');

  const app2Action = p3?.approvals.find((a) => a.approverId === approver2.id)?.action;
  console.log(`- Trạng thái Approver 2 trong ANY_ONE: action = ${app2Action} (kỳ vọng: SKIPPED)`);
  if (app2Action !== 'SKIPPED') throw new Error('Approver 2 phải chuyển thành SKIPPED');
  console.log('✅ Kịch bản 3 (ANY_ONE) thành công!');

  // 5. Kịch bản 4: Tích hợp Workflow Engine
  console.log('\n--- 5. Kịch bản 4: Tích hợp Workflow Engine (Tự động sinh Task) ---');
  // Tạo quy trình Process test
  const testProcess = await prisma.process.create({
    data: {
      name: 'Quy trình Cấp phát Tài sản Test',
      managerId: creator.id,
      createdById: creator.id,
      steps: {
        create: [
          {
            name: 'Chuẩn bị thiết bị',
            order: 1,
            timeLimitHours: 24,
            executorIds: [approver1.id],
            createdById: creator.id,
          },
        ],
      },
      customFields: {
        create: [
          {
            fieldKey: 'device_name',
            fieldLabel: 'Tên thiết bị',
            fieldType: 'text',
            isRequired: true,
            order: 1,
            createdById: creator.id,
          },
          {
            fieldKey: 'estimated_cost',
            fieldLabel: 'Dự toán chi phí',
            fieldType: 'number',
            isRequired: false,
            order: 2,
            createdById: creator.id,
          },
        ],
      },
    },
    include: { steps: true, customFields: true },
  });

  const wfType = await prisma.proposalType.create({
    data: {
      name: 'Đề xuất Mua sắm liên kết Quy trình',
      code: `WF_LINK_TEST_${Date.now()}`,
      approvalWorkflow: 'ANY_ONE',
      defaultApproverIds: [approver1.id],
      linkedProcessId: testProcess.id,
      autoStartWorkflow: true,
      createdById: creator.id,
    },
  });

  const wfProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: wfType.id,
      title: 'Mua màn hình Dell UltraSharp 27 inch',
      content: 'Cần trang bị thêm màn hình cho dev',
      creatorId: creator.id,
      createdById: creator.id,
      formData: {
        device_name: 'Dell UltraSharp U2723QE',
        estimated_cost: 14500000,
      },
      status: 'DRAFT',
    },
  });

  await ProposalWorkflowService.initializeApprovals(wfProposal.id, creator.id);

  // Phê duyệt -> tự động sinh Task trong Workflow
  await ProposalWorkflowService.processDecision(wfProposal.id, approver1.id, 'APPROVED', 'Đã duyệt mua', [], approver1.id);

  const updatedWfProposal = await prisma.proposal.findUnique({
    where: { id: wfProposal.id },
  });
  console.log(`- linkedTaskId trên Proposal: ${updatedWfProposal?.linkedTaskId}`);
  if (!updatedWfProposal?.linkedTaskId) throw new Error('Proposal chưa được gán linkedTaskId');

  const createdTask = await prisma.task.findUnique({
    where: { id: updatedWfProposal.linkedTaskId },
    include: {
      customFieldValues: true,
      histories: true,
    },
  });
  console.log(`- Task đã sinh: ID = ${createdTask?.id}, Name = "${createdTask?.name}", Status = ${createdTask?.status}`);
  console.log(`- Task customFields:`, createdTask?.customFields);
  console.log(`- TaskCustomFieldValue count = ${createdTask?.customFieldValues.length} (kỳ vọng: 2)`);
  console.log(`- TaskHistory count = ${createdTask?.histories.length} (kỳ vọng: >= 1)`);

  if (!createdTask) throw new Error('Không tìm thấy Task được tạo');
  if (createdTask.status !== 'IN_PROGRESS') throw new Error('Task phải có status IN_PROGRESS');
  if (createdTask.customFieldValues.length !== 2) throw new Error('Phải tạo 2 bản ghi TaskCustomFieldValue tương ứng');
  if (createdTask.histories.length === 0) throw new Error('Task phải có lịch sử khởi tạo');

  const historyWf = await prisma.proposalHistory.findFirst({
    where: { proposalId: wfProposal.id, changeType: 'WORKFLOW_STARTED' },
  });
  console.log(`- ProposalHistory WORKFLOW_STARTED ghi nhận: "${historyWf?.changeDescription}"`);
  if (!historyWf) throw new Error('ProposalHistory phải có bản ghi WORKFLOW_STARTED');
  console.log('✅ Kịch bản 4 (Tích hợp Workflow) thành công!');

  // 6. Kịch bản 5: Hủy đề xuất (cancelProposal)
  console.log('\n--- 6. Kịch bản 5: Hủy đề xuất (cancelProposal) ---');
  const cancelProposal = await prisma.proposal.create({
    data: {
      proposalTypeId: parallelType.id,
      title: 'Đề xuất chuẩn bị hủy',
      creatorId: creator.id,
      createdById: creator.id,
      status: 'DRAFT',
    },
  });

  await ProposalWorkflowService.initializeApprovals(cancelProposal.id, creator.id);
  await ProposalWorkflowService.cancelProposal(cancelProposal.id, creator.id, 'Không cần mua nữa');

  const cancelledP = await prisma.proposal.findUnique({
    where: { id: cancelProposal.id },
    include: { approvals: true, histories: true },
  });
  console.log(`- Trạng thái đề xuất sau hủy: status = ${cancelledP?.status} (kỳ vọng: CANCELLED)`);
  const allCancelledApprovals = cancelledP?.approvals.every((a) => a.action === 'CANCELLED');
  console.log(`- Tất cả approvals đã CANCELLED: ${allCancelledApprovals}`);
  const cancelHistory = cancelledP?.histories.find((h) => h.changeType === 'CANCELLED');
  console.log(`- Lịch sử CANCELLED: "${cancelHistory?.changeDescription}"`);

  if (cancelledP?.status !== 'CANCELLED') throw new Error('Status phải là CANCELLED');
  if (!allCancelledApprovals) throw new Error('Tất cả pending approvals phải đổi sang CANCELLED');
  console.log('✅ Kịch bản 5 (Hủy đề xuất) thành công!');

  // Dọn dẹp dữ liệu test
  console.log('\n--- 7. Dọn dẹp dữ liệu test ---');
  await prisma.taskCustomFieldValue.deleteMany({ where: { taskId: createdTask.id } });
  await prisma.taskHistory.deleteMany({ where: { taskId: createdTask.id } });
  await prisma.task.deleteMany({ where: { id: createdTask.id } });
  await prisma.customFieldDefinition.deleteMany({ where: { processId: testProcess.id } });
  await prisma.processStep.deleteMany({ where: { processId: testProcess.id } });
  await prisma.process.deleteMany({ where: { id: testProcess.id } });

  const testProposalIds = [parallelProposal.id, seqProposal.id, anyProposal.id, wfProposal.id, cancelProposal.id];
  await prisma.proposalNotification.deleteMany({ where: { proposalId: { in: testProposalIds } } });
  await prisma.proposalHistory.deleteMany({ where: { proposalId: { in: testProposalIds } } });
  await prisma.proposalApproval.deleteMany({ where: { proposalId: { in: testProposalIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: testProposalIds } } });

  const testTypeIds = [parallelType.id, seqType.id, anyType.id, wfType.id];
  await prisma.proposalType.deleteMany({ where: { id: { in: testTypeIds } } });

  console.log('✅ Đã dọn dẹp sạch dữ liệu test.');
  console.log('\n🎉 TOÀN BỘ CÁC KỊCH BẢN BƯỚC 2 ĐÃ VƯỢT QUA KIỂM THỬ THÀNH CÔNG 100%!');
}

runTests()
  .catch((err) => {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
