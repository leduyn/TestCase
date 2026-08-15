with open('generate_testcase_excel.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    '"Happy Path"': '"Luồng chuẩn"',
    '"Negative"': '"Luồng ngoại lệ"',
    '"Boundary"': '"Giá trị biên"',
    '"High"': '"Cao"',
    '"Medium"': '"Trung bình"',
    '"Low"': '"Thấp"',
    '"Test Type"': '"Loại kiểm thử"',
    '"Preconditions"': '"Điều kiện tiên quyết"',
    '"Steps"': '"Các bước thực hiện"',
    '"Expected Result"': '"Kết quả mong đợi"',
    '"Priority"': '"Mức độ ưu tiên"',
    '"Title"': '"Tiêu đề (Mô tả)"',
    '"Module"': '"Chức năng (Module)"',
    'TestCase_VINAGO_KhachHang.xlsx': 'TestCase_VINAGO_KhachHang_TiengViet.xlsx'
}

for k, v in replacements.items():
    content = content.replace(k, v)

with open('generate_testcase_excel_vn.py', 'w', encoding='utf-8') as f:
    f.write(content)
