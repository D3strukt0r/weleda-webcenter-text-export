import { useTranslation } from 'react-i18next';
import logo from '#/img/weleda-logo.svg';

export default function Header() {
  const { t } = useTranslation('app');
  return (
    <div className="bg-primary">
      <div className="container mx-auto p-4 flex flex-row">
        <img src={logo} alt="Weleda" className="inline-block" />
        <p className="text-white">{t('header.title')}</p>
      </div>
    </div>
  );
}
