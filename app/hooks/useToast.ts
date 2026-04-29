import {useCallback, useEffect, useRef, useState} from 'react';

export type ToastKind = 'ok' | 'error';

export interface ToastState {
  message: string;
  kind: ToastKind;
  visible: boolean;
}

const HIDE_AFTER_MS = 2200;

export function useToast() {
  const [state, setState] = useState<ToastState>({message: '', kind: 'ok', visible: false});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = 'ok') => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setState({message, kind, visible: true});
    timerRef.current = setTimeout(() => {
      setState((prev) => ({...prev, visible: false}));
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return {toast: state, showToast: show};
}
