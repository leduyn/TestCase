import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { TestCase } from '../types';
import { testCaseApi } from '../services/api';
import { ExecutionDrawer } from '../components/ExecutionDrawer';
import { TestCaseModal } from '../components/TestCaseModal';

export const TestCaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);
  const [testCaseToEdit, setTestCaseToEdit] = useState<TestCase | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await testCaseApi.getTestCase(id);
        setTestCase(res.data.testCase);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Lỗi tải chi tiết Test Case');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSaved = (updated: TestCase) => {
    setTestCase(updated);
  };

  const handleEditTestCase = (tc: TestCase) => {
    setTestCaseToEdit(tc);
    setIsTestCaseModalOpen(true);
  };

  const handleTestCaseModalSuccess = (savedTc: TestCase) => {
    setTestCase((prev) => (prev ? { ...prev, ...savedTc } : prev));
    setIsTestCaseModalOpen(false);
    setTestCaseToEdit(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại</span>
        </button>
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Chi tiết Test Case
        </span>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Đang tải...
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex items-center justify-center text-rose-500">
          {error}
        </div>
      )}

      {!loading && !error && testCase && (
        <ExecutionDrawer
          testCase={testCase}
          isOpen={true}
          fullPage
          onClose={() => navigate(-1)}
          onSaved={handleSaved}
          onEditTestCase={handleEditTestCase}
        />
      )}

      <TestCaseModal
        isOpen={isTestCaseModalOpen}
        onClose={() => {
          setIsTestCaseModalOpen(false);
          setTestCaseToEdit(null);
        }}
        testSuiteId={testCase?.testSuiteId || ''}
        defaultModule={testCase?.module || ''}
        testCaseToEdit={testCaseToEdit}
        isDuplicate={false}
        onSuccess={handleTestCaseModalSuccess}
      />
    </div>
  );
};

export default TestCaseDetail;
