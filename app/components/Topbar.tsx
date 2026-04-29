import {useTranslation} from 'react-i18next';
import WeledaMark from '~/assets/weleda-mark.svg?react';
import WeledaWordmark from '~/assets/weleda-wordmark.svg?react';
import {ThemeToggle} from './ThemeToggle';

export function Topbar() {
  const {t} = useTranslation();
  return (
    <header className="topbar">
      <div className="brand">
        <WeledaMark className="brand-mark" aria-hidden="true" />
        <WeledaWordmark className="brand-word" role="img" aria-label={t('brand.weleda_alt')} />
        <span className="brand-divider" aria-hidden="true" />
        <span className="brand-tag">{t('brand.tagline')}</span>
      </div>
      <div className="topbar-end">
        <span className="topbar-meta">
          {t('topbar.hint')} <kbd>{t('topbar.hint_kbd')}</kbd>
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
