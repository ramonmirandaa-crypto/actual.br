/* eslint-disable actual/prefer-trans-over-t */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Card } from '@actual-app/components/card';
import { Input } from '@actual-app/components/input';
import { Select, type SelectOption } from '@actual-app/components/select';
import { Stack } from '@actual-app/components/stack';
import { Text } from '@actual-app/components/text';
import { Toggle } from '@actual-app/components/toggle';
import { View } from '@actual-app/components/view';
import { format, isValid, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

import {
  amountToInteger,
  currencyToAmount,
  integerToCurrency,
} from 'loot-core/shared/util';
import { type TransactionEntity } from 'loot-core/types/models';

import { useAccounts } from '@desktop-client/hooks/useAccounts';
import { useCreditCards } from '@desktop-client/hooks/useCreditCards';
import { useLocalPref } from '@desktop-client/hooks/useLocalPref';
import { useTransactions } from '@desktop-client/hooks/useTransactions';
import * as queries from '@desktop-client/queries';

const CARD_ACCENTS = [
  'linear-gradient(135deg, #312e81, #a855f7)',
  'linear-gradient(135deg, #0f172a, #38bdf8)',
  'linear-gradient(135deg, #052e16, #22c55e)',
  'linear-gradient(135deg, #3f0a22, #fb7185)',
  'linear-gradient(135deg, #1e293b, #f97316)',
];

const DEFAULT_CARD_COLOR = CARD_ACCENTS[0];

const MONEY_DISPLAY_LIMIT = 12;

const PERCENT_FORMATTER = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});

type EnrichedTransaction = TransactionEntity & {
  category?: { id: string; name: string } | null;
  payee?: { id: string; name: string } | null;
  subtransactions?: EnrichedTransaction[];
  notes?: string | null;
};

type StatementCategory = {
  name: string;
  amount: number;
  count: number;
};

type StatementSummary = {
  id: string;
  label: string;
  charges: number;
  payments: number;
  net: number;
  categories: StatementCategory[];
  transactions: EnrichedTransaction[];
};

type FiltersState = {
  categoryId: string;
  transactionType: 'all' | 'charges' | 'payments';
  minAmount: string;
  maxAmount: string;
  search: string;
  onlyUncategorized: boolean;
};

type CardFormState = {
  id?: string;
  name: string;
  accountId: string | null;
  color: string;
  issuer: string;
  lastFour: string;
  limit: string;
  notes: string;
};

type TransactionsHookResult = ReturnType<typeof useTransactions>;

function buildStatements(
  transactions: readonly EnrichedTransaction[],
): StatementSummary[] {
  const buckets = new Map<
    string,
    {
      id: string;
      label: string;
      charges: number;
      payments: number;
      net: number;
      categories: Map<string, StatementCategory>;
      transactions: EnrichedTransaction[];
    }
  >();

  for (const transaction of transactions) {
    if (!transaction.date) {
      continue;
    }

    const parsedDate = parseISO(transaction.date);
    if (!isValid(parsedDate)) {
      continue;
    }

    const monthId = format(parsedDate, 'yyyy-MM');
    let bucket = buckets.get(monthId);

    if (!bucket) {
      bucket = {
        id: monthId,
        label: format(parsedDate, 'MMMM yyyy'),
        charges: 0,
        payments: 0,
        net: 0,
        categories: new Map<string, StatementCategory>(),
        transactions: [],
      };

      buckets.set(monthId, bucket);
    }

    const amount = transaction.amount ?? 0;
    bucket.transactions.push(transaction);

    if (amount < 0) {
      const charge = Math.abs(amount);
      bucket.charges += charge;
      bucket.net += charge;

      const categoryName =
        transaction.category && 'name' in transaction.category
          ? (transaction.category?.name ?? 'Uncategorized')
          : 'Uncategorized';

      const category =
        bucket.categories.get(categoryName) ??
        ({ name: categoryName, amount: 0, count: 0 } as StatementCategory);

      category.amount += charge;
      category.count += 1;
      bucket.categories.set(categoryName, category);
    } else if (amount > 0) {
      bucket.payments += amount;
      bucket.net -= amount;
    }
  }

  return Array.from(buckets.values())
    .map(bucket => ({
      id: bucket.id,
      label: bucket.label,
      charges: bucket.charges,
      payments: bucket.payments,
      net: Math.max(bucket.net, 0),
      categories: Array.from(bucket.categories.values()).sort(
        (left, right) => right.amount - left.amount,
      ),
      transactions: bucket.transactions.sort((left, right) =>
        right.date.localeCompare(left.date),
      ),
    }))
    .sort((left, right) => right.id.localeCompare(left.id));
}

function flattenTransactions(
  transactions: readonly TransactionEntity[],
): EnrichedTransaction[] {
  const flattened: EnrichedTransaction[] = [];

  for (const transaction of transactions as EnrichedTransaction[]) {
    if (transaction.tombstone) {
      continue;
    }

    if (transaction.subtransactions && transaction.subtransactions.length > 0) {
      for (const sub of transaction.subtransactions as EnrichedTransaction[]) {
        if (sub.tombstone) {
          continue;
        }

        flattened.push({ ...sub, parent_id: transaction.id });
      }
      continue;
    }

    flattened.push(transaction);
  }

  return flattened;
}

function currencyInputToInteger(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const amount = currencyToAmount(value);
  if (amount == null) {
    return null;
  }

  return amountToInteger(amount);
}

function toSafeString(value?: string | null): string {
  return value?.trim() ?? '';
}

function buildCardFormState(card?: CardFormState): CardFormState {
  return (
    card ?? {
      name: '',
      accountId: null,
      color: DEFAULT_CARD_COLOR,
      issuer: '',
      lastFour: '',
      limit: '',
      notes: '',
    }
  );
}

function toCardFormState(
  card: ReturnType<typeof useCreditCards>['cards'][number],
): CardFormState {
  return {
    id: card.id,
    name: card.name,
    accountId: card.accountId ?? null,
    color: card.color ?? DEFAULT_CARD_COLOR,
    issuer: toSafeString(card.issuer),
    lastFour: toSafeString(card.lastFour),
    limit: card.limit != null ? integerToCurrency(card.limit) : '',
    notes: toSafeString(card.notes),
  };
}

function getCardAccent(index: number): string {
  return CARD_ACCENTS[index % CARD_ACCENTS.length] ?? DEFAULT_CARD_COLOR;
}

type CreditCardDashboardProps = {
  transactionsResult?: TransactionsHookResult;
};

export function CreditCardDashboard({
  transactionsResult,
}: CreditCardDashboardProps) {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const { cards, addCard, updateCard, removeCard } = useCreditCards();

  const [storedActiveCardId, setStoredActiveCardId, clearStoredActiveCardId] =
    useLocalPref('ui.creditCards.activeCardId');

  const [activeCardId, setActiveCardIdState] = useState<string | null>(
    () => storedActiveCardId ?? null,
  );
  const [formState, setFormState] = useState<CardFormState | null>(null);
  const [activeStatementId, setActiveStatementId] = useState<string | 'all'>(
    'all',
  );
  const [filters, setFilters] = useState<FiltersState>({
    categoryId: 'all',
    transactionType: 'all',
    minAmount: '',
    maxAmount: '',
    search: '',
    onlyUncategorized: false,
  });

  const selectCard = useCallback(
    (cardId: string) => {
      setActiveCardIdState(cardId);
      setStoredActiveCardId(cardId);
    },
    [setStoredActiveCardId],
  );

  useEffect(() => {
    if (cards.length === 0) {
      if (activeCardId !== null) {
        setActiveCardIdState(null);
      }
      if (storedActiveCardId != null) {
        clearStoredActiveCardId();
      }
      return;
    }

    if (
      storedActiveCardId &&
      cards.some(card => card.id === storedActiveCardId) &&
      activeCardId !== storedActiveCardId
    ) {
      setActiveCardIdState(storedActiveCardId);
      return;
    }

    if (!activeCardId || !cards.some(card => card.id === activeCardId)) {
      selectCard(cards[0].id);
    }
  }, [
    cards,
    activeCardId,
    storedActiveCardId,
    selectCard,
    clearStoredActiveCardId,
  ]);

  const activeCard = useMemo(
    () => cards.find(card => card.id === activeCardId) ?? null,
    [cards, activeCardId],
  );

  const transactionsQuery = useMemo(() => {
    if (!activeCard?.accountId) {
      return null;
    }

    return queries
      .transactions(activeCard.accountId)
      .options({ splits: 'all' })
      .orderBy({ date: 'desc' })
      .select('*');
  }, [activeCard?.accountId]);

  const fallbackTransactions = useTransactions({
    query: transactionsQuery ?? undefined,
    options: { pageCount: 200 },
  });

  const {
    transactions = [],
    isLoading,
    reload,
    loadMore,
    isLoadingMore,
  } = transactionsResult ?? fallbackTransactions;

  const flattenedTransactions = useMemo(
    () => flattenTransactions(transactions),
    [transactions],
  );

  const filteredTransactions = useMemo(() => {
    if (!flattenedTransactions.length) {
      return [] as EnrichedTransaction[];
    }

    const searchTerm = filters.search.trim().toLowerCase();
    const minAmount = currencyInputToInteger(filters.minAmount);
    const maxAmount = currencyInputToInteger(filters.maxAmount);

    return flattenedTransactions.filter(transaction => {
      const amount = Math.abs(transaction.amount ?? 0);
      const categoryId =
        transaction.category && typeof transaction.category === 'object'
          ? transaction.category.id
          : undefined;

      if (filters.onlyUncategorized) {
        if (categoryId) {
          return false;
        }
      }

      if (filters.categoryId === 'uncategorized') {
        if (categoryId) {
          return false;
        }
      } else if (
        filters.categoryId !== 'all' &&
        categoryId !== filters.categoryId
      ) {
        return false;
      }

      if (
        filters.transactionType === 'charges' &&
        (transaction.amount ?? 0) >= 0
      ) {
        return false;
      }

      if (
        filters.transactionType === 'payments' &&
        (transaction.amount ?? 0) <= 0
      ) {
        return false;
      }

      if (minAmount != null && amount < minAmount) {
        return false;
      }

      if (maxAmount != null && amount > maxAmount) {
        return false;
      }

      if (searchTerm) {
        const haystack = [
          transaction.notes,
          transaction.imported_payee,
          transaction.payee && typeof transaction.payee === 'object'
            ? transaction.payee.name
            : '',
          transaction.category && typeof transaction.category === 'object'
            ? transaction.category.name
            : '',
        ]
          .filter(Boolean)
          .map(value => value.toLowerCase());

        if (!haystack.some(value => value.includes(searchTerm))) {
          return false;
        }
      }

      return true;
    });
  }, [flattenedTransactions, filters]);

  const statements = useMemo(
    () => buildStatements(filteredTransactions),
    [filteredTransactions],
  );

  useEffect(() => {
    if (statements.length === 0) {
      setActiveStatementId('all');
      return;
    }

    if (
      activeStatementId !== 'all' &&
      !statements.some(statement => statement.id === activeStatementId)
    ) {
      setActiveStatementId(statements[0].id);
    }
  }, [statements, activeStatementId]);

  const activeStatement = useMemo(() => {
    if (activeStatementId === 'all') {
      return statements[0] ?? null;
    }

    return (
      statements.find(statement => statement.id === activeStatementId) ?? null
    );
  }, [statements, activeStatementId]);

  const monthOptions: SelectOption<string>[] = useMemo(() => {
    const options: SelectOption<string>[] = [
      ['all', t('Most recent statement')],
    ];

    for (const statement of statements) {
      options.push([statement.id, statement.label]);
    }

    return options;
  }, [statements, t]);

  const categoryOptions: SelectOption<string>[] = useMemo(() => {
    const options: SelectOption<string>[] = [
      ['all', t('All categories')],
      ['uncategorized', t('Uncategorized')],
    ];
    const seen = new Set<string>();

    for (const transaction of filteredTransactions) {
      if (transaction.category && typeof transaction.category === 'object') {
        if (!seen.has(transaction.category.id)) {
          options.push([transaction.category.id, transaction.category.name]);
          seen.add(transaction.category.id);
        }
      }
    }

    return options;
  }, [filteredTransactions, t]);

  const chartData = useMemo(() => {
    const recentStatements = statements.slice(0, MONEY_DISPLAY_LIMIT).reverse();

    return recentStatements.map(statement => ({
      month: statement.label,
      charges: statement.charges,
      payments: statement.payments,
      net: statement.net,
    }));
  }, [statements]);

  const lifetimeCharges = useMemo(
    () => statements.reduce((sum, statement) => sum + statement.charges, 0),
    [statements],
  );

  const averageCharges = useMemo(() => {
    if (statements.length === 0) {
      return 0;
    }

    return Math.round(lifetimeCharges / statements.length);
  }, [lifetimeCharges, statements.length]);

  const previousStatement = statements[1] ?? null;
  const latestStatement = statements[0] ?? null;
  const statementDelta = previousStatement
    ? (latestStatement?.charges ?? 0) - previousStatement.charges
    : null;

  const utilization = useMemo(() => {
    if (!activeCard?.limit || !latestStatement) {
      return null;
    }

    return latestStatement.charges / activeCard.limit;
  }, [activeCard?.limit, latestStatement]);

  const linkedAccountName = useMemo(() => {
    if (!activeCard?.accountId) {
      return null;
    }

    const account = accounts.find(acc => acc.id === activeCard.accountId);
    return account?.name ?? null;
  }, [accounts, activeCard?.accountId]);

  const onStartAdd = () => {
    setFormState(buildCardFormState());
  };

  const onCancelAdd = () => {
    setFormState(null);
  };

  const onEditCard = (cardId: string) => {
    const card = cards.find(item => item.id === cardId);
    if (!card) {
      return;
    }

    setFormState(toCardFormState(card));
  };

  const onDeleteCard = (cardId: string) => {
    const card = cards.find(item => item.id === cardId);
    if (!card) {
      return;
    }

    if (
      window.confirm(
        t('Remove {{cardName}}? This action only affects this device.', {
          cardName: card.name,
        }),
      )
    ) {
      removeCard(cardId);
    }
  };

  const onChangeFormField = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormState(prev =>
      prev
        ? {
            ...prev,
            [name]: value,
          }
        : prev,
    );
  };

  const onChangeSelectField = (field: keyof CardFormState, value: string) => {
    setFormState(prev =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : prev,
    );
  };

  const onSubmitForm = () => {
    if (!formState) {
      return;
    }

    if (!formState.name.trim()) {
      return;
    }

    const payload = {
      name: formState.name.trim(),
      accountId:
        formState.accountId && formState.accountId !== 'none'
          ? formState.accountId
          : null,
      color: formState.color,
      issuer: formState.issuer.trim() || null,
      lastFour: formState.lastFour.trim() || null,
      limit: currencyInputToInteger(formState.limit),
      notes: formState.notes.trim() || null,
    };

    if (formState.id) {
      updateCard(formState.id, payload);
      selectCard(formState.id);
    } else {
      const createdCard = addCard(payload);
      selectCard(createdCard.id);
    }

    setFormState(null);
  };

  const accountOptions: SelectOption<string>[] = useMemo(() => {
    const options: SelectOption<string>[] = [['none', t('No linked account')]];

    accounts
      .filter(account => account.closed !== 1)
      .forEach(account => {
        options.push([account.id, account.name]);
      });

    return options;
  }, [accounts, t]);

  const onChangeFilters = <K extends keyof FiltersState>(
    key: K,
    value: FiltersState[K],
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <View className="credit-dashboard">
      <Stack direction="column" gap={24} style={{ width: '100%' }}>
        <View className="credit-dashboard__header">
          <View className="credit-dashboard__title">
            <Text style={{ fontSize: 32, fontWeight: 700 }}>
              {t('Credit cards')}
            </Text>
            <Text style={{ color: 'var(--modern-muted)' }}>
              {t(
                'Monitor monthly statements, understand category trends and stay on top of every payment.',
              )}
            </Text>
          </View>
          <Button onPress={onStartAdd} variant="primary">
            {t('Add card')}
          </Button>
        </View>

        <View className="credit-dashboard__cards">
          {cards.map((card, index) => {
            const isActive = card.id === activeCardId;
            const accent = card.color ?? getCardAccent(index);

            return (
              <Card
                key={card.id}
                className={
                  'credit-dashboard__card' +
                  (isActive ? ' credit-dashboard__card--active' : '')
                }
                style={{
                  backgroundImage: accent,
                }}
              >
                <Stack direction="column" gap={12}>
                  <Stack direction="row" justify="space-between" align="center">
                    <Text style={{ fontSize: 18, fontWeight: 600 }}>
                      {card.name}
                    </Text>
                    <Stack direction="row" gap={8}>
                      <Button
                        variant="bare"
                        onPress={() => selectCard(card.id)}
                        style={{
                          color: isActive
                            ? 'var(--modern-on-accent)'
                            : 'var(--modern-on-accent-muted)',
                        }}
                      >
                        {isActive ? t('Selected') : t('Review')}
                      </Button>
                      <Button
                        variant="bare"
                        onPress={() => onEditCard(card.id)}
                        style={{ color: 'var(--modern-on-accent-muted)' }}
                      >
                        {t('Edit')}
                      </Button>
                      <Button
                        variant="bare"
                        onPress={() => onDeleteCard(card.id)}
                        style={{ color: 'var(--modern-on-accent-muted)' }}
                      >
                        {t('Remove')}
                      </Button>
                    </Stack>
                  </Stack>
                  <Stack
                    direction="row"
                    justify="space-between"
                    align="flex-end"
                  >
                    <Text style={{ fontSize: 14, letterSpacing: 2 }}>
                      {card.issuer ?? t('Issuer not set')}
                    </Text>
                    {card.lastFour ? (
                      <Text style={{ fontSize: 24, fontFamily: 'monospace' }}>
                        •••• {card.lastFour}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 14 }}>
                        {t('Last digits unavailable')}
                      </Text>
                    )}
                  </Stack>
                  {card.limit != null && (
                    <Text style={{ fontSize: 14 }}>
                      {t('Limit: {{amount}}', {
                        amount: integerToCurrency(card.limit),
                      })}
                    </Text>
                  )}
                  {card.notes && (
                    <Text style={{ fontSize: 13 }}>{card.notes}</Text>
                  )}
                </Stack>
              </Card>
            );
          })}

          {cards.length === 0 && (
            <Card className="credit-dashboard__card credit-dashboard__card--empty">
              <Stack direction="column" gap={12} align="center">
                <Text style={{ fontSize: 20, fontWeight: 600 }}>
                  {t('No cards yet')}
                </Text>
                <Text
                  style={{ color: 'var(--modern-muted)', textAlign: 'center' }}
                >
                  {t(
                    'Start by adding your first credit card. All information stays safely stored on this device.',
                  )}
                </Text>
                <Button onPress={onStartAdd}>{t('Create card')}</Button>
              </Stack>
            </Card>
          )}
        </View>

        {formState && (
          <Card className="credit-dashboard__form">
            <Stack direction="column" gap={16}>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>
                {formState.id ? t('Edit card') : t('New card')}
              </Text>
              <View className="credit-dashboard__form-grid">
                <View>
                  <Text>{t('Name')}</Text>
                  <Input
                    name="name"
                    value={formState.name}
                    onChange={onChangeFormField}
                    placeholder={t('Primary card name') ?? undefined}
                  />
                </View>
                <View>
                  <Text>{t('Linked account')}</Text>
                  <Select
                    value={formState.accountId ?? 'none'}
                    onChange={value =>
                      onChangeSelectField('accountId', value as string)
                    }
                    options={accountOptions}
                  />
                </View>
                <View>
                  <Text>{t('Issuer')}</Text>
                  <Input
                    name="issuer"
                    value={formState.issuer}
                    onChange={onChangeFormField}
                    placeholder={t('Bank or provider') ?? undefined}
                  />
                </View>
                <View>
                  <Text>{t('Last four digits')}</Text>
                  <Input
                    name="lastFour"
                    value={formState.lastFour}
                    onChange={onChangeFormField}
                    placeholder="1234"
                    maxLength={4}
                  />
                </View>
                <View>
                  <Text>{t('Credit limit')}</Text>
                  <Input
                    name="limit"
                    value={formState.limit}
                    onChange={onChangeFormField}
                    placeholder="0.00"
                  />
                </View>
                <View>
                  <Text>{t('Accent')}</Text>
                  <View className="credit-dashboard__color-picker">
                    {CARD_ACCENTS.map(accent => (
                      <button
                        key={accent}
                        type="button"
                        className={
                          'credit-dashboard__color' +
                          (formState.color === accent
                            ? ' credit-dashboard__color--selected'
                            : '')
                        }
                        style={{ backgroundImage: accent }}
                        onClick={() => onChangeSelectField('color', accent)}
                        aria-label={t('Use this accent') ?? undefined}
                      />
                    ))}
                  </View>
                </View>
                <View className="credit-dashboard__notes">
                  <Text>{t('Notes')}</Text>
                  <Input
                    name="notes"
                    value={formState.notes}
                    onChange={onChangeFormField}
                    placeholder={
                      t('Internal notes, reminders or policies') ?? undefined
                    }
                  />
                </View>
              </View>
              <Stack direction="row" gap={12} justify="flex-end">
                <Button
                  variant="bare"
                  onPress={
                    formState.id ? () => setFormState(null) : onCancelAdd
                  }
                >
                  {t('Cancel')}
                </Button>
                <Button onPress={onSubmitForm} variant="primary">
                  {t('Save card')}
                </Button>
              </Stack>
            </Stack>
          </Card>
        )}

        {activeCard && (
          <Card className="credit-dashboard__summary">
            <Stack direction="row" gap={32} wrap="wrap">
              <View className="credit-dashboard__summary-item">
                <Text style={{ color: 'var(--modern-muted)', fontSize: 14 }}>
                  {t('Current statement')}
                </Text>
                <Text style={{ fontSize: 28, fontWeight: 700 }}>
                  {latestStatement
                    ? integerToCurrency(latestStatement.charges)
                    : integerToCurrency(0)}
                </Text>
                {statementDelta != null && (
                  <Text
                    style={{
                      fontSize: 13,
                      color:
                        statementDelta > 0
                          ? 'var(--modern-negative)'
                          : 'var(--modern-positive)',
                    }}
                  >
                    {statementDelta > 0
                      ? t('Up {{value}} vs last month', {
                          value: integerToCurrency(Math.abs(statementDelta)),
                        })
                      : t('Down {{value}} vs last month', {
                          value: integerToCurrency(Math.abs(statementDelta)),
                        })}
                  </Text>
                )}
              </View>
              <View className="credit-dashboard__summary-item">
                <Text style={{ color: 'var(--modern-muted)', fontSize: 14 }}>
                  {t('Average monthly spend')}
                </Text>
                <Text style={{ fontSize: 28, fontWeight: 700 }}>
                  {integerToCurrency(averageCharges)}
                </Text>
              </View>
              <View className="credit-dashboard__summary-item">
                <Text style={{ color: 'var(--modern-muted)', fontSize: 14 }}>
                  {t('Linked account')}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: 600 }}>
                  {linkedAccountName ?? t('No linked account')}
                </Text>
              </View>
              <View className="credit-dashboard__summary-item">
                <Text style={{ color: 'var(--modern-muted)', fontSize: 14 }}>
                  {t('Utilization')}
                </Text>
                <Text style={{ fontSize: 28, fontWeight: 700 }}>
                  {utilization != null
                    ? PERCENT_FORMATTER.format(Math.min(utilization, 1))
                    : t('Set a limit to track')}
                </Text>
              </View>
            </Stack>
          </Card>
        )}

        <Card className="credit-dashboard__filters">
          <Stack direction="row" gap={16} wrap="wrap" align="center">
            <View>
              <Text>{t('Statement')}</Text>
              <Select
                value={activeStatementId}
                options={monthOptions}
                onChange={value =>
                  setActiveStatementId(value as string | 'all')
                }
              />
            </View>
            <View>
              <Text>{t('Category')}</Text>
              <Select
                value={filters.categoryId}
                options={categoryOptions}
                onChange={value =>
                  onChangeFilters('categoryId', value as string)
                }
              />
            </View>
            <View>
              <Text>{t('Type')}</Text>
              <Select
                value={filters.transactionType}
                options={[
                  ['all', t('All movements')],
                  ['charges', t('Charges only')],
                  ['payments', t('Payments only')],
                ]}
                onChange={value =>
                  onChangeFilters(
                    'transactionType',
                    value as FiltersState['transactionType'],
                  )
                }
              />
            </View>
            <View>
              <Text>{t('Minimum')}</Text>
              <Input
                value={filters.minAmount}
                onChange={event =>
                  onChangeFilters('minAmount', event.target.value)
                }
                placeholder="0.00"
              />
            </View>
            <View>
              <Text>{t('Maximum')}</Text>
              <Input
                value={filters.maxAmount}
                onChange={event =>
                  onChangeFilters('maxAmount', event.target.value)
                }
                placeholder="0.00"
              />
            </View>
            <View>
              <Text>{t('Search')}</Text>
              <Input
                value={filters.search}
                onChange={event =>
                  onChangeFilters('search', event.target.value)
                }
                placeholder={t('Payee, note or category') ?? undefined}
              />
            </View>
            <View className="credit-dashboard__toggle">
              <Toggle
                checked={filters.onlyUncategorized}
                onChange={checked =>
                  onChangeFilters('onlyUncategorized', checked)
                }
              />
              <Text>{t('Only uncategorized')}</Text>
            </View>
            {transactionsQuery && (
              <Button onPress={() => reload()} variant="bare">
                {t('Refresh data')}
              </Button>
            )}
          </Stack>
        </Card>

        <Card className="credit-dashboard__chart">
          <Text style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            {t('Spending overview')}
          </Text>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis dataKey="month" stroke="var(--modern-muted)" />
                <YAxis
                  stroke="var(--modern-muted)"
                  tickFormatter={value => integerToCurrency(value as number)}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload) {
                      return null;
                    }

                    return (
                      <Card className="credit-dashboard__tooltip">
                        <Text style={{ fontWeight: 600 }}>{label}</Text>
                        {payload.map(item => (
                          <Text key={item.dataKey}>
                            {item.name}:{' '}
                            {integerToCurrency(item.value as number)}
                          </Text>
                        ))}
                      </Card>
                    );
                  }}
                />
                <Legend />
                <Bar
                  dataKey="charges"
                  name={t('Charges')}
                  fill="#f97316"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="payments"
                  name={t('Payments')}
                  fill="#22c55e"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="net"
                  name={t('Outstanding')}
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Text style={{ color: 'var(--modern-muted)' }}>
              {t(
                'Transactions will appear here once this card is linked to an account.',
              )}
            </Text>
          )}
        </Card>

        <View className="credit-dashboard__statements">
          {statements.map(statement => {
            const isActive = activeStatement?.id === statement.id;
            const topCategories = statement.categories.slice(0, 3);

            return (
              <Card
                key={statement.id}
                className={
                  'credit-dashboard__statement' +
                  (isActive ? ' credit-dashboard__statement--active' : '')
                }
                onClick={() => setActiveStatementId(statement.id)}
              >
                <Stack direction="column" gap={12}>
                  <Stack direction="row" justify="space-between" align="center">
                    <Text style={{ fontSize: 18, fontWeight: 600 }}>
                      {statement.label}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: 600 }}>
                      {integerToCurrency(statement.charges)}
                    </Text>
                  </Stack>
                  <Stack direction="row" gap={12} wrap="wrap">
                    <View className="credit-dashboard__statement-tag credit-dashboard__statement-tag--charges">
                      <Text>{t('Charges')}</Text>
                      <Text>{integerToCurrency(statement.charges)}</Text>
                    </View>
                    <View className="credit-dashboard__statement-tag credit-dashboard__statement-tag--payments">
                      <Text>{t('Payments')}</Text>
                      <Text>{integerToCurrency(statement.payments)}</Text>
                    </View>
                    <View className="credit-dashboard__statement-tag credit-dashboard__statement-tag--net">
                      <Text>{t('Outstanding')}</Text>
                      <Text>{integerToCurrency(statement.net)}</Text>
                    </View>
                  </Stack>
                  <View>
                    <Text
                      style={{ color: 'var(--modern-muted)', marginBottom: 8 }}
                    >
                      {t('Top categories')}
                    </Text>
                    <Stack direction="column" gap={8}>
                      {topCategories.map(category => {
                        const percentage =
                          statement.charges > 0
                            ? category.amount / statement.charges
                            : 0;

                        return (
                          <View
                            key={category.name}
                            className="credit-dashboard__category-row"
                          >
                            <View className="credit-dashboard__category-bar">
                              <View
                                className="credit-dashboard__category-bar-fill"
                                style={{
                                  width: `${Math.min(percentage * 100, 100)}%`,
                                }}
                              />
                            </View>
                            <Stack
                              direction="row"
                              justify="space-between"
                              align="center"
                            >
                              <Text>{category.name}</Text>
                              <Text>
                                {integerToCurrency(category.amount)} ·{' '}
                                {PERCENT_FORMATTER.format(percentage)}
                              </Text>
                            </Stack>
                          </View>
                        );
                      })}
                      {topCategories.length === 0 && (
                        <Text style={{ color: 'var(--modern-muted)' }}>
                          {t('No categorized charges in this statement.')}
                        </Text>
                      )}
                    </Stack>
                  </View>
                </Stack>
              </Card>
            );
          })}
        </View>

        <Card className="credit-dashboard__transactions">
          <Stack
            direction="row"
            justify="space-between"
            align="center"
            style={{ marginBottom: 12 }}
          >
            <Text style={{ fontSize: 18, fontWeight: 600 }}>
              {t('Transactions')}
            </Text>
            {transactionsQuery && (
              <Button
                onPress={() => loadMore()}
                variant="bare"
                isDisabled={isLoadingMore}
              >
                {isLoadingMore ? t('Loading...') : t('Load more history')}
              </Button>
            )}
          </Stack>
          {isLoading && (
            <Text style={{ color: 'var(--modern-muted)' }}>
              {t('Loading transactions...')}
            </Text>
          )}
          {!isLoading &&
            (!activeStatement || activeStatement.transactions.length === 0) && (
              <Text style={{ color: 'var(--modern-muted)' }}>
                {t('No transactions match the selected filters.')}
              </Text>
            )}
          {!isLoading &&
            activeStatement &&
            activeStatement.transactions.length > 0 && (
              <View className="credit-dashboard__transaction-list">
                {activeStatement.transactions.map(transaction => {
                  const amount = transaction.amount ?? 0;
                  const isCharge = amount < 0;
                  const amountDisplay = integerToCurrency(Math.abs(amount));
                  const categoryName =
                    transaction.category &&
                    typeof transaction.category === 'object'
                      ? transaction.category.name
                      : t('Uncategorized');
                  const payeeName =
                    transaction.payee && typeof transaction.payee === 'object'
                      ? transaction.payee.name
                      : (transaction.imported_payee ?? t('No payee'));

                  return (
                    <View
                      key={transaction.id}
                      className="credit-dashboard__transaction-row"
                    >
                      <View>
                        <Text style={{ fontWeight: 600 }}>{payeeName}</Text>
                        <Text
                          style={{ color: 'var(--modern-muted)', fontSize: 13 }}
                        >
                          {categoryName}
                        </Text>
                        {transaction.notes && (
                          <Text
                            style={{
                              color: 'var(--modern-muted)',
                              fontSize: 13,
                            }}
                          >
                            {transaction.notes}
                          </Text>
                        )}
                      </View>
                      <View className="credit-dashboard__transaction-meta">
                        <Text
                          style={{ fontSize: 13, color: 'var(--modern-muted)' }}
                        >
                          {format(parseISO(transaction.date), 'MMM dd, yyyy')}
                        </Text>
                        <Text
                          style={{
                            fontWeight: 600,
                            color: isCharge
                              ? 'var(--modern-negative)'
                              : 'var(--modern-positive)',
                          }}
                        >
                          {isCharge ? '-' : '+'}
                          {amountDisplay}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
        </Card>
      </Stack>
    </View>
  );
}
