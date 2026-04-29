import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {initReactI18next} from 'react-i18next';
import de from './locales/de.yml';

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {de: {translation: de}},
      fallbackLng: 'de',
      supportedLngs: ['de'],
      interpolation: {escapeValue: false},
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'weleda-konverter:lang',
        caches: ['localStorage'],
      },
      returnObjects: true,
    });
}

export {i18n};
