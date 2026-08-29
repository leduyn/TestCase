import { Router } from 'express';
import { PermissionController } from '../controllers/permissionController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All permission routes require authentication
router.use(authenticate);

// Permission definitions
router.get('/permissions', PermissionController.getAllPermissions);
router.get('/permissions/categories', PermissionController.getPermissionsByCategory);

// Role permissions
router.get('/roles/:role/permissions', PermissionController.getRolePermissions);
router.put('/roles/:role/permissions', PermissionController.updateRolePermissions);

// User permissions
router.get('/users/me/permissions', PermissionController.getMyPermissions);
router.get('/users/:id/permissions', PermissionController.getUserPermissions);
router.post('/users/:id/permissions', PermissionController.grantUserPermission);
router.delete('/users/:id/permissions/:permissionKey', PermissionController.revokeUserPermission);

// Users eligible to handle a given permission (e.g. execution:set-<STATUS>)
router.get('/users/by-permission', PermissionController.getUsersByPermission);

export default router;