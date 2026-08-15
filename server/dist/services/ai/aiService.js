"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = __importDefault(require("openai"));
const SYSTEM_PROMPT = `Bạn là Chuyên gia QA / Software Test Engineer cao cấp với hơn 10 năm kinh nghiệm phân tích tài liệu đặc tả yêu cầu (BRD/SRS) và thiết kế kịch bản kiểm thử (Test Case).

Nhiệm vụ của bạn:
1. Đọc kỹ toàn bộ tài liệu đặc tả yêu cầu được cung cấp.
2. Phân tích các phân hệ, chức năng, luồng nghiệp vụ, giao diện (App di động, Web CMS, API backend), các quy tắc nghiệp vụ (Business Rules), ràng buộc dữ liệu.
3. Sinh ra bộ Test Case toàn diện, đầy đủ và chi tiết gồm cả:
   - Luồng chuẩn (Happy path / Normal flow)
   - Luồng ngoại lệ / Luồng lỗi (Negative flow / Error handling / Validation)
   - Giá trị biên (Boundary value analysis / Edge cases)
   - Phân quyền & trạng thái (Permission / Role-based access / Status transition)
4. Phân định rõ nền tảng kiểm thử cho từng test case: "App", "CMS", hoặc "Web".
5. BẮT BUỘC trả về định dạng JSON thuần túy (không kèm markdown \`\`\`json bọc ngoài nếu không cần thiết, hoặc parse được) tuân theo đúng cấu trúc schema sau:

{
  "moduleName": "Tên phân hệ / module chính của tài liệu (VD: Quản lý Khách hàng)",
  "summary": "Tóm tắt ngắn gọn các chức năng và phạm vi kiểm thử (3-5 câu)",
  "assumptions": "Các giả định, môi trường và điều kiện tiên quyết chung",
  "testCases": [
    {
      "testCaseCode": "TC_XXX_001 (mã test case có tiền tố theo module)",
      "module": "Tên chức năng cụ thể (VD: Đăng ký TK, Duyệt TK, Cấp bậc)",
      "platform": "App" hoặc "CMS" hoặc "Web",
      "title": "Tiêu đề kịch bản ngắn gọn, súc tích, mô tả đúng mục đích test",
      "testType": "Luồng chuẩn" hoặc "Luồng ngoại lệ" hoặc "Giá trị biên",
      "preconditions": "Điều kiện tiên quyết trước khi thực hiện test",
      "steps": "Các bước thực hiện đánh số 1. 2. 3. chi tiết",
      "expectedResult": "Kết quả mong đợi chi tiết",
      "priority": "Cao" hoặc "Trung bình" hoặc "Thấp"
    }
  ]
}`;
class AIService {
    static async generateTestCases(options) {
        const provider = (options.provider || 'gemini').toLowerCase();
        const prompt = `
TÀI LIỆU YÊU CẦU NGHIỆP VỤ CẦN PHÂN TÍCH:
=========================================
${options.documentContent}
=========================================

${options.customInstruction ? `YÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG:\n${options.customInstruction}\n` : ''}

Hãy phân tích kỹ lưỡng tài liệu trên và sinh ra danh sách Test Case chi tiết, đầy đủ theo đúng cấu trúc JSON đã hướng dẫn.
`;
        if (provider === 'gemini') {
            return this.generateWithGemini(prompt, options);
        }
        else if (provider === 'openai' || provider === 'deepseek' || provider === 'custom') {
            return this.generateWithOpenAICompatible(prompt, options);
        }
        else {
            // Fallback to Gemini
            return this.generateWithGemini(prompt, options);
        }
    }
    static async generateWithGemini(prompt, options) {
        const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Chưa cung cấp Gemini API Key. Vui lòng cấu hình trong Cài đặt hoặc file .env');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const modelName = options.modelName || 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
            },
            systemInstruction: SYSTEM_PROMPT,
        });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return this.parseJSONResponse(responseText);
    }
    static async generateWithOpenAICompatible(prompt, options) {
        const provider = (options.provider || 'openai').toLowerCase();
        let apiKey = options.apiKey;
        let baseURL = options.baseUrl;
        let modelName = options.modelName;
        if (provider === 'openai') {
            apiKey = apiKey || process.env.OPENAI_API_KEY;
            modelName = modelName || 'gpt-4o-mini';
        }
        else if (provider === 'deepseek') {
            apiKey = apiKey || process.env.DEEPSEEK_API_KEY;
            baseURL = baseURL || 'https://api.deepseek.com';
            modelName = modelName || 'deepseek-chat';
        }
        if (!apiKey) {
            throw new Error(`Chưa cung cấp API Key cho ${provider.toUpperCase()}. Vui lòng cấu hình trong Cài đặt hoặc file .env`);
        }
        const openai = new openai_1.default({
            apiKey,
            baseURL: baseURL || undefined,
        });
        const completion = await openai.chat.completions.create({
            model: modelName || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
        });
        const content = completion.choices[0]?.message?.content || '{}';
        return this.parseJSONResponse(content);
    }
    static parseJSONResponse(text) {
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
        }
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        cleanText = cleanText.trim();
        try {
            const parsed = JSON.parse(cleanText);
            const testCases = Array.isArray(parsed.testCases)
                ? parsed.testCases.map((tc, index) => ({
                    testCaseCode: tc.testCaseCode || tc.id || `TC_${index + 1}`,
                    module: tc.module || 'Chung',
                    platform: tc.platform || 'App',
                    title: tc.title || '',
                    testType: tc.testType || tc.type || 'Luồng chuẩn',
                    preconditions: tc.preconditions || tc.precondition || '',
                    steps: tc.steps || '',
                    expectedResult: tc.expectedResult || tc.expected || '',
                    priority: tc.priority || 'Cao',
                }))
                : [];
            return {
                moduleName: parsed.moduleName || 'Bộ Test Case',
                summary: parsed.summary || '',
                assumptions: parsed.assumptions || '',
                testCases,
            };
        }
        catch (e) {
            throw new Error(`Lỗi phân tích JSON từ AI: ${e.message}\nNội dung: ${cleanText.slice(0, 300)}...`);
        }
    }
}
exports.AIService = AIService;
