import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  Expand,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Edit3,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { testCaseApi, exportApi, environmentApi, suiteApi, uploadApi } from '../services/api';
import type { TestSuite, TestCase, TestExecution, TestExecutionImage } from '../types';
import { StatusBadge, PlatformBadge, PriorityBadge, TestTypeBadge } from '../components/Badge';
import { ExecutionDrawer } from '../components/ExecutionDrawer';
import { TestCaseModal } from '../components/TestCaseModal';
import { ImageLightbox } from '../components/ImageLightbox';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

export const SuiteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const canCreateTestCase = hasPermission('testcase:create');
  const canUpdateTestCase = hasPermission('testcase:update');
  const canDeleteTestCase = hasPermission('testcase:delete');
  const canExecuteTestCase = hasPermission('testcase:execute');
  const canUpdateSuite = hasPermission('testsuite:update');
  const canDeleteSuite = hasPermission('testsuite:delete');
  const canExport = hasPermission('testcase:export');

  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuredServers, setConfiguredServers] = useState<string[]>([]);
  const [configuredOsList, setConfiguredOsList] = useState<string[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL'); // 'ALL' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'UNTESTED'
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL'); // 'ALL' | 'App' | 'CMS' | 'Web'
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedServer, setSelectedServer] = useState<string>('ALL');
  const [selectedOs, setSelectedOs] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected Test Case for Execution Drawer
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialEditing, setDrawerInitialEditing] = useState(false);
  const [drawerInitialExecution, setDrawerInitialExecution] = useState<TestExecution | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Create / Edit TestCase Modal
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);
  const [testCaseToEdit, setTestCaseToEdit] = useState<TestCase | null>(null);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [testCaseToDelete, setTestCaseToDelete] = useState<TestCase | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Suite Edit Modal
  const [isSuiteModalOpen, setIsSuiteModalOpen] = useState(false);
  const [suiteToEdit, setSuiteToEdit] = useState<TestSuite | null>(null);
  const [updatingSuite, setUpdatingSuite] = useState(false);

  // Suite Delete Confirmation Modal
  const [isDeleteSuiteModalOpen, setIsDeleteSuiteModalOpen] = useState(false);
  const [deletingSuite, setDeletingSuite] = useState(false);

  // Evidence Lightbox State
  const [lightboxImages, setLightboxImages] = useState<TestExecutionImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const openEvidenceLightbox = (images: TestExecutionImage[], index: number = 0) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const fetchSuiteDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await testCaseApi.getSuiteById(id);
      setSuite(res.data.suite);
      // Map executions and ensure latestExecution is set to the logged-in user's latest execution
      const cases = (res.data.testCases || []).map((tc: any) => {
        const allExecs = tc.executions || tc.results || [];
        const userExec = user?.id
          ? allExecs.find((e: any) => e.executedById === user.id || e.executedBy?.id === user.id)
          : tc.latestExecution || allExecs[0];
        return {
          ...tc,
          executions: allExecs,
          latestExecution: userExec || null,
        };
      });
      setTestCases(cases);
    } catch (err: any) {
      console.error('Error loading suite detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuiteDetails();
    const loadEnvironments = async () => {
      try {
        const res = await environmentApi.getEnvironments();
        if (res.data.servers) setConfiguredServers(res.data.servers);
        if (res.data.osList) setConfiguredOsList(res.data.osList);
      } catch (err) {
        console.warn('Error loading environment options:', err);
      }
    };
    loadEnvironments();

    // Fetch suites list
    suiteApi.getSuites().then(() => {
      // Suites are already fetched by getSuiteById, but we keep this for completeness
    }).catch(err => {
      console.warn('Error fetching suites list:', err);
    });
  }, [id, user?.id]);

  const handleOpenDrawer = (tc: TestCase, editMode: boolean = false, initialExec?: TestExecution | null) => {
    setSelectedTestCase(tc);
    setDrawerInitialEditing(editMode);
    setDrawerInitialExecution(initialExec || null);
    setIsDrawerOpen(true);
  };

  const getLatestExecutionsByUser = (executions?: TestExecution[]) => {
    if (!executions || executions.length === 0) return [];
    const seenUserKeys = new Set<string>();
    const result: TestExecution[] = [];

    for (const ex of executions) {
      const userKey = ex.executedById || ex.executedBy?.email || ex.executedBy?.fullName || 'ANONYMOUS';
      if (!seenUserKeys.has(userKey)) {
        seenUserKeys.add(userKey);
        result.push(ex);
      }
    }
    return result;
  };

  const handleSaveExecution = (updatedTc: TestCase) => {
    setTestCases((prev) =>
      prev.map((item) => {
        if (item.id === updatedTc.id) {
          const newExec = updatedTc.latestExecution!;
          const currentExecs = item.executions || [];
          const updatedExecs = [newExec, ...currentExecs.filter((e) => e.id !== newExec.id)];
          return {
            ...item,
            executions: updatedExecs,
            latestExecution: newExec,
          };
        }
        return item;
      })
    );
    if (selectedTestCase?.id === updatedTc.id) {
      const newExec = updatedTc.latestExecution!;
      const currentExecs = selectedTestCase.executions || [];
      const updatedExecs = [newExec, ...currentExecs.filter((e) => e.id !== newExec.id)];
      setSelectedTestCase({
        ...selectedTestCase,
        executions: updatedExecs,
        latestExecution: newExec,
      });
    }
  };

  // Create & Edit Test Case Handlers
  const handleOpenCreateModal = () => {
    setTestCaseToEdit(null);
    setIsTestCaseModalOpen(true);
  };

  const handleOpenEditModal = (tc: TestCase) => {
    setTestCaseToEdit(tc);
    setIsTestCaseModalOpen(true);
  };

  const handleTestCaseModalSuccess = (savedTc: TestCase, isEdit: boolean) => {
    if (isEdit) {
      setTestCases((prev) =>
        prev.map((item) => (item.id === savedTc.id ? { ...item, ...savedTc } : item))
      );
    } else {
      setTestCases((prev) => [...prev, savedTc]);
    }
  };

  // Suite Edit Handlers
  const handleOpenSuiteModal = (suite: TestSuite) => {
    setSuiteToEdit(suite);
    setIsSuiteModalOpen(true);
  };

  const handleCancelSuiteModal = () => {
    setIsSuiteModalOpen(false);
    setSuiteToEdit(null);
  };

  const handleUpdateSuite = async () => {
    if (!suiteToEdit || !suiteToEdit.id) return;
    setUpdatingSuite(true);
    try {
      const res = await suiteApi.updateTestSuite(suiteToEdit.id, {
        name: suiteToEdit.name,
        moduleName: suiteToEdit.moduleName,
        summary: suiteToEdit.summary || undefined,
        assumptions: suiteToEdit.assumptions || undefined,
      });
      setSuite((prev) => prev ? { ...prev, ...res.data.testSuite } : null);
      setTestCases((prev) =>
        prev.map((tc) => (tc.testSuiteId === suiteToEdit.id ? { ...tc, testSuiteId: suiteToEdit.id } : tc))
      );
      setIsSuiteModalOpen(false);
      setSuiteToEdit(null);
    } catch (err: any) {
      alert(`Lỗi khi cập nhật Test Suite: ${err.response?.data?.message || err.message}`);
    } finally {
      setUpdatingSuite(false);
    }
  };

  // Suite Delete Confirmation Handlers
  const handleOpenDeleteSuiteModal = (suite: TestSuite) => {
    setIsDeleteSuiteModalOpen(true);
    setSuiteToEdit(suite);
  };

  const handleConfirmDeleteSuite = async () => {
    if (!suiteToEdit?.id) return;
    setDeletingSuite(true);
    try {
      await suiteApi.deleteTestSuite(suiteToEdit.id);
      setIsDeleteSuiteModalOpen(false);
      setSuiteToEdit(null);
      navigate('/');
    } catch (err: any) {
      alert(`Lỗi khi xóa Test Suite: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingSuite(false);
    }
  };

  // Delete Test Case Handlers
  const handleOpenDeleteModal = (tc: TestCase) => {
    setTestCaseToDelete(tc);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!testCaseToDelete) return;
    setDeleting(true);
    try {
      await testCaseApi.deleteTestCase(testCaseToDelete.id);
      setTestCases((prev) => prev.filter((item) => item.id !== testCaseToDelete.id));
      setIsDeleteModalOpen(false);
      setTestCaseToDelete(null);
    } catch (err: any) {
      alert(`Lỗi khi xóa Test Case: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (testCaseId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(testCaseId)) {
        newSet.delete(testCaseId);
      } else {
        newSet.add(testCaseId);
      }
      return newSet;
    });
  };

  // Status sort order: UNTESTED → FAILED → BLOCKED → PASSED
  const statusOrder: Record<string, number> = {
    UNTESTED: 0,
    FAILED: 1,
    BLOCKED: 2,
    PASSED: 3,
  };

  // Apply default sort by status, then filter
  const sortedCases = [...testCases].sort((a, b) => {
    const aStatus = (a.latestExecution?.status || 'UNTESTED').toUpperCase();
    const bStatus = (b.latestExecution?.status || 'UNTESTED').toUpperCase();
    return (statusOrder[aStatus] ?? 4) - (statusOrder[bStatus] ?? 4);
  });

  // Filter logic
  const filteredCases = sortedCases.filter((tc) => {
    const exec = tc.latestExecution;
    const status = (exec?.status || 'UNTESTED').toUpperCase();
    const platform = (tc.platform || '').toUpperCase();
    const priority = (tc.priority || '').toLowerCase();
    const server = (exec?.server || '').toUpperCase();
    const os = (exec?.os || '').toUpperCase();

    // Status filter
    if (selectedStatus !== 'ALL' && status !== selectedStatus) return false;

    // Platform filter
    if (selectedPlatform !== 'ALL') {
      if (selectedPlatform === 'App' && !platform.includes('APP')) return false;
      if (selectedPlatform === 'CMS' && !platform.includes('CMS')) return false;
      if (selectedPlatform === 'Web' && (!platform.includes('WEB') || platform.includes('CMS'))) return false;
    }

    // Priority filter
    if (selectedPriority !== 'ALL' && priority !== selectedPriority.toLowerCase()) return false;

    // Server filter
    if (selectedServer !== 'ALL' && !server.includes(selectedServer.toUpperCase())) return false;

    // OS filter
    if (selectedOs !== 'ALL' && !os.includes(selectedOs.toUpperCase())) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = tc.testCaseCode.toLowerCase().includes(q);
      const matchTitle = tc.title.toLowerCase().includes(q);
      const matchModule = tc.module.toLowerCase().includes(q);
      const matchSteps = tc.steps.toLowerCase().includes(q);
      const matchExpected = tc.expectedResult.toLowerCase().includes(q);
      const matchActual = (exec?.actualResult || '').toLowerCase().includes(q);
      const matchNotes = (exec?.notes || '').toLowerCase().includes(q);

      if (!matchCode && !matchTitle && !matchModule && !matchSteps && !matchExpected && !matchActual && !matchNotes) {
        return false;
      }
    }

    return true;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedPlatform, selectedPriority, selectedServer, selectedOs, pageSize]);

  // Pagination calculations
  const totalFilteredItems = filteredCases.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFilteredItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = pageSize === -1 ? 0 : (validCurrentPage - 1) * pageSize;
  const endIndex = pageSize === -1 ? totalFilteredItems : Math.min(startIndex + pageSize, totalFilteredItems);
  const paginatedCases = pageSize === -1 ? filteredCases : filteredCases.slice(startIndex, endIndex);

  const getPageNumbers = (current: number, total: number): (number | string)[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  // Calculate live stats
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
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Extract unique servers & OS for filters (merge configured ones with existing case values)
  const availableServers = Array.from(
    new Set([
      ...configuredServers,
      ...testCases.map((tc) => tc.latestExecution?.server).filter(Boolean),
    ])
  ) as string[];
  const availableOs = Array.from(
    new Set([
      ...configuredOsList,
      ...testCases.map((tc) => tc.latestExecution?.os).filter(Boolean),
    ])
  ) as string[];

  if (loading && !suite) {
    return (
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-slate-500">Đang tải bộ Test Suite...</p>
      </div>
    );
  }

  if (!suite) {
    return (
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold">Không tìm thấy bộ Test Suite</h2>
        <Link to="/" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách Suites
        </Link>
        <div className="flex items-center gap-2">
          {canCreateTestCase && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-blue-500/20 transition-all"
              title="Tạo thêm kịch bản kiểm thử mới"
            >
              <Plus className="w-4 h-4" />
              Tạo Test Case
            </button>
          )}
          {canUpdateSuite && (
            <button
              onClick={() => handleOpenSuiteModal(suite!)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-500/20 transition-all"
              title="Chỉnh sửa thông tin bộ Test Suite"
            >
              <Edit3 className="w-4 h-4" />
              Sửa Suite
            </button>
          )}
          {canDeleteSuite && (
            <button
              onClick={() => handleOpenDeleteSuiteModal(suite!)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-rose-500/20 transition-all"
              title="Xóa bộ Test Suite"
            >
              <Trash2 className="w-4 h-4" />
              Xóa Suite
            </button>
          )}
          <button
            onClick={fetchSuiteDetails}
            className="p-2 text-slate-500 hover:text-slate-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canExport && (
            <>
              <a
                href={exportApi.getExcelDownloadUrl(suite.id)}
                download
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-emerald-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                Xuất file Excel (.xlsx)
              </a>
              <button
                onClick={() => exportApi.downloadResultsExcel(suite.id, `TestCase_Results_${suite.name.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}.xlsx`)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-500/20 transition-all"
                title="Xuất kết quả test theo từng người dùng"
              >
                <Download className="w-4 h-4" />
                Xuất kết quả test
              </button>
            </>
          )}
        </div>
      </div>

      {/* Suite Overview Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-7xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-xs font-bold">
                {suite.moduleName}
              </span>
              {suite.filename && (
                <span className="text-xs text-slate-500">File nguồn: {suite.filename}</span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
              {suite.name}
            </h1>
            {suite.summary && (
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                {suite.summary}
              </p>
            )}
            {suite.assumptions && (
              <p className="text-xs text-slate-500 italic">
                <span className="font-semibold not-italic">Giả định:</span> {suite.assumptions}
              </p>
            )}
          </div>

          {/* Pass rate circular/badge */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Tỷ lệ Đạt
            </span>
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {passRate}%
            </span>
            <span className="text-xs text-slate-500 mt-0.5">
              {passed}/{total} kịch bản
            </span>
          </div>
        </div>

        {/* Status Progress Bar */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${(passed / (total || 1)) * 100}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
              title={`Passed: ${passed}`}
            />
            <div
              style={{ width: `${(failed / (total || 1)) * 100}%` }}
              className="bg-rose-500 h-full transition-all duration-300"
              title={`Failed: ${failed}`}
            />
            <div
              style={{ width: `${(blocked / (total || 1)) * 100}%` }}
              className="bg-amber-500 h-full transition-all duration-300"
              title={`Blocked: ${blocked}`}
            />
          </div>

          {/* Quick filter pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
            >
              Tất cả ({total})
            </button>
            <button
              onClick={() => setSelectedStatus('PASSED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'PASSED'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Passed ({passed})
            </button>
            <button
              onClick={() => setSelectedStatus('FAILED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'FAILED'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                : 'bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300'
                } ${failed > 0 ? 'animate-pulse' : ''}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Failed ({failed})
            </button>
            <button
              onClick={() => setSelectedStatus('BLOCKED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'BLOCKED'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Blocked ({blocked})
            </button>
            <button
              onClick={() => setSelectedStatus('UNTESTED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'UNTESTED'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Chưa test ({untested})
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search box */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo Mã TC, tiêu đề, bước test..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Platform Filter */}
          <div>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Tất cả Platform (App & CMS)</option>
              <option value="App">Chỉ App</option>
              <option value="CMS">Chỉ CMS</option>
              <option value="Web">Chỉ Web</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Tất cả Mức ưu tiên</option>
              <option value="Cao">Ưu tiên Cao</option>
              <option value="Trung bình">Ưu tiên Trung bình</option>
              <option value="Thấp">Ưu tiên Thấp</option>
            </select>
          </div>

          {/* Server Filter */}
          <div>
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Tất cả Server</option>
              {availableServers.map((srv) => (
                <option key={srv} value={srv}>
                  Server: {srv}
                </option>
              ))}
            </select>
          </div>

          {/* OS Filter */}
          <div>
            <select
              value={selectedOs}
              onChange={(e) => setSelectedOs(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Tất cả Hệ điều hành</option>
              {availableOs.map((o) => (
                <option key={o} value={o}>
                  OS: {o}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Test Cases Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-left border-collapse text-xs align-top">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-slate-800 font-bold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-[85px]">Mã TC</th>
                <th className="py-3 px-3 w-[130px]">Chức năng</th>
                <th className="py-3 px-3 text-center w-[90px]">Platform</th>
                <th className="py-3 px-3 text-center w-[110px]">Server</th>
                <th className="py-3 px-3 text-center w-[110px]">Hệ điều hành</th>
                <th className="py-3 px-4 w-[210px]">Tiêu đề kịch bản</th>
                <th className="py-3 px-3 text-center w-[110px]">Loại test</th>
                <th className="py-3 px-4 w-[240px]">Các bước thực hiện</th>
                <th className="py-3 px-4 w-[240px]">Kết quả mong đợi</th>
                <th className="py-3 px-3 text-center w-[110px]">Đánh giá</th>
                <th className="py-3 px-3 text-center w-[60px]">Thực thi</th>
                <th className="py-3 px-3 text-center w-[130px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    Không tìm thấy kịch bản kiểm thử nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                paginatedCases.map((tc) => {
                  const exec = tc.latestExecution;
                  const status = (exec?.status || 'UNTESTED').toUpperCase();
                  const isFailed = status === 'FAILED';
                  const isExpanded = expandedRows.has(tc.id);

                  return (
                    <React.Fragment key={tc.id}>
                      <tr
                        onClick={() => handleOpenDrawer(tc, false)}
                        className={`cursor-pointer transition-all hover:bg-blue-50/60 dark:hover:bg-blue-950/25 align-top ${isFailed
                          ? 'bg-rose-50/70 dark:bg-rose-950/40 border-l-4 border-l-rose-600'
                          : 'even:bg-slate-50/40 dark:even:bg-slate-800/30'
                          }`}
                      >
                        {/* Mã TC */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-700 dark:text-blue-400">
                          {tc.testCaseCode}
                        </td>

                        {/* Chức năng */}
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {tc.module}
                        </td>

                        {/* Platform */}
                        <td className="py-3 px-3 text-center">
                          <PlatformBadge platform={tc.platform} />
                        </td>

                        {/* Server */}
                        <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400 font-mono">
                          {exec?.server || '—'}
                        </td>

                        {/* OS */}
                        <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                          {exec?.os || '—'}
                        </td>

                        {/* Tiêu đề */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                            {tc.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <PriorityBadge priority={tc.priority} />
                            {exec?.images && exec.images.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEvidenceLightbox(exec.images || [], 0);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800 transition-colors"
                                title="Xem danh sách ảnh minh chứng đã tải lên"
                              >
                                <ImageIcon className="w-3 h-3 text-blue-600" />
                                <span>{exec.images.length} ảnh</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Loại test */}
                        <td className="py-3 px-3 text-center">
                          <TestTypeBadge type={tc.testType} />
                        </td>

                        {/* Các bước */}
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          <div className="whitespace-pre-line break-words line-clamp-4 leading-relaxed">
                            {tc.steps}
                          </div>
                        </td>

                        {/* Kết quả mong đợi */}
                        <td className="py-3 px-4">
                          <div className="whitespace-pre-line break-words line-clamp-4 leading-relaxed text-emerald-900 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200/70 dark:border-emerald-900/50 font-medium">
                            {tc.expectedResult}
                          </div>
                        </td>

                        {/* Đánh giá */}
                        <td className="py-3 px-3 text-center">
                          <StatusBadge status={status} />
                        </td>

                        {/* Lịch sử */}
                        <td
                          className="py-3 px-3 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(tc.id);
                          }}
                        >
                          {isExpanded ? (
                            <Expand className="w-4 h-4 text-blue-600 mx-auto" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 mx-auto" />
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {canExecuteTestCase && (
                              <button
                                onClick={() => handleOpenDrawer(tc, true)}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 transition-colors"
                                title="Thực thi / Ghi nhận kết quả test (Mở chế độ chỉnh sửa)"
                              >
                                Test
                              </button>
                            )}
                            {canUpdateTestCase && (
                              <button
                                onClick={() => handleOpenEditModal(tc)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors"
                                title="Chỉnh sửa Test Case"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDeleteTestCase && (
                              <button
                                onClick={() => handleOpenDeleteModal(tc)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded transition-colors"
                                title="Xóa Test Case"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded execution history row */}
                      {isExpanded && (() => {
                        const latestUserExecs = getLatestExecutionsByUser(tc.executions);
                        return (
                          <tr>
                            <td colSpan={12} className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-y border-slate-200 dark:border-slate-800">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    Kết quả thực thi mới nhất theo người dùng ({latestUserExecs.length} người)
                                  </p>
                                  <span className="text-[11px] text-slate-400">
                                    Nhấp vào thẻ để mở xem chi tiết & toàn bộ lịch sử theo người dùng
                                  </span>
                                </div>
                                {latestUserExecs.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {latestUserExecs.map((ex) => (
                                      <div
                                        key={ex.id}
                                        onClick={() => handleOpenDrawer(tc, false, ex)}
                                        className="border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 bg-white dark:bg-slate-800 shadow-sm flex flex-col justify-between space-y-2 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all text-xs cursor-pointer group"
                                      >
                                        <div>
                                          {/* Card Top: User + Status */}
                                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                                            <div className="min-w-0 flex-1">
                                              <p
                                                className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate"
                                                title={ex.executedBy?.fullName || ex.executedBy?.email || 'Người dùng'}
                                              >
                                                {ex.executedBy?.fullName || ex.executedBy?.email || 'Người dùng'}
                                              </p>
                                              <p className="text-[10px] text-slate-400 mt-0.5">
                                                {ex.executedAt ? new Date(ex.executedAt).toLocaleString('vi-VN') : '—'}
                                              </p>
                                            </div>
                                            <StatusBadge status={ex.status} size="sm" />
                                          </div>

                                          {/* Card Meta: Server / OS */}
                                          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">
                                              {ex.server || 'Server: —'}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                                              {ex.os || 'OS: —'}
                                            </span>
                                          </div>

                                          {/* Card Content: Actual Result (max 4 lines, no images) */}
                                          <div className="mt-2 text-slate-700 dark:text-slate-300">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] block mb-0.5">
                                              Kết quả thực tế:
                                            </span>
                                            {ex.actualResult ? (
                                              <div
                                                className="history-actual-result rich-text-content text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 line-clamp-4"
                                                dangerouslySetInnerHTML={{
                                                  __html: ex.actualResult.replace(/<img[^>]*>/gi, ''),
                                                }}
                                              />
                                            ) : (
                                              <span className="text-slate-400 italic text-[11px]">Chưa ghi nhận</span>
                                            )}
                                          </div>

                                          {/* Evidence Images */}
                                          {ex.images && ex.images.length > 0 && (
                                            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1 mb-1.5">
                                                <ImageIcon className="w-3 h-3 text-blue-500" />
                                                Ảnh minh chứng ({ex.images.length})
                                              </span>
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                {ex.images.slice(0, 4).map((img: TestExecutionImage, imgIdx: number) => (
                                                  <button
                                                    key={img.id}
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openEvidenceLightbox(ex.images || [], imgIdx);
                                                    }}
                                                    className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform"
                                                    title={img.filename}
                                                  >
                                                    <img
                                                      src={uploadApi.getImageUrl(img.id)}
                                                      alt={img.filename}
                                                      className="w-full h-full object-cover"
                                                    />
                                                    {imgIdx === 3 && (ex.images?.length || 0) > 4 && (
                                                      <div className="absolute inset-0 bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">
                                                        +{(ex.images?.length || 0) - 4}
                                                      </div>
                                                    )}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Card Footer: Notes if present */}
                                        {ex.notes && (
                                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">Ghi chú:</span> {ex.notes}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-slate-400 text-xs italic py-2">Chưa có thực thi nào cho test case này.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalFilteredItems > 0 && (
          <div className="bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Info & Page Size Selector */}
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
              <div>
                Hiển thị <span className="font-bold text-slate-900 dark:text-white">{startIndex + 1}</span> -{' '}
                <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> trong tổng số{' '}
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{totalFilteredItems}</span> Test Case
                {totalFilteredItems < total && (
                  <span className="text-slate-400 ml-1">(lọc từ {total} tổng số)</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Số dòng/trang:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  <option value={10}>10 dòng</option>
                  <option value={25}>25 dòng</option>
                  <option value={50}>50 dòng</option>
                  <option value={100}>100 dòng</option>
                  <option value={-1}>Tất cả ({totalFilteredItems})</option>
                </select>
              </div>
            </div>

            {/* Navigation Page Buttons */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page number buttons */}
                {getPageNumbers(validCurrentPage, totalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400 font-bold select-none">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => setCurrentPage(Number(p))}
                      className={`min-w-[32px] h-8 px-2 text-xs font-bold rounded-lg transition-all shadow-sm ${validCurrentPage === p
                        ? 'bg-blue-600 text-white shadow-blue-500/30'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Execution Drawer */}
      <ExecutionDrawer
        testCase={selectedTestCase}
        isOpen={isDrawerOpen}
        initialEditing={drawerInitialEditing}
        initialExecution={drawerInitialExecution}
        onClose={() => {
          setIsDrawerOpen(false);
          setDrawerInitialExecution(null);
        }}
        onSaved={handleSaveExecution}
        onEditTestCase={handleOpenEditModal}
      />

      {/* Create / Edit TestCase Modal */}
      <TestCaseModal
        isOpen={isTestCaseModalOpen}
        onClose={() => {
          setIsTestCaseModalOpen(false);
          setTestCaseToEdit(null);
        }}
        testSuiteId={suite.id}
        defaultModule={suite.moduleName || ''}
        testCaseToEdit={testCaseToEdit}
        onSuccess={handleTestCaseModalSuccess}
      />

      {/* Suite Edit modal */}
      {isSuiteModalOpen && suiteToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cập nhật bộ Test Suite
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateSuite();
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-700 dark:text-slate-300 font-medium">Tên Suite</label>
                  <input
                    value={suiteToEdit?.name || ''}
                    onChange={(e) =>
                      setSuiteToEdit((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev
                      )
                    }
                    placeholder="Nhập tên suite"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-700 dark:text-slate-300 font-medium">Module</label>
                  <input
                    value={suiteToEdit?.moduleName || ''}
                    onChange={(e) =>
                      setSuiteToEdit((prev) =>
                        prev ? { ...prev, moduleName: e.target.value } : prev
                      )
                    }
                    placeholder="Chọn module"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-slate-700 dark:text-slate-300 font-medium">Tóm tắt</label>
                  <textarea
                    value={suiteToEdit?.summary || ''}
                    onChange={(e) =>
                      setSuiteToEdit((prev) =>
                        prev ? { ...prev, summary: e.target.value } : prev
                      )
                    }
                    placeholder="Nhóm giả định cho kịch bản kiểm thử..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-slate-700 dark:text-slate-300 font-medium">Giả định</label>
                  <textarea
                    value={suiteToEdit?.assumptions || ''}
                    onChange={(e) =>
                      setSuiteToEdit((prev) =>
                        prev ? { ...prev, assumptions: e.target.value } : prev
                      )
                    }
                    placeholder="Những giả định trước khi chạy test..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancelSuiteModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-300 dark:bg-slate-800 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={updatingSuite}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 bg-opacity-80 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60"
                >
                  {updatingSuite ? 'Đang cập nhật...' : 'Cập nhuite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Test Case */}
      {isDeleteModalOpen && testCaseToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác nhận xóa Test Case?
                </h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Mã Test Case:</span>{' '}
                <span className="font-mono font-bold text-blue-600">{testCaseToDelete.testCaseCode}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tiêu đề:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200">{testCaseToDelete.title}</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setTestCaseToDelete(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-300 dark:bg-slate-800 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-md shadow-rose-500/20 transition-all disabled:opacity-60"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Suite */}
      {isDeleteSuiteModalOpen && suiteToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác nhận xóa bộ Test Suite?
                </h3>
                <p className="text-xs text-slate-500">Hành động này sẽ xóa vĩnh viễn tất cả các Test Case trong suite.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tên Suite:</span>{' '}
                <span className="font-medium text-slate-800 dark:text-white">{suiteToEdit.name}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Số lượng Test Case:</span>{' '}
                <span className="font-mono font-bold text-blue-600">{testCases.length}</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteSuiteModalOpen(false);
                  setSuiteToEdit(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-300 dark:bg-slate-800 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSuite}
                disabled={deletingSuite}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-md shadow-rose-500/20 transition-all disabled:opacity-60"
              >
                {deletingSuite ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && testCaseToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác nhận xóa Test Case?
                </h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Mã Test Case:</span>{' '}
                <span className="font-mono font-bold text-blue-600">{testCaseToDelete.testCaseCode}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tiêu đề:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200">{testCaseToDelete.title}</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setTestCaseToDelete(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-md shadow-rose-500/20 transition-all disabled:opacity-60"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for Evidence Screenshots */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  );
};
