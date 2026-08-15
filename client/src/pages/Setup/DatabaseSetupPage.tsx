import React, { useState } from 'react';
import {
  Database,
  Server,
  User,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Sparkles,
  AlertCircle,
  HardDrive,
  Shield,
  Zap,
  RefreshCcw,
} from 'lucide-react';
import { api } from '../../services/api';

interface StepStatus {
  step: string;
  status: string;
  message: string;
}

export const DatabaseSetupPage: React.FC = () => {
  // Wizard step tracking
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Connection info
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [dbUser, setDbUser] = useState('postgres');
  const [dbPassword, setDbPassword] = useState('');

  // Connection test results
  const [connectionTested, setConnectionTested] = useState(false);
  const [connectionOk, setConnectionOk] = useState(false);
  const [serverVersion, setServerVersion] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState('');

  // Step 2: Database selection
  const [dbName, setDbName] = useState('testcase_db');
  const [createNew, setCreateNew] = useState(false);
  const [dbCreated, setDbCreated] = useState(false);
  const [dbCreateMessage, setDbCreateMessage] = useState('');

  // Step 3: Admin account
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFullName, setAdminFullName] = useState('');

  // Step 4: Initialize
  const [initializing, setInitializing] = useState(false);
  const [initResult, setInitResult] = useState<{
    success: boolean;
    message: string;
    steps: StepStatus[];
  } | null>(null);

  // Loading states
  const [testingConnection, setTestingConnection] = useState(false);
  const [creatingDb, setCreatingDb] = useState(false);

  const steps = [
    { title: 'Kết nối Server', icon: Server, desc: 'Nhập thông tin PostgreSQL' },
    { title: 'Chọn Database', icon: Database, desc: 'Tạo mới hoặc chọn DB' },
    { title: 'Tài khoản Admin', icon: Shield, desc: 'Tạo admin đầu tiên' },
    { title: 'Hoàn tất', icon: Zap, desc: 'Khởi tạo hệ thống' },
  ];

  // ============ API Calls ============

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionError('');
    setConnectionTested(false);
    setConnectionOk(false);

    try {
      const res = await api.post('/setup/test-connection', {
        host,
        port: parseInt(port),
        user: dbUser,
        password: dbPassword,
      });

      setConnectionOk(true);
      setConnectionTested(true);
      setServerVersion(res.data.serverVersion || '');
      setDatabases(res.data.databases || []);
    } catch (err: any) {
      setConnectionOk(false);
      setConnectionTested(true);
      setConnectionError(
        err.response?.data?.message || err.message || 'Không thể kết nối đến server'
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreateDatabase = async () => {
    setCreatingDb(true);
    setDbCreateMessage('');

    try {
      const res = await api.post('/setup/create-database', {
        host,
        port: parseInt(port),
        user: dbUser,
        password: dbPassword,
        dbName,
      });

      setDbCreated(true);
      setDbCreateMessage(res.data.message);
      // Refresh database list
      setDatabases((prev) => (prev.includes(dbName) ? prev : [...prev, dbName]));
      setCreateNew(false);
    } catch (err: any) {
      setDbCreateMessage(err.response?.data?.message || err.response?.data?.error || 'Lỗi khi tạo database');
      setDbCreated(false);
    } finally {
      setCreatingDb(false);
    }
  };

  const handleInitialize = async () => {
    setInitializing(true);
    setInitResult(null);

    try {
      const res = await api.post('/setup/initialize', {
        host,
        port: parseInt(port),
        user: dbUser,
        password: dbPassword,
        dbName,
        createNew: createNew || !databases.includes(dbName),
        adminEmail,
        adminPassword,
        adminFullName,
      });

      setInitResult({
        success: res.data.success,
        message: res.data.message,
        steps: res.data.steps || [],
      });

      // Redirect to login after 3 seconds
      if (res.data.success) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      }
    } catch (err: any) {
      setInitResult({
        success: false,
        message: err.response?.data?.error || err.message || 'Lỗi khởi tạo hệ thống',
        steps: err.response?.data?.steps || [],
      });
    } finally {
      setInitializing(false);
    }
  };

  // ============ Navigation ============

  const canGoNext = () => {
    switch (currentStep) {
      case 0:
        return connectionOk;
      case 1:
        return dbName.trim().length > 0;
      case 2:
        return adminEmail && adminPassword && adminFullName;
      default:
        return false;
    }
  };

  // ============ Render Steps ============

  const renderStep0_Connection = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            <HardDrive className="w-3.5 h-3.5 inline mr-1" />
            Host / IP Address
          </label>
          <input
            type="text"
            value={host}
            onChange={(e) => { setHost(e.target.value); setConnectionTested(false); }}
            placeholder="localhost hoặc 192.168.1.100"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Port
          </label>
          <input
            type="number"
            value={port}
            onChange={(e) => { setPort(e.target.value); setConnectionTested(false); }}
            placeholder="5432"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            <User className="w-3.5 h-3.5 inline mr-1" />
            Database Username
          </label>
          <input
            type="text"
            value={dbUser}
            onChange={(e) => { setDbUser(e.target.value); setConnectionTested(false); }}
            placeholder="postgres"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            <Lock className="w-3.5 h-3.5 inline mr-1" />
            Database Password
          </label>
          <input
            type="password"
            value={dbPassword}
            onChange={(e) => { setDbPassword(e.target.value); setConnectionTested(false); }}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Test Connection Button */}
      <button
        onClick={handleTestConnection}
        disabled={testingConnection || !host || !dbUser || !dbPassword}
        className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {testingConnection ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang kiểm tra kết nối...
          </>
        ) : (
          <>
            <RefreshCcw className="w-4 h-4" />
            Test Kết nối
          </>
        )}
      </button>

      {/* Connection Result */}
      {connectionTested && (
        <div
          className={`p-4 rounded-xl border ${
            connectionOk
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {connectionOk ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600" />
            )}
            <span
              className={`text-sm font-bold ${
                connectionOk
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-rose-800 dark:text-rose-300'
              }`}
            >
              {connectionOk ? 'Kết nối thành công!' : 'Kết nối thất bại'}
            </span>
          </div>
          {connectionOk && serverVersion && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">{serverVersion}</p>
          )}
          {connectionOk && databases.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Databases hiện có: <span className="font-semibold">{databases.join(', ')}</span>
              </p>
            </div>
          )}
          {!connectionOk && connectionError && (
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{connectionError}</p>
          )}
        </div>
      )}
    </div>
  );

  const renderStep1_Database = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          <Database className="w-3.5 h-3.5 inline mr-1" />
          Tên Database
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={dbName}
            onChange={(e) => { setDbName(e.target.value); setDbCreated(false); }}
            placeholder="testcase_db"
            className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Existing databases */}
      {databases.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Databases có sẵn trên server (nhấp để chọn):
          </p>
          <div className="flex flex-wrap gap-2">
            {databases.map((db) => (
              <button
                key={db}
                onClick={() => { setDbName(db); setCreateNew(false); setDbCreated(false); }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  dbName === db
                    ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 text-blue-800 dark:text-blue-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                }`}
              >
                <Database className="w-3 h-3 inline mr-1" />
                {db}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create new DB option */}
      {!databases.includes(dbName) && dbName.trim() && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Database "{dbName}" chưa tồn tại
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            Hệ thống sẽ tạo mới database này trong quá trình khởi tạo.
          </p>
          {!dbCreated && (
            <button
              onClick={() => { setCreateNew(true); handleCreateDatabase(); }}
              disabled={creatingDb}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {creatingDb ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Tạo Database Ngay
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* DB creation result */}
      {dbCreateMessage && (
        <div
          className={`p-3 rounded-xl border text-xs ${
            dbCreated
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {dbCreated ? (
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
          ) : (
            <XCircle className="w-4 h-4 inline mr-1" />
          )}
          {dbCreateMessage}
        </div>
      )}

      {/* Info about what happens */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <Sparkles className="w-3.5 h-3.5 inline mr-1" />
          Hệ thống sẽ tự động tạo toàn bộ bảng (Users, Documents, TestSuites, TestCases, TestExecutions, AIConfigs) trong bước khởi tạo.
        </p>
      </div>
    </div>
  );

  const renderStep2_Admin = () => (
    <div className="space-y-5">
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <Shield className="w-3.5 h-3.5 inline mr-1" />
          Tạo tài khoản Admin đầu tiên để quản trị hệ thống. Bạn có thể thêm tài khoản khác sau.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Họ và tên Admin
        </label>
        <div className="relative">
          <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
            placeholder="Nguyễn Văn Admin"
            className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Email Admin
        </label>
        <div className="relative">
          <Server className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@company.com"
            className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Mật khẩu Admin
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">Tối thiểu 6 ký tự</p>
      </div>
    </div>
  );

  const renderStep3_Initialize = () => (
    <div className="space-y-5">
      {/* Summary */}
      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Thông tin khởi tạo
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-slate-500">PostgreSQL Server:</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{host}:{port}</div>
          <div className="text-slate-500">Database User:</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{dbUser}</div>
          <div className="text-slate-500">Database Name:</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{dbName}</div>
          <div className="text-slate-500">Admin Email:</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{adminEmail}</div>
          <div className="text-slate-500">Admin Name:</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{adminFullName}</div>
        </div>
      </div>

      {/* Initialize Button */}
      {!initResult && (
        <button
          onClick={handleInitialize}
          disabled={initializing}
          className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {initializing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang khởi tạo hệ thống...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              🚀 Khởi tạo Hệ thống
            </>
          )}
        </button>
      )}

      {/* Progress Steps */}
      {initResult && (
        <div className="space-y-3">
          <div
            className={`p-4 rounded-xl border ${
              initResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {initResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span
                className={`text-sm font-bold ${
                  initResult.success
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-rose-800 dark:text-rose-300'
                }`}
              >
                {initResult.message}
              </span>
            </div>
          </div>

          {/* Detailed step results */}
          {initResult.steps.length > 0 && (
            <div className="space-y-1.5">
              {initResult.steps.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs"
                >
                  {s.status === 'OK' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : s.status === 'WARNING' ? (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">
                    {s.step}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 truncate">{s.message}</span>
                </div>
              ))}
            </div>
          )}

          {initResult.success && (
            <div className="text-center py-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-semibold animate-pulse">
                ✨ Đang chuyển hướng đến trang Đăng nhập...
              </p>
            </div>
          )}

          {!initResult.success && (
            <button
              onClick={() => setInitResult(null)}
              className="w-full py-2.5 text-sm font-bold text-white bg-slate-600 hover:bg-slate-700 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Thử lại
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderStep0_Connection();
      case 1:
        return renderStep1_Database();
      case 2:
        return renderStep2_Admin();
      case 3:
        return renderStep3_Initialize();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-500/30 mb-4">
            <Database className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
            Khởi tạo Hệ thống
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AI Test Case Generator & Management System
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Cấu hình kết nối PostgreSQL để bắt đầu sử dụng
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;

            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <div
                    className={`w-10 h-0.5 ${
                      isDone ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                    } transition-colors`}
                  />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110'
                        : isDone
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold max-w-[70px] text-center leading-tight ${
                      isActive
                        ? 'text-blue-700 dark:text-blue-400'
                        : isDone
                        ? 'text-blue-600 dark:text-blue-500'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Card Content */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 md:p-8">
          {/* Step Title */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {steps[currentStep].title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{steps[currentStep].desc}</p>
          </div>

          {/* Step Content */}
          {renderCurrentStep()}

          {/* Navigation */}
          {currentStep < 3 && (
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                disabled={currentStep === 0}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </button>
              <button
                onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
                disabled={!canGoNext()}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                Tiếp theo
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
