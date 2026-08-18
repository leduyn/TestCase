import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

export class AIController {
  static async getProviders(_req: AuthRequest, res: Response) {
    const providers = [
      {
        id: 'gemini',
        name: 'Google Gemini',
        models: [
          'gemini-3.7-flash',
          'gemini-3.7-pro',
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-2.0-pro-exp-02-05',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gemini-1.5-flash-8b',
        ],
        defaultModel: 'gemini-3.7-flash',
        requiresBaseUrl: false,
      },
      {
        id: 'groq',
        name: 'Groq AI (Ultra-fast Inference)',
        models: [
          'openai/gpt-oss-120b',
          'llama-3.3-70b-versatile',
          'llama-3.1-70b-versatile',
          'llama-3.1-8b-instant',
          'mixtral-8x7b-32768',
          'gemma2-9b-it',
          'deepseek-r1-distill-llama-70b',
          'qwen-2.5-32b',
        ],
        defaultModel: 'openai/gpt-oss-120b',
        defaultBaseUrl: 'https://api.groq.com/openai/v1',
        requiresBaseUrl: false,
      },
      {
        id: 'openrouter',
        name: 'OpenRouter (Multi-model & Free models)',
        models: [
          'openrouter/free',
          'openrouter/auto',
          'meta-llama/llama-3.3-70b-instruct:free',
          'deepseek/deepseek-r1:free',
          'deepseek/deepseek-chat:free',
          'google/gemini-2.0-flash-exp:free',
          'qwen/qwen-2.5-coder-32b-instruct:free',
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
          'openai/gpt-4o-mini',
        ],
        defaultModel: 'openrouter/free',
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
        requiresBaseUrl: false,
      },
      {
        id: 'openai',
        name: 'OpenAI GPT',
        models: [
          'gpt-4o',
          'gpt-4o-mini',
          'o3-mini',
          'o1',
          'o1-mini',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-3.5-turbo',
        ],
        defaultModel: 'gpt-4o-mini',
        requiresBaseUrl: false,
      },
      {
        id: 'deepseek',
        name: 'DeepSeek AI',
        models: [
          'deepseek-chat',
          'deepseek-reasoner',
          'deepseek-coder',
        ],
        defaultModel: 'deepseek-chat',
        defaultBaseUrl: 'https://api.deepseek.com',
        requiresBaseUrl: false,
      },
      {
        id: 'opencode',
        name: 'OpenCode Zen (Curated Models Gateway)',
        models: [
          'gemini-3.7-flash',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'claude-sonnet-4.5',
          'claude-sonnet-4.6',
          'claude-haiku-4.5',
          'claude-opus-4.6',
          'gpt-5.4-mini',
          'gpt-5.4-pro',
          'gpt-5.5',
          'gpt-5.6-sol',
          'deepseek-v4-pro',
          'deepseek-v4-flash',
          'deepseek-v4-flash-free',
          'minimax-m3',
          'glm-5.2',
          'kimi-k2.7-code',
          'mimo-v2.5-free',
          'nemotron-3.5-lightning-free',
        ],
        defaultModel: 'gemini-3.7-flash',
        defaultBaseUrl: 'https://opencode.ai/zen/v1',
        requiresBaseUrl: false,
      },
      {
        id: 'custom',
        name: 'Custom / OpenAI-Compatible (Local Ollama, vLLM, LMStudio...)',
        models: [
          'qwen2.5-coder:latest',
          'qwen2.5:latest',
          'deepseek-r1:latest',
          'llama3.3:latest',
          'llama3.1:latest',
          'mistral:latest',
          'gemma2:latest',
          'custom-model',
        ],
        defaultModel: 'qwen2.5-coder:latest',
        requiresBaseUrl: true,
      },
    ];

    return res.json({ providers });
  }

  static async getAiConfigs(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const configs = await prisma.aiConfig.findMany({
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
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi tải cấu hình AI', error: error.message });
    }
  }

  static async saveAiConfig(req: AuthRequest, res: Response) {
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
        await prisma.aiConfig.updateMany({
          where: { userId: req.user.id },
          data: { isActive: false },
        });
      }

      const config = await prisma.aiConfig.create({
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
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi lưu cấu hình AI', error: error.message });
    }
  }

  static async updateAiConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const { id } = req.params;
      const { provider, apiKey, modelName, baseUrl, isActive } = req.body;

      const existing = await prisma.aiConfig.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Không tìm thấy cấu hình AI' });
      }

      if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Không có quyền chỉnh sửa cấu hình này' });
      }

      if (isActive) {
        await prisma.aiConfig.updateMany({
          where: { userId: existing.userId },
          data: { isActive: false },
        });
      }

      const updateData: any = {};
      if (provider !== undefined) updateData.provider = provider;
      if (modelName !== undefined) updateData.modelName = modelName;
      if (baseUrl !== undefined) updateData.baseUrl = baseUrl || null;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (apiKey && apiKey.trim()) updateData.apiKey = apiKey.trim();

      const updated = await prisma.aiConfig.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          provider: true,
          modelName: true,
          baseUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.json({ message: 'Cập nhật cấu hình AI thành công', config: updated });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi cập nhật cấu hình AI', error: error.message });
    }
  }

  static async deleteAiConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const { id } = req.params;

      const existing = await prisma.aiConfig.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Không tìm thấy cấu hình AI' });
      }

      if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Không có quyền xóa cấu hình này' });
      }

      await prisma.aiConfig.delete({
        where: { id },
      });

      return res.json({ message: 'Đã xóa cấu hình AI thành công' });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi xóa cấu hình AI', error: error.message });
    }
  }

  static async toggleActiveAiConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const { id } = req.params;

      const existing = await prisma.aiConfig.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Không tìm thấy cấu hình AI' });
      }

      if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Không có quyền thao tác cấu hình này' });
      }

      const nextActiveState = !existing.isActive;

      if (nextActiveState) {
        // Tắt active của các cấu hình khác
        await prisma.aiConfig.updateMany({
          where: { userId: existing.userId },
          data: { isActive: false },
        });
      }

      const updated = await prisma.aiConfig.update({
        where: { id },
        data: { isActive: nextActiveState },
        select: {
          id: true,
          provider: true,
          modelName: true,
          baseUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.json({
        message: nextActiveState ? 'Đã kích hoạt làm cấu hình mặc định' : 'Đã hủy kích hoạt cấu hình',
        config: updated,
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi chuyển đổi trạng thái', error: error.message });
    }
  }
}
