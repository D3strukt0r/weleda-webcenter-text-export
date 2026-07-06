import type {Route} from './+types/root';
import {I18nextProvider, useTranslation} from 'react-i18next';
import {isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration} from 'react-router';
import {FallbackPage} from './components/FallbackPage';
import {THEME_COLOR_DARK, THEME_COLOR_LIGHT} from './hooks/useTheme';
import {i18n} from './i18n';

import './styles/tailwind.css';
import './styles/main.scss';

export const links: Route.LinksFunction = () => {
  // Vite's base (ends in `/`): `/` for the root-served Cloudflare/Docker builds,
  // `/<repo>/` for the GitHub Pages sub-path build. Prefix every same-origin
  // asset href with it so they resolve under a project sub-path.
  const base = import.meta.env.BASE_URL;
  return [
    {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous'},
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap',
    },
    // Favicon set. The SVG carries both light + dark variants inline via a
    // `prefers-color-scheme` `@media` block in its own <style> element, so a
    // single `<link rel="icon">` covers both. PNG + ICO are fallbacks for
    // browsers without SVG-favicon support.
    {rel: 'icon', type: 'image/png', sizes: '96x96', href: `${base}favicon-96x96.png`},
    {rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg`},
    {rel: 'shortcut icon', href: `${base}favicon.ico`},
    {rel: 'apple-touch-icon', sizes: '180x180', href: `${base}apple-touch-icon.png`},
    {rel: 'manifest', href: `${base}site.webmanifest`},
  ];
};

// Runs in <head> before stylesheets evaluate. Writes to <html>
// (`document.documentElement`) because <body> doesn't exist yet during head
// parsing — putting the class on the root element pre-CSS-eval means body
// inherits the dark variable cascade from its first computed style, so the
// global `body, body *` transition in _base.scss has nothing to animate.
// Does three things in one inline pass:
//   1. Sets html.light / html.dark for the first paint (avoids theme FOUC
//      and the cross-fade that fires when the class is added post-paint).
//      Reads localStorage, falls back to prefers-color-scheme.
//   2. Adds html.js so the `no-js:` Tailwind variant hides UI that has no
//      meaningful no-JS state.
//   3. Overrides every `<meta name="theme-color">` content so the mobile
//      browser chrome (address-bar strip) follows the in-page theme even
//      when it disagrees with the OS preference.
// Kept minified to one line for the fastest parse before hydration.
// eslint-disable-next-line style/max-len -- inline IIFE intentionally minified to one line for fastest parse before hydration (avoids theme FOUC)
const themeBootstrap = `(function(){try{var k='weleda-konverter:theme';var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.add(t,'js');var c=t==='dark'?'${THEME_COLOR_DARK}':'${THEME_COLOR_LIGHT}';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c);});}catch(e){document.documentElement.classList.add('light','js');}})();`;

export function Layout({children}: {children: React.ReactNode}) {
  return (
    // Browser extensions (Grammarly, password managers, dark-mode helpers,
    // …) attach attributes / inline styles to <html> and <body> after the
    // server-rendered HTML lands and before React hydrates. That diff
    // would otherwise log a hydration warning the user can't fix.
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="apple-mobile-web-app-title" content="WebCenter Konverter" />
        {/* Two metas so no-JS users still get OS-driven chrome colour. With
            JS, the bootstrap below and `applyTheme` overwrite both `content`
            attrs to the chosen theme — whichever the browser picks via the
            `media` query then shows the right colour regardless. */}
        <meta name="theme-color" content={THEME_COLOR_LIGHT} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={THEME_COLOR_DARK} media="(prefers-color-scheme: dark)" />
        {/* Must run before <Links /> so the theme class is on <html> before
            any stylesheet evaluates — that's what prevents the FOUC. */}
        {/* eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- themeBootstrap is a constant string defined above; no user input, no escaping needed */}
        <script dangerouslySetInnerHTML={{__html: themeBootstrap}} />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({error}: Route.ErrorBoundaryProps) {
  const {t} = useTranslation();
  let title = t('errors.generic_title');
  let message = t('errors.unknown');
  // Dev-only: the raw stack, rendered in a scrollable block by FallbackPage.
  // Gated on import.meta.env.DEV so production bundles never expose it.
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = t('errors.not_found_title');
      message = t('errors.not_found_message');
    } else {
      message = error.statusText || message;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
    stack = error.stack;
  }

  return <FallbackPage title={title} message={message} stack={stack} />;
}
