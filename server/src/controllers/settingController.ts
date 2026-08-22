import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { AIService } from '../services/ai/aiService';
import {
  getStorageConfig as loadStorageConfig,
  saveStorageConfigToDB,
  createStorageProvider,
  DEFAULT_STORAGE_CONFIG,
  StorageConfig,
} from '../services/storageService';

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

  static async getStorageConfig(_req: Request, res: Response) {
    try {
      const config = await loadStorageConfig();
      // Mask sensitive fields for security
      const safeConfig = {
        ...config,
        smb: {
          ...config.smb,
          password: config.smb.password ? '********' : '',
        },
        ftp: {
          ...config.ftp,
          password: config.ftp.password ? '********' : '',
        },
        googleDrive: {
          ...config.googleDrive,
          credentials: config.googleDrive.credentials ? { loaded: true } : null,
          oauth2: {
            ...config.googleDrive?.oauth2,
            clientSecret: config.googleDrive?.oauth2?.clientSecret ? '********' : '',
            refreshToken: config.googleDrive?.oauth2?.refreshToken ? '********' : '',
          },
        },
      };
      return res.json({ config: safeConfig });
    } catch (error: any) {
      console.error('Error fetching storage config:', error);
      return res.status(500).json({ message: 'Lỗi khi tải cấu hình lưu trữ', error: error.message });
    }
  }

  static async saveStorageConfig(req: AuthRequest, res: Response) {
    try {
      const incoming = req.body as Partial<StorageConfig>;
      
      // Load existing config to merge
      const existing = await loadStorageConfig();

      const merged: StorageConfig = {
        provider: incoming.provider || existing.provider,
        maxFilesPerExecution: incoming.maxFilesPerExecution ?? existing.maxFilesPerExecution,
        maxFileSizeMB: incoming.maxFileSizeMB ?? existing.maxFileSizeMB,
        local: { ...existing.local, ...incoming.local },
        smb: {
          ...existing.smb,
          ...incoming.smb,
          // Don't overwrite password if masked value is sent
          password: incoming.smb?.password === '********' ? existing.smb.password : (incoming.smb?.password ?? existing.smb.password),
        },
        ftp: {
          ...existing.ftp,
          ...incoming.ftp,
          password: incoming.ftp?.password === '********' ? existing.ftp.password : (incoming.ftp?.password ?? existing.ftp.password),
        },
        googleDrive: {
          ...existing.googleDrive,
          ...incoming.googleDrive,
          authType: incoming.googleDrive?.authType || existing.googleDrive?.authType || 'service_account',
          // Keep existing credentials if not explicitly provided
          credentials: incoming.googleDrive?.credentials && typeof incoming.googleDrive.credentials === 'object' && !incoming.googleDrive.credentials.loaded
            ? incoming.googleDrive.credentials
            : existing.googleDrive.credentials,
          oauth2: {
            ...existing.googleDrive?.oauth2,
            ...incoming.googleDrive?.oauth2,
            clientSecret: incoming.googleDrive?.oauth2?.clientSecret === '********'
              ? existing.googleDrive?.oauth2?.clientSecret
              : (incoming.googleDrive?.oauth2?.clientSecret ?? existing.googleDrive?.oauth2?.clientSecret),
            refreshToken: incoming.googleDrive?.oauth2?.refreshToken === '********'
              ? existing.googleDrive?.oauth2?.refreshToken
              : (incoming.googleDrive?.oauth2?.refreshToken ?? existing.googleDrive?.oauth2?.refreshToken),
          },
        },
      };

      // Validate limits
      if (merged.maxFilesPerExecution < 1 || merged.maxFilesPerExecution > 50) {
        return res.status(400).json({ message: 'Số ảnh tối đa phải từ 1 đến 50' });
      }
      if (merged.maxFileSizeMB < 1 || merged.maxFileSizeMB > 100) {
        return res.status(400).json({ message: 'Kích thước ảnh tối đa phải từ 1MB đến 100MB' });
      }

      await saveStorageConfigToDB(merged);

      return res.json({
        message: 'Lưu cấu hình lưu trữ ảnh thành công',
        provider: merged.provider,
      });
    } catch (error: any) {
      console.error('Error saving storage config:', error);
      return res.status(500).json({ message: 'Lỗi khi lưu cấu hình lưu trữ', error: error.message });
    }
  }

  static async testStorageConnection(req: AuthRequest, res: Response) {
    try {
      // Build a temporary config from request body for testing
      const incoming = req.body as Partial<StorageConfig>;
      const existing = await loadStorageConfig();

      const testConfig: StorageConfig = {
        provider: incoming.provider || existing.provider,
        maxFilesPerExecution: existing.maxFilesPerExecution,
        maxFileSizeMB: existing.maxFileSizeMB,
        local: { ...existing.local, ...incoming.local },
        smb: {
          ...existing.smb,
          ...incoming.smb,
          password: incoming.smb?.password === '********' ? existing.smb.password : (incoming.smb?.password ?? existing.smb.password),
        },
        ftp: {
          ...existing.ftp,
          ...incoming.ftp,
          password: incoming.ftp?.password === '********' ? existing.ftp.password : (incoming.ftp?.password ?? existing.ftp.password),
        },
        googleDrive: {
          ...existing.googleDrive,
          ...incoming.googleDrive,
          authType: incoming.googleDrive?.authType || existing.googleDrive?.authType || 'service_account',
          credentials: incoming.googleDrive?.credentials && typeof incoming.googleDrive.credentials === 'object' && !incoming.googleDrive.credentials.loaded
            ? incoming.googleDrive.credentials
            : existing.googleDrive.credentials,
          oauth2: {
            ...existing.googleDrive?.oauth2,
            ...incoming.googleDrive?.oauth2,
            clientSecret: incoming.googleDrive?.oauth2?.clientSecret === '********'
              ? existing.googleDrive?.oauth2?.clientSecret
              : (incoming.googleDrive?.oauth2?.clientSecret ?? existing.googleDrive?.oauth2?.clientSecret),
            refreshToken: incoming.googleDrive?.oauth2?.refreshToken === '********'
              ? existing.googleDrive?.oauth2?.refreshToken
              : (incoming.googleDrive?.oauth2?.refreshToken ?? existing.googleDrive?.oauth2?.refreshToken),
          },
        },
      };

      const provider = createStorageProvider(testConfig);
      const result = await provider.testConnection();

      return res.json(result);
    } catch (error: any) {
      console.error('Error testing storage connection:', error);
      return res.json({ success: false, message: `Lỗi: ${error.message}` });
    }
  }
}
