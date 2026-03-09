import { useIsMobile } from "@/hooks/useIsMobile";

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
  width?: string;
  children: React.ReactNode;
  /** Content to show when collapsed (desktop only) */
  collapsedContent?: React.ReactNode;
  /** Header content rendered inside the panel */
  header: React.ReactNode;
}

export function SidePanel({
  open, onOpenChange, side, width = "w-72",
  children, collapsedContent, header,
}: SidePanelProps) {
  const isMobile = useIsMobile();

  const borderClass = side === "left" ? "border-r" : "border-l";
  const mobileTranslate = side === "left"
    ? (open ? "translate-x-0" : "-translate-x-full")
    : (open ? "translate-x-0" : "translate-x-full");
  const mobilePosition = side === "left" ? "left-0" : "right-0";

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-[79] bg-black/60 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => onOpenChange(false)}
        />
      )}
      <aside
        className={
          isMobile
            ? `fixed ${mobilePosition} inset-y-0 z-[80] flex flex-col ${borderClass} border-border bg-card ${width} transition-transform duration-300 ease-out ${mobileTranslate}`
            : `relative z-30 flex h-full shrink-0 flex-col ${borderClass} border-border bg-card transition-all duration-200 ${open ? width : "w-14 cursor-pointer"}`
        }
        onClick={!open && !isMobile ? () => onOpenChange(true) : undefined}
      >
        {header}

        {/* Collapsed: vertical label — desktop only */}
        {!open && !isMobile && collapsedContent}

        {/* Expanded content */}
        {(open || isMobile) && children}
      </aside>
    </>
  );
}
