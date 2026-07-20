import React from "react";

interface MobileTabletPageProps {
  onNavigate?: (scope: any, param?: string) => void;
}

export default function MobileTabletPage({ onNavigate }: MobileTabletPageProps) {
  const apps = [
    {
      title: "Magasinier",
      icon: "fa-barcode",
      color: "blue",
      status: "Actif",
      description: "Scan rapide des articles par QR code lors des sorties et retours de stock.",
      features: ["Scan QR code articles", "Vérification BS/BL", "Contrôle retour photos"],
    },
    {
      title: "Accueil tablette",
      icon: "fa-tablet-screen-button",
      color: "purple",
      status: "Actif",
      description: "Agenda interactif pour la gestion des rendez-vous et la création de proformas.",
      features: ["Agenda jour/semaine", "Création proforma", "Recherche client"],
    },
    {
      title: "Livreur",
      icon: "fa-truck",
      color: "green",
      status: "En développement",
      description: "Suivi des livraisons et retours en temps réel pour les chauffeurs.",
      features: ["Navigation livraison", "Confirmation livraison", "Photo retour"],
    },
  ];

  return (
    <div className="p-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          <i className="fa-solid fa-mobile-screen-button text-indigo-600 mr-2" />
          Applications mobiles
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {apps.map((app) => (
          <div
            key={app.title}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-xl bg-${app.color}-100 text-${app.color}-600 flex items-center justify-center text-xl`}
              >
                <i className={`fa-solid ${app.icon}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {app.title}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    app.status === "Actif"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {app.status}
                </span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              {app.description}
            </p>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
              {app.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-green-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`w-full px-4 py-2 bg-${app.color}-600 hover:bg-${app.color}-700 text-white rounded-lg text-sm font-medium transition-colors`}
            >
              <i className="fa-solid fa-arrow-right mr-1" />
              Ouvrir
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
        <i className="fa-solid fa-info-circle text-amber-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Applications en développement
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Les applications mobiles seront disponibles prochainement. Le scan QR code et l'agenda
            tablette sont en phase de test.
          </p>
        </div>
      </div>
    </div>
  );
}
