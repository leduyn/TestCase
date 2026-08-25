import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '../config/database';

const execAsync = promisify(exec);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StorageResult {
  storagePath: string;
  publicUrl?: string;
}

export interface StorageConfig {
  provider: 'local' | 'smb' | 'ftp' | 'google_drive';
  maxFilesPerExecution: number;
  maxFileSizeMB: number;
  local: {
    uploadPath: string;
  };
  smb: {
    host: string;
    share: string;
    username: string;
    password: string;
    domain: string;
    remotePath: string;
  };
  ftp: {
    host: string;
    port: number;
    username: string;
    password: string;
    remotePath: string;
    secure: boolean;
  };
  googleDrive: {
    authType: 'service_account' | 'oauth2';
    folderId: string;
    credentials: any;
    oauth2: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    };
  };
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  provider: 'local',
  maxFilesPerExecution: 10,
  maxFileSizeMB: 10,
  local: {
    uploadPath: './uploads',
  },
  smb: {
    host: '',
    share: '',
    username: '',
    password: '',
    domain: '',
    remotePath: '/testcase-images',
  },
  ftp: {
    host: '',
    port: 21,
    username: '',
    password: '',
    remotePath: '/testcase-images',
    secure: false,
  },
  googleDrive: {
    authType: 'service_account',
    folderId: '',
    credentials: null,
    oauth2: {
      clientId: '',
      clientSecret: '',
      refreshToken: '',
    },
  },
};

// ─── Storage Provider Interface ─────────────────────────────────────────────

export interface StorageProvider {
  upload(file: Buffer, filename: string, executionId: string): Promise<StorageResult>;
  delete(storagePath: string): Promise<void>;
  getFileStream(storagePath: string): Promise<{ stream: Readable; mimeType: string } | null>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

// ─── 1. Local Storage Provider ──────────────────────────────────────────────

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(config: StorageConfig['local']) {
    this.basePath = path.resolve(config.uploadPath);
  }

  async upload(file: Buffer, filename: string, executionId: string): Promise<StorageResult> {
    const dir = path.join(this.basePath, 'executions', executionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Generate unique filename to avoid collisions
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = `${baseName}_${Date.now()}${ext}`;
    const filePath = path.join(dir, uniqueName);

    fs.writeFileSync(filePath, file);

    const relativePath = path.relative(this.basePath, filePath).replace(/\\/g, '/');
    return {
      storagePath: relativePath,
      publicUrl: `/uploads/${relativePath}`,
    };
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, storagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async getFileStream(storagePath: string): Promise<{ stream: Readable; mimeType: string } | null> {
    const fullPath = path.join(this.basePath, storagePath);
    if (!fs.existsSync(fullPath)) return null;

    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      // Video formats
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.ogv': 'video/ogg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(fullPath);
    return { stream, mimeType };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
      }
      // Write a test file and delete
      const testFile = path.join(this.basePath, '.connection_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return { success: true, message: `Thư mục lưu trữ hoạt động bình thường: ${this.basePath}` };
    } catch (err: any) {
      return { success: false, message: `Lỗi truy cập thư mục: ${err.message}` };
    }
  }
}

// ─── 2. SMB Storage Provider ────────────────────────────────────────────────

export class SmbStorageProvider implements StorageProvider {
  private config: StorageConfig['smb'];
  private uncPath: string;
  private localTempPath: string;

  constructor(config: StorageConfig['smb']) {
    this.config = config;
    this.uncPath = `\\\\${config.host}\\${config.share}`;
    this.localTempPath = path.resolve('./uploads/_smb_temp');
    if (!fs.existsSync(this.localTempPath)) {
      fs.mkdirSync(this.localTempPath, { recursive: true });
    }
  }

  private async connectShare(): Promise<void> {
    const { host, share, username, password, domain } = this.config;
    const uncPath = `\\\\${host}\\${share}`;
    
    // Build net use command
    let cmd = `net use "${uncPath}"`;
    if (password) cmd += ` "${password}"`;
    if (username) {
      const user = domain ? `${domain}\\${username}` : username;
      cmd += ` /user:"${user}"`;
    }
    cmd += ' /persistent:no';

    try {
      await execAsync(cmd);
    } catch (err: any) {
      // If already connected, ignore error 85
      if (!err.message.includes('85')) {
        throw new Error(`Không thể kết nối SMB share: ${err.message}`);
      }
    }
  }

  async upload(file: Buffer, filename: string, executionId: string): Promise<StorageResult> {
    await this.connectShare();

    const remotePath = this.config.remotePath.replace(/^\//, '').replace(/\//g, '\\');
    const remoteDir = path.join(this.uncPath, remotePath, executionId);
    
    // Create remote directory
    if (!fs.existsSync(remoteDir)) {
      fs.mkdirSync(remoteDir, { recursive: true });
    }

    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = `${baseName}_${Date.now()}${ext}`;
    const remoteFilePath = path.join(remoteDir, uniqueName);

    fs.writeFileSync(remoteFilePath, file);

    const storagePath = `${remotePath}\\${executionId}\\${uniqueName}`;
    return {
      storagePath,
      publicUrl: undefined,
    };
  }

  async delete(storagePath: string): Promise<void> {
    await this.connectShare();
    const fullPath = path.join(this.uncPath, storagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async getFileStream(storagePath: string): Promise<{ stream: Readable; mimeType: string } | null> {
    await this.connectShare();
    const fullPath = path.join(this.uncPath, storagePath);
    if (!fs.existsSync(fullPath)) return null;

    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
      '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
    };
    return { stream: fs.createReadStream(fullPath), mimeType: mimeMap[ext] || 'application/octet-stream' };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connectShare();
      const remotePath = this.config.remotePath.replace(/^\//, '').replace(/\//g, '\\');
      const testDir = path.join(this.uncPath, remotePath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const testFile = path.join(testDir, '.smb_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return { success: true, message: `Kết nối SMB thành công: ${this.uncPath}` };
    } catch (err: any) {
      return { success: false, message: `Lỗi kết nối SMB: ${err.message}` };
    }
  }
}

// ─── 3. FTP Storage Provider ────────────────────────────────────────────────

export class FtpStorageProvider implements StorageProvider {
  private config: StorageConfig['ftp'];

  constructor(config: StorageConfig['ftp']) {
    this.config = config;
  }

  private async getClient() {
    // Dynamic import to avoid crash if basic-ftp is not installed
    const { Client } = await import('basic-ftp');
    const client = new Client();
    client.ftp.verbose = false;
    await client.access({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      secure: this.config.secure,
    });
    return client;
  }

  async upload(file: Buffer, filename: string, executionId: string): Promise<StorageResult> {
    const client = await this.getClient();
    try {
      const remotePath = `${this.config.remotePath}/${executionId}`;
      await client.ensureDir(remotePath);

      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      const uniqueName = `${baseName}_${Date.now()}${ext}`;
      const remoteFile = `${remotePath}/${uniqueName}`;

      const stream = Readable.from(file);
      await client.uploadFrom(stream, remoteFile);

      return {
        storagePath: remoteFile,
        publicUrl: undefined,
      };
    } finally {
      client.close();
    }
  }

  async delete(storagePath: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.remove(storagePath);
    } finally {
      client.close();
    }
  }

  async getFileStream(storagePath: string): Promise<{ stream: Readable; mimeType: string } | null> {
    const client = await this.getClient();
    try {
      // Download to temp file then stream
      const tempDir = path.resolve('./uploads/_ftp_temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFile = path.join(tempDir, `ftp_${Date.now()}_${path.basename(storagePath)}`);
      await client.downloadTo(tempFile, storagePath);

      const ext = path.extname(storagePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
        '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
      };

      const stream = fs.createReadStream(tempFile);
      stream.on('end', () => {
        // Clean up temp file after streaming
        try { fs.unlinkSync(tempFile); } catch {}
      });

      return { stream, mimeType: mimeMap[ext] || 'application/octet-stream' };
    } catch {
      client.close();
      return null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const client = await this.getClient();
      const list = await client.list(this.config.remotePath).catch(() => []);
      client.close();
      return { success: true, message: `Kết nối FTP thành công: ${this.config.host}:${this.config.port} (${list.length} files trong thư mục)` };
    } catch (err: any) {
      return { success: false, message: `Lỗi kết nối FTP: ${err.message}` };
    }
  }
}

// ─── 4. Google Drive Storage Provider ───────────────────────────────────────

export class GoogleDriveStorageProvider implements StorageProvider {
  private config: StorageConfig['googleDrive'];

  constructor(config: StorageConfig['googleDrive']) {
    this.config = config;
  }

  private async getDrive() {
    const { google } = await import('googleapis');
    if (this.config.authType === 'oauth2' && this.config.oauth2?.refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        this.config.oauth2.clientId,
        this.config.oauth2.clientSecret,
        'https://developers.google.com/oauthplayground'
      );
      oauth2Client.setCredentials({
        refresh_token: this.config.oauth2.refreshToken,
      });
      return google.drive({ version: 'v3', auth: oauth2Client });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: this.config.credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
  }

  async upload(file: Buffer, filename: string, executionId: string): Promise<StorageResult> {
    const drive = await this.getDrive();

    // Find or create subfolder for this execution
    let folderId = this.config.folderId.trim();

    // Create execution subfolder
    const folderMeta = await drive.files.create({
      requestBody: {
        name: executionId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    const execFolderId = folderMeta.data.id!;

    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = `${baseName}_${Date.now()}${ext}`;

    const extMimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
      '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
    };
    const mimeType = extMimeMap[ext.toLowerCase()] || 'application/octet-stream';

    const res = await drive.files.create({
      requestBody: {
        name: uniqueName,
        parents: [execFolderId],
      },
      media: {
        mimeType,
        body: Readable.from(file),
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    // Make file viewable by anyone with link
    try {
      await drive.permissions.create({
        fileId: res.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      });
    } catch (permErr: any) {
      console.warn('Could not set public permission on Google Drive file:', permErr.message);
    }

    return {
      storagePath: res.data.id!,
      publicUrl: res.data.webContentLink || res.data.webViewLink || undefined,
    };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const drive = await this.getDrive();
      await drive.files.delete({ fileId: storagePath, supportsAllDrives: true });
    } catch (err: any) {
      console.warn('Error deleting from Google Drive:', err.message);
    }
  }

  async getFileStream(storagePath: string): Promise<{ stream: Readable; mimeType: string } | null> {
    try {
      const drive = await this.getDrive();
      const meta = await drive.files.get({ fileId: storagePath, fields: 'mimeType', supportsAllDrives: true });
      const res = await drive.files.get(
        { fileId: storagePath, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      return {
        stream: res.data as unknown as Readable,
        mimeType: meta.data.mimeType || 'application/octet-stream',
      };
    } catch (err: any) {
      console.error('GoogleDrive getFileStream error:', err?.message || err);
      return null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const drive = await this.getDrive();
      const folderId = this.config.folderId.trim();
      if (!folderId) {
        return { success: false, message: 'Chưa nhập Google Drive Folder ID' };
      }
      const res = await drive.files.get({
        fileId: folderId,
        fields: 'name, id',
        supportsAllDrives: true,
      });
      return { success: true, message: `Kết nối Google Drive thành công! Thư mục: "${res.data.name}"` };
    } catch (err: any) {
      const clientEmail = this.config.credentials?.client_email;
      const hint = clientEmail
        ? `\n👉 Gợi ý: Hãy mở Google Drive, click chuột phải vào thư mục này -> "Chia sẻ" (Share) cho email: ${clientEmail} với quyền "Người chỉnh sửa" (Editor).`
        : '';
      return { success: false, message: `Lỗi kết nối Google Drive: ${err.message}.${hint}` };
    }
  }
}

// ─── Storage Factory ────────────────────────────────────────────────────────

export async function getStorageConfig(): Promise<StorageConfig> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'storage_config' },
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      return { ...DEFAULT_STORAGE_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load storage config, using defaults:', err);
  }
  return DEFAULT_STORAGE_CONFIG;
}

export async function saveStorageConfigToDB(config: StorageConfig): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: 'storage_config' },
    update: { value: JSON.stringify(config) },
    create: { key: 'storage_config', value: JSON.stringify(config) },
  });
}

export function createStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case 'local':
      return new LocalStorageProvider(config.local);
    case 'smb':
      return new SmbStorageProvider(config.smb);
    case 'ftp':
      return new FtpStorageProvider(config.ftp);
    case 'google_drive':
      return new GoogleDriveStorageProvider(config.googleDrive);
    default:
      return new LocalStorageProvider(config.local);
  }
}
