import React, { useState } from 'react';
import { Shield, ShieldCheck, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { permissionApi } from '../services/api';
import type { Permission } from '../types';

interface PermissionManagementProps {
  canManagePermissions: boolean;
}

export const PermissionManagement: React.FC<PermissionManagementProps> = ({ canManagePermissions }) => {
  if (!canManagePermissions) return null;

  const [permissionsData, setPermissionsData] = useState<Record<string, Permission[]>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [savingPermissions, setSavingPermissions] = useState<string | null>(null);
  const [savedPermSuccess, setSavedPermSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = async () => {
    try {
      const [permsRes, rolesRes] = await Promise.all([
        permissionApi.getByCategory(),
        Promise.all(['ADMIN', 'TESTER', 'VIEWER'].map(r => permissionApi.getRolePermissions(r))),
      ]);
      setPermissionsData(permsRes.data.categories || {});
      const rolePerms: Record<string, string[]> = {};
      ['ADMIN', 'TESTER', 'VIEWER'].forEach((role, idx) => {
        rolePerms[role] = rolesRes[idx].data.permissions.map(p => p.key);
      });
      setRolePermissions(rolePerms);
    } catch (err) {
      console.warn('Error loading permissions:', err);
    }
  };

  const handleSaveRolePermissions = async (role: string) => {
    const permissionKeys = rolePermissions[role] || [];
    setSavingPermissions(role);
    setSavedPermSuccess(null);
    try {
      await permissionApi.updateRolePermissions(role, permissionKeys);
      setSavedPermSuccess(`Đã cập nhật quyền cho ${role} thành công!`);
      await loadPermissions();
      setTimeout(() => setSavedPermSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi cập nhật quyền');
    } finally {
      setSavingPermissions(null);
    }
  };

  const togglePermission = (role: string, permissionKey: string) => {
    const current = rolePermissions[role] || [];
    const isChecked = current.includes(permissionKey);
    setRolePermissions({
      ...rolePermissions,
      [role]: isChecked
        ? current.filter(k => k !== permissionKey)
        : [...current, permissionKey],
    });
  };

  React.useEffect(() => {
    loadPermissions();
  }, []);

  const renderPermissionCheckbox = (role: string, perm: Permission, perms: string[]) => (
    <label
      key={perm.key}
      className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
    >
      <input
        type="checkbox"
        checked={perms.includes(perm.key)}
        onChange={() => togglePermission(role, perm.key)}
        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
          {perm.name}
        </p>
        <p className="text-[10px] text-slate-500 truncate font-mono">{perm.key}</p>
      </div>
    </label>
  );

  const renderRole = (role: string) => {
    const isExpanded = expandedRole === role;

    const roleColors = {
      ADMIN: 'bg-gradient-to-tr from-rose-500 to-red-600 text-white',
      TESTER: 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white',
      VIEWER: 'bg-gradient-to-tr from-slate-500 to-slate-600 text-white',
    };

    return (
      <div key={role} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedRole(isExpanded ? null : role)}
          className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${roleColors[role as keyof typeof roleColors]}`}
            >
              {role.slice(0, 3)}
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">{role}</span>
              <p className="text-xs text-slate-500 mt-0.5">
                {rolePermissions[role]?.length || 0} quyền
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role !== 'ADMIN' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveRolePermissions(role);
                }}
                disabled={savingPermissions === role}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {savingPermissions === role ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Lưu</span>
              </button>
            )}
            <span className={expandedRole === role ? 'text-blue-600' : 'text-slate-400'}>
              {expandedRole === role ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </span>
          </div>
        </button>

        {expandedRole === role && (
          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700 space-y-4">
            {Object.entries(permissionsData).map(([category, permissions]) => (
              <div key={category} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {category} ({permissions.filter(p => (rolePermissions[role] || []).includes(p.key)).length}/{permissions.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {permissions.map(perm => renderPermissionCheckbox(role, perm, rolePermissions[role] || []))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Quản lý Phân quyền (RBAC)
          </h2>
        </div>
        <p className="text-xs text-slate-500 max-w-md">
          Cấu hình quyền cho từng vai trò. ADMIN có tất cả quyền. TESTER và VIEWER có quyền hạn chế.
        </p>
      </div>

      {savedPermSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {savedPermSuccess}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        {(['ADMIN', 'TESTER', 'VIEWER'] as const).map(role => renderRole(role))}
      </div>
    </div>
  );
};

export default PermissionManagement;