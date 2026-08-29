import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

interface PermissionCache {
  [userId: string]: {
    permissions: string[];
    role: string;
    expiresAt: number;
  };
}

const permissionCache: PermissionCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUserEffectivePermissions(userId: string, role: string): Promise<string[]> {
  const now = Date.now();
  const cached = permissionCache[userId];
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  // Get role permissions
  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: role as any },
    include: { permission: true },
  });

  const rolePermissions = rolePerms.map(rp => rp.permission.key);

  // Get user-specific overrides
  const userPerms = await prisma.userPermission.findMany({
    where: { userId },
    include: { permission: true },
  });

  const allowSet = new Set(rolePermissions);
  const denySet = new Set<string>();

  for (const up of userPerms) {
    if (up.effect === 'ALLOW') {
      allowSet.add(up.permission.key);
    } else {
      denySet.add(up.permission.key);
    }
  }

  // Remove denied permissions
  for (const denied of denySet) {
    allowSet.delete(denied);
  }

  const effective = Array.from(allowSet);

  // Cache
  permissionCache[userId] = {
    permissions: effective,
    role,
    expiresAt: now + CACHE_TTL,
  };

  return effective;
}

export async function hasPermission(
  userId: string,
  role: string,
  permissionKey: string,
  resource?: { type: string; id: string; ownerId: string }
): Promise<boolean> {
  // ADMIN bypasses all permission checks
  if (role === 'ADMIN') {
    return true;
  }

  const permissions = await getUserEffectivePermissions(userId, role);
  
  if (!permissions.includes(permissionKey)) {
    return false;
  }

  // Owner-based check for TESTER on update/delete
  if (resource && role === 'TESTER') {
    const ownershipRequired = [
      'testcase:update', 'testcase:delete',
      'testsuite:update', 'testsuite:delete',
    ];
    if (ownershipRequired.includes(permissionKey)) {
      return resource.ownerId === userId;
    }
  }

  return true;
}

export function clearPermissionCache(userId?: string) {
  if (userId) {
    delete permissionCache[userId];
  } else {
    Object.keys(permissionCache).forEach(key => delete permissionCache[key]);
  }
}

export async function getAllPermissions() {
  return prisma.permission.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export async function getPermissionsByCategory() {
  const permissions = await getAllPermissions();
  const grouped: Record<string, typeof permissions> = {};
  for (const p of permissions) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  return grouped;
}

export async function getRolePermissions(role: string) {
  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: role as any },
    include: { permission: true },
  });
  return rolePerms.map(rp => rp.permission);
}

export async function setRolePermissions(role: string, permissionKeys: string[], grantedById?: string) {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });
  const permissionIds = permissions.map(p => p.id);

  // Remove old mappings not in new list
  await prisma.rolePermission.deleteMany({
    where: {
      role: role as any,
      permissionId: { notIn: permissionIds },
    },
  });

  // Add new mappings
  for (const permId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: role as any,
          permissionId: permId,
        },
      },
      update: { grantedById },
      create: {
        role: role as any,
        permissionId: permId,
        grantedById,
      },
    });
  }

  clearPermissionCache();
  return getRolePermissions(role);
}

export async function getUserPermissions(userId: string) {
  return prisma.userPermission.findMany({
    where: { userId },
    include: { permission: true },
  });
}

export async function grantUserPermission(
  userId: string,
  permissionKey: string,
  effect: 'ALLOW' | 'DENY',
  resourceType?: string,
  resourceId?: string
) {
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!permission) throw new Error(`Permission not found: ${permissionKey}`);

  const result = await prisma.userPermission.upsert({
    where: {
      userId_permissionId_resourceType_resourceId: {
        userId,
        permissionId: permission.id,
        resourceType: resourceType || '',
        resourceId: resourceId || '',
      },
    },
    update: { effect },
    create: {
      userId,
      permissionId: permission.id,
      effect,
      resourceType,
      resourceId,
    },
  });

  clearPermissionCache(userId);
  return result;
}

export async function revokeUserPermission(userId: string, permissionKey: string, resourceType?: string, resourceId?: string) {
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!permission) throw new Error(`Permission not found: ${permissionKey}`);

  await prisma.userPermission.delete({
    where: {
      userId_permissionId_resourceType_resourceId: {
        userId,
        permissionId: permission.id,
        resourceType: resourceType || '',
        resourceId: resourceId || '',
      },
    },
  });

  clearPermissionCache(userId);
}

export async function checkPermission(userId: string, role: string, permissionKey: string) {
  return hasPermission(userId, role, permissionKey);
}

export async function getUsersWithPermission(
  permissionKey: string
): Promise<{ id: string; fullName: string; email: string }[]> {
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!permission) return [];

  const rolePerms = await prisma.rolePermission.findMany({
    where: { permissionId: permission.id },
    select: { role: true },
  });
  const rolesWithPerm = rolePerms.map((r) => r.role);

  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { role: 'ADMIN' },
        { role: { in: rolesWithPerm } },
        { userPermissions: { some: { permissionId: permission.id, effect: 'ALLOW' } } },
      ],
    },
    select: { id: true, fullName: true, email: true },
  });

  // Loại bỏ người dùng bị từ chối (DENY) quyền này một cách tường minh
  const denies = await prisma.userPermission.findMany({
    where: { permissionId: permission.id, effect: 'DENY' },
    select: { userId: true },
  });
  const denySet = new Set(denies.map((d) => d.userId));

  return users.filter((u) => !denySet.has(u.id));
}

export async function canViewAllExecutionHistory(userId: string | undefined, role: string | undefined): Promise<boolean> {
  if (!userId || !role) return false;
  if (role === 'ADMIN') return true;
  return hasPermission(userId, role, 'execution:read-all');
}

export async function canViewOwnExecutionHistory(userId: string | undefined, role: string | undefined): Promise<boolean> {
  if (!userId || !role) return false;
  if (role === 'ADMIN') return true;
  return hasPermission(userId, role, 'execution:read-own');
}

export async function canReviewTestCase(userId: string | undefined, role: string | undefined): Promise<boolean> {
  if (!userId || !role) return false;
  if (role === 'ADMIN') return true;
  return hasPermission(userId, role, 'testcase:review');
}

export async function canViewAllUserTestStats(userId: string | undefined, role: string | undefined): Promise<boolean> {
  if (!userId || !role) return false;
  if (role === 'ADMIN') return true;
  const hasReadAll = await hasPermission(userId, role, 'dashboard:user-stats:read-all');
  if (hasReadAll) return true;
  return hasPermission(userId, role, 'execution:read-all');
}

export async function canViewUserTestStats(userId: string | undefined, role: string | undefined): Promise<boolean> {
  if (!userId || !role) return false;
  if (role === 'ADMIN') return true;
  const hasRead = await hasPermission(userId, role, 'dashboard:user-stats:read');
  if (hasRead) return true;
  return hasPermission(userId, role, 'dashboard:user-stats:read-all');
}