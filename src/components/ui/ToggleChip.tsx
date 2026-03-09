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
    <button
      onClick={onClick}
      title={title}
      className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors ${
        active ? activeClass : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
