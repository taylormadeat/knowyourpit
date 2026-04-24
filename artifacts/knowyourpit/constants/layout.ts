/**
 * Layout constants shared across screens.
 *
 * `WEB_PREVIEW_TOP_OFFSET` accounts for the height of the Replit
 * preview proxy chrome that overlays the top of the viewport when
 * the app is rendered in a web preview. It is added to the
 * `safe-area` top inset so screens clear the proxy header.
 *
 * If the proxy offset ever changes, update this value in one place
 * and every screen that uses `useTopInset` will pick it up.
 */
export const WEB_PREVIEW_TOP_OFFSET = 67;
