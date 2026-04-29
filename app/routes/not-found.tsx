import {useTranslation} from 'react-i18next';

export default function NotFound() {
  const {t} = useTranslation();
  return (
    <main className="fallback-page">
      <h1>{t('not_found.title')}</h1>
      <p>{t('not_found.message')}</p>
    </main>
  );
}
