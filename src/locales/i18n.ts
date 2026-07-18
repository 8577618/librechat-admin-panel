import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEn from './en/translation.json';
import translationZhCN from './zh-CN/translation.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: translationEn },
  'zh-CN': { translation: translationZhCN },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'zh-CN',
    fallbackLng: {
      'zh-CN': ['en'],
      default: ['zh-CN', 'en'],
    },
    fallbackNS: 'translation',
    ns: ['translation'],
    debug: false,
    defaultNS,
    resources,
    interpolation: { escapeValue: false },
  });

export default i18n;
