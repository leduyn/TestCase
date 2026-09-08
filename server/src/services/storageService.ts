import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import SMB2 from '@marsaud/smb2';
import prisma from '../config/database';
import { slugify } from '../utils/slug';

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
    osType?: 'windows' | 'linux';
    port?: number;
    linuxBackend?: 'smb2' | 'smbclient';
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
    osType: 'windows',
    port: 445,
    linuxBackend: 'smb2',
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
  upload(file: Buffer, filename: string, executionId: string, functionName?: string): Promise<StorageResult>;
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

  async upload(file: Buffer, filename: string, executionId: string, functionName?: string): Promise<StorageResult> {
    const funcFolder = slugify(functionName || '') || 'general';
    const dir = path.join(this.basePath, 'executions', funcFolder, executionId);
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
    const sanitized = storagePath.replace(/^(\/|\\)?uploads(\/|\\)/i, '').replace(/^(\/|\\)+/, '');
    const fullPath = path.resolve(this.basePath, sanitized);
    if (!fullPath.startsWith(this.basePath)) return null;
    if (!fs.existsSync(fullPath)) return null;

    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      // Videos
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.ogv': 'video/ogg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      // Documents & Text
      '.pdf': 'application/pdf',
      '.txt': 'text/plain; charset=utf-8',
      '.log': 'text/plain; charset=utf-8',
      '.json': 'application/json',
      '.csv': 'text/csv; charset=utf-8',
      '.xml': 'application/xml',
      // Archives
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      // Office docs
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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

  constructor(config: StorageConfig['smb']) {
    this.config = config;
    this.uncPath = `\\\\${config.host}\\${config.share}`;
  }

  private get osType(): 'windows' | 'linux' {
    return this.config.osType === 'linux' ? 'linux' : 'windows';
  }

  private normalizeRemotePath(): string {
    return (this.config.remotePath || '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  private mimeTypeFor(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
      '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  private async connectShare(): Promise<void> {
    const { host, share, username, password, domain } = this.config;
    const uncPath = `\\\\${host}\\${share}`;

    // Build net use command (Windows only)
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

  private async getLinuxClient(): Promise<SMB2> {
    return new SMB2({
      share: `\\\\${this.config.host}\\${this.config.share}`,
      domain: this.config.domain || '',
      username: this.config.username,
      password: this.config.password,
      port: this.config.port || 445,
    });
  }

  private async ensureLinuxDir(client: SMB2, dir: string): Promise<void> {
    const parts = dir.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      try {
        await client.mkdir(current);
      } catch (err: any) {
        const exists = await client.exists(current).catch(() => false);
        if (!exists) throw err;
      }
    }
  }

  private safeFolder(functionName?: string): string {
    const slug = slugify(functionName || '');
    return slug || 'general';
  }

  async upload(file: Buffer, filename: string, executionId: string, functionName?: string): Promise<StorageResult> {
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = `${baseName}_${Date.now()}${ext}`;
    const remoteBase = this.normalizeRemotePath();
    const funcFolder = this.safeFolder(functionName);

    if (this.osType === 'linux') {
      const client = await this.getLinuxClient();
      const dir = `/${remoteBase}/${funcFolder}/${executionId}`;
      await this.ensureLinuxDir(client, dir);
      const filePath = `${dir}/${uniqueName}`;
      await client.writeFile(filePath, file);
      return {
        storagePath: `${remoteBase}/${funcFolder}/${executionId}/${uniqueName}`,
        publicUrl: undefined,
      };
    }

    // Windows: net use + UNC path
    await this.connectShare();
    const remotePath = remoteBase.replace(/\//g, '\\');
    const remoteDir = path.join(this.uncPath, remotePath, funcFolder, executionId);
    if (!fs.existsSync(remoteDir)) {
      fs.mkdirSync(remoteDir, { recursive: true });
    }
    const remoteFilePath = path.join(remoteDir, uniqueName);
    fs.writeFileSync(remoteFilePath, file);

    const storagePath = `${remotePath}\\${funcFolder}\\${executionId}\\${uniqueName}`;
    return {
      storagePath: storagePath.replace(/\\/g, '/'),
      publicUrl: undefined,
    };
  }

  async delete(storagePath: string): Promise<void> {
    if (this.osType === 'linux') {
      const client = await this.getLinuxClient();
      try {
        await client.unlink(`/${storagePath}`);
      } catch {
        // ignore if already removed
      }
      return;
    }

    await this.connectShare();
    const fullPath = path.join(this.uncPath, storagePath.replace(/\//g, '\\'));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async getFileStream(storagePath: string): Promise<{ stream: Readable; mimeType: string } | null> {
    const mimeType = this.mimeTypeFor(storagePath);

    if (this.osType === 'linux') {
      const client = await this.getLinuxClient();
      const stream = await client.createReadStream(`/${storagePath}`);
      return { stream, mimeType };
    }

    await this.connectShare();
    const fullPath = path.join(this.uncPath, storagePath.replace(/\//g, '\\'));
    if (!fs.existsSync(fullPath)) return null;
    return { stream: fs.createReadStream(fullPath), mimeType };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.osType === 'linux') {
        const client = await this.getLinuxClient();
        await client.writeFile('/.smb_test', 'test');
        try {
          await client.unlink('/.smb_test');
        } catch {
          // ignore cleanup error
        }
        return { success: true, message: `Kết nối SMB (Linux) thành công: \\\\${this.config.host}\\${this.config.share}` };
      }

      // Windows
      await this.connectShare();
      const remotePath = this.normalizeRemotePath().replace(/\//g, '\\');
      const testDir = path.join(this.uncPath, remotePath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const testFile = path.join(testDir, '.smb_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return { success: true, message: `Kết nối SMB thành công: ${this.uncPath}` };
    } catch (err: any) {
      const step = err.messageName ? ` (bước: ${err.messageName})` : '';
      const ntStatus = err.message && err.message.includes('STATUS_') ? ` [${err.message.match(/STATUS_\w+/)?.[0]}]` : '';
      return { success: false, message: `Lỗi kết nối SMB: ${err.message}${step}${ntStatus}` };
    }
  }
}

// ─── 2b. SMB Linux via smbclient (robust for Samba NAS) ───────────────────────

const NT_STATUS_TEXT: Record<string, string> = {
  'STATUS_INVALID_PARAMETER': 'Tham số không hợp lệ (share/path/auth bị sai)',
  'STATUS_LOGON_FAILURE': 'Sai tài khoản/mật khẩu',
  'STATUS_ACCESS_DENIED': 'Không có quyền truy cập',
  'STATUS_BAD_NETWORK_NAME': 'Tên share không tồn tại trên server',
  'STATUS_NOT_FOUND': 'Không tìm thấy file/thư mục',
};

export class SmbClientLinuxProvider implements StorageProvider {
  private config: StorageConfig['smb'];
  private uncBase: string;

  constructor(config: StorageConfig['smb']) {
    this.config = config;
    this.uncBase = `//${config.host}/${config.share}`;
  }

  private normalizeRemotePath(): string {
    return (this.config.remotePath || '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  private safeFolder(functionName?: string): string {
    const slug = slugify(functionName || '');
    return slug || 'general';
  }

  private mimeTypeFor(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
      '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  private commonArgs(): string[] {
    const args = [this.uncBase, '-U', this.config.username || ''];
    if (this.config.domain) args.push('-W', this.config.domain);
    if (this.config.port) args.push('-p', String(this.config.port));
    return args;
  }

  private env(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (this.config.password) env.PASSWD = this.config.password;
    return env;
  }

  private run(commands: string, ignoreErrors = false): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [...this.commonArgs(), '-c', commands];
      const child = spawn('smbclient', args, { env: this.env() });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code !== 0 && !ignoreErrors) {
          reject(new Error(stderr.trim() || `smbclient exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  private async ensureRemoteDir(remoteDirBackslash: string): Promise<void> {
    const parts = remoteDirBackslash.split('\\').filter(Boolean);
    let cur = '';
    for (const part of parts) {
      cur += (cur ? '\\' : '') + part;
      await this.run(`mkdir "${cur}"`, true).catch(() => {});
    }
  }

  async upload(file: Buffer, filename: string, executionId: string, functionName?: string): Promise<StorageResult> {
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = `${baseName}_${Date.now()}${ext}`;
    const remoteBase = this.normalizeRemotePath();
    const funcFolder = this.safeFolder(functionName);

    const localTemp = path.resolve('./uploads/_smbclient_temp');
    if (!fs.existsSync(localTemp)) fs.mkdirSync(localTemp, { recursive: true });
    const localFile = path.join(localTemp, uniqueName);
    fs.writeFileSync(localFile, file);

    const remoteDir = `${remoteBase}\\${funcFolder}\\${executionId}`;
    try {
      await this.ensureRemoteDir(remoteDir);
      const remoteFile = `${remoteDir}\\${uniqueName}`;
      await this.run(`put "${localFile}" "${remoteFile}"`);
    } finally {
      try { fs.unlinkSync(localFile); } catch {}
    }

    return {
      storagePath: `${remoteBase}/${funcFolder}/${executionId}/${uniqueName}`,
      publicUrl: undefined,
    };
  }

  async delete(storagePath: string): Promise<void> {
    const remote = storagePath.replace(/\//g, '\\');
    await this.run(`del "${remote}"`, true).catch(() => {});
  }

  async getFileStream(storagePath: string): Promise<{ stream: Readable; mimeType: string } | null> {
    const mimeType = this.mimeTypeFor(storagePath);
    const remote = storagePath.replace(/\//g, '\\');
    const args = [...this.commonArgs(), '-c', `get "${remote}" -`];
    const child = spawn('smbclient', args, { env: this.env() });
    child.on('error', () => {});
    return { stream: child.stdout, mimeType };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.run('pwd');
      return {
        success: true,
        message: `Kết nối SMB (smbclient) thành công: ${this.uncBase}`,
      };
    } catch (err: any) {
      const m = err.message || String(err);
      const code = m.match(/STATUS_\w+/)?.[0];
      const hint = code && NT_STATUS_TEXT[code] ? ` — ${NT_STATUS_TEXT[code]}` : '';
      const missing = m.includes('ENOENT') ? ' — không tìm thấy lệnh smbclient (hãy cài: apt install smbclient)' : '';
      return { success: false, message: `Lỗi kết nối SMB (smbclient): ${m}${hint}${missing}` };
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

  async upload(file: Buffer, filename: string, executionId: string, functionName?: string): Promise<StorageResult> {
    const client = await this.getClient();
    try {
      const funcFolder = slugify(functionName || '') || 'general';
      const remotePath = `${this.config.remotePath}/${funcFolder}/${executionId}`;
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

  private async findOrCreateFolder(name: string, parentId: string): Promise<string> {
    const drive = await this.getDrive();
    const escaped = name.replace(/'/g, "\\'");
    const list = await drive.files.list({
      q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (list.data.files && list.data.files.length > 0) {
      return list.data.files[0].id!;
    }
    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    return created.data.id!;
  }

  async upload(file: Buffer, filename: string, executionId: string, functionName?: string): Promise<StorageResult> {
    const drive = await this.getDrive();

    // Find or create function-name folder, then execution subfolder inside it
    const funcFolderId = await this.findOrCreateFolder(functionName || 'general', this.config.folderId.trim());

    // Create execution subfolder
    const folderMeta = await drive.files.create({
      requestBody: {
        name: executionId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [funcFolderId],
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
      if (config.smb.osType === 'linux' && config.smb.linuxBackend === 'smbclient') {
        return new SmbClientLinuxProvider(config.smb);
      }
      return new SmbStorageProvider(config.smb);
    case 'ftp':
      return new FtpStorageProvider(config.ftp);
    case 'google_drive':
      return new GoogleDriveStorageProvider(config.googleDrive);
    default:
      return new LocalStorageProvider(config.local);
  }
}
