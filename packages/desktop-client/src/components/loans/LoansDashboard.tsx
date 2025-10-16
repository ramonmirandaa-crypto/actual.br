import React, { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Stack } from '@actual-app/components/stack';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Sparkline } from '../visualizations/Sparkline';

import { useFormat } from '@desktop-client/hooks/useFormat';

const LOAN_STATUS = [72, 68, 63, 57, 51, 46, 39, 33, 26, 18, 11, 5];

const PAYMENT_SCHEDULE = [
  { month: 'Jul', value: 2150 },
  { month: 'Ago', value: 2150 },
  { month: 'Set', value: 2150 },
  { month: 'Out', value: 2150 },
  { month: 'Nov', value: 2150 },
  { month: 'Dez', value: 2150 },
];

const LOAN_PORTFOLIO = [
  { label: 'Imobiliário', value: 280000, rate: 0.89 },
  { label: 'Veicular', value: 85000, rate: 1.32 },
  { label: 'Consignado', value: 54000, rate: 1.05 },
];

export function LoansDashboard() {
  const { t } = useTranslation();
  const format = useFormat();

  const [amount, setAmount] = useState(120000);
  const [rate, setRate] = useState(1.15);
  const [term, setTerm] = useState(48);

  const monthlyPayment = useMemo(() => {
    const interest = rate / 100;
    const monthlyRate = interest / 12;
    const periods = term;
    const factor = Math.pow(1 + monthlyRate, periods);
    const payment = (amount * monthlyRate * factor) / (factor - 1);
    return Number.isFinite(payment) ? Math.round(payment) : 0;
  }, [amount, rate, term]);

  const totalPaid = monthlyPayment * term;
  const totalInterest = totalPaid - amount;

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
            <Trans i18nKey="loans.headline">Empréstimos sob controle</Trans>
          </Text>
          <Text className="finance-dashboard__subtitle">
            <Trans i18nKey="loans.description">
              Simule novos créditos, visualize status de quitação e acompanhe seus pagamentos com alertas inteligentes.
            </Trans>
          </Text>
        </View>
        <Button variant="primary" onPress={() => undefined}>
          {t('loans.actions.newSimulation')}
        </Button>
      </Stack>

      <div className="finance-dashboard__grid">
        <View className="finance-card finance-card--highlight">
          <Text className="finance-card__label">
            {t('loans.cards.nextPayment')}
          </Text>
          <Text className="finance-card__value">
            {format(monthlyPayment, 'financial')}
          </Text>
          <Text className="finance-card__muted">
            {t('loans.cards.totalInterest', {
              value: format(totalInterest, 'financial'),
            })}
          </Text>
          <Sparkline
            data={LOAN_STATUS}
            ariaLabel={t('loans.aria.balanceEvolution')}
            backgroundColor="rgba(248, 113, 113, 0.12)"
            color="rgba(239, 68, 68, 0.85)"
          />
        </View>

        <View className="finance-card">
          <Text className="finance-card__label">
            {t('loans.cards.activeLoans')}
          </Text>
          <div className="finance-card__list">
            {LOAN_PORTFOLIO.map(item => (
              <div key={item.label} className="finance-card__list-item">
                <div>
                  <strong>{item.label}</strong>
                  <span>{t('loans.cards.interestRate', { value: `${item.rate.toFixed(2)}%` })}</span>
                </div>
                <Text>{format(item.value, 'financial')}</Text>
              </div>
            ))}
          </div>
        </View>

        <View className="finance-card">
          <Text className="finance-card__label">
            {t('loans.cards.simulator')}
          </Text>
          <div className="finance-card__form">
            <label>
              <span>{t('loans.simulator.amount')}</span>
              <input
                type="number"
                min={1000}
                step={1000}
                value={amount}
                onChange={event => setAmount(Number(event.target.value))}
              />
            </label>
            <label>
              <span>{t('loans.simulator.rate')}</span>
              <input
                type="number"
                step={0.01}
                value={rate}
                onChange={event => setRate(Number(event.target.value))}
              />
            </label>
            <label>
              <span>{t('loans.simulator.term')}</span>
              <input
                type="number"
                min={6}
                step={6}
                value={term}
                onChange={event => setTerm(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="finance-card__simulator-result">
            <div>
              <span>{t('loans.simulator.monthlyPayment')}</span>
              <strong>{format(monthlyPayment, 'financial')}</strong>
            </div>
            <div>
              <span>{t('loans.simulator.totalPaid')}</span>
              <strong>{format(totalPaid, 'financial')}</strong>
            </div>
          </div>
        </View>

        <View className="finance-card finance-card--wide">
          <Stack direction="row" justify="space-between" align="center">
            <Text className="finance-card__label">
              {t('loans.cards.upcomingPayments')}
            </Text>
            <Button variant="bare" onPress={() => undefined}>
              {t('loans.actions.viewSchedule')}
            </Button>
          </Stack>
          <div className="finance-card__bar-chart">
            {PAYMENT_SCHEDULE.map(item => (
              <div key={item.month} className="finance-card__bar">
                <div
                  className="finance-card__bar-fill finance-card__bar-fill--warning"
                  style={{ height: `${(item.value / 2500) * 100}%` }}
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
