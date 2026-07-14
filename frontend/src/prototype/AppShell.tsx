import React from "react";
import type { AppScope } from "../App";
import BrandIdentity, { type BrandScope } from "./BrandIdentity";
import { mockClients } from "./mockData";

interface AppShellProps {
  activeScope: AppScope;
  activeParam?: string;
  onNavigate: (scope: any, param?: string) => void;
  returnContext?: { from: string; param?: string } | null;
  children: React.ReactNode;
}

type StaticAppScope = Exclude<AppScope, "reservation-new" | "reservation-detail">;

const brandScopeByAppScope = {
  dashboard: "ergon",
  planning: "ergon",
  customers: "ergon",
  hahitantsoa: "hahitantsoa",
  titan: "titan",
  "commercial-ops": "ergon",
  cashbox: "ergon",
  caution: "titan",
  audit: "ergon",
  reports: "ergon",
  help: "ergon",
  reservations: "ergon",
  customer: "ergon",
  login: "ergon",
  packages: "hahitantsoa",
  services: "hahitantsoa",
  "blacklist-intervenants": "hahitantsoa",
  inventory: "titan",
  "inventory-management": "titan",
  "inventory-item": "titan",
  "stock-movements": "titan",
  "stock-preparation": "titan",
  "logistics-dispatch": "titan",
  "logistics-returns": "titan",
  "breakage-loss": "titan",
  venues: "hahitantsoa",
  "agenda-visitors": "hahitantsoa",
  "import-excel": "titan",
  documents: "ergon",
  "hr-payroll": "ergon",
  purchasing: "ergon",
  notifications: "ergon",
  admin: "ergon",
  "mobile-tablet": "ergon",
} satisfies Record<StaticAppScope, BrandScope>;

export function resolveBrandScope(activeScope: AppScope, activeParam?: string): BrandScope {
  if (activeScope === "reservation-detail") {
    if (activeParam?.startsWith("LOC-")) return "titan";
    if (activeParam?.startsWith("RES-")) return "hahitantsoa";
    return "ergon";
  }

  if (activeScope === "reservation-new") {
    if (
      activeParam === "titan" ||
      activeParam?.startsWith("catalog-prep|") ||
      activeParam?.startsWith("prospect-proforma-t")
    ) return "titan";
    if (activeParam === "hahitantsoa" || activeParam?.startsWith("prospect-proforma-h")) {
      return "hahitantsoa";
    }
    return "ergon";
  }

  return brandScopeByAppScope[activeScope];
}

export default function AppShell({ activeScope, activeParam, onNavigate, returnContext, children }: AppShellProps) {
  const activeBrand = resolveBrandScope(activeScope, activeParam);
  const scopeHeading: Record<string, string> = {
    dashboard: "Tableau de bord",
    planning: "Planning",
    customers: "Clients & Prospects",
    hahitantsoa: "Hahitantsoa",
    titan: "Titan",
    reservations: "Toutes les réservations",
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

  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark", "theme-dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark", "theme-dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  let pageTitle = scopeHeading[activeScope] || "Tableau de bord";
  let breadcrumbs: Array<{label: string, scope: string, param: string | undefined}> = [
    { label: "Tableau de bord", scope: "dashboard", param: undefined }
  ];

  if (
    [
      "inventory-management", "inventory-item", "stock-movements", "stock-preparation",
      "logistics-dispatch", "logistics-returns", "breakage-loss", "blacklist-intervenants"
    ].includes(activeScope)
  ) {
    breadcrumbs = [
      { label: "Inventaire & Logistique", scope: "inventory-management", param: undefined }
    ];
    
    if (activeScope === "inventory-management") {
      pageTitle = "Inventaire";
      breadcrumbs.push({ label: "Inventaire", scope: "inventory-management", param: undefined });
    } else if (activeScope === "inventory-item") {
      pageTitle = "Fiche article";
      if (returnContext?.from === 'inventory') {
        breadcrumbs = [
          { label: "Offres", scope: "inventory", param: undefined },
          { label: "Catalogue", scope: "inventory", param: undefined },
          { label: "Fiche article", scope: "inventory-item", param: activeParam }
        ];
      } else {
        breadcrumbs.push({ label: "Fiche article", scope: "inventory-item", param: activeParam });
      }
    } else if (activeScope === "stock-movements") {
      pageTitle = "Mouvements de stock";
      breadcrumbs.push({ label: "Mouvements", scope: "stock-movements", param: undefined });
    } else if (activeScope === "stock-preparation") {
      pageTitle = "Préparation";
      breadcrumbs.push({ label: "Préparation", scope: "stock-preparation", param: undefined });
    } else if (activeScope === "logistics-dispatch") {
      pageTitle = "Sortie & Livraison";
      breadcrumbs.push({ label: "Sortie / Livraison", scope: "logistics-dispatch", param: undefined });
    } else if (activeScope === "logistics-returns") {
      pageTitle = "Retour & Restitution";
      breadcrumbs.push({ label: "Retour / Restit.", scope: "logistics-returns", param: undefined });
    } else if (activeScope === "breakage-loss") {
      pageTitle = "Casse & Perte";
      breadcrumbs.push({ label: "Casse & Perte", scope: "breakage-loss", param: undefined });
    } else if (activeScope === "blacklist-intervenants") {
      pageTitle = "Liste noire";
      breadcrumbs.push({ label: "Liste noire", scope: "blacklist-intervenants", param: undefined });
    }
  } else if (
    [
      "inventory", "packages", "services", "venues"
    ].includes(activeScope)
  ) {
    breadcrumbs = [
      { label: "Offres", scope: "inventory", param: undefined }
    ];

    if (activeScope === "inventory") {
      pageTitle = "Catalogue";
      breadcrumbs.push({ label: "Catalogue", scope: "inventory", param: undefined });
    } else if (activeScope === "packages") {
      pageTitle = "Packs";
      breadcrumbs.push({ label: "Packs", scope: "packages", param: undefined });
    } else if (activeScope === "services") {
      pageTitle = "Services";
      breadcrumbs.push({ label: "Services", scope: "services", param: undefined });
    } else if (activeScope === "venues") {
      pageTitle = "Locaux & Dépôts";
      breadcrumbs.push({ label: "Locaux & Dépôts", scope: "venues", param: undefined });
    }
  } else if (activeScope === "customer") {
    const client = mockClients.find(c => c.id === activeParam);
    const isProspect = client?.status === "Prospect" || client?.notes?.includes("[PROSPECT]");
    pageTitle = isProspect ? "Fiche prospect" : "Fiche client";
    breadcrumbs = [
      { label: "Clients & Prospects", scope: "customers", param: undefined },
      { label: client ? client.name : (activeParam || pageTitle), scope: "customer", param: activeParam }
    ];
  } else if (activeScope === "customers") {
    pageTitle = "Clients & Prospects";
    breadcrumbs = [
      { label: "Clients & Prospects", scope: "customers", param: undefined }
    ];
  } else if (activeScope === "reservations") {
    pageTitle = "Toutes les réservations";
    breadcrumbs = [
      { label: "Réservations", scope: "reservations", param: undefined },
      { label: "Toutes les réservations", scope: "reservations", param: undefined }
    ];
  } else if (activeScope === "reservation-new") {
    pageTitle = "Nouvelle Réservation";
    breadcrumbs = [];
    if (activeParam && (activeParam.startsWith('CUST-') || activeParam.startsWith('PROS-'))) {
      const client = mockClients.find(c => c.id === activeParam);
      breadcrumbs.push({ label: "Clients & Prospects", scope: "customers", param: undefined });
      if (client) {
        breadcrumbs.push({ label: client.name, scope: "customer", param: activeParam });
      } else {
        breadcrumbs.push({ label: activeParam, scope: "customer", param: activeParam });
      }
      breadcrumbs.push({ label: "Nouvelle réservation", scope: "reservation-new", param: activeParam });
    } else {
      breadcrumbs = [
        { label: "Réservations", scope: "reservations", param: undefined },
        { label: "Nouvelle Réservation", scope: "reservation-new", param: activeParam }
      ];
    }
  } else if (activeScope === "reservation-detail") {
    const isTitan = activeParam && activeParam.startsWith("LOC-");
    const parentLabel = isTitan ? "Titan" : "Hahitantsoa";
    const parentScope = isTitan ? "titan" : "hahitantsoa";
    pageTitle = activeParam || "Détail réservation";
    breadcrumbs = [
      { label: "Réservations", scope: parentScope, param: undefined },
      { label: parentLabel, scope: parentScope, param: undefined },
      { label: pageTitle, scope: "reservation-detail", param: activeParam }
    ];
  } else if (activeScope === "help") {
    pageTitle = "Aide & Onboarding";
    breadcrumbs = [
      { label: "Pilotage", scope: "dashboard", param: undefined },
      { label: "Aide & Onboarding", scope: "help", param: undefined }
    ];
  } else if (activeScope !== "dashboard") {
    pageTitle = scopeHeading[activeScope] || "Page";
    if (pageTitle === "Page") {
      pageTitle = activeScope.charAt(0).toUpperCase() + activeScope.slice(1);
    }
    breadcrumbs.push({ label: pageTitle, scope: activeScope, param: activeParam });
  }

  return (
    <div className="flex h-screen overflow-y-hidden app-frame bg-slate-50 text-slate-800 font-sans">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 overflow-y-auto transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 flex items-center gap-3 border-b border-slate-800">
          <BrandIdentity brand="ergon" compact className="sidebar-brand" />
          <div>
            <h1 className="text-white font-extrabold text-sm leading-tight tracking-wide">ERGON ERP</h1>
            <p className="text-xs text-slate-400">Hahitantsoa · Titan Rental <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded ml-1">v3.4</span></p>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5">
          {/* ACCUEIL */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Accueil</div>
          <a href="#dashboard" onClick={(e) => { e.preventDefault(); onNavigate("dashboard"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "dashboard" ? "active" : ""}`}>
            <i className="fas fa-chart-pie w-5 text-center"></i><span>Tableau de bord</span>
          </a>

          {/* COMMERCIAL */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Commercial</div>
          <a href="#planning" onClick={(e) => { e.preventDefault(); onNavigate("planning"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "planning" ? "active" : ""}`}>
            <i className="fas fa-calendar-days w-5 text-center"></i><span>Planning</span>
          </a>
          <a href="#customers" onClick={(e) => { e.preventDefault(); onNavigate("customers"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "customers" ? "active" : ""}`}>
            <i className="fas fa-users w-5 text-center"></i><span>Clients & Prospects</span>
          </a>
          <a href="#agenda-visitors" onClick={(e) => { e.preventDefault(); onNavigate("agenda-visitors"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "agenda-visitors" ? "active" : ""}`}>
            <i className="fas fa-user-clock w-5 text-center"></i><span>Agenda visiteurs</span>
          </a>

          {/* RÉSERVATIONS */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Réservations</div>
          <a href="#reservations" onClick={(e) => { e.preventDefault(); onNavigate("reservations"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "reservations" ? "active" : ""}`}>
            <i className="fas fa-list w-5 text-center"></i><span>Toutes les réservations</span>
          </a>
          <a href="#hahitantsoa" onClick={(e) => { e.preventDefault(); onNavigate("hahitantsoa"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "hahitantsoa" ? "active" : ""}`}>
            <i className="fas fa-building w-5 text-center"></i><span>Hahitantsoa</span>
            <span className="ml-auto bg-hah-900 text-hah-100 nav-badge">Événement</span>
          </a>
          <a href="#titan" onClick={(e) => { e.preventDefault(); onNavigate("titan"); setIsMobileMenuOpen(false); }} className={`sidebar-link titan flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "titan" ? "active" : ""}`}>
            <i className="fas fa-box w-5 text-center"></i><span>Titan</span>
            <span className="ml-auto bg-tit-900 text-tit-100 nav-badge">Matériel</span>
          </a>

          {/* OFFRES */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Offres</div>
          <a href="#inventory" onClick={(e) => { e.preventDefault(); onNavigate("inventory"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "inventory" ? "active" : ""}`}>
            <i className="fas fa-box-open w-5 text-center"></i><span>Catalogue</span>
          </a>
          <a href="#packages" onClick={(e) => { e.preventDefault(); onNavigate("packages"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "packages" ? "active" : ""}`}>
            <i className="fas fa-boxes-stacked w-5 text-center"></i><span>Packs</span>
          </a>
          <a href="#services" onClick={(e) => { e.preventDefault(); onNavigate("services"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "services" ? "active" : ""}`}>
            <i className="fas fa-concierge-bell w-5 text-center"></i><span>Services</span>
          </a>
          <a href="#venues" onClick={(e) => { e.preventDefault(); onNavigate("venues"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "venues" ? "active" : ""}`}>
            <i className="fas fa-map-location-dot w-5 text-center"></i><span>Locaux & Dépôts</span>
          </a>

          {/* INVENTAIRE & LOGISTIQUE */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Inventaire & Logistique</div>
          <a href="#inventory-management" onClick={(e) => { e.preventDefault(); onNavigate("inventory-management"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "inventory-management" ? "active" : ""}`}>
            <i className="fas fa-boxes w-5 text-center"></i><span>Inventaire</span>
          </a>
          <a href="#stock-movements" onClick={(e) => { e.preventDefault(); onNavigate("stock-movements"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "stock-movements" ? "active" : ""}`}>
            <i className="fas fa-exchange-alt w-5 text-center"></i><span>Mouvements</span>
          </a>
          <a href="#stock-preparation" onClick={(e) => { e.preventDefault(); onNavigate("stock-preparation"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "stock-preparation" ? "active" : ""}`}>
            <i className="fas fa-clipboard-list w-5 text-center"></i><span>Préparation</span>
          </a>
          <a href="#logistics-dispatch" onClick={(e) => { e.preventDefault(); onNavigate("logistics-dispatch"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "logistics-dispatch" ? "active" : ""}`}>
            <i className="fas fa-truck-loading w-5 text-center"></i><span>Sortie / Livraison</span>
          </a>
          <a href="#logistics-returns" onClick={(e) => { e.preventDefault(); onNavigate("logistics-returns"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "logistics-returns" ? "active" : ""}`}>
            <i className="fas fa-undo-alt w-5 text-center"></i><span>Retour / Restitution</span>
          </a>
          <a href="#breakage-loss" onClick={(e) => { e.preventDefault(); onNavigate("breakage-loss"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "breakage-loss" ? "active" : ""}`}>
            <i className="fas fa-heart-broken w-5 text-center"></i><span>Casse & Perte</span>
          </a>
          <a href="#blacklist-intervenants" onClick={(e) => { e.preventDefault(); onNavigate("blacklist-intervenants"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "blacklist-intervenants" ? "active" : ""}`}>
            <i className="fas fa-ban w-5 text-center"></i><span>Liste noire</span>
          </a>
          <a href="#import-excel" onClick={(e) => { e.preventDefault(); onNavigate("import-excel"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "import-excel" ? "active" : ""}`}>
            <i className="fas fa-file-excel w-5 text-center"></i><span>Import Excel</span>
          </a>

          {/* FINANCE & OPÉRATIONS */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Finance & Opérations</div>
          <a href="#commercial-ops" onClick={(e) => { e.preventDefault(); onNavigate("commercial-ops"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "commercial-ops" ? "active" : ""}`}>
            <i className="fas fa-file-invoice-dollar w-5 text-center"></i><span>Facturation & Paiements</span>
          </a>
          <a href="#documents" onClick={(e) => { e.preventDefault(); onNavigate("documents"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "documents" ? "active" : ""}`}>
            <i className="fas fa-file-alt w-5 text-center"></i><span>Documents & Modèles</span>
          </a>
          <a href="#cashbox" onClick={(e) => { e.preventDefault(); onNavigate("cashbox"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "cashbox" ? "active" : ""}`}>
            <i className="fas fa-cash-register w-5 text-center"></i><span>Caisse</span>
          </a>
          <a href="#caution" onClick={(e) => { e.preventDefault(); onNavigate("caution"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "caution" ? "active" : ""}`}>
            <i className="fas fa-undo w-5 text-center"></i><span>Caution</span>
          </a>
          <a href="#hr-payroll" onClick={(e) => { e.preventDefault(); onNavigate("hr-payroll"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "hr-payroll" ? "active" : ""}`}>
            <i className="fas fa-user-tie w-5 text-center"></i><span>Personnel & Paie</span>
          </a>
          <a href="#purchasing" onClick={(e) => { e.preventDefault(); onNavigate("purchasing"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "purchasing" ? "active" : ""}`}>
            <i className="fas fa-shopping-cart w-5 text-center"></i><span>Achats & Fournisseurs</span>
          </a>

          {/* PILOTAGE */}
          <div className="px-6 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Pilotage</div>
          <a href="#notifications" onClick={(e) => { e.preventDefault(); onNavigate("notifications"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "notifications" ? "active" : ""}`}>
            <i className="fas fa-bell w-5 text-center"></i><span>Notifications</span>
          </a>
          <a href="#reports" onClick={(e) => { e.preventDefault(); onNavigate("reports"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "reports" ? "active" : ""}`}>
            <i className="fas fa-chart-bar w-5 text-center"></i><span>Reporting</span>
          </a>
          <a href="#admin" onClick={(e) => { e.preventDefault(); onNavigate("admin"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "admin" ? "active" : ""}`}>
            <i className="fas fa-cogs w-5 text-center"></i><span>Administration</span>
          </a>
          <a href="#audit" onClick={(e) => { e.preventDefault(); onNavigate("audit"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "audit" ? "active" : ""}`}>
            <i className="fas fa-shield-alt w-5 text-center"></i><span>Audit & Sécurité</span>
          </a>
          <a href="#mobile-tablet" onClick={(e) => { e.preventDefault(); onNavigate("mobile-tablet"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "mobile-tablet" ? "active" : ""}`}>
            <i className="fas fa-mobile-alt w-5 text-center"></i><span>Mobile & Tablette</span>
          </a>
          <a href="#help" onClick={(e) => { e.preventDefault(); onNavigate("help"); setIsMobileMenuOpen(false); }} className={`sidebar-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium ${activeScope === "help" ? "active" : ""}`}>
            <i className="fas fa-question-circle w-5 text-center"></i><span>Aide & Onboarding</span>
          </a>
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto relative" ref={userMenuRef}>
          <button 
            type="button"
            aria-label="Menu utilisateur"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 w-full text-left focus:outline-none focus:ring-2 focus:ring-hah-500 rounded p-1 hover:bg-slate-800 transition-colors"
          >
            <span
              role="img"
              aria-label="Avatar Gérant ERP"
              className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold"
            >
              GE
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Jean R.</p>
              <p className="text-xs text-slate-500 truncate">Gérant · En ligne</p>
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute bottom-full mb-2 left-4 right-4 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
              <a href="#profile" onClick={(e) => { e.preventDefault(); setIsUserMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Profil utilisateur</a>
              <a href="#preferences" onClick={(e) => { e.preventDefault(); setIsUserMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Préférences</a>
              <a href="#support" onClick={(e) => { e.preventDefault(); setIsUserMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Aide / support</a>
              <div className="my-1 border-t border-slate-700"></div>
              <a href="#login" onClick={(e) => { e.preventDefault(); setIsUserMenuOpen(false); onNavigate("login"); }} className="block px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors">Déconnexion</a>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-hidden main-shell dark:bg-slate-900">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 topbar-responsive">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <i className="fas fa-bars text-xl"></i>
            </button>
            <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <span 
                    className={`transition ${idx === breadcrumbs.length - 1 ? "text-slate-800 dark:text-slate-200 font-semibold" : "cursor-pointer hover:text-slate-800 dark:hover:text-slate-200"}`} 
                    onClick={() => idx < breadcrumbs.length - 1 && onNavigate(crumb.scope, crumb.param)}
                    aria-current={idx === breadcrumbs.length - 1 ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                  {idx < breadcrumbs.length - 1 && <i className="fas fa-chevron-right text-[10px] text-slate-400 dark:text-slate-600"></i>}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="min-w-0 text-xl font-extrabold text-slate-800 dark:text-white truncate">{pageTitle}</h2>
              <BrandIdentity brand={activeBrand} compact className="topbar-brand-scope" />
            </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition focus-ring" title="Changer le thème">
              {darkMode ? <i className="fas fa-sun text-lg"></i> : <i className="fas fa-moon text-lg"></i>}
            </button>
            <button className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition focus-ring" title="Notifications">
              <i className="fas fa-bell text-lg"></i><span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            {activeScope === 'dashboard' ? (
              <button className="px-3 py-1.5 rounded-full bg-hah-50 dark:bg-hah-900/30 text-hah-600 dark:text-hah-400 font-medium text-sm hover:bg-hah-100 dark:hover:bg-hah-900/50 transition focus-ring" onClick={() => onNavigate("reservation-new")}>
                <i className="fas fa-plus-circle mr-1"></i> Nouvelle réservation
              </button>
            ) : (
              <button className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-medium text-sm cursor-not-allowed hidden lg:inline-flex" title="Disponible depuis le tableau de bord">
                <i className="fas fa-plus-circle mr-1"></i> Nouvelle réservation
              </button>
            )}
            <button className="px-3 py-1.5 rounded-full bg-tit-50 dark:bg-tit-900/30 text-tit-600 dark:text-tit-400 font-medium text-sm hover:bg-tit-100 dark:hover:bg-tit-900/50 transition focus-ring hidden lg:inline-flex" onClick={() => onNavigate("planning")}>
              <i className="fas fa-calendar-alt mr-1"></i> Planning
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-900 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
