import { useState, useEffect, useCallback, useMemo } from "react";
import * as Location from "expo-location";

export type AmbientWeather = {
  tempF: number | null;
  tempC: number | null;
  conditionCode: number | null;
  loading: boolean;
  locationDenied: boolean;
  error: string | null;
  /** True when tempF/conditionCode reflect a daily forecast for a future cook
   *  date; false when they reflect current ambient conditions. */
  isForecast: boolean;
  /** YYYY-MM-DD of the forecasted day when isForecast=true; null otherwise. */
  forecastDate: string | null;
  refresh: () => void;
};

// Weather condition codes from Open-Meteo WMO Weather interpretation codes
export function weatherDescription(code: number | null): string | null {
  if (code == null) return null;
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return null;
}

export function weatherIcon(code: number | null): string {
  if (code == null) return "cloud";
  if (code === 0) return "sun";
  if (code <= 2) return "sun";
  if (code === 3) return "cloud";
  if (code >= 45 && code <= 48) return "cloud";
  if (code >= 51 && code <= 65) return "cloud-rain";
  if (code >= 71 && code <= 77) return "cloud-snow";
  if (code >= 80 && code <= 86) return "cloud-rain";
  if (code >= 95) return "cloud-lightning";
  return "cloud";
}

interface CacheEntry {
  tempF: number;
  tempC: number;
  conditionCode: number;
  fetchedAt: number;
}

const CURRENT_TTL_MS = 10 * 60 * 1000; // 10 minutes for live conditions
const FORECAST_TTL_MS = 60 * 60 * 1000; // 1 hour for daily forecast

let cachedCurrent: CacheEntry | null = null;
const cachedForecasts = new Map<string, CacheEntry>();

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Returns ambient weather for either current conditions or a forecast for a
 * specific cook date.
 *
 * - `targetDate` omitted / null / today: returns current observed conditions
 *   (existing behaviour, used for live cooks and same-day planning).
 * - `targetDate` set to a future calendar day: returns the daily forecast for
 *   that day — temperature is the midday estimate ((max + min) / 2) and the
 *   condition code is Open-Meteo's daily weathercode for that day. Used by
 *   the Plan screen so cooks scheduled for tomorrow are weather-adjusted for
 *   tomorrow, not today.
 *
 * Forecast fetches are gated by the caller (Plan screen requires Pro). The
 * hook itself does not enforce entitlement — pass `null` for free users.
 */
export function useAmbientWeather(targetDate?: Date | null): AmbientWeather {
  // Recompute the target key reactively so changing the cook date triggers a
  // new fetch. We compare YYYY-MM-DD against today's local date — anything
  // before-or-equal-to today resolves to "current conditions".
  const { wantsForecast, targetKey } = useMemo(() => {
    if (!targetDate) return { wantsForecast: false, targetKey: null as string | null };
    const today = new Date();
    if (isSameLocalDay(targetDate, today)) {
      return { wantsForecast: false, targetKey: null as string | null };
    }
    if (targetDate.getTime() < today.getTime()) {
      // Past dates fall back to current conditions — there's no useful
      // historical forecast to fetch.
      return { wantsForecast: false, targetKey: null as string | null };
    }
    return { wantsForecast: true, targetKey: ymd(targetDate) };
  }, [targetDate?.getTime()]);

  const initialEntry =
    wantsForecast && targetKey ? cachedForecasts.get(targetKey) : cachedCurrent;

  const [tempF, setTempF] = useState<number | null>(initialEntry?.tempF ?? null);
  const [tempC, setTempC] = useState<number | null>(initialEntry?.tempC ?? null);
  const [conditionCode, setConditionCode] = useState<number | null>(
    initialEntry?.conditionCode ?? null,
  );
  const [loading, setLoading] = useState<boolean>(initialEntry == null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refresh = useCallback(() => {
    cachedCurrent = null;
    cachedForecasts.clear();
    setFetchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      const cache =
        wantsForecast && targetKey
          ? cachedForecasts.get(targetKey) ?? null
          : cachedCurrent;
      const ttl = wantsForecast ? FORECAST_TTL_MS : CURRENT_TTL_MS;
      if (cache && Date.now() - cache.fetchedAt < ttl) {
        setTempF(cache.tempF);
        setTempC(cache.tempC);
        setConditionCode(cache.conditionCode);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) {
            setLocationDenied(true);
            setLoading(false);
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        const { latitude, longitude } = loc.coords;

        let tF: number | null = null;
        let wCode: number | null = null;

        if (wantsForecast && targetKey) {
          const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
            `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto` +
            `&start_date=${targetKey}&end_date=${targetKey}`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Weather API error: ${resp.status}`);
          const json = await resp.json();
          if (cancelled) return;
          const max: number | null = json.daily?.temperature_2m_max?.[0] ?? null;
          const min: number | null = json.daily?.temperature_2m_min?.[0] ?? null;
          if (max != null && min != null) {
            tF = (max + min) / 2;
          } else if (max != null) {
            tF = max;
          } else if (min != null) {
            tF = min;
          }
          wCode = json.daily?.weathercode?.[0] ?? null;
        } else {
          const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
            `&current=temperature_2m,weathercode&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Weather API error: ${resp.status}`);
          const json = await resp.json();
          if (cancelled) return;
          tF = json.current?.temperature_2m ?? null;
          wCode = json.current?.weathercode ?? null;
        }

        if (tF != null) {
          const tCRounded = Math.round(((tF - 32) * 5) / 9 * 10) / 10;
          const entry: CacheEntry = {
            tempF: Math.round(tF),
            tempC: tCRounded,
            conditionCode: wCode ?? 0,
            fetchedAt: Date.now(),
          };
          if (wantsForecast && targetKey) {
            cachedForecasts.set(targetKey, entry);
          } else {
            cachedCurrent = entry;
          }
          setTempF(Math.round(tF));
          setTempC(tCRounded);
          setConditionCode(wCode);
        }
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Could not load weather");
          setLoading(false);
        }
      }
    }

    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [fetchTick, targetKey, wantsForecast]);

  return {
    tempF,
    tempC,
    conditionCode,
    loading,
    locationDenied,
    error,
    isForecast: wantsForecast,
    forecastDate: targetKey,
    refresh,
  };
}
