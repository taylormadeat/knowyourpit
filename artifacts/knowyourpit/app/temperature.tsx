import React, { useEffect } from "react";
import { useRouter } from "expo-router";

export default function TemperatureScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(tabs)/cooks" as any);
  }, []);
  return null;
}
