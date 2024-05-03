import ReactDOM from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App';
import './index.css';
import { init as initI18n, currentLanguage } from './utils/i18n';

(async () => {
  await initI18n(currentLanguage());

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Failed to find the root element');
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
})();
