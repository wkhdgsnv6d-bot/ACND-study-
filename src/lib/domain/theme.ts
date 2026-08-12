/**
 * Where the chosen theme is remembered.
 *
 * A constant in its own module because both sides need it: the inline script in
 * `<head>` reads it before first paint (server-rendered, needs the CSP nonce
 * from `next/headers`), and the toggle writes it (browser). Keeping it here
 * means the toggle does not have to import the module that reaches for request
 * headers, which would drag `next/headers` into the client bundle.
 */
export const THEME_STORAGE_KEY = "ascend.theme";
