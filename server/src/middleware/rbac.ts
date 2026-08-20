import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { hasPermission, clearPermissionCache } from '../services/permissionService';

export const requirePermission = (permissionKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id || !req.user.role) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const allowed = await hasPermission(req.user.id, req.user.role, permissionKey);
      if (!allowed) {
        return res.status(403).json({ 
          message: 'Bạn không có quyền thực hiện hành động này',
          permission: permissionKey,
        });
      }

      next();
    } catch (error: any) {
      console.error('RBAC error:', error);
      return res.status(500).json({ message: 'Lỗi kiểm tra quyền' });
    }
  };
};

export const requireAnyPermission = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id || !req.user.role) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const permissions = await getUserEffectivePermissions(req.user.id, req.user.role);
      const hasAny = permissionKeys.some(p => permissions.includes(p));
      
      if (!hasAny) {
        return res.status(403).json({ 
          message: 'Bạn không có quyền thực hiện hành động này',
          permissions: permissionKeys,
        });
      }

      next();
    } catch (error: any) {
      console.error('RBAC error:', error);
      return res.status(500).json({ message: 'Lỗi kiểm tra quyền' });
    }
  };
};

export const requireAllPermissions = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id || !req.user.role) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const permissions = await getUserEffectivePermissions(req.user.id, req.user.role);
      const hasAll = permissionKeys.every(p => permissions.includes(p));
      
      if (!hasAll) {
        return res.status(403).json({ 
          message: 'Bạn không có đủ quyền để thực hiện hành động này',
          permissions: permissionKeys,
        });
      }

      next();
    } catch (error: any) {
      console.error('RBAC error:', error);
      return res.status(500).json({ message: 'Lỗi kiểm tra quyền' });
    }
  };
};

export const requireResourcePermission = (
  permissionKey: string,
  getResource: (req: AuthRequest) => Promise<{ type: string; id: string; ownerId: string } | null>
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id || !req.user.role) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const resource = await getResource(req);
      const allowed = await hasPermission(req.user.id, req.user.role, permissionKey, resource || undefined);
      
      if (!allowed) {
        return res.status(403).json({ 
          message: 'Bạn không có quyền thực hiện hành động này trên tài nguyên này',
          permission: permissionKey,
        });
      }

      next();
    } catch (error: any) {
      console.error('RBAC resource error:', error);
      return res.status(500).json({ message: 'Lỗi kiểm tra quyền tài nguyên' });
    }
  };
};

async function getUserEffectivePermissions(userId: string, role: string): Promise<string[]> {
  const { getUserEffectivePermissions } = await import('../services/permissionService');
  return getUserEffectivePermissions(userId, role);
}