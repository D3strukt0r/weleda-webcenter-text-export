import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// import HttpApi, {HttpBackendOptions} from 'i18next-http-backend';
import resourcesToBackend from 'i18next-resources-to-backend';

export const currentLanguage = () => document.documentElement.lang || 'de';

export const init = async (lng: string) => {
  await i18n
    // .use(HttpApi)
    .use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          import(`../translations/${namespace}.${language}.json`),
      ),
    )
    .use(LanguageDetector)
    .use(initReactI18next)
    // .init<HttpBackendOptions>({
    .init({
      lng,
      fallbackLng: 'de',
      keySeparator: false,
      defaultNS: false,
      ns: [],
      // backend: {
      //   loadPath: '/translations/{{ns}}.{{lng}}.json',
      // },
      react: {
        useSuspense: false,
      },
      interpolation: {
        escapeValue: false,
      },
    });
};
