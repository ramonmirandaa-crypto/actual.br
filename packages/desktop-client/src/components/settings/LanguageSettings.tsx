import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Menu } from '@actual-app/components/menu';
import { Select, type SelectOption } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { type TFunction } from 'i18next';

import { Setting } from './UI';

import { Link } from '@desktop-client/components/common/Link';
import { useGlobalPref } from '@desktop-client/hooks/useGlobalPref';
import { availableLanguages, setI18NextLanguage } from '@desktop-client/i18n';

const languageDisplayNameOverride: { [key: string]: string } = {
  'pt-BR': 'Português (Brasil)',
};

const languageOptions = (t: TFunction): SelectOption[] =>
  [
    ['', t('System default')] as [string, string],
    Menu.line as typeof Menu.line,
  ].concat(
    [...availableLanguages]
      .sort((a, b) => {
        if (a === 'pt-BR') {
          return -1;
        }
        if (b === 'pt-BR') {
          return 1;
        }
        return a.localeCompare(b);
      })
      .map(lang => [
        lang,
        lang in languageDisplayNameOverride
          ? languageDisplayNameOverride[lang]
          : new Intl.DisplayNames([lang], {
              type: 'language',
            }).of(lang) || lang,
      ]),
  );

export function LanguageSettings() {
  const { t } = useTranslation();
  const [language, setLanguage] = useGlobalPref('language');
  const isEnabled = !!availableLanguages.length;

  return (
    <Setting
      primaryAction={
        <Select
          aria-label={t('Select language')}
          options={languageOptions(t)}
          value={isEnabled ? (language ?? '') : 'not-available'}
          defaultLabel={
            isEnabled ? t('Select language') : t('No languages available')
          }
          onChange={value => {
            setLanguage(value);
            setI18NextLanguage(value);
          }}
          disabled={!isEnabled}
        />
      }
    >
      <Text>
        {isEnabled ? (
          <Trans defaults="<0>Idioma</0> é o idioma de exibição de todos os textos. Observe que nenhuma garantia é fornecida quanto à precisão ou integralidade das traduções que não estejam em inglês. Se você encontrar um erro de tradução, sinta-se à vontade para fazer uma sugestão no <3>Weblate</3>.">
            <strong>Language</strong> is the display language of all text.
            Please note that no warranty is provided for the accuracy or
            completeness of non-English translations. If you encounter a
            translation error, feel free to make a suggestion on{' '}
            <Link
              variant="external"
              to={
                'https://hosted.weblate.org/projects/actualbudget/actual/' +
                (language ?? '')
              }
              linkColor="purple"
            >
              Weblate
            </Link>
            .
          </Trans>
        ) : (
          <Trans defaults="<0>Idioma</0> não está disponível. Siga as instruções <3>aqui</3> para adicionar arquivos de tradução que estejam faltando.">
            <strong>Language</strong> support is not available. Please follow
            the instructions{' '}
            <Link
              variant="external"
              to="https://actualbudget.org/docs/install/build-from-source#translations"
            >
              here
            </Link>{' '}
            to add missing translation files.
          </Trans>
        )}
      </Text>
    </Setting>
  );
}
