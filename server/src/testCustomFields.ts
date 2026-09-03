import prisma from './config/database';
import { CustomFieldService } from './services/customFieldService';
import { TaskCustomFieldService } from './services/taskCustomFieldService';

async function runTests() {
  console.log('🧪 === BẮT ĐẦU KIỂM THỬ HỆ THỐNG CUSTOM FIELDS ===\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ─── Test 1: Supported Field Types ─────────────────────────────────────────
  console.log('1️⃣ Kiểm tra danh sách loại trường (22 loại):');
  const types = CustomFieldService.getSupportedFieldTypes();
  assert(types.length === 22, 'Phải hỗ trợ chính xác 22 loại trường dữ liệu');
  assert(types.some((t) => t.type === 'formula'), 'Hỗ trợ loại formula');
  assert(types.some((t) => t.type === 'multifile'), 'Hỗ trợ loại multifile');
  assert(types.some((t) => t.type === 'slider'), 'Hỗ trợ loại slider');

  // ─── Test 2: Field Config Validation ───────────────────────────────────────
  console.log('\n2️⃣ Kiểm tra Validate Cấu hình trường:');
  const validSelect = CustomFieldService.validateFieldConfig('select', {
    options: [{ label: 'Opt 1', value: '1' }],
  });
  assert(validSelect.isValid, 'Cấu hình select hợp lệ');

  const invalidNumber = CustomFieldService.validateFieldConfig('number', {
    min: 100,
    max: 50,
  });
  assert(!invalidNumber.isValid, 'Bắt lỗi khi min > max');

  const invalidStars = CustomFieldService.validateFieldConfig('rating', {
    max_stars: 15,
  });
  assert(!invalidStars.isValid, 'Bắt lỗi khi max_stars > 10');

  // ─── Test 3: Visibility Condition Evaluation ───────────────────────────────
  console.log('\n3️⃣ Kiểm tra Đánh giá Điều kiện hiển thị (Visibility Conditions):');
  const condEquals = { field: 'approval_result', operator: 'equals', value: 'rejected' };
  assert(
    TaskCustomFieldService.evaluateVisibility(condEquals, { approval_result: 'rejected' }),
    'Điều kiện equals: đúng khi giá trị khớp'
  );
  assert(
    !TaskCustomFieldService.evaluateVisibility(condEquals, { approval_result: 'approved' }),
    'Điều kiện equals: ẩn khi giá trị không khớp'
  );

  const condGreaterThan = { field: 'score', operator: 'greater_than', value: 8 };
  assert(
    TaskCustomFieldService.evaluateVisibility(condGreaterThan, { score: 9 }),
    'Điều kiện greater_than: 9 > 8'
  );
  assert(
    !TaskCustomFieldService.evaluateVisibility(condGreaterThan, { score: 7 }),
    'Điều kiện greater_than: 7 không > 8'
  );

  const condNotEmpty = { field: 'notes', operator: 'is_not_empty' };
  assert(
    TaskCustomFieldService.evaluateVisibility(condNotEmpty, { notes: 'Có nội dung' }),
    'Điều kiện is_not_empty: đúng khi chuỗi có dữ liệu'
  );
  assert(
    !TaskCustomFieldService.evaluateVisibility(condNotEmpty, { notes: '' }),
    'Điều kiện is_not_empty: sai khi chuỗi rỗng'
  );

  // ─── Test 4: Formula Calculation ───────────────────────────────────────────
  console.log('\n4️⃣ Kiểm tra Đánh giá và Tính toán Công thức (Formula Fields):');
  const formula1 = TaskCustomFieldService.evaluateFormula('contract_value * 1.1', {
    contract_value: 100000000,
  });
  assert(formula1 === 110000000, 'Tính đúng công thức VAT 10%: 100tr * 1.1 = 110tr');

  const formula2 = TaskCustomFieldService.evaluateFormula('price * quantity * (1 - discount / 100)', {
    price: 200,
    quantity: 5,
    discount: 10,
  });
  assert(formula2 === 900, 'Tính đúng công thức phức tạp: 200 * 5 * 0.9 = 900');

  // ─── Test 5: Database Operations & Task Custom Fields ──────────────────────
  console.log('\n5️⃣ Kiểm tra Truy vấn và Lưu giá trị Task Custom Fields trong DB:');
  const task = await prisma.task.findFirst({
    where: { name: 'Hợp đồng dịch vụ IT Tân Thịnh 2026' },
  });
  assert(!!task, 'Tìm thấy Task 1 trong cơ sở dữ liệu');

  if (task) {
    const customFieldsData = await TaskCustomFieldService.getTaskCustomFields(task.id);
    assert(customFieldsData.fields.length > 0, `Task có ${customFieldsData.fields.length} Custom Fields`);

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    assert(!!adminUser, 'Tìm thấy tài khoản Admin');

    if (adminUser) {
      // Test Lưu giá trị mới
      const saveRes = await TaskCustomFieldService.saveTaskCustomFieldValues(
        task.id,
        [
          { fieldKey: 'contract_value', value: 300000000 },
          { fieldKey: 'partner_info', value: 'Đối tác mới cập nhật qua kiểm thử tự động' },
        ],
        adminUser.id
      );

      assert(saveRes.success, 'Lưu bulk giá trị Custom Fields thành công');
      assert(saveRes.values.total_contract_with_vat === 330000000, 'Tự động tính lại formula: 300tr * 1.1 = 330tr');

      // Kiểm tra History Snapshot
      const histories = await TaskCustomFieldService.getTaskCustomFieldHistory(task.id);
      assert(histories.length > 0, 'Ghi nhận lịch sử FIELD_UPDATED thành công');
    }
  }

  console.log(`\n🎉 === HOÀN THÀNH TẤT CẢ ${passedTests}/${totalTests} KIỂM THỬ THÀNH CÔNG (100%) ===\n`);
}

runTests()
  .catch((err) => {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
