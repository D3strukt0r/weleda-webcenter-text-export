import {useTranslation} from 'react-i18next';

export function Lede() {
  const {t} = useTranslation();
  return (
    <section className="lede">
      <div>
        <h1 className="lede-title">
          {t('lede.title_prefix')} <em>{t('lede.title_emphasis')}</em>&nbsp;{t('lede.title_suffix')}
        </h1>
        <p className="lede-subtitle">{t('lede.subtitle')}</p>
      </div>
    </section>
  );
}
