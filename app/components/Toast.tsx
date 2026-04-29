import type {ToastState} from '~/hooks/useToast';

interface Props {
  toast: ToastState;
}

export function Toast({toast}: Props) {
  const cls = ['toast'];
  if (toast.visible) {
    cls.push('is-visible');
  }
  if (toast.kind === 'error') {
    cls.push('is-error');
  }
  return (
    <div className={cls.join(' ')} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}
