import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Onest } from 'next/font/google';

import { AppShell } from '@/components/layout/app-shell';
import { AppModeProvider } from '@/components/providers/app-mode-provider';
import { ProfileProvider } from '@/components/providers/profile-provider';
import { getAppMode } from '@/server/flags';

import './globals.css';

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-onest',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'MLM Academy — библиотека действий',
    template: '%s · MLM Academy',
  },
  description:
    'Библиотека рабочих треков для партнёров сетевого бизнеса: ситуация, действие, зафиксированный результат и следующий шаг.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f3efe6',
};

/**
 * Режимы (preview, admin) читаются из серверного окружения на каждый запрос,
 * поэтому дерево рендерится динамически. Данные лежат в памяти, стоимость минимальна.
 */
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = getAppMode();

  return (
    <html lang="ru" className={`${onest.variable} ${mono.variable}`}>
      <body>
        <AppModeProvider mode={mode}>
          <ProfileProvider>
            <AppShell preview={mode.preview}>{children}</AppShell>
          </ProfileProvider>
        </AppModeProvider>
      </body>
    </html>
  );
}
