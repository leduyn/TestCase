import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/database';
import { ProposalTypeService } from '../services/proposalTypeService';
import { FormTemplateService } from '../services/formTemplateService';
import { ProposalService } from '../services/proposalService';
import { ProposalWorkflowService } from '../services/proposalWorkflowService';
import { ProposalReportService } from '../services/proposalReportService';

async function runStep3Tests() {
  console.log('🚀 Bắt đầu kiểm thử Bước 3: Backend Services, Controllers & Validation...');

  // 1. Setup users
  console.log('\n--- 1. Chuẩn bị Users ---');
  let testAdmin = await prisma.user.findFirst({ where: { email: 'admin_test_b3@test.com' } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        email: 'admin_test_b3@test.com',
        fullName: 'Admin Test B3',
        passwordHash: 'dummy_hash',
        role: 'ADMIN',
        department: 'BOD',
      },
    });
  }

  let testUser = await prisma.user.findFirst({ where: { email: 'user_test_b3@test.com' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'user_test_b3@test.com',
        fullName: 'User Test B3',
        passwordHash: 'dummy_hash',
        role: 'USER',
        department: 'Sales',
      },
    });
  }

  let testApprover = await prisma.user.findFirst({ where: { email: 'approver_test_b3@test.com' } });
  if (!testApprover) {
    testApprover = await prisma.user.create({
      data: {
        email: 'approver_test_b3@test.com',
        fullName: 'Approver Test B3',
        passwordHash: 'dummy_hash',
        role: 'MANAGER',
        department: 'Sales',
      },
    });
  }

  console.log(`✅ Users sẵn sàng: Admin (${testAdmin.id}), User (${testUser.id}), Approver (${testApprover.id})`);

  // 2. Test FormTemplateService
  console.log('\n--- 2. Kiểm thử FormTemplateService (CRUD, Duplicate, Fields) ---');
  const template = await FormTemplateService.createFormTemplate(
    {
      name: 'Form Đề xuất Công tác Test',
      description: 'Mẫu form đề xuất đi công tác ngắn ngày',
      fields: [
        {
          fieldKey: 'destination',
          fieldLabel: 'Địa điểm công tác',
          fieldType: 'text',
          isRequired: true,
          order: 1,
        },
        {
          fieldKey: 'days',
          fieldLabel: 'Số ngày',
          fieldType: 'number',
          isRequired: true,
          order: 2,
        },
      ],
    },
    testAdmin.id
  );

  console.log(`- Đã tạo Form Template: ID = ${template?.id}, Fields = ${template?.fields.length}`);
  if (!template || template.fields.length !== 2) throw new Error('Tạo FormTemplate thất bại');

  // Thêm field
  const newField = await FormTemplateService.addField(
    template.id,
    {
      fieldKey: 'purpose',
      fieldLabel: 'Mục đích chuyến đi',
      fieldType: 'textarea',
      isRequired: false,
    },
    testAdmin.id
  );
  console.log(`- Đã thêm field mới: ID = ${newField.id}, Key = "${newField.fieldKey}"`);

  // Sắp xếp lại fields
  await FormTemplateService.reorderFields(template.id, [
    { id: newField.id, order: 1 },
    { id: template.fields[0].id, order: 2 },
    { id: template.fields[1].id, order: 3 },
  ]);
  console.log('- Đã sắp xếp lại thứ tự fields thành công');

  // Nhân bản form template
  const duplicatedTemplate = await FormTemplateService.duplicateFormTemplate(
    template.id,
    'Form Đề xuất Công tác (Copy)',
    testAdmin.id
  );
  console.log(`- Đã nhân bản Form Template: ID = ${duplicatedTemplate?.id}, Fields = ${duplicatedTemplate?.fields.length}`);
  if (!duplicatedTemplate || duplicatedTemplate.fields.length !== 3) throw new Error('Nhân bản FormTemplate thất bại');

  // 3. Test ProposalTypeService
  console.log('\n--- 3. Kiểm thử ProposalTypeService (CRUD, ToggleActive, Permissions) ---');
  const pType = await ProposalTypeService.createProposalType(
    {
      name: 'Đề xuất Công tác Nội địa',
      code: `BIZ_TRIP_${Date.now()}`,
      description: 'Quy trình xét duyệt công tác trong nước',
      icon: 'Plane',
      color: '#3B82F6',
      defaultApproverIds: [testApprover.id],
      approvalWorkflow: 'ANY_ONE',
      deadlineHours: 72,
      useCustomForm: true,
      formTemplateId: template.id,
      creatorDepartments: ['Sales', 'Marketing'],
      allowDraft: true,
      allowCancel: true,
    },
    testAdmin.id
  );

  console.log(`- Đã tạo ProposalType: ID = ${pType.id}, Code = "${pType.code}"`);

  // Cập nhật ProposalType
  const updatedType = await ProposalTypeService.updateProposalType(
    pType.id,
    { description: 'Quy trình xét duyệt công tác nội địa cập nhật' },
    testAdmin.id
  );
  console.log(`- Cập nhật mô tả: "${updatedType.description}"`);

  // Toggle active
  const toggled = await ProposalTypeService.toggleActive(pType.id, testAdmin.id);
  console.log(`- Toggle active: isActive = ${toggled.isActive}`);
  await ProposalTypeService.toggleActive(pType.id, testAdmin.id); // Bật lại

  // Lọc theo user (forCreation: user có department Sales)
  const typesForUser = await ProposalTypeService.getProposalTypes({
    forUser: { id: testUser.id, role: testUser.role, department: testUser.department },
    isActive: true,
  });
  const canUserSee = typesForUser.types.some((t) => t.id === pType.id);
  console.log(`- User department "Sales" nhìn thấy loại đề xuất: ${canUserSee}`);
  if (!canUserSee) throw new Error('Lọc theo phòng ban thất bại');

  // 4. Test ProposalService & User Dashboard
  console.log('\n--- 4. Kiểm thử ProposalService & Dashboard (Tạo nháp, cập nhật, gửi duyệt, bình luận) ---');
  // Tạo nháp
  const proposalDraft = await ProposalService.createProposal(
    {
      proposalTypeId: pType.id,
      title: 'Công tác chi nhánh TP.HCM tuần tới',
      content: 'Gặp gỡ khách hàng lớn',
      formData: {
        destination: 'TP. Hồ Chí Minh',
        days: 3,
        purpose: 'Ký kết hợp đồng đối tác',
      },
      priority: 'HIGH',
      isSubmit: false, // Lưu nháp
    },
    testUser.id
  );

  console.log(`- Tạo đề xuất DRAFT: ID = ${proposalDraft.id}, Status = ${proposalDraft.status}`);
  if (proposalDraft.status !== 'DRAFT') throw new Error('Proposal tạo ra phải là DRAFT');

  // Cập nhật nháp
  const updatedProposal = await ProposalService.updateProposal(
    proposalDraft.id,
    { title: 'Công tác chi nhánh TP.HCM 4 ngày' },
    testUser.id
  );
  console.log(`- Cập nhật tiêu đề: "${updatedProposal.title}"`);

  // Thêm bình luận
  const comment = await ProposalService.addComment(
    proposalDraft.id,
    testUser.id,
    'Lưu ý: Tôi sẽ di chuyển bằng máy bay chuyến sáng sớm.'
  );
  console.log(`- Đã thêm bình luận: ID = ${comment.id}, Nội dung = "${comment.content}"`);

  const comments = await ProposalService.getComments(proposalDraft.id);
  console.log(`- Số lượng bình luận: ${comments.length}`);
  if (comments.length !== 1) throw new Error('Số lượng bình luận không khớp');

  // Gửi duyệt (SUBMIT)
  const submitted = await ProposalWorkflowService.initializeApprovals(proposalDraft.id, testUser.id);
  console.log(`- Sau khi gửi duyệt: Status = ${submitted.proposal.status}`);
  if (submitted.proposal.status !== 'PENDING') throw new Error('Sau submit phải là PENDING');

  // Kiểm tra chi tiết và quyền canApprove
  const detail = await ProposalService.getProposalById(proposalDraft.id, testApprover.id);
  console.log(`- Approver xem chi tiết đề xuất: currentUserApproval.canApprove = ${detail.currentUserApproval.canApprove}`);
  if (!detail.currentUserApproval.canApprove) throw new Error('Approver phải có quyền canApprove = true');

  // Approver phê duyệt
  await ProposalWorkflowService.processDecision(
    proposalDraft.id,
    testApprover.id,
    'APPROVED',
    'Duyệt chuyến công tác',
    [],
    testApprover.id
  );

  const approvedDetail = await ProposalService.getProposalById(proposalDraft.id, testApprover.id);
  console.log(`- Trạng thái sau phê duyệt: ${approvedDetail.status}`);
  if (approvedDetail.status !== 'APPROVED') throw new Error('Trạng thái phải là APPROVED');

  // Kiểm tra lịch sử đề xuất
  const history = await ProposalService.getHistory(proposalDraft.id);
  console.log(`- Số mốc lịch sử ghi nhận: ${history.length} mốc`);
  if (history.length < 3) throw new Error('Lịch sử đề xuất phải ghi nhận >= 3 sự kiện (CREATED, SUBMITTED, APPROVED)');

  // 5. Test ProposalReportService
  console.log('\n--- 5. Kiểm thử ProposalReportService (Báo cáo & Thống kê) ---');
  const byTypeReport = await ProposalReportService.getProposalsByType();
  console.log(`- Báo cáo theo loại: Tổng ${byTypeReport.total} đề xuất`);

  const byStatusReport = await ProposalReportService.getProposalsByStatus();
  console.log(`- Báo cáo theo trạng thái: Tổng ${byStatusReport.total} đề xuất`);

  const byApproverReport = await ProposalReportService.getProposalsByApprover();
  console.log(`- Báo cáo theo người duyệt: ${byApproverReport.length} người duyệt`);

  const approvalTimeReport = await ProposalReportService.getApprovalTimeStats();
  console.log(`- Báo cáo thời gian duyệt trung bình: ${approvalTimeReport.avgHours} giờ (${approvalTimeReport.totalEvaluated} đề xuất đã hoàn tất)`);

  const overdueReport = await ProposalReportService.getOverdueProposals();
  console.log(`- Báo cáo quá hạn: ${overdueReport.total} đề xuất quá hạn`);

  // 6. Dọn dẹp dữ liệu test
  console.log('\n--- 6. Dọn dẹp dữ liệu test Bước 3 ---');
  await prisma.proposalNotification.deleteMany({ where: { proposalId: proposalDraft.id } });
  await prisma.proposalComment.deleteMany({ where: { proposalId: proposalDraft.id } });
  await prisma.proposalHistory.deleteMany({ where: { proposalId: proposalDraft.id } });
  await prisma.proposalApproval.deleteMany({ where: { proposalId: proposalDraft.id } });
  await prisma.proposal.deleteMany({ where: { id: proposalDraft.id } });

  await prisma.proposalType.deleteMany({ where: { formTemplateId: template.id } });
  await FormTemplateService.deleteFormTemplate(duplicatedTemplate.id);
  await FormTemplateService.deleteFormTemplate(template.id);

  console.log('✅ Đã dọn dẹp sạch dữ liệu test.');
  console.log('\n🎉 TOÀN BỘ CÁC DỊCH VỤ & LOGIC BƯỚC 3 ĐÃ VƯỢT QUA KIỂM THỬ THÀNH CÔNG 100%!');
}

runStep3Tests()
  .catch((err) => {
    console.error('❌ Lỗi kiểm thử Bước 3:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
