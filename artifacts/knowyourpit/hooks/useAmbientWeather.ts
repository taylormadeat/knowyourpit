import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";

export type AmbientWeather = {
  tempF: number | null;
  tempC: number | null;
  conditionCode: number | null;
  loading: boolean;
  locationDenied: boolean;
  error: string | null;
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

let cachedWeather: { tempF: number; tempC: number; conditionCode: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function useAmbientWeather(): AmbientWeather {
  const [tempF, setTempF] = useState<number | null>(cachedWeather?.tempF ?? null);
  const [tempC, setTempC] = useState<number | null>(cachedWeather?.tempC ?? null);
  const [conditionCode, setConditionCode] = useState<number | null>(cachedWeather?.conditionCode ?? null);
  const [loading, setLoading] = useState<boolean>(cachedWeather == null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refresh = useCallback(() => {
    cachedWeather = null;
    setFetchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      // Use cache if fresh
      if (cachedWeather && Date.now() - cachedWeather.fetchedAt < CACHE_TTL_MS) {
        setTempF(cachedWeather.tempF);
        setTempC(cachedWeather.tempC);
        setConditionCode(cachedWeather.conditionCode);
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
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&current=temperature_2m,weathercode&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Weather API error: ${resp.status}`);
        const json = await resp.json();

        if (cancelled) return;

        const tF: number = json.current?.temperature_2m ?? null;
        const tC: number | null = tF != null ? Math.round(((tF - 32) * 5) / 9 * 10) / 10 : null;
        const wCode: number | null = json.current?.weathercode ?? null;

        if (tF != null) {
          cachedWeather = { tempF: Math.round(tF), tempC: tC ?? 0, conditionCode: wCode ?? 0, fetchedAt: Date.now() };
          setTempF(Math.round(tF));
          setTempC(tC);
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
    return () => { cancelled = true; };
  }, [fetchTick]);

  return { tempF, tempC, conditionCode, loading, locationDenied, error, refresh };
}
