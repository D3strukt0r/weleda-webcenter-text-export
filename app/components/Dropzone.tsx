import type {ChangeEvent, KeyboardEvent} from 'react';
import {useRef} from 'react';
import {useTranslation} from 'react-i18next';

interface Props {
  onFileChosen: (file: File) => void;
}

export function Dropzone({onFileChosen}: Props) {
  const {t} = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileChosen(file);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <>
      <label
        className="dropzone"
        htmlFor="file-input"
        tabIndex={0}
        role="button"
        aria-label={t('dropzone.aria_label')}
        onKeyDown={handleKey}
      >
        <div className="icon-wrap" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M5 18a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3" />
          </svg>
        </div>
        <p className="title-line">{t('dropzone.title')}</p>
        <p className="sub-line">
          {t('dropzone.subtitle_prefix')} <span className="pill">{t('dropzone.subtitle_pill')}</span>
        </p>
        <input
          ref={inputRef}
          className="dropzone-input"
          id="file-input"
          type="file"
          accept=".xml,application/xml,text/xml"
          onChange={handleChange}
        />
      </label>
      <p className="hint">
        {t('dropzone.paste_hint_prefix')}{' '}
        <kbd>{t('dropzone.paste_hint_cmd')}</kbd>{t('dropzone.paste_hint_or')}<kbd>{t('dropzone.paste_hint_ctrl')}</kbd>
        {' + '}
        <kbd>{t('dropzone.paste_hint_v')}</kbd>{' '}
        {t('dropzone.paste_hint_suffix')}
      </p>
    </>
  );
}
