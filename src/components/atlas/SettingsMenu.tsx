import { Settings, Sun, Moon, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
        <Button
          variant="ghost"
          size="icon"
          className="glass-panel size-9 shrink-0"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[80] w-52 border-border/50 p-2">
        <button
          onClick={onToggleTheme}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          {dark ? <Sun className="size-3.5 text-primary" /> : <Moon className="size-3.5 text-muted-foreground" />}
          <span className={dark ? "text-foreground" : "text-muted-foreground"}>
            {dark ? "Light mode" : "Dark mode"}
          </span>
          <Switch checked={dark} className="ml-auto" size="sm" tabIndex={-1} />
        </button>
        <button
          onClick={onToggleLabels}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          <Tag className={`size-3.5 ${showLabels ? "text-primary" : "text-muted-foreground"}`} />
          <span className={showLabels ? "text-foreground" : "text-muted-foreground"}>
            UI Labels
          </span>
          <Switch checked={showLabels} className="ml-auto" size="sm" tabIndex={-1} />
        </button>
      </PopoverContent>
    </Popover>
  );
}
