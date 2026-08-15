"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingController = void 0;
const database_1 = __importDefault(require("../config/database"));
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
class SettingController {
    static async getEnvironments(_req, res) {
        try {
            const serverSetting = await database_1.default.systemSetting.findUnique({
                where: { key: 'environments_servers' },
            });
            const osSetting = await database_1.default.systemSetting.findUnique({
                where: { key: 'environments_os' },
            });
            let servers = DEFAULT_SERVERS;
            let osList = DEFAULT_OS_LIST;
            if (serverSetting?.value) {
                try {
                    const parsed = JSON.parse(serverSetting.value);
                    if (Array.isArray(parsed) && parsed.length > 0)
                        servers = parsed;
                }
                catch {
                    // ignore
                }
            }
            if (osSetting?.value) {
                try {
                    const parsed = JSON.parse(osSetting.value);
                    if (Array.isArray(parsed) && parsed.length > 0)
                        osList = parsed;
                }
                catch {
                    // ignore
                }
            }
            return res.json({ servers, osList });
        }
        catch (error) {
            console.error('Error fetching environment settings:', error);
            return res.json({ servers: DEFAULT_SERVERS, osList: DEFAULT_OS_LIST });
        }
    }
    static async saveEnvironments(req, res) {
        try {
            const { servers, osList } = req.body;
            if (!Array.isArray(servers) || !Array.isArray(osList)) {
                return res.status(400).json({ message: 'Dữ liệu servers hoặc osList không hợp lệ' });
            }
            const cleanServers = Array.from(new Set(servers.map((s) => String(s).trim()).filter(Boolean)));
            const cleanOsList = Array.from(new Set(osList.map((o) => String(o).trim()).filter(Boolean)));
            await database_1.default.systemSetting.upsert({
                where: { key: 'environments_servers' },
                update: { value: JSON.stringify(cleanServers) },
                create: { key: 'environments_servers', value: JSON.stringify(cleanServers) },
            });
            await database_1.default.systemSetting.upsert({
                where: { key: 'environments_os' },
                update: { value: JSON.stringify(cleanOsList) },
                create: { key: 'environments_os', value: JSON.stringify(cleanOsList) },
            });
            return res.json({
                message: 'Lưu danh sách Server & Hệ điều hành thành công',
                servers: cleanServers,
                osList: cleanOsList,
            });
        }
        catch (error) {
            console.error('Error saving environment settings:', error);
            return res.status(500).json({
                message: 'Lỗi khi lưu cấu hình môi trường',
                error: error.message,
            });
        }
    }
}
exports.SettingController = SettingController;
