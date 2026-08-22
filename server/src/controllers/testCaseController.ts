import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { parseDocument } from '../services/documentParser';
import { AIService } from '../services/ai/aiService';
import { canViewAllExecutionHistory, canViewAllUserTestStats, canViewUserTestStats } from '../services/permissionService';

export class TestCaseController {
  static async generate(req: AuthRequest, res: Response) {
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
        documentText = await parseDocument(file.buffer, file.mimetype, file.originalname);
      } else if (rawText) {
        documentText = rawText.trim();
        fileSize = Buffer.byteLength(documentText, 'utf8');
      }

      if (!documentText) {
        return res.status(400).json({ message: 'Vui lòng tải lên file tài liệu hoặc dán nội dung văn bản' });
      }

      // Resolve effective AI credentials.
      // Priority:
      // 1) Explicit configId
      // 2) Explicit body apiKey (nếu có nhập)
      // 3) Cấu hình của User cho đúng provider đó
      // 4) Cấu hình mặc định (isActive) của User
      // 5) Cấu hình chung trong Database cho provider đó
      // 6) Bất kỳ cấu hình active nào trong Database
      let effectiveApiKey = apiKey && String(apiKey).trim() ? String(apiKey).trim() : undefined;
      let effectiveProvider = provider || 'gemini';
      let effectiveModelName = modelName;
      let effectiveBaseUrl = baseUrl;

      // 1) Nếu có configId
      if (configId) {
        const savedConfig = req.user
          ? await prisma.aiConfig.findFirst({ where: { id: configId, userId: req.user.id } })
          : await prisma.aiConfig.findUnique({ where: { id: configId } });

        if (savedConfig) {
          effectiveApiKey = savedConfig.apiKey;
          effectiveProvider = savedConfig.provider;
          effectiveModelName = modelName || savedConfig.modelName;
          effectiveBaseUrl = savedConfig.baseUrl || undefined;
        }
      }

      // 2) Nếu chưa có apiKey, tìm cấu hình trong DB
      if (!effectiveApiKey) {
        // 2a. Tìm cấu hình của user cho đúng provider này trước
        if (req.user) {
          const userProviderConfig = await prisma.aiConfig.findFirst({
            where: { userId: req.user.id, provider: effectiveProvider },
            orderBy: { updatedAt: 'desc' },
          });
          if (userProviderConfig) {
            effectiveApiKey = userProviderConfig.apiKey;
            effectiveModelName = effectiveModelName || userProviderConfig.modelName;
            effectiveBaseUrl = effectiveBaseUrl || userProviderConfig.baseUrl || undefined;
          }
        }

        // 2b. Nếu vẫn chưa có, tìm cấu hình active của user
        if (!effectiveApiKey && req.user) {
          const userActiveConfig = await prisma.aiConfig.findFirst({
            where: { userId: req.user.id, isActive: true },
          });
          if (userActiveConfig) {
            effectiveApiKey = userActiveConfig.apiKey;
            effectiveProvider = userActiveConfig.provider;
            effectiveModelName = effectiveModelName || userActiveConfig.modelName;
            effectiveBaseUrl = effectiveBaseUrl || userActiveConfig.baseUrl || undefined;
          }
        }

        // 2c. Nếu vẫn chưa có (hoặc là guest), tìm bất kỳ cấu hình nào trong DB cho provider này
        if (!effectiveApiKey) {
          const systemProviderConfig = await prisma.aiConfig.findFirst({
            where: { provider: effectiveProvider },
            orderBy: { updatedAt: 'desc' },
          });
          if (systemProviderConfig) {
            effectiveApiKey = systemProviderConfig.apiKey;
            effectiveModelName = effectiveModelName || systemProviderConfig.modelName;
            effectiveBaseUrl = effectiveBaseUrl || systemProviderConfig.baseUrl || undefined;
          }
        }

        // 2d. Fallback cuối cùng trong DB: lấy bất kỳ cấu hình active nào
        if (!effectiveApiKey) {
          const anyActiveConfig = await prisma.aiConfig.findFirst({
            where: { isActive: true },
            orderBy: { updatedAt: 'desc' },
          });
          if (anyActiveConfig) {
            effectiveApiKey = anyActiveConfig.apiKey;
            effectiveProvider = anyActiveConfig.provider;
            effectiveModelName = effectiveModelName || anyActiveConfig.modelName;
            effectiveBaseUrl = effectiveBaseUrl || anyActiveConfig.baseUrl || undefined;
          }
        }
      }

      // Call AI Service
      const aiResult = await AIService.generateTestCases({
        documentContent: documentText,
        provider: effectiveProvider,
        apiKey: effectiveApiKey,
        modelName: effectiveModelName,
        baseUrl: effectiveBaseUrl,
        customInstruction,
      });

      // Save to PostgreSQL if user is authenticated or demo mode
      let savedDocId: string | null = null;
      let savedSuiteId: string | null = null;

      // Find or create default user if anonymous
      let userId = req.user?.id;
      if (!userId) {
        let defaultUser = await prisma.user.findFirst({ where: { email: 'guest@system.local' } });
        if (!defaultUser) {
          defaultUser = await prisma.user.create({
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
      const doc = await prisma.document.create({
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
      const suite = await prisma.testSuite.create({
        data: {
          documentId: savedDocId,
          name: typeof (suiteName || aiResult.moduleName || filename) === 'string' ? (suiteName || aiResult.moduleName || filename) : String(suiteName || aiResult.moduleName || filename),
          moduleName: typeof (aiResult.moduleName || 'Tổng hợp') === 'string' ? (aiResult.moduleName || 'Tổng hợp') : String(aiResult.moduleName || 'Tổng hợp'),
          summary: Array.isArray(aiResult.summary) ? aiResult.summary.join('\n') : (aiResult.summary ? String(aiResult.summary) : null),
          assumptions: Array.isArray(aiResult.assumptions) ? aiResult.assumptions.join('\n') : (aiResult.assumptions ? String(aiResult.assumptions) : null),
        },
      });
      savedSuiteId = suite.id;

      const formatField = (val: any, isNumbered = false): string => {
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) {
          if (isNumbered) {
            return val
              .map((item, idx) => {
                const str = typeof item === 'object' ? JSON.stringify(item) : String(item).trim();
                return /^\d+[\.\)]\s*/.test(str) ? str : `${idx + 1}. ${str}`;
              })
              .join('\n');
          }
          return val
            .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item).trim()))
            .join('\n');
        }
        if (typeof val === 'object') return JSON.stringify(val, null, 2);
        return String(val).trim();
      };

      // Save TestCases and default executions
      const createdTestCases = await Promise.all(
        aiResult.testCases.map(async (tc, idx) => {
          const testCase = await prisma.testCase.create({
            data: {
              testSuiteId: suite.id,
              testCaseCode: formatField(tc.testCaseCode) || `TC_${String(idx + 1).padStart(3, '0')}`,
              module: formatField(tc.module) || 'Chung',
              platform: formatField(tc.platform) || 'App',
              title: formatField(tc.title) || `Kịch bản kiểm thử ${idx + 1}`,
              testType: formatField(tc.testType) || 'Luồng chuẩn',
              preconditions: formatField(tc.preconditions),
              steps: formatField(tc.steps, true),
              expectedResult: formatField(tc.expectedResult),
              priority: formatField(tc.priority) || 'Cao',
              orderIndex: idx + 1,
            },
          });

          // Create initial UNTESTED execution
          const execution = await prisma.testExecution.create({
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
        })
      );

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
    } catch (error: any) {
      console.error('Generate test cases error:', error);
      return res.status(500).json({
        message: 'Lỗi trong quá trình sinh Test Case bằng AI',
        error: error.message,
      });
    }
  }

  static async getSuites(req: AuthRequest, res: Response) {
    try {
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;
      const canViewAll = await canViewAllExecutionHistory(currentUserId, currentUserRole);
      
      const suites = await prisma.testSuite.findMany({
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
          // Filter executions based on permissions
          let filteredExecutions = tc.executions;
          if (!canViewAll && currentUserId) {
            filteredExecutions = tc.executions.filter((e) => e.executedById === currentUserId);
          }
          
          const userExec = currentUserId
            ? filteredExecutions.find((e) => e.executedById === currentUserId)
            : filteredExecutions[0];
          return {
            ...tc,
            latestExecution: userExec ?? null,
            results: filteredExecutions, // Filtered list of executions based on permissions
          };
        });

        const total = testCasesWithExtras.length;
        let passed = 0;
        let failed = 0;
        let blocked = 0;
        let untested = 0;

        testCasesWithExtras.forEach((tc) => {
          const status = tc.latestExecution?.status || 'UNTESTED';
          if (status === 'PASSED') passed++;
          else if (status === 'FAILED') failed++;
          else if (status === 'BLOCKED') blocked++;
          else untested++;
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
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi tải danh sách Test Suites', error: error.message });
    }
  }

  static async getSuiteById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;
      const canViewAll = await canViewAllExecutionHistory(currentUserId, currentUserRole);
      
      const suite = await prisma.testSuite.findUnique({
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
        // Filter executions based on permissions
        let filteredExecutions = tc.executions;
        if (!canViewAll && currentUserId) {
          filteredExecutions = tc.executions.filter((e) => e.executedById === currentUserId);
        }
        
        const userExec = currentUserId
          ? filteredExecutions.find((e) => e.executedById === currentUserId)
          : filteredExecutions[0];
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
          results: filteredExecutions, // Filtered list of executions based on permissions
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
        if (s === 'PASSED') passed++;
        else if (s === 'FAILED') failed++;
        else if (s === 'BLOCKED') blocked++;
        else untested++;
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
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi tải chi tiết Test Suite', error: error.message });
    }
  }

  static async createTestCase(req: AuthRequest, res: Response) {
    try {
      const {
        testSuiteId,
        testCaseCode,
        module,
        platform,
        title,
        testType,
        preconditions,
        steps,
        expectedResult,
        priority,
      } = req.body;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;
      const canViewAll = await canViewAllExecutionHistory(currentUserId, currentUserRole);

      if (!testSuiteId || !title || !module) {
        return res.status(400).json({
          message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (testSuiteId, module, title)',
        });
      }

      // Count existing cases to determine orderIndex
      const count = await prisma.testCase.count({ where: { testSuiteId } });
      const code = testCaseCode || `TC_${String(count + 1).padStart(3, '0')}`;

      const testCase = await prisma.testCase.create({
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
      const initialExec = await prisma.testExecution.create({
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

      // Filter executions based on permissions (for consistency)
      const filteredExecutions = canViewAll || !currentUserId ? [initialExec] : (initialExec.executedById === currentUserId ? [initialExec] : []);

      return res.status(201).json({
        message: 'Tạo Test Case mới thành công',
        testCase: {
          ...testCase,
          latestExecution: filteredExecutions[0] || null,
          executions: filteredExecutions,
        },
      });
    } catch (error: any) {
      console.error('Create test case error:', error);
      return res.status(500).json({ message: 'Lỗi tạo Test Case mới', error: error.message });
    }
  }

  static async updateTestCase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { testCaseCode, module, platform, title, testType, preconditions, steps, expectedResult, priority } = req.body;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;
      const canViewAll = await canViewAllExecutionHistory(currentUserId, currentUserRole);

      const updated = await prisma.testCase.update({
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

      // Filter executions based on permissions
      let filteredExecutions = updated.executions;
      if (!canViewAll && currentUserId) {
        filteredExecutions = updated.executions.filter((e) => e.executedById === currentUserId);
      }

      const userExec = currentUserId
        ? filteredExecutions.find((e) => e.executedById === currentUserId)
        : filteredExecutions[0];

      return res.json({
        message: 'Cập nhật Test Case thành công',
        testCase: {
          ...updated,
          latestExecution: userExec || null,
          executions: filteredExecutions,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi cập nhật Test Case', error: error.message });
    }
  }

  static async deleteTestCase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await prisma.testCase.delete({ where: { id } });
      return res.json({ message: 'Đã xóa Test Case thành công' });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi xóa Test Case', error: error.message });
    }
  }

  static async updateTestSuite(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, moduleName, summary, assumptions } = req.body;

      const updated = await prisma.testSuite.update({
        where: { id },
        data: {
          name,
          moduleName,
          summary,
          assumptions,
          updatedAt: new Date(),
        },
      });

      return res.json({
        message: 'Cập nhật Test Suite thành công',
        testSuite: {
          id: updated.id,
          name: updated.name,
          moduleName: updated.moduleName,
          summary: updated.summary,
          assumptions: updated.assumptions,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi cập nhật Test Suite', error: error.message });
    }
  }

  static async deleteTestSuite(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await prisma.testSuite.delete({ where: { id } });
      return res.json({ message: 'Đã xóa Test Suite thành công' });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi xóa Test Suite', error: error.message });
    }
  }

  static async getUserExecutionStats(req: AuthRequest, res: Response) {
    try {
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;

      if (!currentUserId || !currentUserRole) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const canView = await canViewUserTestStats(currentUserId, currentUserRole);
      if (!canView) {
        return res.status(403).json({ message: 'Bạn không có quyền xem thống kê kiểm thử' });
      }

      const canViewAll = await canViewAllUserTestStats(currentUserId, currentUserRole);

      // Total test cases in the system
      const totalTestCases = await prisma.testCase.count();

      // Find target users
      let targetUsers;
      if (canViewAll) {
        targetUsers = await prisma.user.findMany({
          where: {
            role: { in: ['ADMIN', 'TESTER'] },
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            lastLogin: true,
          },
          orderBy: [
            { role: 'asc' },
            { fullName: 'asc' },
          ],
        });
      } else {
        targetUsers = await prisma.user.findMany({
          where: { id: currentUserId },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            lastLogin: true,
          },
        });
      }

      // Calculate stats for each user
      const userStats = await Promise.all(
        targetUsers.map(async (user) => {
          // Get all executions by this user
          const executions = await prisma.testExecution.findMany({
            where: { executedById: user.id },
            select: {
              testCaseId: true,
              status: true,
              executedAt: true,
            },
            orderBy: { executedAt: 'desc' },
          });

          // Deduplicate to get latest execution status per testCaseId
          const latestStatusMap = new Map<string, string>();
          for (const exec of executions) {
            if (!latestStatusMap.has(exec.testCaseId)) {
              latestStatusMap.set(exec.testCaseId, exec.status);
            }
          }

          let passed = 0;
          let failed = 0;
          let blocked = 0;

          for (const status of latestStatusMap.values()) {
            if (status === 'PASSED') passed++;
            else if (status === 'FAILED') failed++;
            else if (status === 'BLOCKED') blocked++;
          }

          const testedCount = passed + failed + blocked;
          const untested = Math.max(0, totalTestCases - testedCount);
          const passRate = testedCount > 0 ? Math.round((passed / testedCount) * 100) : 0;
          const completionRate = totalTestCases > 0 ? Math.round((testedCount / totalTestCases) * 100) : 0;

          return {
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            status: user.status,
            lastLogin: user.lastLogin,
            totalTestCases,
            untested,
            passed,
            failed,
            blocked,
            testedCount,
            passRate,
            completionRate,
          };
        })
      );

      return res.json({
        canViewAll,
        totalTestCases,
        userStats,
      });
    } catch (error: any) {
      console.error('Error fetching user execution stats:', error);
      return res.status(500).json({ message: 'Lỗi khi lấy thống kê kiểm thử', error: error.message });
    }
  }
}


