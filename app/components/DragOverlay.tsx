import {useTranslation} from 'react-i18next';

interface Props {
  active: boolean;
}

export function DragOverlay({active}: Props) {
  const {t} = useTranslation();
  return (
    <div className={`drag-overlay${active ? ' is-active' : ''}`} aria-hidden="true">
      <div className="drag-overlay-panel">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 18a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3" />
        </svg>
        <span>{t('drag_overlay.message')}</span>
      </div>
    </div>
  );
}
