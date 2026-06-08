import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "knowyourpit:staySignedIn";

export async function getStaySignedIn(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v !== "0";
  } catch {
    return true;
  }
}

export async function setStaySignedIn(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? "1" : "0");
  } catch {}
}
