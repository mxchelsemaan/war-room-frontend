import { useLocalStorage } from "./useLocalStorage";

export function useSettings() {
  const [showLabels, setShowLabels] = useLocalStorage("settings:showLabels", true);

  return { showLabels, toggleLabels: () => setShowLabels((v) => !v) };
}
