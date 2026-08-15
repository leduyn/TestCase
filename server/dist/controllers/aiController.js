"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIController = void 0;
const database_1 = __importDefault(require("../config/database"));
class AIController {
    static async getProviders(_req, res) {
        const providers = [
            {
                id: 'gemini',
                name: 'Google Gemini',
                models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'],
                defaultModel: 'gemini-2.5-flash',
                requiresBaseUrl: false,
            },
            {
                id: 'openai',
                name: 'OpenAI GPT',
                models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
                defaultModel: 'gpt-4o-mini',
                requiresBaseUrl: false,
            },
            {
                id: 'deepseek',
                name: 'DeepSeek AI',
                models: ['deepseek-chat', 'deepseek-coder'],
                defaultModel: 'deepseek-chat',
                defaultBaseUrl: 'https://api.deepseek.com',
                requiresBaseUrl: false,
            },
            {
                id: 'custom',
                name: 'Custom / OpenAI-Compatible (Local Ollama, vLLM...)',
                models: ['custom-model'],
                defaultModel: 'custom-model',
                requiresBaseUrl: true,
            },
        ];
        return res.json({ providers });
    }
    static async getAiConfigs(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: 'Chưa đăng nhập' });
            }
            const configs = await database_1.default.aiConfig.findMany({
                where: { userId: req.user.id },
                select: {
                    id: true,
                    provider: true,
                    modelName: true,
                    baseUrl: true,
                    isActive: true,
                    createdAt: true,
                },
            });
            return res.json({ configs });
        }
        catch (error) {
            return res.status(500).json({ message: 'Lỗi tải cấu hình AI', error: error.message });
        }
    }
    static async saveAiConfig(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: 'Chưa đăng nhập' });
            }
            const { provider, apiKey, modelName, baseUrl, isActive } = req.body;
            if (!provider || !apiKey) {
                return res.status(400).json({ message: 'Vui lòng cung cấp Provider và API Key' });
            }
            // If isActive is true, set others to false
            if (isActive) {
                await database_1.default.aiConfig.updateMany({
                    where: { userId: req.user.id },
                    data: { isActive: false },
                });
            }
            const config = await database_1.default.aiConfig.create({
                data: {
                    userId: req.user.id,
                    provider,
                    apiKey,
                    modelName: modelName || 'default',
                    baseUrl: baseUrl || null,
                    isActive: isActive !== undefined ? isActive : true,
                },
            });
            return res.json({ message: 'Lưu cấu hình AI thành công', configId: config.id });
        }
        catch (error) {
            return res.status(500).json({ message: 'Lỗi lưu cấu hình AI', error: error.message });
        }
    }
}
exports.AIController = AIController;
