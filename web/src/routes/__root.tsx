import { useEffect, useState, type ReactNode } from 'react';
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useLocation,
} from '@tanstack/react-router';
import '@fontsource-variable/space-grotesk';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import appCss from '../styles/app.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'LGT arcade' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { pathname } = useLocation();
  const bookClubActive = pathname === '/' || pathname === '/archive';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <RootDocument>
      <div className="backdrop" aria-hidden="true">
        <div className="backdrop__sun" />
        <div className="backdrop__grid" />
      </div>

      <header className="marquee">
        <a href="/" className="marquee__brand" aria-label="LGT home">
          <img src="/lgt-logo.webp" alt="LGT" />
        </a>

        <button
          type="button"
          className="marquee__toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span
            className="marquee__bars"
            data-open={menuOpen}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </span>
        </button>

        <div id="primary-nav" className="marquee__menu" data-open={menuOpen}>
          <nav className="marquee__nav" onClick={() => setMenuOpen(false)}>
            <a
              href="/"
              className="nav-link"
              aria-current={bookClubActive ? 'page' : undefined}
            >
              Book club
            </a>
            <a
              href="/kudos"
              className="nav-link"
              aria-current={pathname === '/kudos' ? 'page' : undefined}
            >
              Kudos
            </a>
            <a
              href="/hall-of-shame"
              className="nav-link"
              aria-current={pathname === '/hall-of-shame' ? 'page' : undefined}
            >
              Hall of shame
            </a>
            <a
              href="/haikus"
              className="nav-link"
              aria-current={pathname === '/haikus' ? 'page' : undefined}
            >
              Haikus
            </a>
          </nav>
          <a href="/logout" className="marquee__logout">
            Logout
          </a>
        </div>
      </header>

      <div className="shell">
        <Outlet />
      </div>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
