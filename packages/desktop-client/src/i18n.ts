import { initReactI18next } from 'react-i18next';

import i18n from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

import * as Platform from 'loot-core/shared/platform';

const languages = import.meta.glob(['/locale/*.json', '!/locale/*_old.json']);

export const availableLanguages = Object.keys(languages).map(
  path => path.split('/')[2].split('.')[0],
);

const isLanguageAvailable = (language: string) =>
  Object.hasOwn(languages, `/locale/${language}.json`);

const loadLanguage = (language: string) => {
  if (!isLanguageAvailable(language)) {
    throw new Error(`Unknown locale ${language}`);
  }
  return languages[`/locale/${language}.json`]();
};

i18n
  .use(initReactI18next)
  .use(resourcesToBackend(loadLanguage))
  .init({
    lng: 'pt-BR',

    // allow keys to be phrases having `:`, `.`
    nsSeparator: false,
    keySeparator: false,
    fallbackLng: ['pt-BR', 'en'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      transSupportBasicHtmlNodes: false,
    },
  });

export const setI18NextLanguage = (language: string) => {
  if (!language) {
    // System default
    setI18NextLanguage(
      Platform.isPlaywright ? 'cimode' : navigator.language || 'pt-BR',
    );
    return;
  }

  if (!isLanguageAvailable(language)) {
    if (language === 'en') {
      // English is always available since we use natural-language keys.
      return;
    }

    if (language.includes('-')) {
      const fallback = language.split('-')[0];
      console.info(`Unknown locale ${language}, falling back to ${fallback}`);
      setI18NextLanguage(fallback);
      return;
    }

    const lowercaseLanguage = language.toLowerCase();
    if (lowercaseLanguage !== language) {
      console.info(
        `Unknown locale ${language}, falling back to ${lowercaseLanguage}`,
      );
      setI18NextLanguage(lowercaseLanguage);
      return;
    }

    if (language !== 'pt-BR') {
      console.info(`Unknown locale ${language}, falling back to pt-BR`);
      setI18NextLanguage('pt-BR');
      return;
    }

    // Fall back to English if Portuguese is unavailable
    console.info(`Unknown locale ${language}, falling back to en`);
    setI18NextLanguage('en');
    return;
  }

  if (language === i18n.language) {
    return; // language is already set
  }

  i18n.changeLanguage(language || 'en');
};
