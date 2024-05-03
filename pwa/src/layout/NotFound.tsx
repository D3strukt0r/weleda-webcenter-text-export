import { useTranslation } from 'react-i18next';
import { useNavigate, useRouteError } from 'react-router-dom';

function NotFound() {
  const { t } = useTranslation('app');

  const navigate = useNavigate();
  const error = useRouteError();

  if (error !== undefined) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  return (
    <div className="h-full flex items-center justify-center flex-col text-center">
      <h1>404</h1>
      <p>{t('notFound.title')}</p>
      <button onClick={() => navigate(-1)}>{t('notFound.goBack')}</button>
    </div>
  );
}

export default NotFound;
