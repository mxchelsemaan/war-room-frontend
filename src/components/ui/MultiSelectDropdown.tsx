import { useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FilterOption } from "@/components/atlas/FilterSidebar";

type SortMode = "alpha-asc" | "alpha-desc" | "count-desc" | "count-asc";

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  isLoading,
  searchable,
  showPills,
  sortable,
  placeholder = "Search…",
  allLabel = "All selected",
}: {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  isLoading?: boolean;
  searchable?: boolean;
  showPills?: boolean;
  sortable?: boolean;
  placeholder?: string;
  allLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("count-desc");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const SORT_CYCLE: SortMode[] = ["alpha-asc", "alpha-desc", "count-desc", "count-asc"];
  const SORT_ICONS: Record<SortMode, typeof ArrowDownAZ> = {
    "alpha-asc": ArrowDownAZ,
    "alpha-desc": ArrowUpAZ,
    "count-desc": ArrowDown01,
    "count-asc": ArrowUp01,
  };
  const SORT_LABELS: Record<SortMode, string> = {
    "alpha-asc": "A → Z",
    "alpha-desc": "Z → A",
    "count-desc": "Most first",
    "count-asc": "Least first",
  };

  function cycleSort() {
    setSortMode((prev) => {
      const idx = SORT_CYCLE.indexOf(prev);
      return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    });
  }

  const filtered = useMemo(() => {
    let result = options;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) => o.label.toLowerCase().includes(q) || o.key.toLowerCase().includes(q),
      );
    }
    if (sortable) {
      result = [...result].sort((a, b) => {
        switch (sortMode) {
          case "alpha-asc": return a.label.localeCompare(b.label);
          case "alpha-desc": return b.label.localeCompare(a.label);
          case "count-desc": return (b.count ?? 0) - (a.count ?? 0);
          case "count-asc": return (a.count ?? 0) - (b.count ?? 0);
        }
      });
    }
    return result;
  }, [options, search, sortable, sortMode]);

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(options.map((o) => o.key)));
  }

  function selectNone() {
    onChange(new Set());
  }

  const interactingRef = useRef(false);

  const handleBlur = (e: React.FocusEvent) => {
    // relatedTarget is the element receiving focus.
    // If it's inside our container, keep dropdown open (e.g. checkbox click).
    // If null or outside, delay-check because Radix Checkbox can momentarily
    // move focus outside before returning it.
    const related = e.relatedTarget as Node | null;
    if (related && containerRef.current?.contains(related)) return;
    requestAnimationFrame(() => {
      if (interactingRef.current) { interactingRef.current = false; return; }
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setSearch("");
      }
    });
  };

  /** Mark as interacting to prevent blur from closing dropdown */
  const keepOpen = () => { interactingRef.current = true; };

  const selectedCount = selected.size;
  const totalCount = options.length;

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="section-heading">
          {label}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-auto px-1 py-0 text-2xs text-muted-foreground hover:text-foreground" onClick={selectAll}>All</Button>
          <span className="text-2xs text-muted-foreground">/</span>
          <Button variant="ghost" size="sm" className="h-auto px-1 py-0 text-2xs text-muted-foreground hover:text-foreground" onClick={selectNone}>None</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Trigger button */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); keepOpen(); }}
            onClick={() => {
              setIsOpen((v) => !v);
              if (searchable && !isOpen) setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="flex items-center w-full gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
          >
            <span className="flex-1 text-left truncate text-muted-foreground">
              {selectedCount === 0
                ? "None selected"
                : selectedCount === totalCount
                  ? allLabel
                  : `${selectedCount} of ${totalCount}`}
            </span>
            <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Selected pills — show excluded items when most are selected, selected items when few are */}
          {showPills && selectedCount > 0 && selectedCount < totalCount && (() => {
            const showExcluded = selectedCount > totalCount / 2;
            const pillItems = showExcluded
              ? options.filter((o) => !selected.has(o.key))
              : options.filter((o) => selected.has(o.key));
            const MAX_PILLS = 8;
            const visible = pillItems.slice(0, MAX_PILLS);
            const overflow = pillItems.length - MAX_PILLS;
            return (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {showExcluded && (
                  <span className="text-2xs text-muted-foreground self-center mr-0.5">Excl:</span>
                )}
                {visible.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => toggle(o.key)}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted/50 pl-1.5 pr-1 py-0.5 text-2xs hover:bg-muted transition-colors group"
                  >
                    {o.icon && <span>{o.icon}</span>}
                    <span className="truncate max-w-[80px]">{o.label}</span>
                    <X className="size-2.5 text-muted-foreground group-hover:text-foreground" />
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="text-2xs text-muted-foreground self-center">+{overflow} more</span>
                )}
              </div>
            );
          })()}

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-lg">
              {/* Search input */}
              {searchable && (
                <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
                  <Search className="size-3.5 text-muted-foreground shrink-0" />
                  <Input
                    ref={inputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={placeholder}
                    className="h-auto border-0 bg-transparent shadow-none text-xs focus-visible:ring-0 placeholder:text-muted-foreground/60"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Sort toggle */}
              {sortable && (() => {
                const SortIcon = SORT_ICONS[sortMode];
                return (
                  <div className="flex items-center justify-between border-b border-border px-2.5 py-1">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); keepOpen(); }}
                      onClick={cycleSort}
                      className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <SortIcon className="size-3" />
                      <span>{SORT_LABELS[sortMode]}</span>
                    </button>
                  </div>
                );
              })()}

              {/* Options list */}
              <div className="max-h-52 overflow-y-auto py-1">
                {filtered.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches for &ldquo;{search}&rdquo;</div>
                )}
                {filtered.map((o) => {
                  const unavailable = o.count != null && o.count === 0;
                  return (
                    <label
                      key={o.key}
                      onMouseDown={(e) => { e.preventDefault(); keepOpen(); }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${unavailable ? "opacity-35" : "hover:bg-muted/50"}`}
                    >
                      <Checkbox
                        checked={selected.has(o.key)}
                        onCheckedChange={() => toggle(o.key)}
                        className="size-3.5"
                      />
                      <span className="text-xs leading-none flex items-center gap-1.5 flex-1">
                        {o.icon && <span>{o.icon}</span>}
                        <span>{o.label}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
