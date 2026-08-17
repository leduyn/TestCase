import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Generate } from './pages/Generate';
import { Import } from './pages/Import';
import { SuiteDetail } from './pages/SuiteDetail';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Settings } from './pages/Settings';
import { UserManagement } from './pages/UserManagement';
import { DatabaseSetupPage } from './pages/Setup/DatabaseSetupPage';
import { setupApi } from './services/api';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  useEffect(() => {
    const checkSystemStatus = async () => {
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
        }
      } catch (err: any) {
        if (err.response?.data?.status === 'SETUP_REQUIRED') {
          setIsSetupRequired(true);
          if (location.pathname !== '/setup') {
            navigate('/setup', { replace: true });
          }
        }
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSystemStatus();
  }, [location.pathname]);

  if (checkingSetup && location.pathname !== '/setup') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">Đang kiểm tra kết nối hệ thống...</p>
        </div>
      </div>
    );
  }

  const isSetupRoute = location.pathname === '/setup';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {!isSetupRoute && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/setup" element={<DatabaseSetupPage />} />
          <Route path="/" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Dashboard />} />
          <Route path="/generate" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Generate />} />
          <Route path="/import" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Import />} />
          <Route path="/suites/:id" element={isSetupRequired ? <Navigate to="/setup" replace /> : <SuiteDetail />} />
          <Route path="/login" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Login />} />
          <Route path="/register" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Register />} />
          <Route path="/settings" element={isSetupRequired ? <Navigate to="/setup" replace /> : <Settings />} />
          <Route path="/user-management" element={isSetupRequired ? <Navigate to="/setup" replace /> : <UserManagement />} />
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