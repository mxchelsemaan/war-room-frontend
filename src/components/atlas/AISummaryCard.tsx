import { useState } from "react";
import { X, Bot, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface AISummaryCardProps {
  open: boolean;
  onToggle: () => void;
  date?: string;
}

export function AISummaryCard({ open, onToggle, date: _date = "6 March 2026" }: AISummaryCardProps) {
  const [activeTab, setActiveTab] = useState<string>("Overall");

  const tabTriggerClass = "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t rounded-b-none border -mb-px transition-colors border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-border data-[state=active]:border-b-card data-[state=active]:bg-card/90 data-[state=active]:text-foreground";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onToggle}
        className={`absolute inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        className={`absolute inset-2 md:top-14 md:bottom-4 md:left-[136px] md:right-[136px] z-[60] flex flex-col glass-panel overflow-hidden transition-all duration-300 ease-out ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 gap-0">
          {/* Tabs as folders */}
          <div className="flex items-end border-b border-border px-4 pt-3 gap-1 overflow-x-auto">
            <TabsList variant="line" className="h-auto p-0 bg-transparent gap-1">
              <TabsTrigger value="Overall" className={tabTriggerClass}>
                <Globe className="size-3" />
                Overall
              </TabsTrigger>
              <TabsTrigger value="Copilot" className={tabTriggerClass}>
                <Bot className="size-3" />
                Copilot
              </TabsTrigger>
            </TabsList>

            <Button variant="ghost" size="icon-sm" onClick={onToggle} className="ml-auto mb-1" aria-label="Close daily briefing">
              <X className="size-4" />
            </Button>
          </div>

          {/* Overall tab */}
          <TabsContent value="Overall" className="flex-1 overflow-y-auto px-5 py-5 mt-0">
            <div className="mx-auto max-w-2xl flex flex-col gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <ul className="flex flex-col gap-2.5">
                {[
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
                  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
                  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
                  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
                ].map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>

          {/* Copilot tab — coming soon */}
          <TabsContent value="Copilot" className="flex-1 overflow-hidden mt-0">
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <Bot className="size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground/50">Coming very soon!</p>
              <p className="text-xs text-muted-foreground/30 max-w-xs">
                Copilot chat will let you ask questions about the situation and get AI-powered analysis.
              </p>
            </div>
          </TabsContent>

          {/* Disclaimer */}
          <div className="shrink-0 border-t border-border px-5 py-2.5">
            <p className="text-2xs leading-relaxed text-destructive/80 max-w-2xl mx-auto">
              ⚠ AI-generated. May contain inaccuracies — verify against primary sources before operational use.
            </p>
          </div>
        </Tabs>
      </div>
    </>
  );
}
