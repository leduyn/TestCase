import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { authApi } from '../services/api';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenError('Không tìm thấy mã xác thực (token) trong đường dẫn.');
        setVerifying(false);
        return;
      }

      try {
        const response = await authApi.verifyResetToken(token);
        if (response.data.valid) {
          setTokenValid(true);
          setUserEmail(response.data.email || null);
          setUserFullName(response.data.fullName || null);
        } else {
          setTokenValid(false);
          setTokenError(response.data.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError(
          err.response?.data?.message ||
          'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
        );
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  // Calculate password strength
  const calculateStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strengthScore = calculateStrength(password);

  const getStrengthLabel = (score: number) => {
    if (score === 0) return { label: 'Chưa nhập', color: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-400' };
    if (score <= 2) return { label: 'Yếu', color: 'bg-rose-500', text: 'text-rose-500' };
    if (score === 3) return { label: 'Trung bình', color: 'bg-amber-500', text: 'text-amber-500' };
    if (score === 4) return { label: 'Khá mạnh', color: 'bg-blue-500', text: 'text-blue-500' };
    return { label: 'Rất mạnh', color: 'bg-emerald-500', text: 'text-emerald-500' };
  };

  const strengthInfo = getStrengthLabel(strengthScore);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Thiếu mã xác thực hợp lệ.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword({ token, newPassword: password });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3500);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Không thể đặt lại mật khẩu. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white mx-auto shadow-md shadow-indigo-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Đặt lại mật khẩu</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {userFullName ? `Tài khoản: ${userFullName} (${userEmail})` : 'Tạo mật khẩu mới cho tài khoản của bạn'}
          </p>
        </div>

        {verifying ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Đang kiểm tra mã xác thực...</p>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-4">
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-start gap-3 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm mb-1">Liên kết không khả dụng</p>
                <p>{tokenError || 'Đường dẫn đặt lại mật khẩu đã hết hạn hoặc không tồn tại.'}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/forgot-password"
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all text-center flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Gửi lại yêu cầu quên mật khẩu
              </Link>
              <Link
                to="/login"
                className="w-full py-2 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-center flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Quay lại trang Đăng nhập
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Đặt lại mật khẩu thành công!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mật khẩu của bạn đã được cập nhật thành công. Hệ thống sẽ tự động chuyển về trang Đăng nhập sau giây lát...
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-all"
            >
              <Lock className="w-4 h-4" />
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength meter */}
              {password && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Độ mạnh mật khẩu:</span>
                    <span className={`font-semibold ${strengthInfo.text}`}>{strengthInfo.label}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 h-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-full rounded-full transition-colors ${
                          level <= strengthScore ? strengthInfo.color : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-[11px] text-rose-500">Mật khẩu xác nhận không khớp</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password || password !== confirmPassword}
              className="w-full py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Đang cập nhật mật khẩu...' : 'Xác nhận đổi mật khẩu'}
            </button>

            <div className="text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Quay lại Đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
