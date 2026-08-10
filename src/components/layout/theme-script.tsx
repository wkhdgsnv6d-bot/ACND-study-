/**
 * Applies the stored theme before first paint.
 *
 * The platform is dark-first: `:root` carries the dark palette and a `light`
 * class opts out. Running this inline in `<head>` avoids the flash of the wrong
 * theme that a `useEffect` would produce, which matters on a tool intended for
 * daily use at night.
 */

export const THEME_STORAGE_KEY = "ascend.theme";

const script = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark' ? stored : null;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.classList.toggle('light', theme === 'light');
  } catch (e) {
    // Private browsing can throw on localStorage access. Dark is the default,
    // and it is already applied by the stylesheet, so there is nothing to do.
  }
})();
`;

export function ThemeScript() {
  return (
    <script
      // The script is a build-time constant with no interpolated input.
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
