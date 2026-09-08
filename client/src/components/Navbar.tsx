import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  LayoutDashboard,
  Settings,
  LogIn,
  LogOut,
  User as UserIcon,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  Layers,
  FileText,
  BarChart3,
  Bell,
  Check,
  Clock,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { myProposalApi } from '../services/proposalApi';
import { notificationApi } from '../services/notificationApi';
import type { AppNotification } from '../types/notification';
import { emitProposalUpdated } from '../utils/proposalEvents';
import {
  connectSocket,
  disconnectSocket,
  onNotificationNew,
  onNotificationUnreadCount,
  onNotificationRead,
} from '../services/socket';
import {
  sendBrowserNotification,
  requestNotificationPermission,
  getNotificationPermission,
} from '../utils/browserNotification';
import { getNotificationMeta, formatRelativeTime } from '../utils/notificationUtils';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const canAccessGenerate = hasPermission('testcase:read');
  const canAccessImport = hasPermission('testcase:read');
  const canAccessSettings =
    hasPermission('settings:ai:read') ||
    hasPermission('settings:prompt:read') ||
    hasPermission('settings:env:read');
  const canAccessUserManagement = hasPermission('users:read');
  const canAccessReview = hasPermission('testcase:read');
  const canAccessWorkflow = hasPermission('workflow:process:read');
  const canAccessProposal = hasPermission('proposal:read');

  // Proposal pending approvals count & unified unread notifications count
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());

  const notifRef = useRef<HTMLDivElement>(null);
  const prevUnreadCountRef = useRef<number | null>(null);

  // Fetch counters (Proposal pending & Notification unread)
  const fetchCounts = useCallback(async () => {
    if (!user) return;
    try {
      const [pendingRes, notifRes] = await Promise.all([
        myProposalApi.getMyPendingApprovals({ limit: 1 }),
        notificationApi.getUnreadCount(),
      ]);
      const newPendingCount = pendingRes.data.total || 0;
      const newUnreadCount = notifRes.data.unreadCount || 0;

      setPendingApprovalsCount(newPendingCount);
      setUnreadNotifCount(newUnreadCount);

      if (prevUnreadCountRef.current !== null && newUnreadCount > prevUnreadCountRef.current) {
        emitProposalUpdated();
      }
      prevUnreadCountRef.current = newUnreadCount;
    } catch {
      // Ignore background errors
    }
  }, [user]);

  // Quản lý kết nối Socket.IO Realtime & Lắng nghe sự kiện
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    // Kết nối Socket.IO
    connectSocket();

    // 1. Lắng nghe thông báo mới realtime
    const unsubNew = onNotificationNew((newNotif) => {
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
      setUnreadNotifCount((prev) => prev + 1);

      // Bắn popup trình duyệt khi tab chạy ngầm
      const meta = getNotificationMeta(newNotif);
      sendBrowserNotification(newNotif.title, {
        body: newNotif.content,
        tag: newNotif.id,
        onlyWhenHidden: false,
        onClick: () => {
          navigate(meta.url);
        },
      });

      // Nếu liên quan tới Proposal, đồng bộ làm mới
      if (newNotif.proposalId) {
        emitProposalUpdated(newNotif.proposalId);
      }
    });

    // 2. Lắng nghe cập nhật unread count chuẩn xác từ server
    const unsubCount = onNotificationUnreadCount((data) => {
      setUnreadNotifCount(data.unreadCount);
    });

    // 3. Lắng nghe trạng thái đã đọc từ tab khác
    const unsubRead = onNotificationRead((data) => {
      if (data.all) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadNotifCount(0);
      } else if (data.id) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === data.id ? { ...n, isRead: true } : n))
        );
        setUnreadNotifCount((prev) => Math.max(0, prev - 1));
      }
    });

    return () => {
      unsubNew();
      unsubCount();
      unsubRead();
    };
  }, [user, navigate]);

  useEffect(() => {
    fetchCounts();
    // Fallback polling mỗi 45s (hoặc khi focus cửa sổ)
    const interval = setInterval(fetchCounts, 45000);

    const handleFocus = () => {
      fetchCounts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCounts();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCounts, location.pathname]);

  // Handle outside click for notification dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications list when opening dropdown
  const handleToggleNotifs = async () => {
    const willOpen = !isNotifOpen;
    setIsNotifOpen(willOpen);
    if (willOpen && user) {
      setLoadingNotifs(true);
      try {
        const res = await notificationApi.getNotifications({ limit: 15 });
        setNotifications(res.data.notifications || []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoadingNotifs(false);
      }
    }
  };

  // Mark single notification as read & navigate
  const handleNotificationClick = async (notif: AppNotification) => {
    try {
      if (!notif.isRead) {
        await notificationApi.markAsRead(notif.id);
        setUnreadNotifCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
      }
      setIsNotifOpen(false);

      const meta = getNotificationMeta(notif);
      if (notif.proposalId) {
        emitProposalUpdated(notif.proposalId);
      }

      navigate(meta.url, {
        state: { refresh: Date.now() },
      });
    } catch (err) {
      console.error('Error clicking notification:', err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setUnreadNotifCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Yêu cầu quyền thông báo trình duyệt
  const handleEnableBrowserNotification = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationPermission('granted');
      sendBrowserNotification('Đã bật thông báo thành công! 🎉', {
        body: 'Bạn sẽ nhận được thông báo tức thì khi có cập nhật hoặc bình luận mới.',
        onlyWhenHidden: false,
      });
    } else {
      setNotificationPermission(getNotificationPermission());
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-bold text-lg text-slate-900 dark:text-white group flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              AI Test Case
            </span>
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
              v2.0
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>

          {canAccessWorkflow && (
          <Link
            to="/workflow"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/workflow')
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-500" />
            Quy trình
          </Link>
        )}

        {canAccessProposal && (
          <>
            {/* Proposal Hub with Pending Approvals Badge */}
            <Link
              to="/proposals"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                isActive('/proposals') && !isActive('/proposals/reports')
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Đề xuất</span>
              {pendingApprovalsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse shadow-sm">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>

            {/* Proposal Reports Link */}
            <Link
              to="/proposals/reports"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/proposals/reports')
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span>Báo cáo</span>
            </Link>
          </>
        )}

          {canAccessGenerate && (
            <Link
              to="/generate"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/generate')
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-blue-500" />
              Sinh TC AI
            </Link>
          )}

          {canAccessImport && (
            <Link
              to="/import"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/import')
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Nhập Excel
            </Link>
          )}

          {canAccessSettings && (
            <Link
              to="/settings"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/settings')
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              Cài đặt
            </Link>
          )}

          {canAccessUserManagement && (
            <Link
              to="/user-management"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/user-management')
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              Nhân sự
            </Link>
          )}

          {canAccessReview && (
            <Link
              to="/testcase-management"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/testcase-management')
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Kiểm duyệt
            </Link>
          )}
        </nav>

        {/* User profile, Notification Bell & Actions */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2.5">
              {/* Notification Popover Button */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={handleToggleNotifs}
                  className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Thông báo hệ thống"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse shadow-sm">
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-500" />
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          Thông báo
                        </h4>
                        {unreadNotifCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                            {unreadNotifCount} mới
                          </span>
                        )}
                      </div>
                      {unreadNotifCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          Đọc tất cả
                        </button>
                      )}
                    </div>

                    {/* Banner xin quyền thông báo trình duyệt nếu chưa bật */}
                    {notificationPermission === 'default' && (
                      <div className="px-3.5 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200">
                          <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 animate-bounce" />
                          <span className="text-[11px] leading-tight">Bật thông báo đẩy khi tab ẩn</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleEnableBrowserNotification}
                          className="px-2.5 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg shadow-sm transition-colors flex-shrink-0"
                        >
                          Bật ngay
                        </button>
                      </div>
                    )}

                    {/* Notifications List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                      {loadingNotifs ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Đang tải thông báo...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="py-10 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                          <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                          <p className="text-xs">Không có thông báo mới nào</p>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const meta = getNotificationMeta(notif);
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors text-xs flex gap-3 ${
                                !notif.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                              }`}
                            >
                              {/* Read Status Indicator */}
                              <div className="mt-1 flex-shrink-0">
                                {!notif.isRead ? (
                                  <span className={`w-2 h-2 rounded-full ${meta.dotColor} block`} />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 space-y-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                                  >
                                    {meta.label}
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-white truncate flex-1">
                                    {notif.title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                  {notif.content}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span>{formatRelativeTime(notif.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer Links */}
                    <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-xs px-4">
                      <Link
                        to="/workflow"
                        onClick={() => setIsNotifOpen(false)}
                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                      >
                        Nhiệm vụ
                      </Link>
                      <Link
                        to="/testcase-management"
                        onClick={() => setIsNotifOpen(false)}
                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                      >
                        Kiểm thử
                      </Link>
                      <Link
                        to="/proposals"
                        onClick={() => setIsNotifOpen(false)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        Đề xuất &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* User badge */}
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium max-w-[120px] truncate">{user.fullName || user.email}</span>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                  {user.role}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
