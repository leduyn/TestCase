import { useState, useEffect, useCallback } from 'react';
import { permissionApi } from '../services/api';
import type { UserPermissionsResponse } from '../types';

interface UsePermissionsReturn {
  permissions: string[];
  rolePermissions: string[];
  userPermissions: UserPermissionsResponse['userPermissions'];
  loading: boolean;
  error: string | null;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
  hasAllPermissions: (keys: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

export const usePermissions = (): UsePermissionsReturn => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissionsResponse['userPermissions']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await permissionApi.getMyPermissions();
      const data = res.data;
      
      // Combine role permissions with user overrides (ALLOW adds, DENY removes)
      const allowSet = new Set(data.rolePermissions);
      const denySet = new Set<string>();
      
      for (const up of data.userPermissions) {
        if (up.effect === 'ALLOW') {
          allowSet.add(up.permissionKey);
        } else {
          denySet.add(up.permissionKey);
        }
      }
      
      // Remove denied permissions
      for (const denied of denySet) {
        allowSet.delete(denied);
      }
      
      const effective = Array.from(allowSet);
      
      setPermissions(effective);
      setRolePermissions(data.rolePermissions);
      setUserPermissions(data.userPermissions);
    } catch (err: any) {
      console.error('Failed to fetch permissions:', err);
      setError(err.response?.data?.message || 'Không thể tải quyền');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = (key: string): boolean => {
    return permissions.includes(key);
  };

  const hasAnyPermission = (keys: string[]): boolean => {
    return keys.some(k => permissions.includes(k));
  };

  const hasAllPermissions = (keys: string[]): boolean => {
    return keys.every(k => permissions.includes(k));
  };

  return {
    permissions,
    rolePermissions,
    userPermissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: fetchPermissions,
  };
};

// Helper hook for role-based checks
export const useRole = () => {
  const { permissions } = usePermissions();
  
  const isAdmin = permissions.includes('users:create'); // Admin has all permissions
  const isTester = permissions.includes('testcase:create') && !isAdmin;
  const isViewer = !isAdmin && !isTester;
  
  return { isAdmin, isTester, isViewer, permissions };
};