"use client";

import { useState } from "react";
import { Sparkles, ChevronUp } from "lucide-react";

const TABS = ["Overall", "Military", "Political", "Economic"] as const;
type Tab = (typeof TABS)[number];

const CONTENT: Record<Tab, { summary: string; bullets: string[] }> = {
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
  date?: string;
}

export function AISummaryCard({ date = "6 March 2026" }: AISummaryCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Overall");
  const [collapsed, setCollapsed] = useState(false);

  const { summary, bullets } = CONTENT[activeTab];

  return (
    <div className="absolute top-4 right-4 z-[1000] flex w-72 flex-col rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="h-3 w-3 shrink-0 text-indigo-500" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              AI Briefing · {date}
            </p>
            <p className="text-xs font-semibold leading-snug text-foreground mt-0.5">
              Lebanon Situation Report
            </p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          <ChevronUp
            className={`h-3 w-3 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex border-t border-border">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 text-[10px] font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex flex-col gap-2 px-3 py-2.5 max-h-56 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{summary}</p>
            <ul className="flex flex-col gap-1">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground leading-relaxed">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="border-t border-border px-3 py-2">
            <p className="text-[10px] leading-relaxed text-red-400/80">
              ⚠ AI-generated. May contain inaccuracies — verify against primary sources before operational use.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
