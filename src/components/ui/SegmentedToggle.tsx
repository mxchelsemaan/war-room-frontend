import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function SegmentedToggle<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v as T); }}
      className="w-full rounded-lg border border-border text-[11px] font-medium"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-none text-[11px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
