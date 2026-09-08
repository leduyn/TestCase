// Utility for real-time proposal event synchronization across tabs and within the same tab

type ProposalEventPayload = {
  proposalId?: string;
  timestamp: number;
};

const CHANNEL_NAME = 'proposal_sync_channel';
const LOCAL_EVENT_NAME = 'proposal-updated';

let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported or failed to initialize:', e);
}

/**
 * Emit a proposal updated event to:
 * 1. Current tab via CustomEvent
 * 2. Other tabs via BroadcastChannel and localStorage storage fallback
 */
export function emitProposalUpdated(proposalId?: string): void {
  const payload: ProposalEventPayload = {
    proposalId,
    timestamp: Date.now()
  };

  // 1. Same-tab event
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail: payload }));
    } catch (e) {
      console.error('Failed to dispatch local proposal event:', e);
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

  // 3. Fallback for older environments / robust cross-tab sync via localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('proposal_last_update_ping', JSON.stringify(payload));
    } catch {
      // Ignore storage quota / access issues
    }
  }
}

/**
 * Subscribe to proposal updated events (both within tab and across tabs).
 * Returns an unsubscribe cleanup function.
 */
export function onProposalUpdated(callback: (proposalId?: string) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Handler for same-tab custom events
  const handleCustomEvent = (event: Event) => {
    const customEvt = event as CustomEvent<ProposalEventPayload>;
    callback(customEvt.detail?.proposalId);
  };

  // Handler for BroadcastChannel messages
  const handleBroadcastMessage = (event: MessageEvent<ProposalEventPayload>) => {
    if (event.data) {
      callback(event.data.proposalId);
    }
  };

  // Handler for localStorage storage events (fallback across tabs)
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'proposal_last_update_ping' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue) as ProposalEventPayload;
        callback(data.proposalId);
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
