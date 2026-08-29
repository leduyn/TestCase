import prisma from '../config/database';

// Cache danh sách user được gán xử lý theo trạng thái (tránh query liên tục)
const cache: Record<string, { ids: Set<string>; exp: number }> = {};
const TTL = 5 * 60 * 1000; // 5 phút

export function clearStatusHandlerCache(status?: string): void {
  if (status) {
    delete cache[status];
  } else {
    Object.keys(cache).forEach((k) => delete cache[k]);
  }
}

export async function getStatusHandlerIds(status: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = cache[status];
  if (cached && cached.exp > now) {
    return cached.ids;
  }

  const rows = await prisma.executionStatusHandler.findMany({
    where: { status },
    select: { userId: true },
  });
  const ids = new Set(rows.map((r) => r.userId));
  cache[status] = { ids, exp: now + TTL };
  return ids;
}

// Người dùng có được gán xử lý trạng thái này hay không
export async function isStatusHandler(
  userId: string | undefined,
  status: string
): Promise<boolean> {
  if (!userId) return false;
  const ids = await getStatusHandlerIds(status);
  return ids.has(userId);
}

// Danh sách user được gán xử lý một trạng thái (cho dropdown giao việc)
export async function getStatusHandlers(
  status: string
): Promise<{ id: string; fullName: string; email: string }[]> {
  const ids = await getStatusHandlerIds(status);
  if (ids.size === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(ids) }, status: 'ACTIVE' },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  });
  return users;
}

// Các trạng thái mà một user được gán xử lý
export async function getStatusesForUser(userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.executionStatusHandler.findMany({
    where: { userId },
    select: { status: true },
  });
  return Array.from(new Set(rows.map((r) => r.status)));
}

// Gán / gỡ user khỏi trạng thái
export async function assignStatusHandler(status: string, userId: string) {
  const result = await prisma.executionStatusHandler.upsert({
    where: { status_userId: { status, userId } },
    update: {},
    create: { status, userId },
  });
  clearStatusHandlerCache(status);
  return result;
}

export async function removeStatusHandler(status: string, userId: string) {
  await prisma.executionStatusHandler.deleteMany({ where: { status, userId } });
  clearStatusHandlerCache(status);
}
