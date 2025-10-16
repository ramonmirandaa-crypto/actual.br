// @ts-strict-ignore
import React, { type ReactElement, useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Route, Routes, Navigate, useLocation, useHref } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Stack } from '@actual-app/components/stack';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import * as undo from 'loot-core/platform/client/undo';

import { UserAccessPage } from './admin/UserAccess/UserAccessPage';
import { BankSync } from './banksync';
import { BankSyncStatus } from './BankSyncStatus';
import { CommandBar } from './CommandBar';
import { GlobalKeys } from './GlobalKeys';
import { ModernShell } from './layout/ModernShell';
import { MobileNavTabs } from './mobile/MobileNavTabs';
import { TransactionEdit } from './mobile/transactions/TransactionEdit';
import { Notifications } from './Notifications';
import { Reports } from './reports';
import { LoadingIndicator } from './reports/LoadingIndicator';
import { NarrowAlternate, WideComponent } from './responsive';
import { UserDirectoryPage } from './responsive/wide';
import { ScrollProvider } from './ScrollProvider';
import { useMultiuserEnabled } from './ServerContext';
import { Settings } from './settings';
import { Sidebar } from './sidebar/Sidebar';
import { ManageTagsPage } from './tags/ManageTagsPage';
import { Titlebar } from './Titlebar';
import { InvestmentsDashboard } from './investments/InvestmentsDashboard';
import { LoansDashboard } from './loans/LoansDashboard';

import { getLatestAppVersion, sync } from '@desktop-client/app/appSlice';
import { ProtectedRoute } from '@desktop-client/auth/ProtectedRoute';
import { Permissions } from '@desktop-client/auth/types';
import { useAccounts } from '@desktop-client/hooks/useAccounts';
import { useGlobalPref } from '@desktop-client/hooks/useGlobalPref';
import { useLocalPref } from '@desktop-client/hooks/useLocalPref';
import { useMetaThemeColor } from '@desktop-client/hooks/useMetaThemeColor';
import { useNavigate } from '@desktop-client/hooks/useNavigate';
import { addNotification } from '@desktop-client/notifications/notificationsSlice';
import { useSelector, useDispatch } from '@desktop-client/redux';
import { useFormat } from '@desktop-client/hooks/useFormat';

function NarrowNotSupported({
  redirectTo = '/budget',
  children,
}: {
  redirectTo?: string;
  children: ReactElement;
}) {
  const { isNarrowWidth } = useResponsive();
  const navigate = useNavigate();
  useEffect(() => {
    if (isNarrowWidth) {
      navigate(redirectTo);
    }
  }, [isNarrowWidth, navigate, redirectTo]);
  return isNarrowWidth ? null : children;
}

function WideNotSupported({ children, redirectTo = '/budget' }) {
  const { isNarrowWidth } = useResponsive();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNarrowWidth) {
      navigate(redirectTo);
    }
  }, [isNarrowWidth, navigate, redirectTo]);
  return isNarrowWidth ? children : null;
}

function RouterBehaviors() {
  const location = useLocation();
  const href = useHref(location);
  useEffect(() => {
    undo.setUndoState('url', href);
  }, [href]);

  return null;
}

export function FinancesApp() {
  const { isNarrowWidth } = useResponsive();
  useMetaThemeColor(isNarrowWidth ? theme.mobileViewTheme : null);

  const dispatch = useDispatch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();

  const accounts = useAccounts();
  const isAccountsLoaded = useSelector(state => state.account.isAccountsLoaded);

  const versionInfo = useSelector(state => state.app.versionInfo);
  const [notifyWhenUpdateIsAvailable] = useGlobalPref(
    'notifyWhenUpdateIsAvailable',
  );
  const [lastUsedVersion, setLastUsedVersion] = useLocalPref(
    'flags.updateNotificationShownForVersion',
  );

  const multiuserEnabled = useMultiuserEnabled();

  useEffect(() => {
    // Wait a little bit to make sure the sync button will get the
    // sync start event. This can be improved later.
    setTimeout(async () => {
      await dispatch(sync());
    }, 100);
  }, []);

  useEffect(() => {
    async function run() {
      await global.Actual.waitForUpdateReadyForDownload(); // This will only resolve when an update is ready
      dispatch(
        addNotification({
          notification: {
            type: 'message',
            title: t('A new version of Actual is available!'),
            message: t(
              'Click the button below to reload and apply the update.',
            ),
            sticky: true,
            id: 'update-reload-notification',
            button: {
              title: t('Update now'),
              action: async () => {
                await global.Actual.applyAppUpdate();
              },
            },
          },
        }),
      );
    }

    run();
  }, []);

  useEffect(() => {
    dispatch(getLatestAppVersion());
  }, [dispatch]);

  useEffect(() => {
    if (notifyWhenUpdateIsAvailable && versionInfo) {
      if (
        versionInfo.isOutdated &&
        lastUsedVersion !== versionInfo.latestVersion
      ) {
        dispatch(
          addNotification({
            notification: {
              type: 'message',
              title: t('A new version of Actual is available!'),
              message:
                (process.env.REACT_APP_IS_PIKAPODS ?? '').toLowerCase() ===
                'true'
                  ? t(
                      'A new version of Actual is available! Your Pikapods instance will be automatically updated in the next few days - no action needed.',
                    )
                  : t(
                      'Version {{latestVersion}} of Actual was recently released.',
                      { latestVersion: versionInfo.latestVersion },
                    ),
              sticky: true,
              id: 'update-notification',
              button: {
                title: t('Open changelog'),
                action: () => {
                  window.open('https://actualbudget.org/docs/releases');
                },
              },
              onClose: () => {
                setLastUsedVersion(versionInfo.latestVersion);
              },
            },
          }),
        );
      }
    }
  }, [
    dispatch,
    lastUsedVersion,
    notifyWhenUpdateIsAvailable,
    setLastUsedVersion,
    t,
    versionInfo,
  ]);

  const scrollableRef = useRef<HTMLDivElement>(null);

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, account) => {
      const balance =
        (account?.balance_current as number | undefined) ??
        (account?.balance as number | undefined) ??
        0;
      return sum + balance;
    }, 0);
  }, [accounts]);

  const averageBalance = useMemo(() => {
    if (accounts.length === 0) {
      return 0;
    }
    return Math.round(totalBalance / accounts.length);
  }, [accounts.length, totalBalance]);

  const activeAccounts = useMemo(() => {
    return accounts.filter(account => !account?.closed).length;
  }, [accounts]);

  const headerContent = (
    <View style={{ position: 'relative', paddingTop: 52 }}>
      <Titlebar
        style={{
          WebkitAppRegion: 'drag',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          zIndex: 2,
        }}
      />
      <Stack direction="row" justify="space-between" align="start" spacing={4}>
        <View className="finance-dashboard__headline">
          <Text className="finance-dashboard__title">
            <Trans i18nKey="finances.header.title">
              Seu centro financeiro inteligente
            </Trans>
          </Text>
          <Text className="finance-dashboard__subtitle">
            <Trans
              i18nKey="finances.header.subtitle"
              values={{ count: accounts.length }}
            >
              Organize {{ count }} contas, investimentos e empréstimos com métricas em tempo real e visual moderno.
            </Trans>
          </Text>
        </View>
        <Stack
          direction="row"
          align="center"
          spacing={3}
          style={{ flexWrap: 'wrap' }}
        >
          <Button onPress={() => navigate('/investimentos')}>
            {t('finances.header.actions.investments')}
          </Button>
          <Button variant="bare" onPress={() => navigate('/cards')}>
            {t('finances.header.actions.cards')}
          </Button>
          <Button variant="primary" onPress={() => dispatch(sync())}>
            {t('finances.header.actions.sync')}
          </Button>
        </Stack>
      </Stack>

      <View className="finance-header__metrics">
        <div className="finance-header__metric">
          <span>{t('finances.header.metrics.totalBalance')}</span>
          <strong>{format(totalBalance, 'financial')}</strong>
          <small>{t('finances.header.metrics.totalBalanceHint')}</small>
        </div>
        <div className="finance-header__metric">
          <span>{t('finances.header.metrics.averageBalance')}</span>
          <strong>{format(averageBalance, 'financial')}</strong>
          <small>{t('finances.header.metrics.averageBalanceHint')}</small>
        </div>
        <div className="finance-header__metric">
          <span>{t('finances.header.metrics.activeAccounts')}</span>
          <strong>{activeAccounts}</strong>
          <small>{t('finances.header.metrics.activeAccountsHint')}</small>
        </div>
      </View>
    </View>
  );

  return (
    <View style={{ height: '100%' }}>
      <RouterBehaviors />
      <GlobalKeys />
      <CommandBar />
      <ModernShell sidebar={<Sidebar />} header={headerContent}>
        <ScrollProvider
          isDisabled={!isNarrowWidth}
          scrollableRef={scrollableRef}
        >
          <View
            ref={scrollableRef}
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              paddingBottom: 32,
            }}
          >
            <Notifications />
            <BankSyncStatus />

            <Routes>
              <Route
                path="/"
                element={
                  isAccountsLoaded ? (
                    accounts.length > 0 ? (
                      <Navigate to="/budget" replace />
                    ) : (
                      // If there are no accounts, we want to redirect the user to
                      // the All Accounts screen which will prompt them to add an account
                      <Navigate to="/accounts" replace />
                    )
                  ) : (
                    <LoadingIndicator />
                  )
                }
              />

              <Route path="/reports/*" element={<Reports />} />

              <Route
                path="/investimentos"
                element={<InvestmentsDashboard />}
              />

              <Route path="/emprestimos" element={<LoansDashboard />} />

              <Route
                path="/budget"
                element={<NarrowAlternate name="Budget" />}
              />

              <Route
                path="/schedules"
                element={
                  <NarrowNotSupported>
                    <WideComponent name="Schedules" />
                  </NarrowNotSupported>
                }
              />

              <Route
                path="/payees"
                element={<NarrowAlternate name="Payees" />}
              />
              <Route path="/rules" element={<NarrowAlternate name="Rules" />} />
              <Route
                path="/rules/:id"
                element={<NarrowAlternate name="RuleEdit" />}
              />
              <Route path="/bank-sync" element={<BankSync />} />
              <Route path="/tags" element={<ManageTagsPage />} />
              <Route path="/settings" element={<Settings />} />

              <Route
                path="/cards"
                element={
                  <NarrowNotSupported>
                    <WideComponent name="CreditCards" />
                  </NarrowNotSupported>
                }
              />

              <Route
                path="/gocardless/link"
                element={
                  <NarrowNotSupported>
                    <WideComponent name="GoCardlessLink" />
                  </NarrowNotSupported>
                }
              />

              <Route
                path="/accounts"
                element={<NarrowAlternate name="Accounts" />}
              />

              <Route
                path="/accounts/:id"
                element={<NarrowAlternate name="Account" />}
              />

              <Route
                path="/transactions/:transactionId"
                element={
                  <WideNotSupported>
                    <TransactionEdit />
                  </WideNotSupported>
                }
              />

              <Route
                path="/categories/:id"
                element={<NarrowAlternate name="Category" />}
              />
              {multiuserEnabled && (
                <Route
                  path="/user-directory"
                  element={
                    <ProtectedRoute
                      permission={Permissions.ADMINISTRATOR}
                      element={<UserDirectoryPage />}
                    />
                  }
                />
              )}
              {multiuserEnabled && (
                <Route
                  path="/user-access"
                  element={
                    <ProtectedRoute
                      permission={Permissions.ADMINISTRATOR}
                      validateOwner={true}
                      element={<UserAccessPage />}
                    />
                  }
                />
              )}
              {/* redirect all other traffic to the budget page */}
              <Route path="/*" element={<Navigate to="/budget" replace />} />
            </Routes>
          </View>

          <Routes>
            <Route path="/budget" element={<MobileNavTabs />} />
            <Route path="/accounts" element={<MobileNavTabs />} />
            <Route path="/settings" element={<MobileNavTabs />} />
            <Route path="/reports" element={<MobileNavTabs />} />
            <Route path="/rules" element={<MobileNavTabs />} />
            <Route path="/payees" element={<MobileNavTabs />} />
            <Route path="/cards" element={<MobileNavTabs />} />
            <Route path="/investimentos" element={<MobileNavTabs />} />
            <Route path="/emprestimos" element={<MobileNavTabs />} />
            <Route path="*" element={null} />
          </Routes>
        </ScrollProvider>
      </ModernShell>
    </View>
  );
}
