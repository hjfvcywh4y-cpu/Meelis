import type { ReactNode } from 'react';

import { Footer } from './footer';
import { Header } from './header';
import { MobileNav } from './mobile-nav';
import { PreviewBanner } from './preview-banner';

export function AppShell({ preview, children }: { preview: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#content" className="skip-link">
        Перейти к содержанию
      </a>
      <Header />
      {preview ? <PreviewBanner /> : null}
      <main id="content" className="flex-1 pb-[62px] lg:pb-0">
        {children}
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
