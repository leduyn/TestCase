import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import {
  getAllPermissions,
  getPermissionsByCategory,
  getRolePermissions,
  setRolePermissions,
  getUserPermissions,
  grantUserPermission,
  revokeUserPermission,
} from '../services/permissionService';

export class PermissionController {
  static async getAllPermissions(_req: AuthRequest, res: Response) {
    try {
      const permissions = await getAllPermissions();
      return res.json({ permissions });
    } catch (error: any) {
      console.error('Get all permissions error:', error);
      return res.status(500).json({ message: 'Lỗi lấy danh sách quyền', error: error.message });
    }
  }

  static async getPermissionsByCategory(_req: AuthRequest, res: Response) {
    try {
      const grouped = await getPermissionsByCategory();
      return res.json({ categories: grouped });
    } catch (error: any) {
      console.error('Get permissions by category error:', error);
      return res.status(500).json({ message: 'Lỗi lấy quyền theo nhóm', error: error.message });
    }
  }

  static async getRolePermissions(req: AuthRequest, res: Response) {
    try {
      const { role } = req.params;
      const permissions = await getRolePermissions(role);
      return res.json({ role, permissions });
    } catch (error: any) {
      console.error('Get role permissions error:', error);
      return res.status(500).json({ message: 'Lỗi lấy quyền của vai trò', error: error.message });
    }
  }

  static async updateRolePermissions(req: AuthRequest, res: Response) {
    try {
      const { role } = req.params;
      const { permissionKeys } = req.body;

      if (!Array.isArray(permissionKeys)) {
        return res.status(400).json({ message: 'permissionKeys phải là mảng' });
      }

      const permissions = await setRolePermissions(role, permissionKeys, req.user?.id);
      return res.json({ role, permissions, message: 'Cập nhật quyền vai trò thành công' });
    } catch (error: any) {
      console.error('Update role permissions error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật quyền vai trò', error: error.message });
    }
  }

  static async getUserPermissions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      const rolePerms = await getRolePermissions(user.role);
      const userPerms = await getUserPermissions(id);

      return res.json({ 
        user: { id: user.id, role: user.role },
        rolePermissions: rolePerms.map(p => p.key),
        userPermissions: userPerms.map(up => ({
          permissionKey: up.permission.key,
          effect: up.effect,
          resourceType: up.resourceType,
          resourceId: up.resourceId,
        })),
      });
    } catch (error: any) {
      console.error('Get user permissions error:', error);
      return res.status(500).json({ message: 'Lỗi lấy quyền người dùng', error: error.message });
    }
  }

  static async getMyPermissions(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }
      
      // ADMIN has all permissions
      if (req.user.role === 'ADMIN') {
        const allPermissions = await getAllPermissions();
        return res.json({ 
          role: req.user.role,
          rolePermissions: allPermissions.map(p => p.key),
          userPermissions: [],
        });
      }

      const rolePerms = await getRolePermissions(req.user.role);
      const userPerms = await getUserPermissions(req.user.id);

      return res.json({ 
        role: req.user.role,
        rolePermissions: rolePerms.map(p => p.key),
        userPermissions: userPerms.map(up => ({
          permissionKey: up.permission.key,
          effect: up.effect,
          resourceType: up.resourceType,
          resourceId: up.resourceId,
        })),
      });
    } catch (error: any) {
      console.error('Get my permissions error:', error);
      return res.status(500).json({ message: 'Lỗi lấy quyền của bạn', error: error.message });
    }
  }

  static async grantUserPermission(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { permissionKey, effect, resourceType, resourceId } = req.body;

      if (!permissionKey || !['ALLOW', 'DENY'].includes(effect)) {
        return res.status(400).json({ message: 'permissionKey và effect (ALLOW/DENY) là bắt buộc' });
      }

      const result = await grantUserPermission(id, permissionKey, effect, resourceType, resourceId);
      return res.json({ message: 'Cấp quyền thành công', result });
    } catch (error: any) {
      console.error('Grant user permission error:', error);
      return res.status(500).json({ message: 'Lỗi cấp quyền', error: error.message });
    }
  }

  static async revokeUserPermission(req: AuthRequest, res: Response) {
    try {
      const { id, permissionKey } = req.params;
      const { resourceType, resourceId } = req.query;

      await revokeUserPermission(id, permissionKey, resourceType as string, resourceId as string);
      return res.json({ message: 'Thu hồi quyền thành công' });
    } catch (error: any) {
      console.error('Revoke user permission error:', error);
      return res.status(500).json({ message: 'Lỗi thu hồi quyền', error: error.message });
    }
  }
}