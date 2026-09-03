import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { Role, TaskStatus, TaskHistoryChangeType, Prisma } from '@prisma/client';

export const SEED_USERS = [
  {
    email: 'it@tanthinh68.vn',
    fullName: 'Lê Đuyn (Admin)',
    password: '123456',
    role: Role.ADMIN,
  },
  {
    email: 'manager@tanthinh68.vn',
    fullName: 'Trần Quản Lý (Manager)',
    password: '123456',
    role: Role.MANAGER,
  },
  {
    email: 'user1@tanthinh68.vn',
    fullName: 'Nguyễn Nhân Viên 1',
    password: '123456',
    role: Role.USER,
  },
  {
    email: 'user2@tanthinh68.vn',
    fullName: 'Phạm Nhân Viên 2',
    password: '123456',
    role: Role.USER,
  },
  {
    email: 'tester@tanthinh68.vn',
    fullName: 'Hoàng Tester',
    password: '123456',
    role: Role.TESTER,
  },
];

/**
 * Helper tạo snapshot cho Task tại thời điểm ghi log
 */
async function createTaskSnapshot(taskId: string) {
  const fullTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      process: {
        select: { id: true, name: true },
      },
      currentStep: true,
      todos: true,
      comments: {
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      customFieldValues: {
        include: {
          fieldDefinition: true,
          filledBy: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });

  return fullTask ? JSON.parse(JSON.stringify(fullTask)) : {};
}

/**
 * Khởi tạo dữ liệu mẫu cho hệ thống Workflow & Task Management
 */
export async function ensureWorkflowSeed(): Promise<void> {
  console.log('🔄 [Workflow-Seed] Bắt đầu khởi tạo dữ liệu mẫu Workflow...');

  try {
    // 1. Tạo / Cập nhật Users
    const userMap: Record<string, any> = {};
    for (const u of SEED_USERS) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          fullName: u.fullName,
          passwordHash,
          role: u.role,
          status: 'ACTIVE',
        },
        create: {
          email: u.email,
          fullName: u.fullName,
          passwordHash,
          role: u.role,
          status: 'ACTIVE',
        },
      });
      userMap[u.email] = user;
    }
    console.log(`👤 [Workflow-Seed] Đã đồng bộ ${SEED_USERS.length} người dùng mẫu.`);

    const admin = userMap['it@tanthinh68.vn'];
    const manager = userMap['manager@tanthinh68.vn'];
    const user1 = userMap['user1@tanthinh68.vn'];
    const user2 = userMap['user2@tanthinh68.vn'];
    const tester = userMap['tester@tanthinh68.vn'];

    // 2. Tạo Quy trình 1: Phê duyệt hợp đồng
    let contractProcess = await prisma.process.findFirst({
      where: { name: 'Quy trình Phê duyệt hợp đồng', deletedAt: null },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!contractProcess) {
      contractProcess = await prisma.process.create({
        data: {
          name: 'Quy trình Phê duyệt hợp đồng',
          description:
            'Quy trình chuẩn kiểm duyệt, thẩm định pháp lý và ký duyệt hợp đồng kinh tế của công ty.',
          managerId: manager.id,
          watcherIds: [admin.id],
          createdById: admin.id,
          steps: {
            create: [
              {
                name: 'Soạn thảo hợp đồng',
                order: 1,
                timeLimitHours: 24,
                instructions:
                  'Soạn thảo nội dung bản thảo hợp đồng đầy đủ điều khoản, phụ lục và biểu mẫu chi phí kèm theo.',
                executorIds: [user1.id],
                createdById: admin.id,
              },
              {
                name: 'Thẩm định pháp lý & tài chính',
                order: 2,
                timeLimitHours: 48,
                instructions:
                  'Kiểm tra tính pháp lý, rủi ro điều khoản phạt hợp đồng và kế hoạch dòng tiền thanh toán.',
                executorIds: [manager.id],
                createdById: admin.id,
              },
              {
                name: 'Ký duyệt & Đóng dấu hợp đồng',
                order: 3,
                timeLimitHours: 24,
                instructions:
                  'Ban Giám đốc ký duyệt và bộ phận văn thư đóng dấu bản cứng hoặc chữ ký số Token.',
                executorIds: [admin.id],
                createdById: admin.id,
              },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      console.log('📋 [Workflow-Seed] Đã tạo quy trình: "Quy trình Phê duyệt hợp đồng"');
    }

    const cpSteps = contractProcess.steps;

    // Seed Custom Fields cho Quy trình Phê duyệt hợp đồng
    const contractFields = [
      {
        fieldKey: 'contract_type',
        fieldLabel: 'Loại hợp đồng',
        fieldType: 'select',
        stepId: cpSteps[0]?.id || null,
        fieldConfig: {
          options: [
            { label: 'Hợp đồng mua bán', value: 'purchase' },
            { label: 'Hợp đồng dịch vụ', value: 'service' },
            { label: 'Hợp đồng lao động', value: 'labor' },
            { label: 'Hợp đồng thuê ngoài', value: 'outsourcing' },
          ],
        },
        isRequired: true,
        order: 1,
      },
      {
        fieldKey: 'contract_value',
        fieldLabel: 'Giá trị hợp đồng (trước thuế)',
        fieldType: 'number',
        stepId: cpSteps[0]?.id || null,
        fieldConfig: {
          min: 0,
          max: 10000000000,
          step: 1000000,
          unit: 'VNĐ',
        },
        isRequired: true,
        order: 2,
      },
      {
        fieldKey: 'partner_info',
        fieldLabel: 'Thông tin đối tác / Khách hàng',
        fieldType: 'textarea',
        stepId: cpSteps[0]?.id || null,
        fieldConfig: { rows: 4, max_length: 1000 },
        placeholder: 'Tên công ty, Mã số thuế, Người đại diện pháp luật...',
        order: 3,
      },
      {
        fieldKey: 'contract_file',
        fieldLabel: 'Tệp hợp đồng dự thảo',
        fieldType: 'file',
        stepId: cpSteps[0]?.id || null,
        fieldConfig: { accepted_types: ['pdf', 'doc', 'docx'], max_size_mb: 20 },
        isRequired: true,
        order: 4,
      },
      {
        fieldKey: 'approval_result',
        fieldLabel: 'Kết quả thẩm định',
        fieldType: 'radio',
        stepId: cpSteps[1]?.id || null,
        fieldConfig: {
          options: [
            { label: 'Đồng ý thông qua', value: 'approved' },
            { label: 'Từ chối phê duyệt', value: 'rejected' },
            { label: 'Cần sửa đổi bổ sung', value: 'revision' },
          ],
        },
        isRequired: true,
        order: 1,
      },
      {
        fieldKey: 'reject_reason',
        fieldLabel: 'Lý do từ chối / Yêu cầu sửa đổi',
        fieldType: 'textarea',
        stepId: cpSteps[1]?.id || null,
        visibilityCondition: {
          field: 'approval_result',
          operator: 'equals',
          value: 'rejected',
        },
        order: 2,
      },
      {
        fieldKey: 'approval_rating',
        fieldLabel: 'Đánh giá mức độ khả thi',
        fieldType: 'rating',
        stepId: cpSteps[1]?.id || null,
        fieldConfig: { max_stars: 5 },
        order: 3,
      },
      {
        fieldKey: 'total_contract_with_vat',
        fieldLabel: 'Tổng thanh toán (gồm 10% VAT)',
        fieldType: 'formula',
        stepId: null, // Áp dụng toàn bộ bước
        fieldConfig: {
          expression: 'contract_value * 1.1',
          decimal_places: 0,
        },
        helpText: 'Tự động tính từ Giá trị hợp đồng + 10% VAT',
        order: 10,
      },
    ];

    for (const cf of contractFields) {
      await prisma.customFieldDefinition.upsert({
        where: {
          processId_fieldKey: {
            processId: contractProcess.id,
            fieldKey: cf.fieldKey,
          },
        },
        update: {
          fieldLabel: cf.fieldLabel,
          fieldType: cf.fieldType,
          stepId: cf.stepId,
          fieldConfig: cf.fieldConfig || {},
          isRequired: !!cf.isRequired,
          visibilityCondition: cf.visibilityCondition ? cf.visibilityCondition : Prisma.DbNull,
          helpText: cf.helpText || null,
          order: cf.order,
          updatedById: admin.id,
        },
        create: {
          processId: contractProcess.id,
          stepId: cf.stepId,
          fieldKey: cf.fieldKey,
          fieldLabel: cf.fieldLabel,
          fieldType: cf.fieldType,
          fieldConfig: cf.fieldConfig || {},
          isRequired: !!cf.isRequired,
          visibilityCondition: cf.visibilityCondition ? cf.visibilityCondition : Prisma.DbNull,
          helpText: cf.helpText || null,
          order: cf.order,
          createdById: admin.id,
        },
      });
    }
    console.log(`🧩 [Workflow-Seed] Đã tạo ${contractFields.length} Custom Fields cho "Quy trình Phê duyệt hợp đồng"`);

    // 3. Tạo Quy trình 2: Xử lý sự cố kỹ thuật
    let incidentProcess = await prisma.process.findFirst({
      where: { name: 'Quy trình Xử lý sự cố kỹ thuật', deletedAt: null },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!incidentProcess) {
      incidentProcess = await prisma.process.create({
        data: {
          name: 'Quy trình Xử lý sự cố kỹ thuật',
          description:
            'Quy trình tiếp nhận, điều tra nguyên nhân gốc rễ (RCA), khắc phục và nghiệm thu sự cố hệ thống hạ tầng / phần mềm.',
          managerId: admin.id,
          watcherIds: [manager.id],
          createdById: admin.id,
          steps: {
            create: [
              {
                name: 'Tiếp nhận & Phân loại sự cố',
                order: 1,
                timeLimitHours: 4,
                instructions:
                  'Ghi nhận mức độ ảnh hưởng (Severity), thu thập log hệ thống và phân công kỹ sư phụ trách.',
                executorIds: [admin.id, manager.id],
                createdById: admin.id,
              },
              {
                name: 'Khắc phục kỹ thuật',
                order: 2,
                timeLimitHours: 12,
                instructions:
                  'Điều tra nguyên nhân gốc, viết hotfix, kiểm thử trên môi trường Staging và deploy bản vá.',
                executorIds: [user2.id, tester.id],
                createdById: admin.id,
              },
              {
                name: 'Nghiệm thu & Đóng sự cố',
                order: 3,
                timeLimitHours: 8,
                instructions:
                  'Kiểm tra lại hệ thống sau bản vá, đánh giá SLA và xuất báo cáo sự cố (Post-Mortem).',
                executorIds: [tester.id],
                createdById: admin.id,
              },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      console.log('📋 [Workflow-Seed] Đã tạo quy trình: "Quy trình Xử lý sự cố kỹ thuật"');
    }

    const ipSteps = incidentProcess.steps;

    // 4. Tạo Quy trình 3: Tuyển dụng nhân sự
    let recruitProcess = await prisma.process.findFirst({
      where: { name: 'Quy trình Tuyển dụng nhân sự', deletedAt: null },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!recruitProcess) {
      recruitProcess = await prisma.process.create({
        data: {
          name: 'Quy trình Tuyển dụng nhân sự',
          description: 'Quy trình chuẩn sàng lọc hồ sơ, phỏng vấn chuyên môn và gửi offer thử việc cho ứng viên mới.',
          managerId: manager.id,
          watcherIds: [admin.id],
          createdById: admin.id,
          steps: {
            create: [
              {
                name: 'Tiếp nhận & Sàng lọc CV',
                order: 1,
                timeLimitHours: 24,
                instructions: 'Kiểm tra CV ứng viên, đánh giá kỹ năng và liên hệ xếp lịch phỏng vấn.',
                executorIds: [user1.id],
                createdById: admin.id,
              },
              {
                name: 'Phỏng vấn chuyên môn & Văn hóa',
                order: 2,
                timeLimitHours: 48,
                instructions: 'Phỏng vấn trực tiếp hoặc online qua Google Meet, đánh giá kỹ thuật và ghi chú chi tiết.',
                executorIds: [manager.id, admin.id],
                createdById: admin.id,
              },
              {
                name: 'Gửi Thư mời nhận việc (Offer Letter)',
                order: 3,
                timeLimitHours: 24,
                instructions: 'Trao đổi mức lương, gửi Offer Letter chính thức và chuẩn bị thủ tục Onboarding.',
                executorIds: [manager.id],
                createdById: admin.id,
              },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      console.log('📋 [Workflow-Seed] Đã tạo quy trình: "Quy trình Tuyển dụng nhân sự"');
    }

    const rpSteps = recruitProcess.steps;

    // Seed Custom Fields cho Quy trình Tuyển dụng nhân sự
    const recruitFields = [
      {
        fieldKey: 'candidate_name',
        fieldLabel: 'Họ và tên ứng viên',
        fieldType: 'text',
        stepId: rpSteps[0]?.id || null,
        isRequired: true,
        order: 1,
      },
      {
        fieldKey: 'position',
        fieldLabel: 'Vị trí ứng tuyển',
        fieldType: 'select',
        stepId: rpSteps[0]?.id || null,
        fieldConfig: {
          options: [
            { label: 'Frontend Developer', value: 'fe_dev' },
            { label: 'Backend Developer', value: 'be_dev' },
            { label: 'Fullstack Developer', value: 'fullstack' },
            { label: 'QA / Automation Tester', value: 'tester' },
            { label: 'Business Analyst (BA)', value: 'ba' },
            { label: 'Product Owner / PM', value: 'pm' },
          ],
        },
        isRequired: true,
        order: 2,
      },
      {
        fieldKey: 'cv_file',
        fieldLabel: 'Hồ sơ CV đính kèm',
        fieldType: 'multifile',
        stepId: rpSteps[0]?.id || null,
        fieldConfig: { accepted_types: ['pdf', 'doc', 'docx'], max_files: 3, max_size_mb: 10 },
        order: 3,
      },
      {
        fieldKey: 'skills',
        fieldLabel: 'Kỹ năng chuyên môn',
        fieldType: 'checkbox',
        stepId: rpSteps[0]?.id || null,
        fieldConfig: {
          options: [
            { label: 'React / Next.js', value: 'react' },
            { label: 'TypeScript / JavaScript', value: 'ts' },
            { label: 'Node.js / Express', value: 'node' },
            { label: 'PostgreSQL / Prisma', value: 'postgres' },
            { label: 'Docker / CI-CD', value: 'devops' },
            { label: 'Automated Testing', value: 'testing' },
          ],
        },
        order: 4,
      },
      {
        fieldKey: 'interviewer',
        fieldLabel: 'Người chủ trì phỏng vấn',
        fieldType: 'user',
        stepId: rpSteps[1]?.id || null,
        fieldConfig: { role_filter: ['ADMIN', 'MANAGER'] },
        order: 1,
      },
      {
        fieldKey: 'interview_score',
        fieldLabel: 'Điểm đánh giá chuyên môn',
        fieldType: 'slider',
        stepId: rpSteps[1]?.id || null,
        fieldConfig: { min: 0, max: 10, step: 0.5, unit: 'điểm' },
        defaultValue: 8,
        order: 2,
      },
      {
        fieldKey: 'interview_notes',
        fieldLabel: 'Ghi chú & Nhận xét phỏng vấn',
        fieldType: 'richtext',
        stepId: rpSteps[1]?.id || null,
        placeholder: 'Đánh giá tư duy giải thuật, kỹ năng giao tiếp và mức độ phù hợp văn hóa...',
        order: 3,
      },
      {
        fieldKey: 'interview_result',
        fieldLabel: 'Kết quả phỏng vấn (Pass/Fail)',
        fieldType: 'toggle',
        stepId: rpSteps[1]?.id || null,
        helpText: 'Bật nếu ứng viên đạt yêu cầu tuyển dụng',
        defaultValue: true,
        order: 4,
      },
      {
        fieldKey: 'salary_offer',
        fieldLabel: 'Mức lương thỏa thuận (Gross)',
        fieldType: 'number',
        stepId: rpSteps[2]?.id || null,
        fieldConfig: { min: 5000000, max: 100000000, step: 1000000, unit: 'VNĐ' },
        order: 1,
      },
    ];

    for (const rf of recruitFields) {
      await prisma.customFieldDefinition.upsert({
        where: {
          processId_fieldKey: {
            processId: recruitProcess.id,
            fieldKey: rf.fieldKey,
          },
        },
        update: {
          fieldLabel: rf.fieldLabel,
          fieldType: rf.fieldType,
          stepId: rf.stepId,
          fieldConfig: rf.fieldConfig || {},
          isRequired: !!rf.isRequired,
          defaultValue: rf.defaultValue !== undefined ? rf.defaultValue : Prisma.DbNull,
          helpText: rf.helpText || null,
          order: rf.order,
          updatedById: admin.id,
        },
        create: {
          processId: recruitProcess.id,
          stepId: rf.stepId,
          fieldKey: rf.fieldKey,
          fieldLabel: rf.fieldLabel,
          fieldType: rf.fieldType,
          fieldConfig: rf.fieldConfig || {},
          isRequired: !!rf.isRequired,
          defaultValue: rf.defaultValue !== undefined ? rf.defaultValue : Prisma.DbNull,
          helpText: rf.helpText || null,
          order: rf.order,
          createdById: admin.id,
        },
      });
    }
    console.log(`🧩 [Workflow-Seed] Đã tạo ${recruitFields.length} Custom Fields cho "Quy trình Tuyển dụng nhân sự"`);

    // 5. Tạo 5 Nhiệm vụ mẫu
    const now = Date.now();

    // Task 1: "Hợp đồng dịch vụ IT Tân Thịnh 2026" (IN_PROGRESS - Step 1)
    let task1 = await prisma.task.findFirst({
      where: { name: 'Hợp đồng dịch vụ IT Tân Thịnh 2026' },
    });
    if (!task1 && cpSteps[0]) {
      const task1Values = {
        contract_type: 'service',
        contract_value: 250000000,
        partner_info: 'Công ty Cổ phần Công nghệ ABC - MST: 0109988776. Đại diện: Nguyễn Văn Giám Đốc.',
        contract_file: {
          originalName: 'hop_dong_dich_vu_it_2026_draft.docx',
          filename: 'hop_dong_dich_vu_it_2026_draft.docx',
          storagePath: 'samples/hop_dong_dich_vu_it_2026_draft.docx',
          size: 1048576,
        },
        total_contract_with_vat: 275000000,
      };

      task1 = await prisma.task.create({
        data: {
          processId: contractProcess.id,
          name: 'Hợp đồng dịch vụ IT Tân Thịnh 2026',
          content: 'Soạn thảo hợp đồng bảo trì hạ tầng IT, Server và sao lưu dữ liệu cho năm tài chính 2026.',
          customFields: task1Values,
          currentStepId: cpSteps[0].id,
          executorIds: [user1.id],
          watcherIds: [manager.id],
          startedAt: new Date(now - 4 * 3600 * 1000),
          deadline: new Date(now + 20 * 3600 * 1000),
          status: TaskStatus.IN_PROGRESS,
          createdById: admin.id,
          updatedById: user1.id,
          todos: {
            create: [
              {
                description: 'Thu thập yêu cầu dịch vụ và thông số kỹ thuật từ đối tác',
                isCompleted: true,
                completedAt: new Date(now - 2 * 3600 * 1000),
                executorId: user1.id,
                createdById: user1.id,
              },
              {
                description: 'Soạn thảo điều khoản bảo mật thông tin (NDA) đính kèm',
                isCompleted: false,
                executorId: user1.id,
                createdById: user1.id,
              },
            ],
          },
          comments: {
            create: [
              {
                content: 'Đã hoàn tất bản phác thảo điều khoản thanh toán, đang đợi đối tác xác nhận phụ lục kỹ thuật.',
                userId: user1.id,
                createdById: user1.id,
              },
            ],
          },
        },
      });

      // Tạo TaskCustomFieldValues cho Task 1
      const cDefs = await prisma.customFieldDefinition.findMany({
        where: { processId: contractProcess.id },
      });
      for (const def of cDefs) {
        if (task1Values[def.fieldKey as keyof typeof task1Values] !== undefined) {
          await prisma.taskCustomFieldValue.create({
            data: {
              taskId: task1.id,
              fieldDefinitionId: def.id,
              value: task1Values[def.fieldKey as keyof typeof task1Values],
              stepId: def.stepId || cpSteps[0].id,
              filledById: user1.id,
              filledAt: new Date(),
            },
          });
        }
      }

      const snapshot1 = await createTaskSnapshot(task1.id);
      await prisma.taskHistory.create({
        data: {
          taskId: task1.id,
          version: 1,
          changedById: admin.id,
          changeType: TaskHistoryChangeType.CREATED,
          changeDescription: `Khởi tạo nhiệm vụ tại bước "${cpSteps[0].name}"`,
          snapshot: snapshot1,
          createdById: admin.id,
        },
      });
      console.log('📌 [Workflow-Seed] Đã tạo Task 1 (IN_PROGRESS - Step 1)');
    }

    // Task 2: "Hợp đồng cung cấp thiết bị phần cứng Q3" (IN_PROGRESS - Step 2)
    let task2 = await prisma.task.findFirst({
      where: { name: 'Hợp đồng cung cấp thiết bị phần cứng Q3' },
    });
    if (!task2 && cpSteps[1]) {
      const task2Values = {
        contract_type: 'purchase',
        contract_value: 580000000,
        partner_info: 'Nhà phân phối Công nghệ Tân Tiến - MST: 0308877665.',
        approval_result: 'approved',
        approval_rating: 5,
        total_contract_with_vat: 638000000,
      };

      task2 = await prisma.task.create({
        data: {
          processId: contractProcess.id,
          name: 'Hợp đồng cung cấp thiết bị phần cứng Q3',
          content: 'Mua sắm thiết bị Switch Cisco Layer 3 và Firewall Fortinet phục vụ mở rộng văn phòng.',
          customFields: task2Values,
          currentStepId: cpSteps[1].id,
          previousExecutorId: user1.id,
          executorIds: [manager.id],
          watcherIds: [admin.id, user1.id],
          startedAt: new Date(now - 12 * 3600 * 1000),
          deadline: new Date(now + 36 * 3600 * 1000),
          status: TaskStatus.IN_PROGRESS,
          createdById: user1.id,
          updatedById: manager.id,
          todos: {
            create: [
              {
                description: 'Soạn thảo bảng báo giá chi tiết từng mã linh kiện',
                isCompleted: true,
                completedAt: new Date(now - 14 * 3600 * 1000),
                executorId: user1.id,
                createdById: user1.id,
              },
              {
                description: 'Thẩm định hồ sơ năng lực nhà cung cấp và cam kết SLA giao hàng',
                isCompleted: false,
                executorId: manager.id,
                createdById: manager.id,
              },
            ],
          },
          comments: {
            create: [
              {
                content: 'Báo giá đã được thẩm định với mức chiết khấu 12% so với giá thị trường.',
                userId: manager.id,
                createdById: manager.id,
              },
            ],
          },
        },
      });

      const cDefs2 = await prisma.customFieldDefinition.findMany({
        where: { processId: contractProcess.id },
      });
      for (const def of cDefs2) {
        if (task2Values[def.fieldKey as keyof typeof task2Values] !== undefined) {
          await prisma.taskCustomFieldValue.create({
            data: {
              taskId: task2.id,
              fieldDefinitionId: def.id,
              value: task2Values[def.fieldKey as keyof typeof task2Values],
              stepId: def.stepId || cpSteps[1].id,
              filledById: manager.id,
              filledAt: new Date(),
            },
          });
        }
      }

      const snapshot2 = await createTaskSnapshot(task2.id);
      await prisma.taskHistory.createMany({
        data: [
          {
            taskId: task2.id,
            version: 1,
            changedById: user1.id,
            changeType: TaskHistoryChangeType.CREATED,
            changeDescription: `Khởi tạo hợp đồng tại bước "${cpSteps[0].name}"`,
            snapshot: snapshot2,
            createdById: user1.id,
          },
          {
            taskId: task2.id,
            version: 2,
            changedById: user1.id,
            changeType: TaskHistoryChangeType.STEP_CHANGED,
            changeDescription: `Chuyển bước sang: "${cpSteps[1].name}" (Bước 2)`,
            snapshot: snapshot2,
            createdById: user1.id,
          },
        ],
      });
      console.log('📌 [Workflow-Seed] Đã tạo Task 2 (IN_PROGRESS - Step 2)');
    }

    // Task 3: "Tuyển dụng Senior Fullstack Developer Q3"
    let task3 = await prisma.task.findFirst({
      where: { name: 'Tuyển dụng Senior Fullstack Developer Q3' },
    });
    if (!task3 && rpSteps[1]) {
      const task3Values = {
        candidate_name: 'Nguyễn Văn Đạt',
        position: 'fullstack',
        skills: ['react', 'ts', 'node', 'postgres'],
        interview_score: 9,
        interview_notes: 'Ứng viên có kiến trúc tốt về Clean Architecture, giao tiếp tự tin và có kinh nghiệm quản lý nhóm nhỏ.',
        interview_result: true,
        interviewer: manager.id,
      };

      task3 = await prisma.task.create({
        data: {
          processId: recruitProcess.id,
          name: 'Tuyển dụng Senior Fullstack Developer Q3',
          content: 'Tuyển dụng nhân sự cấp cao cho dự án Hệ thống Quản lý Quy trình doanh nghiệp.',
          customFields: task3Values,
          currentStepId: rpSteps[1].id,
          executorIds: [manager.id, admin.id],
          watcherIds: [user1.id],
          startedAt: new Date(now - 8 * 3600 * 1000),
          deadline: new Date(now + 40 * 3600 * 1000),
          status: TaskStatus.IN_PROGRESS,
          createdById: user1.id,
          updatedById: manager.id,
          todos: {
            create: [
              {
                description: 'Sàng lọc CV và làm bài test kỹ thuật trực tuyến',
                isCompleted: true,
                completedAt: new Date(now - 6 * 3600 * 1000),
                executorId: user1.id,
                createdById: user1.id,
              },
              {
                description: 'Tiến hành phỏng vấn trực tiếp tại văn phòng',
                isCompleted: true,
                completedAt: new Date(now - 1 * 3600 * 1000),
                executorId: manager.id,
                createdById: manager.id,
              },
            ],
          },
          comments: {
            create: [
              {
                content: 'Ứng viên trả lời rất xuất sắc phần System Design và Database Sharding.',
                userId: manager.id,
                createdById: manager.id,
              },
            ],
          },
        },
      });

      const rDefs = await prisma.customFieldDefinition.findMany({
        where: { processId: recruitProcess.id },
      });
      for (const def of rDefs) {
        if (task3Values[def.fieldKey as keyof typeof task3Values] !== undefined) {
          await prisma.taskCustomFieldValue.create({
            data: {
              taskId: task3.id,
              fieldDefinitionId: def.id,
              value: task3Values[def.fieldKey as keyof typeof task3Values],
              stepId: def.stepId || rpSteps[1].id,
              filledById: manager.id,
              filledAt: new Date(),
            },
          });
        }
      }

      const snapshot3 = await createTaskSnapshot(task3.id);
      await prisma.taskHistory.create({
        data: {
          taskId: task3.id,
          version: 1,
          changedById: user1.id,
          changeType: TaskHistoryChangeType.CREATED,
          changeDescription: `Khởi tạo hồ sơ tại bước "${rpSteps[0].name}"`,
          snapshot: snapshot3,
          createdById: user1.id,
        },
      });
      console.log('📌 [Workflow-Seed] Đã tạo Task 3 (Tuyển dụng - Step 2)');
    }

    console.log('🎉 [Workflow-Seed] Hoàn tất khởi tạo dữ liệu mẫu Workflow & Custom Fields thành công!');
  } catch (error: any) {
    console.error('❌ [Workflow-Seed] Lỗi khi tạo dữ liệu mẫu Workflow:', error);
    throw error;
  }
}
