import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Stack } from '@actual-app/components/stack';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Sparkline } from '../visualizations/Sparkline';

import { useFormat } from '@desktop-client/hooks/useFormat';

const INVESTMENT_GROWTH = [36, 42, 45, 48, 56, 62, 74, 81, 97, 112, 138, 150];
const YIELD_HISTORY = [0.6, 0.8, 1.1, 1.2, 0.9, 1.3, 1.5, 1.4, 1.1, 1.6, 1.8, 2];

const PORTFOLIO_DISTRIBUTION = [
  { label: 'Renda fixa', percent: 42, color: 'rgba(59,130,246,0.75)' },
  { label: 'Fundos imobiliários', percent: 28, color: 'rgba(139,92,246,0.75)' },
  { label: 'Ações', percent: 21, color: 'rgba(16,185,129,0.75)' },
  { label: 'Internacional', percent: 9, color: 'rgba(251,191,36,0.75)' },
];

const CONTRIBUTION_HISTORY = [
  { month: 'Jan', value: 2000 },
  { month: 'Fev', value: 2000 },
  { month: 'Mar', value: 2500 },
  { month: 'Abr', value: 2500 },
  { month: 'Mai', value: 3000 },
  { month: 'Jun', value: 3500 },
];

export function InvestmentsDashboard() {
  const { t } = useTranslation();
  const format = useFormat();

  const totalInvested = useMemo(
    () => INVESTMENT_GROWTH[INVESTMENT_GROWTH.length - 1] * 1000,
    [],
  );

  const monthlyYield = YIELD_HISTORY[YIELD_HISTORY.length - 1];
  const bestMonth = Math.max(...YIELD_HISTORY);

  return (
    <View className="finance-dashboard">
      <Stack
        direction="row"
        justify="space-between"
        align="start"
        className="finance-dashboard__header"
      >
        <View className="finance-dashboard__headline">
          <Text className="finance-dashboard__title">
            <Trans i18nKey="investments.headline">Investimentos em alta performance</Trans>
          </Text>
          <Text className="finance-dashboard__subtitle">
            <Trans i18nKey="investments.description">
              Acompanhe seus rendimentos, aportes e evolução patrimonial com gráficos claros e atualizações automáticas.
            </Trans>
          </Text>
        </View>
        <Stack direction="row" spacing={3} align="center">
          <Button onPress={() => undefined}>
            {t('investments.actions.viewPortfolio')}
          </Button>
          <Button variant="primary" onPress={() => undefined}>
            {t('investments.actions.newContribution')}
          </Button>
        </Stack>
      </Stack>

      <div className="finance-dashboard__grid">
        <View className="finance-card finance-card--highlight">
          <Text className="finance-card__label">
            {t('investments.cards.totalInvested')}
          </Text>
          <Text className="finance-card__value">
            {format(totalInvested, 'financial')}
          </Text>
          <Text className="finance-card__trend finance-card__trend--positive">
            {t('investments.cards.returnToDate', { value: '12,4%' })}
          </Text>
          <Sparkline data={INVESTMENT_GROWTH} ariaLabel={t('investments.aria.growth')} />
        </View>

        <View className="finance-card">
          <Text className="finance-card__label">
            {t('investments.cards.monthlyYield')}
          </Text>
          <Text className="finance-card__value">{monthlyYield.toFixed(2)}%</Text>
          <Text className="finance-card__muted">
            {t('investments.cards.bestMonth', { value: `${bestMonth.toFixed(2)}%` })}
          </Text>
          <Sparkline
            data={YIELD_HISTORY}
            ariaLabel={t('investments.aria.yield')}
            backgroundColor="rgba(56, 189, 248, 0.12)"
            color="rgba(14, 165, 233, 0.85)"
          />
        </View>

        <View className="finance-card">
          <Text className="finance-card__label">
            {t('investments.cards.diversification')}
          </Text>
          <div className="finance-card__distribution">
            {PORTFOLIO_DISTRIBUTION.map(item => (
              <div key={item.label} className="finance-card__distribution-item">
                <div
                  className="finance-card__distribution-bar"
                  style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                />
                <span>{item.label}</span>
                <strong>{item.percent}%</strong>
              </div>
            ))}
          </div>
        </View>

        <View className="finance-card finance-card--wide">
          <Stack direction="row" justify="space-between" align="center">
            <Text className="finance-card__label">
              {t('investments.cards.contributions')}
            </Text>
            <Button variant="bare" onPress={() => undefined}>
              {t('investments.actions.viewHistory')}
            </Button>
          </Stack>
          <div className="finance-card__bar-chart">
            {CONTRIBUTION_HISTORY.map(item => (
              <div key={item.month} className="finance-card__bar">
                <div
                  className="finance-card__bar-fill"
                  style={{ height: `${(item.value / 3500) * 100}%` }}
                />
                <span>{item.month}</span>
              </div>
            ))}
          </div>
        </View>
      </div>
    </View>
  );
}
