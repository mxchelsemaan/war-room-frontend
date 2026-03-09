import { useEffect, useState } from "react";

export function useSettings() {
  const [showLabels, setShowLabels] = useState(() => {
    const stored = localStorage.getItem("settings:showLabels");
    return stored ? stored === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("settings:showLabels", String(showLabels));
  }, [showLabels]);

  return { showLabels, toggleLabels: () => setShowLabels((v) => !v) };
}
