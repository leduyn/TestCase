"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionController = void 0;
const database_1 = __importDefault(require("../config/database"));
class ExecutionController {
    static async executeTestCase(req, res) {
        try {
            const { testCaseId } = req.params;
            const { server, os, status, actualResult, evaluation, notes } = req.body;
            if (!testCaseId) {
                return res.status(400).json({ message: 'Thiếu testCaseId' });
            }
            // Validate status
            const validStatuses = ['PASSED', 'FAILED', 'BLOCKED', 'UNTESTED'];
            const executionStatus = validStatuses.includes(status) ? status : 'UNTESTED';
            const execution = await database_1.default.testExecution.create({
                data: {
                    testCaseId,
                    executedById: req.user?.id || null,
                    server: server || null,
                    os: os || null,
                    status: executionStatus,
                    actualResult: actualResult || null,
                    evaluation: evaluation || null,
                    notes: notes || null,
                },
                include: {
                    executedBy: {
                        select: { fullName: true, email: true },
                    },
                },
            });
            return res.json({
                message: 'Lưu kết quả kiểm thử thành công',
                execution,
            });
        }
        catch (error) {
            console.error('Execute test case error:', error);
            return res.status(500).json({ message: 'Lỗi khi lưu kết quả kiểm thử', error: error.message });
        }
    }
    static async getHistory(req, res) {
        try {
            const { testCaseId } = req.params;
            const history = await database_1.default.testExecution.findMany({
                where: { testCaseId },
                orderBy: { executedAt: 'desc' },
                include: {
                    executedBy: {
                        select: { fullName: true, email: true },
                    },
                },
            });
            return res.json({ history });
        }
        catch (error) {
            return res.status(500).json({ message: 'Lỗi tải lịch sử thực thi', error: error.message });
        }
    }
}
exports.ExecutionController = ExecutionController;
