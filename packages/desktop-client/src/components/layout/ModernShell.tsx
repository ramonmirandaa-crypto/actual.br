import React, { type ReactNode } from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { View } from '@actual-app/components/view';

export type ModernShellProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export function ModernShell({
  sidebar,
  header,
  children,
  footer,
}: ModernShellProps) {
  const { isNarrowWidth } = useResponsive();

  if (isNarrowWidth) {
    return (
      <View className="modern-shell modern-shell--narrow">
        {header ? <View className="modern-shell__header">{header}</View> : null}
        <View className="modern-shell__content modern-shell__content--narrow">
          {children}
        </View>
        {footer ? <View className="modern-shell__footer">{footer}</View> : null}
      </View>
    );
  }

  return (
    <View className="modern-shell">
      <View className="modern-shell__container">
        <View className="modern-shell__sidebar">{sidebar}</View>
        <View className="modern-shell__main">
          {header ? (
            <View className="modern-shell__header">{header}</View>
          ) : null}
          <View className="modern-shell__content">{children}</View>
          {footer ? (
            <View className="modern-shell__footer">{footer}</View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
