import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import prisma from '../../config/database';

export interface GeneratedTestCase {
  testCaseCode: string;
  module: string;
  platform: string; // App, CMS, Web
  title: string;
  testType: string; // Luồng chuẩn, Luồng ngoại lệ, Giá trị biên
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: string; // Cao, Trung bình, Thấp
}

export interface GenerationResult {
  moduleName: string;
  summary: string;
  assumptions: string;
  testCases: GeneratedTestCase[];
}

export interface GenerateOptions {
  documentContent: string;
  provider?: string; // 'gemini' | 'openrouter' | 'groq' | 'openai' | 'deepseek' | 'custom'
  apiKey?: string;
  modelName?: string;
  baseUrl?: string;
  customInstruction?: string;
}

const DEFAULT_SYSTEM_PROMPT = `Bạn là Chuyên gia QA / Software Test Engineer cao cấp với hơn 10 năm kinh nghiệm phân tích tài liệu đặc tả yêu cầu (BRD/SRS) và thiết kế kịch bản kiểm thử (Test Case).

NHIỆM VỤ:
1. Đọc kỹ toàn bộ tài liệu đặc tả yêu cầu được cung cấp.
2. Phân tích các phân hệ, chức năng, luồng nghiệp vụ, giao diện (App di động, Web CMS, API backend), các quy tắc nghiệp vụ (Business Rules), ràng buộc dữ liệu.
3. Sinh ra bộ Test Case toàn diện, đầy đủ và chi tiết gồm cả:
   - Luồng chuẩn (Happy path / Normal flow)
   - Luồng ngoại lệ / Luồng lỗi (Negative flow / Error handling / Validation)
   - Giá trị biên (Boundary value analysis / Edge cases)
   - Phân quyền & trạng thái (Permission / Role-based access / Status transition)
4. Phân định rõ nền tảng kiểm thử cho từng test case: "App", "CMS", hoặc "Web".
5. **BẮT BUỘC CHỈ TRẢ VỀ JSON THUẦN TÚY** – KHÔNG CÓ VĂN BẢN GIẢI THÍCH, KHÔNG CÓ MARKDOWN \`\`\`json, KHÔNG CÓ CHỮ GÌ KHÁC NGOÀI JSON. NẾU VI PHẠM, HỆ THỐNG SẼ BỎ QUA.

CẤU TRÚC JSON BẮT BUỘC TUÂN THEO:
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

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Kiểm tra xem lỗi có phải do Rate Limit (429) hoặc lỗi mạng/tạm thời có thể thử lại
 */
function isRetryableError(error: any): boolean {
  const status = error?.status || error?.statusCode || error?.response?.status;
  if (status === 429 || [500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = (error?.message || '').toLowerCase();
  const retryableKeywords = [
    'rate limit',
    'rate_limit',
    'too many requests',
    'resource has been exhausted',
    'quota',
    '429',
    'econnreset',
    'etimedout',
    'temporarily unavailable',
    'overloaded',
    'fetch failed',
    'server error',
  ];

  return retryableKeywords.some((keyword) => message.includes(keyword));
}

/**
 * Hàm thực thi với cơ chế Exponential Backoff Retry cho các API AI
 */
async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 2000;
  const maxDelayMs = options.maxDelayMs ?? 20000;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Tính toán delay theo Exponential Backoff
      let delayMs = initialDelayMs * Math.pow(backoffFactor, attempt - 1);

      // Nếu server trả về Retry-After header
      const retryAfter = error?.headers?.get?.('retry-after') || error?.response?.headers?.['retry-after'];
      if (retryAfter) {
        const parsed = parseFloat(retryAfter);
        if (!isNaN(parsed) && parsed > 0) {
          delayMs = parsed * 1000;
        }
      }

      // Thêm jitter ngẫu nhiên để tránh xung đột
      const jitter = Math.random() * 500;
      const finalDelay = Math.min(delayMs + jitter, maxDelayMs);

      console.warn(
        `[AIService] ⚠️ Gặp lỗi Rate Limit / Tạm thời (Lần thử ${attempt}/${maxRetries}): ${error.message}. Đang thử lại sau ${Math.round(finalDelay)}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }
}

function normalizeToString(value: any, isNumberedList = false): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (isNumberedList) {
      return value
        .map((item, idx) => {
          const str = typeof item === 'object' ? JSON.stringify(item) : String(item).trim();
          if (/^\d+[\.\)]\s*/.test(str)) {
            return str;
          }
          return `${idx + 1}. ${str}`;
        })
        .join('\n');
    }
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item).trim()))
      .join('\n');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value).trim();
}

export class AIService {
  static async generateTestCases(options: GenerateOptions): Promise<GenerationResult> {
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
    } else {
      // Mọi nhà cung cấp OpenAI-Compatible (OpenRouter, Groq, DeepSeek, OpenAI, Local vLLM/Ollama)
      return this.generateWithOpenAICompatible(prompt, options);
    }
  }

  /**
   * Gọi Google Gemini API với cơ chế Retry & Rate Limit Exponential Backoff
   */
  private static async generateWithGemini(prompt: string, options: GenerateOptions): Promise<GenerationResult> {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Chưa cung cấp Gemini API Key. Vui lòng cấu hình trong Cài đặt hoặc file .env');
    }

    const systemPrompt = await this.getSystemPrompt();

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = options.modelName || 'gemini-3.7-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
      systemInstruction: systemPrompt,
    });

    const responseText = await withRetry(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    return this.parseJSONResponse(responseText);
  }

  /**
   * Gọi chuẩn OpenAI-Compatible API (OpenRouter, Groq, DeepSeek, OpenAI, Custom)
   * Tự động điều chỉnh baseURL, apiKey, modelName và có cơ chế Retry Exponential Backoff
   */
  private static async generateWithOpenAICompatible(prompt: string, options: GenerateOptions): Promise<GenerationResult> {
    const provider = (options.provider || 'openai').toLowerCase();
    let apiKey = options.apiKey;
    let baseURL = options.baseUrl;
    let modelName = options.modelName;

    // Thiết lập mặc định cho từng Provider
    if (provider === 'orcarouter') {
      apiKey = apiKey || process.env.ORCAROUTER_API_KEY;
      baseURL = baseURL || 'https://api.orcarouter.ai/v1';
      modelName = modelName || 'orcarouter/auto';
    } else if (provider === 'opencode' || provider === 'zen') {
      apiKey = apiKey || process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY;
      baseURL = baseURL || 'https://opencode.ai/zen/v1';
      modelName = modelName || 'gemini-3.7-flash';
    } else if (provider === 'openrouter') {
      apiKey = apiKey || process.env.OPENROUTER_API_KEY;
      baseURL = baseURL || 'https://openrouter.ai/api/v1';
      modelName = modelName || 'openrouter/free';
    } else if (provider === 'groq') {
      apiKey = apiKey || process.env.GROQ_API_KEY;
      baseURL = baseURL || 'https://api.groq.com/openai/v1';
      modelName = modelName || 'openai/gpt-oss-120b';
    } else if (provider === 'openai') {
      apiKey = apiKey || process.env.OPENAI_API_KEY;
      modelName = modelName || 'gpt-4o-mini';
    } else if (provider === 'deepseek') {
      apiKey = apiKey || process.env.DEEPSEEK_API_KEY;
      baseURL = baseURL || 'https://api.deepseek.com';
      modelName = modelName || 'deepseek-chat';
    }

    if (!apiKey) {
      throw new Error(`Chưa cung cấp API Key cho ${provider.toUpperCase()}. Vui lòng cấu hình trong Cài đặt hoặc file .env`);
    }

    const systemPrompt = await this.getSystemPrompt();

    const openai = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });

    const content = await withRetry(async () => {
      try {
        const completion = await openai.chat.completions.create({
          model: modelName || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });
        return completion.choices[0]?.message?.content || '{}';
      } catch (err: any) {
        // Lỗi xác thực 401 (sai API Key hoặc chưa có Header)
        if (err?.status === 401 || err?.message?.includes('401') || err?.message?.includes('Missing Authentication header')) {
          throw new Error(`Xác thực thất bại với ${provider.toUpperCase()} (401 Unauthorized / Sai API Key). Vui lòng kiểm tra lại API Key trong Cài đặt hoặc nhập trực tiếp.`);
        }

        // Fallback nếu một số model free (như trên OpenRouter/Ollama) chưa hỗ trợ response_format json_object
        if (err.message && (err.message.includes('response_format') || err.message.includes('json_object') || err.status === 400)) {
          const completion = await openai.chat.completions.create({
            model: modelName || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
          });
          return completion.choices[0]?.message?.content || '{}';
        }
        throw err;
      }
    });

    return this.parseJSONResponse(content);
  }

  private static parseJSONResponse(text: string): GenerationResult {
    let cleanText = text.trim();

    // 1. Remove markdown fences
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

    // 2. Try direct JSON parse
    try {
      const parsed = JSON.parse(cleanText);
      return this.mapToResult(parsed);
    } catch {}

    // 3. Extract JSON object from mixed text (handles "We need to..." + JSON)
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.mapToResult(parsed);
      } catch {}
    }

    // 4. Last resort: find array and wrap
    const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const testCases = JSON.parse(arrayMatch[0]);
        return {
          moduleName: 'Bộ Test Case',
          summary: '',
          assumptions: '',
          testCases: this.normalizeTestCases(testCases),
        };
      } catch {}
    }

    throw new Error(`Lỗi phân tích JSON từ AI: Không tìm thấy JSON hợp lệ\nNội dung (300 ký tự đầu): ${cleanText.slice(0, 300)}...`);
  }

  private static mapToResult(parsed: any): GenerationResult {
    const testCases: GeneratedTestCase[] = Array.isArray(parsed.testCases)
      ? parsed.testCases.map((tc: any, index: number) => ({
          testCaseCode: normalizeToString(tc.testCaseCode || tc.id) || `TC_${String(index + 1).padStart(3, '0')}`,
          module: normalizeToString(tc.module) || 'Chung',
          platform: normalizeToString(tc.platform) || 'App',
          title: normalizeToString(tc.title) || `Kịch bản kiểm thử ${index + 1}`,
          testType: normalizeToString(tc.testType || tc.type) || 'Luồng chuẩn',
          preconditions: normalizeToString(tc.preconditions || tc.precondition),
          steps: normalizeToString(tc.steps, true),
          expectedResult: normalizeToString(tc.expectedResult || tc.expected),
          priority: normalizeToString(tc.priority) || 'Cao',
        }))
      : [];

    return {
      moduleName: normalizeToString(parsed.moduleName) || 'Bộ Test Case',
      summary: normalizeToString(parsed.summary),
      assumptions: normalizeToString(parsed.assumptions),
      testCases,
    };
  }

  private static normalizeTestCases(arr: any[]): GeneratedTestCase[] {
    return arr.map((tc: any, index: number) => ({
      testCaseCode: normalizeToString(tc.testCaseCode || tc.id) || `TC_${String(index + 1).padStart(3, '0')}`,
      module: normalizeToString(tc.module) || 'Chung',
      platform: normalizeToString(tc.platform) || 'App',
      title: normalizeToString(tc.title) || `Kịch bản kiểm thử ${index + 1}`,
      testType: normalizeToString(tc.testType || tc.type) || 'Luồng chuẩn',
      preconditions: normalizeToString(tc.preconditions || tc.precondition),
      steps: normalizeToString(tc.steps, true),
      expectedResult: normalizeToString(tc.expectedResult || tc.expected),
      priority: normalizeToString(tc.priority) || 'Cao',
    }));
  }

  static async getSystemPrompt(): Promise<string> {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'ai_system_prompt' } });
    return setting?.value || DEFAULT_SYSTEM_PROMPT;
  }

  static async setSystemPrompt(prompt: string): Promise<void> {
    if (!prompt || prompt.trim().length < 100) {
      throw new Error('Prompt quá ngắn (tối thiểu 100 ký tự)');
    }
    await prisma.systemSetting.upsert({
      where: { key: 'ai_system_prompt' },
      update: { value: prompt.trim() },
      create: { key: 'ai_system_prompt', value: prompt.trim() },
    });
  }
}

