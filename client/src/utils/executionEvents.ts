// Utility for real-time test execution comment synchronization across tabs and within the same tab

type ExecutionCommentEventPayload = {
  executionId?: string;
  timestamp: number;
};

const CHANNEL_NAME = 'execution_comment_sync_channel';
const LOCAL_EVENT_NAME = 'execution-comment-updated';

let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported or failed to initialize:', e);
}

/**
 * Emit an execution comment updated event to:
 * 1. Current tab via CustomEvent
 * 2. Other tabs via BroadcastChannel and localStorage storage fallback
 */
export function emitExecutionCommentUpdated(executionId?: string): void {
  const payload: ExecutionCommentEventPayload = {
    executionId,
    timestamp: Date.now(),
  };

  // 1. Same-tab event
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail: payload }));
    } catch (e) {
      console.error('Failed to dispatch local execution comment event:', e);
    }
  }

  // 2. Cross-tab BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch (e) {
      console.error('Failed to postMessage on BroadcastChannel:', e);
    }
  }

  // 3. Fallback for cross-tab sync via localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('execution_comment_last_update_ping', JSON.stringify(payload));
    } catch {
      // Ignore storage quota / access issues
    }
  }
}

/**
 * Subscribe to execution comment updated events (both within tab and across tabs).
 * Returns an unsubscribe cleanup function.
 */
export function onExecutionCommentUpdated(callback: (executionId?: string) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Handler for same-tab custom events
  const handleCustomEvent = (event: Event) => {
    const customEvt = event as CustomEvent<ExecutionCommentEventPayload>;
    callback(customEvt.detail?.executionId);
  };

  // Handler for BroadcastChannel messages
  const handleBroadcastMessage = (event: MessageEvent<ExecutionCommentEventPayload>) => {
    if (event.data) {
      callback(event.data.executionId);
    }
  };

  // Handler for localStorage storage events (fallback across tabs)
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'execution_comment_last_update_ping' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue) as ExecutionCommentEventPayload;
        callback(data.executionId);
      } catch {
        callback();
      }
    }
  };

  window.addEventListener(LOCAL_EVENT_NAME, handleCustomEvent);

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(LOCAL_EVENT_NAME, handleCustomEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
    window.removeEventListener('storage', handleStorageEvent);
  };
}
