import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';
const RETRY_INTERVAL_MS = Number(process.env.REDIS_RETRY_INTERVAL_MS || 10000);

let cacheClient: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let redisReady = false;
let retryTimer: NodeJS.Timeout | null = null;

function createClient(role: string): Redis {
  return new Redis(REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    retryStrategy: () => null,
  }).on('error', (err) => {
    console.warn(`[Redis:${role}] ${err.message}`);
  });
}

async function connectAll(): Promise<boolean> {
  if (!REDIS_URL) return false;
  try {
    cacheClient = createClient('cache');
    pubClient = createClient('pub');
    subClient = createClient('sub');
    await Promise.all([cacheClient.connect(), pubClient.connect(), subClient.connect()]);
    await cacheClient.ping();
    redisReady = true;
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    console.log('✅ [Redis] Connected (cache/pub/sub).');
    return true;
  } catch (err: any) {
    console.warn(`⚠️ [Redis] Unavailable, fallback to memory: ${err?.message || err}`);
    await disconnectAll().catch(() => {});
    redisReady = false;
    scheduleRetry();
    return false;
  }
}

async function disconnectAll(): Promise<void> {
  const clients = [cacheClient, pubClient, subClient];
  cacheClient = pubClient = subClient = null;
  await Promise.allSettled(clients.map((c) => (c ? c.quit().catch(() => c.disconnect()) : null)));
}

function scheduleRetry(): void {
  if (retryTimer || !REDIS_URL) return;
  retryTimer = setInterval(() => {
    if (redisReady) {
      if (retryTimer) clearInterval(retryTimer);
      retryTimer = null;
      return;
    }
    console.log('[Redis] Retrying connection in background...');
    connectAll()
      .then((ok) => {
        if (ok) attachInvalidationSubscriber();
      })
      .catch(() => {});
  }, RETRY_INTERVAL_MS);
  if (typeof retryTimer.unref === 'function') retryTimer.unref();
}

type InvalidateHandler = (userId: string | '*') => void;
let invalidateHandler: InvalidateHandler | null = null;
let subscribed = false;

export const PERM_INVALIDATE_CHANNEL = 'perm:invalidate';

function attachInvalidationSubscriber(): void {
  if (!subClient || subscribed) return;
  subscribed = true;
  subClient.subscribe(PERM_INVALIDATE_CHANNEL).catch((err) => {
    subscribed = false;
    console.warn(`[Redis] Subscribe failed: ${err?.message || err}`);
  });
  subClient.on('message', (channel, message) => {
    if (channel === PERM_INVALIDATE_CHANNEL && invalidateHandler) {
      try {
        const parsed = JSON.parse(message) as { userId?: string | '*' };
        invalidateHandler(parsed.userId || '*');
      } catch {
        invalidateHandler('*');
      }
    }
  });
  subClient.on('close', () => {
    subscribed = false;
  });
}

export function onRedisReady(callback: () => void): void {
  if (redisReady && pubClient && subClient) {
    callback();
    return;
  }
  const timer = setInterval(() => {
    if (redisReady && pubClient && subClient) {
      clearInterval(timer);
      callback();
    }
  }, 1000);
  if (typeof timer.unref === 'function') timer.unref();
}

export async function initRedis(): Promise<boolean> {
  if (!REDIS_URL) {
    console.log('[Redis] REDIS_URL not set, running with in-memory fallback.');
    return false;
  }
  const ok = await connectAll();
  if (ok) attachInvalidationSubscriber();
  return ok;
}

export function isRedisReady(): boolean {
  return redisReady && !!cacheClient;
}

export function getRedisCache(): Redis | null {
  return redisReady ? cacheClient : null;
}

export function getRedisPubSub(): { pub: Redis; sub: Redis } | null {
  return redisReady && pubClient && subClient ? { pub: pubClient, sub: subClient } : null;
}

export function onPermissionInvalidated(handler: InvalidateHandler): void {
  invalidateHandler = handler;
  if (redisReady) attachInvalidationSubscriber();
}

export async function publishPermissionInvalidated(userId: string | '*'): Promise<void> {
  const pub = redisReady ? pubClient : null;
  if (!pub) return;
  try {
    await pub.publish(PERM_INVALIDATE_CHANNEL, JSON.stringify({ userId }));
  } catch (err: any) {
    console.warn(`[Redis] Publish invalidate failed: ${err?.message || err}`);
  }
}
