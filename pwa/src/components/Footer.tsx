import { Markup } from 'interweave';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation('app');
  return (
    <footer className="mt-auto">
      <p className="text-secondary text-center my-4">
        <Markup content={t('footer.copyright', { year: new Date().getFullYear() })} />
      </p>
    </footer>
  );
}
