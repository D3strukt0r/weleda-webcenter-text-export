import {useTranslation} from 'react-i18next';

export function AppFooter() {
  const {t} = useTranslation();
  return (
    <footer className="app-footer">
      <span className="footer-brand">{t('footer.brand')}</span> {t('footer.separator')} {t('footer.text')}
    </footer>
  );
}
