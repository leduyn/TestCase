import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Generate } from './pages/Generate';
import { Import } from './pages/Import';
import { SuiteDetail } from './pages/SuiteDetail';
import { TestCaseDetail } from './pages/TestCaseDetail';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Settings } from './pages/Settings';
import UserManagement from './pages/UserManagement';
import { TestCaseManagement } from './pages/TestCaseManagement';
import { DatabaseSetupPage } from './pages/Setup/DatabaseSetupPage';
import { WorkflowDashboard } from './pages/Workflow/WorkflowDashboard';
import { ProcessList } from './pages/Workflow/ProcessList';
import { TaskList } from './pages/Workflow/TaskList';
import { TaskDetail } from './pages/Workflow/TaskDetail';
import { ProposalTypesManagement } from './pages/Proposals/ProposalTypesManagement';
import { ProposalCreate } from './pages/Proposals/ProposalCreate';
import { ProposalHub } from './pages/Proposals/ProposalHub';
import { ProposalDetail } from './pages/Proposals/ProposalDetail';
import { ProposalReports } from './pages/Proposals/ProposalReports';
import { setupApi } from './services/api';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from './components/ProtectedRoute';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // If user is already loaded and authenticated, proceed normally
      if (user && !authLoading) {
        setIsSetupRequired(false);
        setCheckingSetup(false);
        return;
      }

      // If no user token, check setup status
      if (!user && !authLoading) {
        try {
          const res = await setupApi.getStatus();
          if (res.data.status === 'SETUP_REQUIRED') {
            setIsSetupRequired(true);
            if (location.pathname !== '/setup') {
              navigate('/setup', { replace: true });
            }
          } else {
            setIsSetupRequired(false);
            if (location.pathname === '/setup') {
              navigate('/', { replace: true });
            }
            if (location.pathname !== '/login' && location.pathname !== '/register') {
              navigate('/login', { replace: true });
            }
          }
        } catch (err: any) {
          if (err.response?.data?.status === 'SETUP_REQUIRED') {
            setIsSetupRequired(true);
            if (location.pathname !== '/setup') {
              navigate('/setup', { replace: true });
            }
          }
        }
      }
      setCheckingSetup(false);
    };

    checkAuth();
  }, [user, authLoading, location.pathname]);

  // Show spinner only during initial auth check, not when already authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (checkingSetup && location.pathname !== '/setup' && location.pathname !== '/login' && location.pathname !== '/register') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">Đang kiểm tra kết nối hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {user ? <Navbar /> : null}
      <main className="flex-1">
        <Routes>
          <Route path="/setup" element={<DatabaseSetupPage />} />
          <Route path="/" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Dashboard />} />
          <Route path="/generate" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute permission="testcase:generate"><Generate /></ProtectedRoute>
            )
          } />
          <Route path="/import" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute permission="testcase:import"><Import /></ProtectedRoute>
            )
          } />
          <Route path="/suites/:id" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute permission="testsuite:read"><SuiteDetail /></ProtectedRoute>
            )
          } />
          <Route path="/testcases/:id" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute permission="testsuite:read"><TestCaseDetail /></ProtectedRoute>
            )
          } />
          <Route path="/login" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Login />} />
          <Route path="/register" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Register />} />
          <Route path="/settings" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute permissions={['settings:ai:read', 'settings:prompt:read', 'settings:env:read']} mode="any"><Settings /></ProtectedRoute>
            )
          } />
          <Route path="/user-management" element={
            <ProtectedRoute permission="users:read"><UserManagement /></ProtectedRoute>
          } />
          <Route path="/testcase-management" element={
            <ProtectedRoute permission="testcase:review"><TestCaseManagement /></ProtectedRoute>
          } />
          {/* Workflow & Task Management Routes */}
          <Route path="/workflow" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : <WorkflowDashboard />
          } />
          <Route path="/workflow/processes" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : <ProcessList />
          } />
          <Route path="/workflow/tasks" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : <TaskList />
          } />
          <Route path="/workflow/tasks/:id" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : <TaskDetail />
          } />
          {/* Proposal & Request Management Routes */}
          <Route path="/proposals" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute><ProposalHub /></ProtectedRoute>
            )
          } />
          <Route path="/proposals/reports" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute><ProposalReports /></ProtectedRoute>
            )
          } />
          <Route path="/proposals/types" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute><ProposalTypesManagement /></ProtectedRoute>
            )
          } />
          <Route path="/proposals/settings" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute><ProposalTypesManagement /></ProtectedRoute>
            )
          } />
          <Route path="/proposals/new" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute><ProposalCreate /></ProtectedRoute>
            )
          } />
          <Route path="/proposals/create" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute><ProposalCreate /></ProtectedRoute>
            )
          } />
          <Route path="/proposals/:id" element={
            isSetupRequired ? <Navigate to="/setup" replace /> : (
              <ProtectedRoute><ProposalDetail /></ProtectedRoute>
            )
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;