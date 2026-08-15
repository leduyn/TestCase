"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCaseController = void 0;
const database_1 = __importDefault(require("../config/database"));
const documentParser_1 = require("../services/documentParser");
const aiService_1 = require("../services/ai/aiService");
class TestCaseController {
    static async generate(req, res) {
        try {
            const file = req.file;
            const { rawText, customInstruction, provider, apiKey, modelName, baseUrl, suiteName, configId } = req.body;
            let documentText = '';
            let filename = 'Direct Input Document';
            let fileType = 'text/plain';
            let fileSize = 0;
            if (file) {
                filename = file.originalname;
                fileType = file.mimetype;
                fileSize = file.size;
                documentText = await (0, documentParser_1.parseDocument)(file.buffer, file.mimetype, file.originalname);
            }
            else if (rawText) {
                documentText = rawText.trim();
                fileSize = Buffer.byteLength(documentText, 'utf8');
            }
            if (!documentText) {
                return res.status(400).json({ message: 'Vui lòng tải lên file tài liệu hoặc dán nội dung văn bản' });
            }
            // Resolve effective AI credentials.
            // Priority: 1) explicit saved config (configId) -> 2) body apiKey -> 3) active saved config
            let effectiveApiKey = apiKey;
            let effectiveProvider = provider || 'gemini';
            let effectiveModelName = modelName;
            let effectiveBaseUrl = baseUrl;
            if (configId && req.user) {
                const savedConfig = await database_1.default.aiConfig.findFirst({
                    where: { id: configId, userId: req.user.id },
                });
                if (savedConfig) {
                    effectiveApiKey = savedConfig.apiKey;
                    effectiveProvider = savedConfig.provider;
                    effectiveModelName = modelName || savedConfig.modelName;
                    effectiveBaseUrl = savedConfig.baseUrl || undefined;
                }
            }
            if (!effectiveApiKey && req.user) {
                const savedConfig = await database_1.default.aiConfig.findFirst({
                    where: { userId: req.user.id, isActive: true },
                });
                if (savedConfig) {
                    effectiveApiKey = savedConfig.apiKey;
                    effectiveProvider = savedConfig.provider;
                    effectiveModelName = savedConfig.modelName;
                    effectiveBaseUrl = savedConfig.baseUrl || undefined;
                }
            }
            // Call AI Service
            const aiResult = await aiService_1.AIService.generateTestCases({
                documentContent: documentText,
                provider: effectiveProvider,
                apiKey: effectiveApiKey,
                modelName: effectiveModelName,
                baseUrl: effectiveBaseUrl,
                customInstruction,
            });
            // Save to PostgreSQL if user is authenticated or demo mode
            let savedDocId = null;
            let savedSuiteId = null;
            // Find or create default user if anonymous
            let userId = req.user?.id;
            if (!userId) {
                let defaultUser = await database_1.default.user.findFirst({ where: { email: 'guest@system.local' } });
                if (!defaultUser) {
                    defaultUser = await database_1.default.user.create({
                        data: {
                            email: 'guest@system.local',
                            passwordHash: 'guest_hash',
                            fullName: 'Guest User',
                            role: 'TESTER',
                        },
                    });
                }
                userId = defaultUser.id;
            }
            // Save document
            const doc = await database_1.default.document.create({
                data: {
                    userId,
                    filename,
                    fileType,
                    fileSize,
                    rawContent: documentText.slice(0, 50000), // store preview/content
                },
            });
            savedDocId = doc.id;
            // Save TestSuite
            const suite = await database_1.default.testSuite.create({
                data: {
                    documentId: savedDocId,
                    name: suiteName || aiResult.moduleName || filename,
                    moduleName: aiResult.moduleName || 'Tổng hợp',
                    summary: aiResult.summary,
                    assumptions: aiResult.assumptions,
                },
            });
            savedSuiteId = suite.id;
            // Save TestCases and default executions
            const createdTestCases = await Promise.all(aiResult.testCases.map(async (tc, idx) => {
                const testCase = await database_1.default.testCase.create({
                    data: {
                        testSuiteId: suite.id,
                        testCaseCode: tc.testCaseCode || `TC_${idx + 1}`,
                        module: tc.module,
                        platform: tc.platform || 'App',
                        title: tc.title,
                        testType: tc.testType,
                        preconditions: tc.preconditions,
                        steps: tc.steps,
                        expectedResult: tc.expectedResult,
                        priority: tc.priority || 'Cao',
                        orderIndex: idx + 1,
                    },
                });
                // Create initial UNTESTED execution
                const execution = await database_1.default.testExecution.create({
                    data: {
                        testCaseId: testCase.id,
                        executedById: userId,
                        status: 'UNTESTED',
                    },
                });
                return {
                    ...testCase,
                    latestExecution: execution,
                };
            }));
            return res.status(201).json({
                message: 'Phân tích và sinh Test Case thành công',
                testSuite: {
                    id: suite.id,
                    name: suite.name,
                    moduleName: suite.moduleName,
                    summary: suite.summary,
                    assumptions: suite.assumptions,
                    totalCases: createdTestCases.length,
                    createdAt: suite.createdAt,
                },
                testCases: createdTestCases,
            });
        }
        catch (error) {
            console.error('Generate test cases error:', error);
            return res.status(500).json({
                message: 'Lỗi trong quá trình sinh Test Case bằng AI',
                error: error.message,
            });
        }
    }
    static async getSuites(req, res) {
        try {
            const currentUserId = req.user?.id;
            const suites = await database_1.default.testSuite.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    document: {
                        select: { filename: true, fileType: true, fileSize: true },
                    },
                    testCases: {
                        include: {
                            executions: {
                                orderBy: { executedAt: 'desc' },
                                include: {
                                    executedBy: {
                                        select: { id: true, fullName: true, email: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            const formatted = suites.map((suite) => {
                const testCasesWithExtras = suite.testCases.map((tc) => {
                    const userExec = currentUserId
                        ? tc.executions.find((e) => e.executedById === currentUserId)
                        : tc.executions[0];
                    return {
                        ...tc,
                        latestExecution: userExec ?? null,
                        results: tc.executions, // Full list of executions (with user details)
                    };
                });
                const total = testCasesWithExtras.length;
                let passed = 0;
                let failed = 0;
                let blocked = 0;
                let untested = 0;
                testCasesWithExtras.forEach((tc) => {
                    const status = tc.latestExecution?.status || 'UNTESTED';
                    if (status === 'PASSED')
                        passed++;
                    else if (status === 'FAILED')
                        failed++;
                    else if (status === 'BLOCKED')
                        blocked++;
                    else
                        untested++;
                });
                return {
                    id: suite.id,
                    name: suite.name,
                    moduleName: suite.moduleName,
                    summary: suite.summary,
                    assumptions: suite.assumptions,
                    filename: suite.document?.filename || null,
                    createdAt: suite.createdAt,
                    updatedAt: suite.updatedAt,
                    testCases: testCasesWithExtras,
                    stats: {
                        total,
                        passed,
                        failed,
                        blocked,
                        untested,
                        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
                    },
                };
            });
            return res.json({ suites: formatted });
        }
        catch (error) {
            return res.status(500).json({ message: 'Lỗi tải danh sách Test Suites', error: error.message });
        }
    }
    static async getSuiteById(req, res) {
        try {
            const { id } = req.params;
            const currentUserId = req.user?.id;
            const suite = await database_1.default.testSuite.findUnique({
                where: { id },
                include: {
                    document: true,
                    testCases: {
                        orderBy: { orderIndex: 'asc' },
                        include: {
                            executions: {
                                orderBy: { executedAt: 'desc' },
                                include: {
                                    executedBy: {
                                        select: { id: true, fullName: true, email: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!suite) {
                return res.status(404).json({ message: 'Không tìm thấy bộ Test Suite' });
            }
            const testCases = suite.testCases.map((tc) => {
                const userExec = currentUserId
                    ? tc.executions.find((e) => e.executedById === currentUserId)
                    : tc.executions[0];
                return {
                    id: tc.id,
                    testSuiteId: tc.testSuiteId,
                    testCaseCode: tc.testCaseCode,
                    module: tc.module,
                    platform: tc.platform,
                    title: tc.title,
                    testType: tc.testType,
                    preconditions: tc.preconditions,
                    steps: tc.steps,
                    expectedResult: tc.expectedResult,
                    priority: tc.priority,
                    orderIndex: tc.orderIndex,
                    createdAt: tc.createdAt,
                    latestExecution: userExec || null,
                    results: tc.executions, // Full list of executions (with user details)
                };
            });
            // Calculate stats
            const total = testCases.length;
            let passed = 0;
            let failed = 0;
            let blocked = 0;
            let untested = 0;
            testCases.forEach((tc) => {
                const s = tc.latestExecution?.status || 'UNTESTED';
                if (s === 'PASSED')
                    passed++;
                else if (s === 'FAILED')
                    failed++;
                else if (s === 'BLOCKED')
                    blocked++;
                else
                    untested++;
            });
            return res.json({
                suite: {
                    id: suite.id,
                    name: suite.name,
                    moduleName: suite.moduleName,
                    summary: suite.summary,
                    assumptions: suite.assumptions,
                    filename: suite.document?.filename || null,
                    createdAt: suite.createdAt,
                    updatedAt: suite.updatedAt,
                },
                testCases,
            });
        }
        catch (error) {
            return res.status(500).json({ message: 'Lỗi tải chi tiết Test Suite', error: error.message });
        }
    }
    static async createTestCase(req, res) {
        try {
            const { testSuiteId, testCaseCode, module, platform, title, testType, preconditions, steps, expectedResult, priority, } = req.body;
            if (!testSuiteId || !title || !module) {
                return res.status(400).json({
                    message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (testSuiteId, module, title)',
                });
            }
            // Count existing cases to determine orderIndex
            const count = await database_1.default.testCase.count({ where: { testSuiteId } });
            const code = testCaseCode || `TC_${String(count + 1).padStart(3, '0')}`;
            const testCase = await database_1.default.testCase.create({
                data: {
                    testSuiteId,
                    testCaseCode: code,
                    module,
                    platform: platform || 'App',
                    title,
                    testType: testType || 'Luồng chuẩn',
                    preconditions: preconditions || '',
                    steps: steps || '',
                    expectedResult: expectedResult || '',
                    priority: priority || 'Cao',
                    orderIndex: count + 1,
                },
            });
            // Create initial UNTESTED execution
            const initialExec = await database_1.default.testExecution.create({
                data: {
                    testCaseId: testCase.id,
                    executedById: req.user?.id || null,
                    status: 'UNTESTED',
                },
                include: {
                    executedBy: {
                        select: { id: true, fullName: true, email: true },
                    },
                },
            });
            return res.status(201).json({
                message: 'Tạo Test Case mới thành công',
                testCase: {
                    ...testCase,
                    latestExecution: initialExec,
                    executions: [initialExec],
                },
            });
        }
        catch (error) {
            console.error('Create test case error:', error);
            return res.status(500).json({ message: 'Lỗi tạo Test Case mới', error: error.message });
        }
    }
    static async updateTestCase(req, res) {
        try {
            const { id } = req.params;
            const { testCaseCode, module, platform, title, testType, preconditions, steps, expectedResult, priority } = req.body;
            const updated = await database_1.default.testCase.update({
                where: { id },
                data: {
                    testCaseCode,
                    module,
                    platform,
                    title,
                    testType,
                    preconditions,
                    steps,
                    expectedResult,
                    priority,
                },
                include: {
                    executions: {
                        orderBy: { executedAt: 'desc' },
                        include: {
                            executedBy: {
                                select: { id: true, fullName: true, email: true },
                            },
                        },
                    },
                },
            });
            const currentUserId = req.user?.id;
            const userExec = currentUserId
                ? updated.executions.find((e) => e.executedById === currentUserId)
                : updated.executions[0];
            return res.json({
                message: 'Cập nhật Test Case thành công',
                testCase: {
                    ...updated,
                    latestExecution: userExec || null,
                    executions: updated.executions,
                },
            });
        }
        catch (error) {
            return res.status(500).json({ message: 'Lỗi cập nhật Test Case', error: error.message });
        }
    }
    static async deleteTestCase(req, res) {
        try {
            const { id } = req.params;
            await database_1.default.testCase.delete({ where: { id } });
            return res.json({ message: 'Đã xóa Test Case thành công' });
        }
        catch (error) {
            return res.status(500).json({ message: 'Lỗi xóa Test Case', error: error.message });
        }
    }
}
exports.TestCaseController = TestCaseController;
