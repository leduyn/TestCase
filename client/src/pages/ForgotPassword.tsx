import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { authApi } from '../services/api';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setResetUrl(null);
    setLoading(true);

    try {
      const response = await authApi.forgotPassword({ email: email.trim() });
      setSuccess(response.data.message || 'Yêu cầu đặt lại mật khẩu đã được xử lý.');
      if (response.data.resetUrl) {
        setResetUrl(response.data.resetUrl);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!resetUrl) return;
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white mx-auto shadow-md shadow-blue-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quên mật khẩu?</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nhập email đã đăng ký của bạn để nhận liên kết đặt lại mật khẩu
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl space-y-3 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>

            {resetUrl && (
              <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-emerald-300/60 dark:border-emerald-700/60 text-slate-700 dark:text-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Liên kết đặt lại mật khẩu (Môi trường phát triển / Nội bộ):</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono break-all text-blue-600 dark:text-blue-400 select-all">
                  {resetUrl}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Đã sao chép!' : 'Sao chép liên kết'}
                  </button>
                  <a
                    href={resetUrl}
                    className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Đến trang đặt lại
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nhanvien@vinago.com"
                disabled={loading}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu đặt lại mật khẩu'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};
