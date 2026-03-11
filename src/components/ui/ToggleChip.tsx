import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

export function ToggleChip({
  active, onClick, activeClass, icon, label, title,
}: {
  active: boolean;
  onClick: () => void;
  activeClass: string;
  icon: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <Toggle
      pressed={active}
      onPressedChange={onClick}
      title={title}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-2xs font-medium rounded-none h-auto min-w-0 min-h-0",
        active ? activeClass : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 data-[state=on]:bg-transparent"
      )}
    >
      {icon}
      <span>{label}</span>
    </Toggle>
  );
}
