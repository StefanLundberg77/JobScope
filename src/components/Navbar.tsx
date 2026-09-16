"use client";

import React from "react";
import {
  Search,
  FileText,
  Briefcase,
  PlusCircle,
  Settings,
  Sparkles,
} from "lucide-react";

/**
 * Top-level application view tab identifiers.
 */
export type TabType = "search" | "import" | "tracker" | "profile" | "settings";

/**
 * Props for the Navbar component.
 */
interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  savedCount: number;
}

/**
 * Top navigation bar featuring brand identity, responsive view switching tabs,
 * and live badge count of saved applications.
 */
export function Navbar({ currentTab, onSelectTab, savedCount }: NavbarProps) {
  const navItems = [
    {
      id: "search" as TabType,
      label: "Jobbsök",
      icon: Search,
      badge: null,
    },
    {
      id: "import" as TabType,
      label: "Klistra in Annons",
      icon: PlusCircle,
      badge: null,
    },
    {
      id: "tracker" as TabType,
      label: "Ansökningar",
      icon: Briefcase,
      badge: savedCount > 0 ? savedCount : null,
    },
    {
      id: "profile" as TabType,
      label: "Mitt Master-CV",
      icon: FileText,
      badge: null,
    },
    {
      id: "settings" as TabType,
      label: "Inställningar",
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onSelectTab("search")}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              JobScope
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Job Tech & Kravprofilsanalys
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
                {item.badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
