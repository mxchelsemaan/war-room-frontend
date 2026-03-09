import { useState } from "react";
import { X, Bot, Globe, Shield, Landmark, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CopilotChat } from "./CopilotChat";
import { useCopilot } from "@/hooks/useCopilot";

const TABS = ["Overall", "Military", "Political", "Economic", "Copilot"] as const;
type Tab = (typeof TABS)[number];

type BriefingTab = Exclude<Tab, "Copilot">;
const CONTENT: Record<BriefingTab, { summary: string; bullets: string[] }> = {
  Overall: {
    summary:
      "Lebanon's security and political landscape remained fragile on 6 March 2026, with overlapping pressures across the southern front, the parliament, and an economy still struggling to stabilise.",
    bullets: [
      "At least 14 security incidents recorded across southern Lebanon and the Bekaa Valley overnight.",
      "UN Special Coordinator convened emergency session over humanitarian corridor access dispute.",
      "Surge in diaspora remittances reported following central bank's new transfer mechanism.",
      "Civil society demonstrations outside Grand Serail calling for accelerated cabinet formation.",
      "Three major outlets revised Lebanon near-term stability risk ratings upward.",
    ],
  },
  Military: {
    summary:
      "Activity concentrated along the Blue Line and Arqoub region, with UNIFIL reporting higher-than-average incursions and aerial observation sorties.",
    bullets: [
      "Three IED incidents on secondary roads in Marjayoun district; no casualties confirmed.",
      "UNIFIL protest note issued after unidentified drone overflew headquarters near Naqoura.",
      "Lebanese Armed Forces reinforced two Litani River checkpoints amid smuggling intelligence.",
      "Hezbollah media acknowledged exchange of fire near Kfar Kila.",
      "Iron Dome activated twice in six-hour window over upper Galilee.",
    ],
  },
  Political: {
    summary:
      "Cabinet negotiations entered week fourteen, with the Amal–Hezbollah bloc and Lebanese Forces exchanging competing proposals for interior and finance portfolios.",
    bullets: [
      "Trilateral Aoun–Speaker–PM-designate session described as 'constructive but inconclusive.'",
      "France's special envoy in Beirut for two-day shuttle diplomacy with seven parliamentary blocs.",
      "Opposition Change MPs tabled motion of no-confidence over port reconstruction funds.",
      "Saudi Arabia reiterates normalisation contingent on 'meaningful reform milestones.'",
      "Draft hybrid electoral law cleared first reading in legislative committee.",
    ],
  },
  Economic: {
    summary:
      "The pound held steady on the parallel market, but fuel and food import costs remained elevated amid supply-chain disruptions.",
    bullets: [
      "Lebanese pound at ~89,500 LBP/USD — narrow band for third consecutive session.",
      "World Bank disbursed second tranche of $300 M social protection loan to 180,000 households.",
      "Fuel operators threaten 48-hour strike over $42 M Ministry of Energy arrears.",
      "Beirut Port container throughput up 8% MoM on diverted Red Sea traffic.",
      "Consumer price inflation eased to 74% YoY, down from 79% prior month.",
    ],
  },
};

interface AISummaryCardProps {
  open: boolean;
  onToggle: () => void;
  date?: string;
}

export function AISummaryCard({ open, onToggle, date: _date = "6 March 2026" }: AISummaryCardProps) {
  const [activeTab, setActiveTab] = useState<string>("Copilot");
  const copilot = useCopilot();

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
              <TabsTrigger value="Copilot" className={tabTriggerClass}>
                <Bot className="size-3" />
                Copilot
              </TabsTrigger>
            </TabsList>

            {/* Reports group — pushed to the right */}
            <div className="ml-auto flex items-end gap-1">
              <span className="hidden md:flex items-center pb-2 pr-2 text-2xs font-medium uppercase tracking-widest text-muted-foreground/40 select-none">
                Reports
              </span>
              <TabsList variant="line" className="h-auto p-0 bg-transparent gap-1">
                {TABS.filter((t) => t !== "Copilot").map((tab) => {
                  const Icon = { Overall: Globe, Military: Shield, Political: Landmark, Economic: TrendingUp }[tab];
                  return (
                    <TabsTrigger key={tab} value={tab} className={tabTriggerClass}>
                      <Icon className="size-3" />
                      {tab}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <Button variant="ghost" size="icon-sm" onClick={onToggle} className="ml-2 mb-1" aria-label="Close daily briefing">
              <X className="size-4" />
            </Button>
          </div>

          {/* Content */}
          <TabsContent value="Copilot" className="flex-1 overflow-hidden mt-0">
            <CopilotChat {...copilot} />
          </TabsContent>

          {(["Overall", "Military", "Political", "Economic"] as BriefingTab[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="flex-1 overflow-y-auto px-5 py-5 mt-0">
              <div className="mx-auto max-w-2xl flex flex-col gap-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{CONTENT[tab].summary}</p>
                <ul className="flex flex-col gap-2.5">
                  {CONTENT[tab].bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}

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
