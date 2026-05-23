/** How often probe readings (MEATER, ThermoWorks) and the cook journal are
 *  re-fetched while a cook is active.  15 minutes strikes the right balance
 *  between fresh data and battery / API cost. */
export const PROBE_POLL_INTERVAL_MS = 15 * 60 * 1000;
