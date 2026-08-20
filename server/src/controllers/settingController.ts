import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { AIService } from '../services/ai/aiService';

const DEFAULT_SERVERS = ['DEV', 'STAGING', 'UAT', 'PRODUCTION'];
const DEFAULT_OS_LIST = [
  'Windows 11',
  'Windows 10',
  'macOS Sonoma',
  'macOS Sequoia',
  'Android 14',
  'Android 15',
  'iOS 17.5',
  'iOS 18',
  'Ubuntu 22.04',
];

export class SettingController {
  static async getEnvironments(_req: Request, res: Response) {
    try {
      const serverSetting = await prisma.systemSetting.findUnique({
        where: { key: 'environments_servers' },
      });
      const osSetting = await prisma.systemSetting.findUnique({
        where: { key: 'environments_os' },
      });

      let servers = DEFAULT_SERVERS;
      let osList = DEFAULT_OS_LIST;

      if (serverSetting?.value) {
        try {
          const parsed = JSON.parse(serverSetting.value);
          if (Array.isArray(parsed) && parsed.length > 0) servers = parsed;
        } catch {
          // ignore
        }
      }

      if (osSetting?.value) {
        try {
          const parsed = JSON.parse(osSetting.value);
          if (Array.isArray(parsed) && parsed.length > 0) osList = parsed;
        } catch {
          // ignore
        }
      }

      return res.json({ servers, osList });
    } catch (error: any) {
      console.error('Error fetching environment settings:', error);
      return res.json({ servers: DEFAULT_SERVERS, osList: DEFAULT_OS_LIST });
    }
  }

  static async saveEnvironments(req: AuthRequest, res: Response) {
    try {
      const { servers, osList } = req.body;

      if (!Array.isArray(servers) || !Array.isArray(osList)) {
        return res.status(400).json({ message: 'Dữ liệu servers hoặc osList không hợp lệ' });
      }

      const cleanServers = Array.from(
        new Set(servers.map((s: string) => String(s).trim()).filter(Boolean))
      );
      const cleanOsList = Array.from(
        new Set(osList.map((o: string) => String(o).trim()).filter(Boolean))
      );

      await prisma.systemSetting.upsert({
        where: { key: 'environments_servers' },
        update: { value: JSON.stringify(cleanServers) },
        create: { key: 'environments_servers', value: JSON.stringify(cleanServers) },
      });

      await prisma.systemSetting.upsert({
        where: { key: 'environments_os' },
        update: { value: JSON.stringify(cleanOsList) },
        create: { key: 'environments_os', value: JSON.stringify(cleanOsList) },
      });

      return res.json({
        message: 'Lưu danh sách Server & Hệ điều hành thành công',
        servers: cleanServers,
        osList: cleanOsList,
      });
    } catch (error: any) {
      console.error('Error saving environment settings:', error);
      return res.status(500).json({
        message: 'Lỗi khi lưu cấu hình môi trường',
        error: error.message,
      });
    }
  }

  static async getSystemPrompt(_req: Request, res: Response) {
    try {
      const prompt = await AIService.getSystemPrompt();
      return res.json({ prompt });
    } catch (error: any) {
      console.error('Error fetching system prompt:', error);
      return res.status(500).json({ message: 'Lỗi khi lấy System Prompt', error: error.message });
    }
  }

  static async updateSystemPrompt(req: AuthRequest, res: Response) {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 100) {
        return res.status(400).json({ message: 'Prompt quá ngắn (tối thiểu 100 ký tự)' });
      }
      await AIService.setSystemPrompt(prompt.trim());
      return res.json({ message: 'Đã cập nhật System Prompt thành công' });
    } catch (error: any) {
      console.error('Error updating system prompt:', error);
      return res.status(500).json({ message: 'Lỗi khi cập nhật System Prompt', error: error.message });
    }
  }
}
