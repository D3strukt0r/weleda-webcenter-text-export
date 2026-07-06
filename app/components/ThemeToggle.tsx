import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import MoonIcon from '~/assets/icons/moon.svg?react';
import SunIcon from '~/assets/icons/sun.svg?react';
import {useTheme} from '~/hooks/useTheme';

export function ThemeToggle() {
  const {t} = useTranslation();
  const {theme, toggle} = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react/set-state-in-effect -- SSR-hydration marker: must fire only on the client after mount, so aria-pressed stays absent during SSR
  useEffect(() => setMounted(true), []);

  const isDark = theme === 'dark';
  const label = isDark ? t('theme.switch_to_light') : t('theme.switch_to_dark');

  return (
    <button
      type="button"
      // Both icons live in the DOM at all times. The visible one is picked
      // by the `dark:` Tailwind variant (CSS reads `html.dark`, set by the
      // inline themeBootstrap in <head> before first paint). React's
      // `isDark` only drives `aria-label` / `title` / `aria-pressed` —
      // visual state is CSS-driven, so the correct icon is shown from
      // frame one with no SSR-vs-client reconciliation flash.
      className="relative grid size-9 place-items-center overflow-hidden rounded-lg border border-border bg-card text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background no-js:hidden"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={mounted ? isDark : undefined}
    >
      <SunIcon
        width={18}
        height={18}
        aria-hidden="true"
        className="absolute transition-[translate,rotate,opacity] duration-theme ease-soft translate-y-0 rotate-0 opacity-100 dark:translate-y-[120%] dark:rotate-[40deg] dark:opacity-0"
      />
      <MoonIcon
        width={18}
        height={18}
        aria-hidden="true"
        className="absolute transition-[translate,rotate,opacity] duration-theme ease-soft -translate-y-[120%] -rotate-[40deg] opacity-0 dark:translate-y-0 dark:rotate-0 dark:opacity-100"
      />
    </button>
  );
}
