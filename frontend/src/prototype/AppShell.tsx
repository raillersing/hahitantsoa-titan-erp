import React from "react";
import { AppScope } from "../App";

interface AppShellProps {
  activeScope: AppScope;
  onNavigate: (scope: any, param?: string) => void;
  children: React.ReactNode;
}

export default function AppShell({ activeScope, onNavigate, children }: AppShellProps) {
  const scopeHeading: Record<string, string> = {
    dashboard: "Tableau de bord",
    planning: "Planning",
    customers: "Clients & Prospects",
    hahitantsoa: "Hahitantsoa",
    titan: "Titan",
    "commercial-ops": "Opérations Commerciales",
    cashbox: "Caisse",
    caution: "Caution",
    audit: "Audit & Sécurité",
    reports: "Reporting",
    help: "Aide & Onboarding",
    "reservation-new": "Nouvelle réservation",
  };

  const [darkMode, setDarkMode] = React.useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark", "theme-dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark", "theme-dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  return (
    <div className="flex h-screen overflow-hidden app-frame bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 overflow-y-auto sidebar-responsive">
        <div className="p-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-hah-500 to-tit-500 flex items-center justify-center text-white font-extrabold text-lg shadow-lg">H/T</div>
          <div>
            <h1 className="text-white font-extrabold text-sm leading-tight tracking-wide">HAHITANTSOA</h1>
            <p className="text-xs text-slate-400">Titan ERP <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded ml-1">v3.4</span></p>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5">
          {/* ACCUEIL */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Accueil</div>
          <a href="#dashboard" onClick={(e) => { e.preventDefault(); onNavigate("dashboard"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "dashboard" ? "active" : ""}`}>
            <i className="fas fa-chart-pie w-5 text-center"></i><span>Tableau de bord</span>
          </a>
          <a href="#login" onClick={(e) => { e.preventDefault(); onNavigate("login"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium`}>
            <i className="fas fa-lock w-5 text-center"></i><span>Déconnexion</span>
          </a>

          {/* COMMERCIAL */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Commercial</div>
          <a href="#planning" onClick={(e) => { e.preventDefault(); onNavigate("planning"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "planning" ? "active" : ""}`}>
            <i className="fas fa-calendar-days w-5 text-center"></i><span>Planning</span>
          </a>
          <a href="#customers" onClick={(e) => { e.preventDefault(); onNavigate("customers"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "customers" ? "active" : ""}`}>
            <i className="fas fa-users w-5 text-center"></i><span>Clients & Prospects</span>
          </a>

          {/* RESERVATIONS */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Réservations</div>
          <a href="#hahitantsoa" onClick={(e) => { e.preventDefault(); onNavigate("hahitantsoa"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "hahitantsoa" ? "active" : ""}`}>
            <i className="fas fa-building w-5 text-center"></i><span>Hahitantsoa</span>
            <span className="ml-auto bg-hah-900 text-hah-100 nav-badge">Événement</span>
          </a>
          <a href="#titan" onClick={(e) => { e.preventDefault(); onNavigate("titan"); }} className={`sidebar-link titan flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "titan" ? "active" : ""}`}>
            <i className="fas fa-box w-5 text-center"></i><span>Titan</span>
            <span className="ml-auto bg-tit-900 text-tit-100 nav-badge">Matériel</span>
          </a>

          {/* INVENTAIRE & STOCKS */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Inventaire & Stocks</div>
          <a href="#packages" onClick={(e) => { e.preventDefault(); onNavigate("packages"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "packages" ? "active" : ""}`}>
            <i className="fas fa-boxes-stacked w-5 text-center"></i><span>Packages</span>
          </a>
          <a href="#services" onClick={(e) => { e.preventDefault(); onNavigate("services"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "services" ? "active" : ""}`}>
            <i className="fas fa-concierge-bell w-5 text-center"></i><span>Services</span>
          </a>
          <a href="#blacklist-intervenants" onClick={(e) => { e.preventDefault(); onNavigate("blacklist-intervenants"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "blacklist-intervenants" ? "active" : ""}`}>
            <i className="fas fa-ban w-5 text-center"></i><span>Liste noire</span>
          </a>

          {/* FINANCE & RH */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Finance & Opérations</div>
          <a href="#commercial-ops" onClick={(e) => { e.preventDefault(); onNavigate("commercial-ops"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "commercial-ops" ? "active" : ""}`}>
            <i className="fas fa-file-invoice-dollar w-5 text-center"></i><span>Opérations</span>
          </a>
          <a href="#cashbox" onClick={(e) => { e.preventDefault(); onNavigate("cashbox"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "cashbox" ? "active" : ""}`}>
            <i className="fas fa-cash-register w-5 text-center"></i><span>Caisse</span>
          </a>
          <a href="#caution" onClick={(e) => { e.preventDefault(); onNavigate("caution"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "caution" ? "active" : ""}`}>
            <i className="fas fa-undo w-5 text-center"></i><span>Caution</span>
          </a>

          {/* PILOTAGE */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Pilotage</div>
          <a href="#reports" onClick={(e) => { e.preventDefault(); onNavigate("reports"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "reports" ? "active" : ""}`}>
            <i className="fas fa-chart-bar w-5 text-center"></i><span>Reporting</span>
          </a>
          <a href="#audit" onClick={(e) => { e.preventDefault(); onNavigate("audit"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "audit" ? "active" : ""}`}>
            <i className="fas fa-shield-alt w-5 text-center"></i><span>Audit & Sécurité</span>
          </a>
          <a href="#help" onClick={(e) => { e.preventDefault(); onNavigate("help"); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "help" ? "active" : ""}`}>
            <i className="fas fa-question-circle w-5 text-center"></i><span>Aide & Onboarding</span>
          </a>
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="flex items-center gap-3">
            <img src="https://ui-avatars.com/api/?name=G%C3%A9rant+ERP&background=0d9488&color=fff" className="w-9 h-9 rounded-full" alt="avatar" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Jean R.</p>
              <p className="text-xs text-slate-500 truncate">Gérant · En ligne</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden main-shell">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 topbar-responsive">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="text-xl font-extrabold text-slate-800 truncate">{scopeHeading[activeScope] || "Tableau de bord"}</h2>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <button onClick={() => setDarkMode(!darkMode)} className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition focus-ring" title="Changer le thème">
              {darkMode ? <i className="fas fa-sun text-lg"></i> : <i className="fas fa-moon text-lg"></i>}
            </button>
            <button className="relative p-2 text-slate-500 hover:text-slate-700 transition focus-ring" title="Notifications">
              <i className="fas fa-bell text-lg"></i><span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            {activeScope === 'dashboard' ? (
              <button className="px-3 py-1.5 rounded-full bg-hah-50 text-hah-600 font-medium text-sm hover:bg-hah-100 transition focus-ring" onClick={() => onNavigate("reservation-new")}>
                <i className="fas fa-plus-circle mr-1"></i> Nouvelle réservation
              </button>
            ) : (
              <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-400 font-medium text-sm cursor-not-allowed hidden md:inline-flex" title="Disponible depuis le tableau de bord">
                <i className="fas fa-plus-circle mr-1"></i> Nouvelle réservation
              </button>
            )}
            <button className="px-3 py-1.5 rounded-full bg-tit-50 text-tit-600 font-medium text-sm hover:bg-tit-100 transition focus-ring hidden md:inline-flex" onClick={() => onNavigate("planning")}>
              <i className="fas fa-calendar-alt mr-1"></i> Planning
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
