import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../services/api';
import type { User, Role } from '../types';
import { PermissionManagement } from '../components/PermissionManagement';
import StatusHandlerManagement from '../components/StatusHandlerManagement';
import { usePermissions } from '../hooks/usePermissions';
import { normalizeSearch } from '../utils/diacritics';
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Shield,
  X,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  user?: User | null;
}

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();

  const canCreateUser = hasPermission('users:create');
  const canUpdateUser = hasPermission('users:update');
  const canDeleteUser = hasPermission('users:delete');
  const canToggleStatus = hasPermission('users:status');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Add / Edit Modal
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    mode: 'create',
    user: null,
  });

  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    fullName: string;
    role: Role;
  }>({
    email: '',
    password: '',
    fullName: '',
    role: 'TESTER',
  });

  // Confirmation Modals
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user?: User | null }>({
    open: false,
    user: null,
  });

  const [statusModal, setStatusModal] = useState<{ open: boolean; user?: User | null }>({
    open: false,
    user: null,
  });

  // Admin Reset Password Modal
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    open: boolean;
    user: User | null;
    activeTab: 'manual' | 'link';
    newPassword: string;
    showPassword: boolean;
    generatedLink: string | null;
    submitting: boolean;
    copiedPassword: boolean;
    copiedLink: boolean;
    error: string | null;
    success: string | null;
  }>({
    open: false,
    user: null,
    activeTab: 'manual',
    newPassword: '',
    showPassword: true,
    generatedLink: null,
    submitting: false,
    copiedPassword: false,
    copiedLink: false,
    error: null,
    success: null,
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await userApi.getUsers();
      setUsers(data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi khi tải danh sách người dùng', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'TESTER',
    });
    setModalState({
      open: true,
      mode: 'create',
      user: null,
    });
  };

  const openEditModal = (targetUser: User) => {
    setFormData({
      email: targetUser.email,
      password: '',
      fullName: targetUser.fullName,
      role: targetUser.role,
    });
    setModalState({
      open: true,
      mode: 'edit',
      user: targetUser,
    });
  };

  const closeModal = () => {
    setModalState({ open: false, mode: 'create', user: null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (modalState.mode === 'create') {
        if (!formData.email || !formData.password || !formData.fullName) {
          showToast('Vui lòng nhập đầy đủ email, mật khẩu và họ tên', 'error');
          setSubmitting(false);
          return;
        }

        const { data } = await userApi.createUser({
          email: formData.email.trim(),
          password: formData.password,
          fullName: formData.fullName.trim(),
          role: formData.role,
        });

        showToast('Tạo người dùng mới thành công', 'success');
        setUsers((prev) => [data, ...prev]);
        closeModal();
      } else if (modalState.mode === 'edit' && modalState.user) {
        if (!formData.fullName.trim()) {
          showToast('Họ tên không được để trống', 'error');
          setSubmitting(false);
          return;
        }

        const { data } = await userApi.updateUser(modalState.user.id, {
          fullName: formData.fullName.trim(),
          role: formData.role,
        });

        showToast('Cập nhật thông tin người dùng thành công', 'success');
        setUsers((prev) => prev.map((u) => (u.id === modalState.user!.id ? data : u)));
        closeModal();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await userApi.deleteUser(userId);
      showToast('Xóa người dùng thành công', 'success');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi khi xóa người dùng', 'error');
    } finally {
      setDeleteModal({ open: false, user: null });
    }
  };

  const handleToggleStatus = async (userToToggle: User) => {
    try {
      const { data } = await userApi.toggleStatus(userToToggle.id);
      const isNowActive = data.user.status === 'ACTIVE';
      showToast(`Tài khoản ${isNowActive ? 'kích hoạt' : 'khóa'} thành công`, 'success');
      setUsers((prev) => prev.map((u) => (u.id === userToToggle.id ? data.user : u)));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi thay đổi trạng thái', 'error');
    } finally {
      setStatusModal({ open: false, user: null });
    }
  };

  const openResetPasswordModal = (targetUser: User) => {
    setResetPasswordModal({
      open: true,
      user: targetUser,
      activeTab: 'manual',
      newPassword: '',
      showPassword: true,
      generatedLink: null,
      submitting: false,
      copiedPassword: false,
      copiedLink: false,
      error: null,
      success: null,
    });
  };

  const closeResetPasswordModal = () => {
    setResetPasswordModal((prev) => ({ ...prev, open: false, user: null }));
  };

  const generateRandomPassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*';
    const all = uppercase + lowercase + numbers + symbols;

    let res = '';
    res += uppercase[Math.floor(Math.random() * uppercase.length)];
    res += lowercase[Math.floor(Math.random() * lowercase.length)];
    res += numbers[Math.floor(Math.random() * numbers.length)];
    res += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < 10; i++) {
      res += all[Math.floor(Math.random() * all.length)];
    }

    const shuffled = res.split('').sort(() => 0.5 - Math.random()).join('');
    setResetPasswordModal((prev) => ({
      ...prev,
      newPassword: shuffled,
      error: null,
    }));
  };

  const handleAdminResetPasswordDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal.user) return;
    if (!resetPasswordModal.newPassword || resetPasswordModal.newPassword.length < 6) {
      setResetPasswordModal((prev) => ({
        ...prev,
        error: 'Mật khẩu mới phải có tối thiểu 6 ký tự',
      }));
      return;
    }

    setResetPasswordModal((prev) => ({ ...prev, submitting: true, error: null, success: null }));
    try {
      const res = await userApi.adminResetPassword(resetPasswordModal.user.id, {
        newPassword: resetPasswordModal.newPassword,
      });
      showToast(res.data.message || 'Đặt lại mật khẩu thành công', 'success');
      setResetPasswordModal((prev) => ({
        ...prev,
        submitting: false,
        success: 'Đặt lại mật khẩu thành công! Người dùng có thể đăng nhập bằng mật khẩu này.',
      }));
    } catch (err: any) {
      setResetPasswordModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Có lỗi xảy ra khi đặt lại mật khẩu',
      }));
    }
  };

  const handleAdminGenerateResetLink = async () => {
    if (!resetPasswordModal.user) return;
    setResetPasswordModal((prev) => ({ ...prev, submitting: true, error: null, success: null }));
    try {
      const res = await userApi.adminResetPassword(resetPasswordModal.user.id, {
        type: 'generate_link',
      });
      setResetPasswordModal((prev) => ({
        ...prev,
        submitting: false,
        generatedLink: res.data.resetUrl || null,
        success: 'Tạo liên kết đặt lại mật khẩu thành công! Bạn có thể sao chép và gửi cho người dùng.',
      }));
    } catch (err: any) {
      setResetPasswordModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Có lỗi xảy ra khi tạo liên kết',
      }));
    }
  };

  const handleCopyGeneratedPassword = () => {
    if (!resetPasswordModal.newPassword) return;
    navigator.clipboard.writeText(resetPasswordModal.newPassword);
    setResetPasswordModal((prev) => ({ ...prev, copiedPassword: true }));
    setTimeout(() => {
      setResetPasswordModal((prev) => ({ ...prev, copiedPassword: false }));
    }, 2000);
  };

  const handleCopyGeneratedLink = () => {
    if (!resetPasswordModal.generatedLink) return;
    navigator.clipboard.writeText(resetPasswordModal.generatedLink);
    setResetPasswordModal((prev) => ({ ...prev, copiedLink: true }));
    setTimeout(() => {
      setResetPasswordModal((prev) => ({ ...prev, copiedLink: false }));
    }, 2000);
  };

  if (!currentUser) {
    return null;
  }

  const filteredUsers = users.filter((u) => {
    const q = normalizeSearch(search);
    const matchesSearch = normalizeSearch(u.email).includes(q) ||
      (u.fullName && normalizeSearch(u.fullName).includes(q));
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = users.filter(u => u.status === 'PENDING').length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white font-medium text-sm transition-all duration-300 ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600" />
            Quản lý Người dùng
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Tổng cộng: <span className="font-semibold text-slate-700">{filteredUsers.length}</span> người dùng
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canCreateUser && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Thêm người dùng mới
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo email hoặc họ tên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
        />
      </div>

      {/* Status Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['ALL', 'PENDING', 'ACTIVE', 'INACTIVE'] as const).map((filter) => {
          const labels: Record<string, string> = { ALL: 'Tất cả', PENDING: 'Chờ duyệt', ACTIVE: 'Hoạt động', INACTIVE: 'Đã khóa' };
          const isActive = statusFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {labels[filter]}
              {filter === 'PENDING' && pendingCount > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full ${
                  isActive ? 'bg-white text-indigo-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm font-medium">Đang tải danh sách người dùng...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500">
            <AlertCircle className="w-8 h-8 text-slate-400" />
            <span className="text-sm">Không tìm thấy người dùng phù hợp</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Họ tên & Email</th>
                  <th className="px-5 py-3.5">Vai trò</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5">Đăng nhập gần nhất</th>
                  <th className="px-5 py-3.5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{u.fullName || '(Chưa đặt tên)'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{u.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'ADMIN'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : u.role === 'TESTER'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {u.role === 'ADMIN'
                          ? 'Quản trị viên'
                          : u.role === 'TESTER'
                          ? 'Kiểm thử viên'
                          : 'Xem chỉ đọc'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : u.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500'
                              : u.status === 'PENDING'
                              ? 'bg-amber-500 animate-pulse'
                              : 'bg-slate-400'
                          }`}
                        />
                        {u.status === 'ACTIVE' ? 'Hoạt động' : u.status === 'PENDING' ? 'Chờ duyệt' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canUpdateUser && (
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canUpdateUser && (
                          <button
                            onClick={() => openResetPasswordModal(u)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Đặt lại mật khẩu"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                        {canToggleStatus && (
                          <button
                            onClick={() => setStatusModal({ open: true, user: u })}
                            className={`p-1.5 rounded transition-colors ${
                              u.status === 'PENDING'
                                ? 'text-blue-600 hover:bg-blue-50'
                                : u.status === 'ACTIVE'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.status === 'PENDING' ? 'Duyệt tài khoản' : u.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
                          >
                            {u.status === 'PENDING' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : u.status === 'ACTIVE' ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {canDeleteUser && (
                          <button
                            onClick={() => setDeleteModal({ open: true, user: u })}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {modalState.mode === 'create' ? 'Thêm người dùng mới' : 'Chỉnh sửa người dùng'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  disabled={modalState.mode === 'edit'}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {modalState.mode === 'create' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Nhập mật khẩu..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vai trò (Role)
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  <option value="TESTER">Kiểm thử viên (TESTER)</option>
                  <option value="VIEWER">Xem chỉ đọc (VIEWER)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {modalState.mode === 'create' ? 'Thêm người dùng' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa người dùng</h3>
              <p className="text-sm text-slate-500 mt-2">
                Bạn có chắc chắn muốn xóa tài khoản <span className="font-semibold text-slate-800">{deleteModal.user.email}</span>? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, user: null })}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteModal.user!.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle Modal */}
      {statusModal.open && statusModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                statusModal.user.status === 'PENDING'
                  ? 'bg-blue-100 text-blue-600'
                  : statusModal.user.status === 'ACTIVE'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {statusModal.user.status === 'PENDING' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : statusModal.user.status === 'ACTIVE' ? (
                <Lock className="w-6 h-6" />
              ) : (
                <Unlock className="w-6 h-6" />
              )}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">
                {statusModal.user.status === 'PENDING'
                  ? 'Phê duyệt tài khoản'
                  : statusModal.user.status === 'ACTIVE'
                  ? 'Khóa tài khoản'
                  : 'Mở khóa tài khoản'}
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                Bạn có chắc chắn muốn{' '}
                {statusModal.user.status === 'PENDING'
                  ? 'phê duyệt'
                  : statusModal.user.status === 'ACTIVE'
                  ? 'khóa'
                  : 'mở khóa'}{' '}
                tài khoản{' '}
                <span className="font-semibold text-slate-800">{statusModal.user.email}</span>?
              </p>
              {statusModal.user.status === 'PENDING' && (
                <p className="text-xs text-blue-600 mt-2">
                  Sau khi phê duyệt, người dùng có thể đăng nhập và sử dụng hệ thống.
                </p>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusModal({ open: false, user: null })}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleToggleStatus(statusModal.user!)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors ${
                  statusModal.user.status === 'PENDING'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : statusModal.user.status === 'ACTIVE'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusModal.user.status === 'PENDING'
                  ? 'Phê duyệt'
                  : statusModal.user.status === 'ACTIVE'
                  ? 'Khóa tài khoản'
                  : 'Mở khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetPasswordModal.open && resetPasswordModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Đặt lại mật khẩu</h3>
                  <p className="text-xs text-slate-500">
                    Người dùng: <span className="font-semibold text-slate-700">{resetPasswordModal.user.fullName}</span> ({resetPasswordModal.user.email})
                  </p>
                </div>
              </div>
              <button
                onClick={closeResetPasswordModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/30">
              <button
                type="button"
                onClick={() =>
                  setResetPasswordModal((prev) => ({
                    ...prev,
                    activeTab: 'manual',
                    error: null,
                    success: null,
                  }))
                }
                className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  resetPasswordModal.activeTab === 'manual'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Đặt mật khẩu trực tiếp
              </button>
              <button
                type="button"
                onClick={() =>
                  setResetPasswordModal((prev) => ({
                    ...prev,
                    activeTab: 'link',
                    error: null,
                    success: null,
                  }))
                }
                className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  resetPasswordModal.activeTab === 'link'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Cấp link đặt lại mật khẩu
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {resetPasswordModal.error && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{resetPasswordModal.error}</span>
                </div>
              )}

              {resetPasswordModal.success && (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{resetPasswordModal.success}</span>
                </div>
              )}

              {resetPasswordModal.activeTab === 'manual' ? (
                <form onSubmit={handleAdminResetPasswordDirect} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Mật khẩu mới <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={resetPasswordModal.showPassword ? 'text' : 'password'}
                        value={resetPasswordModal.newPassword}
                        onChange={(e) =>
                          setResetPasswordModal((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                            error: null,
                          }))
                        }
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                        className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setResetPasswordModal((prev) => ({
                            ...prev,
                            showPassword: !prev.showPassword,
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        tabIndex={-1}
                      >
                        {resetPasswordModal.showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions for password */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Tạo mật khẩu ngẫu nhiên
                    </button>
                    {resetPasswordModal.newPassword && (
                      <button
                        type="button"
                        onClick={handleCopyGeneratedPassword}
                        className="py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        {resetPasswordModal.copiedPassword ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {resetPasswordModal.copiedPassword ? 'Đã chép mật khẩu!' : 'Sao chép'}
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Lưu ý:
                    </p>
                    <p className="text-amber-700">
                      Mật khẩu sẽ có hiệu lực ngay lập tức. Nếu tài khoản trước đó bị tạm khóa do nhập sai nhiều lần, hệ thống sẽ tự động mở khóa và reset số lần đăng nhập sai.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeResetPasswordModal}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={
                        resetPasswordModal.submitting ||
                        !resetPasswordModal.newPassword ||
                        resetPasswordModal.newPassword.length < 6
                      }
                      className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {resetPasswordModal.submitting ? 'Đang cập nhật...' : 'Xác nhận đặt lại'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hệ thống sẽ tạo ra một liên kết đặt lại mật khẩu an toàn (có hiệu lực trong <strong>24 giờ</strong>). Bạn có thể sao chép liên kết này để gửi qua Chat, Zalo hoặc Email cho nhân viên tự tạo mật khẩu mới.
                  </p>

                  {!resetPasswordModal.generatedLink ? (
                    <div className="py-4 text-center">
                      <button
                        type="button"
                        onClick={handleAdminGenerateResetLink}
                        disabled={resetPasswordModal.submitting}
                        className="py-2.5 px-5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 inline-flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {resetPasswordModal.submitting
                          ? 'Đang tạo liên kết...'
                          : 'Tạo liên kết đặt lại mật khẩu'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                          <span>Liên kết đặt lại mật khẩu:</span>
                          <span className="text-emerald-600 font-medium">Hạn sử dụng: 24 giờ</span>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-200 text-xs font-mono break-all text-blue-600 select-all">
                          {resetPasswordModal.generatedLink}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCopyGeneratedLink}
                            className="flex-1 py-1.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            {resetPasswordModal.copiedLink ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {resetPasswordModal.copiedLink ? 'Đã sao chép!' : 'Sao chép liên kết'}
                          </button>
                          <a
                            href={resetPasswordModal.generatedLink}
                            target="_blank"
                            rel="noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Mở liên kết
                          </a>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={handleAdminGenerateResetLink}
                          disabled={resetPasswordModal.submitting}
                          className="text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Tạo lại liên kết mới
                        </button>
                        <button
                          type="button"
                          onClick={closeResetPasswordModal}
                          className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Permission Management (RBAC) */}
      {currentUser?.role === 'ADMIN' && (
        <div className="mt-6">
          <PermissionManagement canManagePermissions={true} />
        </div>
      )}

      {/* Phân công xử lý trạng thái thực thi (chỉ ADMIN) */}
      {currentUser?.role === 'ADMIN' && (
        <div className="mt-6">
          <StatusHandlerManagement />
        </div>
      )}
    </div>
  );
};

export default UserManagement;