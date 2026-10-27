import type { AppIdentityContract } from '@tinyhouse/contracts';

export type AppIdentity = (Partial<AppIdentityContract> & Record<string, unknown>) | null;

type Listener = (
  identity: AppIdentity,
) => void;

let currentIdentity:
  AppIdentity = null;

const listeners =
  new Set<Listener>();

const sessionListeners = new Set<() => void>();

export function getIdentityScope(identity: AppIdentity) {
  if (!identity) return null;

  return JSON.stringify([
    identity.id,
    identity.roleCode,
    identity.status,
    Array.isArray(identity.allowedScreens)
      ? [...identity.allowedScreens].sort()
      : [],
    identity.bookingScope,
    identity.bookingCanAssign,
    identity.bookingCanReassign,
    identity.bookingCanTransition,
    identity.bookingCanCancel,
    identity.bookingCanReschedule,
    identity.dealScope,
    identity.dealCanCreate,
    identity.dealCanCreateDirect,
    identity.dealCanManageContractDeposit,
    identity.dealCanManageRentalSchedule,
    identity.dealCanManageLifecycle,
  ]);
}

// QueryClient.clear also cancels active queries. A late response therefore
// cannot refill a query belonging to the previous account.
export function bindIdentityQueryCache(cache: { clear: () => void }) {
  const clear = () => cache.clear();
  sessionListeners.add(clear);
  return () => {
    sessionListeners.delete(clear);
  };
}

export const IdentityStore = {
  get() {
    return currentIdentity;
  },

  set(identity: AppIdentity) {
    if (getIdentityScope(currentIdentity) !== getIdentityScope(identity)) {
      for (const listener of sessionListeners) listener();
    }

    currentIdentity = identity;

    for (const listener of listeners) {
      listener(identity);
    }
  },

  subscribe(listener: Listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
};
