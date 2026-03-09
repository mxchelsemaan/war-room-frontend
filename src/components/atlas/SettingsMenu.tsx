import { Settings, Sun, Moon, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SettingsMenuProps {
  dark: boolean;
  onToggleTheme: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
}

export function SettingsMenu({ dark, onToggleTheme, showLabels, onToggleLabels }: SettingsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="glass-panel size-9 flex items-center justify-center shrink-0"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[80] w-52 p-2">
        <button
          onClick={onToggleTheme}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          {dark ? <Sun className="size-3.5 text-primary" /> : <Moon className="size-3.5 text-muted-foreground" />}
          <span className={dark ? "text-foreground" : "text-muted-foreground"}>
            {dark ? "Light mode" : "Dark mode"}
          </span>
          <span className={`ml-auto h-4 w-7 rounded-full transition-colors ${dark ? "bg-primary" : "bg-muted"}`}>
            <span className={`block h-4 w-4 rounded-full border border-border bg-card shadow transition-transform ${dark ? "translate-x-3" : "translate-x-0"}`} />
          </span>
        </button>
        <button
          onClick={onToggleLabels}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          <Tag className={`size-3.5 ${showLabels ? "text-primary" : "text-muted-foreground"}`} />
          <span className={showLabels ? "text-foreground" : "text-muted-foreground"}>
            UI Labels
          </span>
          <span className={`ml-auto h-4 w-7 rounded-full transition-colors ${showLabels ? "bg-primary" : "bg-muted"}`}>
            <span className={`block h-4 w-4 rounded-full border border-border bg-card shadow transition-transform ${showLabels ? "translate-x-3" : "translate-x-0"}`} />
          </span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
