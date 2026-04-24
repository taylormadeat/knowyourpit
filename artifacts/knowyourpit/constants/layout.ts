/**
 * Layout constants shared across screens.
 *
 * `WEB_PREVIEW_TOP_OFFSET` accounts for the height of the Replit
 * preview proxy chrome that overlays the top of the viewport when
 * the app is rendered in a web preview. It is added to the
 * `safe-area` top inset so screens clear the proxy header.
 *
 * `WEB_PREVIEW_BOTTOM_OFFSET` accounts for the height of the
 * Replit preview proxy chrome that overlays the bottom of the
 * viewport (e.g. the device frame chin in the web preview). It is
 * added to the `safe-area` bottom inset so screens clear it.
 *
 * If the proxy offsets ever change, update these values in one
 * place and every screen that uses `useTopInset` / `useBottomInset`
 * will pick them up.
 */
export const WEB_PREVIEW_TOP_OFFSET = 67;
export const WEB_PREVIEW_BOTTOM_OFFSET = 34;
