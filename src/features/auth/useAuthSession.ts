import { useCallback, useEffect, useState } from 'react';
import { AuthService } from './authService';

export function useAuthSession() {
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentIdentity);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retrySession = useCallback(() => {
    setSessionReady(false);
    setSessionError(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = AuthService.subscribe((user) => {
      if (mounted) setCurrentUser(user);
    });
    AuthService.restoreSession()
      .then((user) => {
        if (mounted) setCurrentUser(user);
      })
      .catch(() => {
        if (mounted) setSessionError(true);
      })
      .finally(() => {
        if (mounted) setSessionReady(true);
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [attempt]);

  const userId = currentUser?.id;
  useEffect(() => {
    if (!sessionReady || sessionError || !userId) return;
    let pending = false;
    let lastCheck = 0;
    const sync = () => {
      if (document.visibilityState === 'hidden' || pending || Date.now() - lastCheck < 5_000) return;
      pending = true;
      lastCheck = Date.now();
      // A transient network failure must not hide the page or end the session.
      void AuthService.syncIdentity().catch(() => undefined).finally(() => { pending = false; });
    };
    sync();
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    const timer = window.setInterval(sync, 60_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [sessionReady, sessionError, userId]);

  return { currentUser, setCurrentUser, sessionReady, sessionError, retrySession };
}
