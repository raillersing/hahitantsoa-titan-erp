import React, { useState, useEffect, useCallback } from "react";
import {
  getMaterialPackages,
  createMaterialPackage,
  updateMaterialPackage,
  deleteMaterialPackage,
  getInventoryItems,
} from "../api";
import type {
  MaterialPackage,
  MaterialPackageLine,
  InventoryItem,
} from "../types";

export default function PackageBuilderPage() {
  const [packages, setPackages] = useState<MaterialPackage[]>([]);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "details">("details");
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingDraft, setEditingDraft] = useState<{
    name: string;
    description: string;
    price: number;
    is_active: boolean;
    lines: Array<{ inventory_item: string; quantity: number }>;
  } | null>(null);

  const showToast = (
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    let cancelled = false;
    const controller = new AbortController();
    try {
      const [pkgData, catData] = await Promise.all([
        getMaterialPackages(controller.signal),
        getInventoryItems(controller.signal),
      ]);
      if (!cancelled) {
        setPackages(Array.isArray(pkgData) ? pkgData : []);
        setCatalog(Array.isArray(catData) ? catData : []);
      }
    } catch {
      if (!cancelled) setError("Erreur lors du chargement des packages.");
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const cleanup = loadData();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, [loadData]);

  const selectedPkg = packages.find((p) => p.id === selectedPkgId);

  // Build the editing draft when selecting a package
  useEffect(() => {
    if (selectedPkg) {
      setEditingDraft({
        name: selectedPkg.name,
        description: selectedPkg.description,
        price: selectedPkg.price,
        is_active: selectedPkg.is_active,
        lines: selectedPkg.lines.map((l) => ({
          inventory_item: l.inventory_item,
          quantity: l.quantity,
        })),
      });
    } else {
      setEditingDraft(null);
    }
  }, [selectedPkg]);

  const handleAddPackage = async () => {
    try {
      const created = await createMaterialPackage({
        name: "Nouveau Package",
        description: "Description du package",
        price: 0,
        is_active: true,
        lines: [],
      });
      setPackages((prev) => [...prev, created]);
      setSelectedPkgId(created.id);
      setViewMode("details");
      showToast("Nouveau pack créé", "success");
    } catch {
      showToast("Erreur lors de la création du pack", "error");
    }
  };

  const handleSaveDraft = async () => {
    if (!editingDraft || !selectedPkgId) return;
    setSaving(true);
    try {
      const updated = await updateMaterialPackage(selectedPkgId, {
        name: editingDraft.name,
        description: editingDraft.description,
        price: editingDraft.price,
        is_active: editingDraft.is_active,
        lines: editingDraft.lines,
      });
      setPackages((prev) => prev.map((p) => (p.id === selectedPkgId ? updated : p)));
      showToast("Pack enregistré", "success");
    } catch {
      showToast("Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDisablePackage = async (id: string) => {
    try {
      await updateMaterialPackage(id, { is_active: false });
      setPackages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: false } : p)),
      );
      showToast("Pack désactivé", "warning");
    } catch {
      showToast("Erreur lors de la désactivation", "error");
    }
  };

  const handleDeletePackage = async (id: string) => {
    try {
      await deleteMaterialPackage(id);
      setPackages((prev) => prev.filter((p) => p.id !== id));
      setSelectedPkgId(null);
      showToast("Pack supprimé", "error");
    } catch {
      showToast("Erreur lors de la suppression", "error");
    }
  };

  const toggleArticle = (articleId: string) => {
    if (!editingDraft) return;
    const exists = editingDraft.lines.find(
      (l) => l.inventory_item === articleId,
    );
    if (exists) {
      setEditingDraft({
        ...editingDraft,
        lines: editingDraft.lines.filter(
          (l) => l.inventory_item !== articleId,
        ),
      });
    } else {
      setEditingDraft({
        ...editingDraft,
        lines: [...editingDraft.lines, { inventory_item: articleId, quantity: 1 }],
      });
    }
  };

  const updateArticleQty = (articleId: string, rawQty: number) => {
    if (!editingDraft) return;
    let qty = rawQty;
    if (Number.isNaN(qty)) qty = 0;
    if (qty < 0) qty = 0;

    if (qty <= 0) {
      toggleArticle(articleId);
    } else {
      setEditingDraft({
        ...editingDraft,
        lines: editingDraft.lines.map((l) =>
          l.inventory_item === articleId ? { ...l, quantity: qty } : l,
        ),
      });
    }
  };

  const getEstimatedTotal = () => {
    if (!editingDraft) return 0;
    return editingDraft.lines.reduce((acc, line) => {
      const catItem = catalog.find((c) => c.id === line.inventory_item);
      // Catalog items don't have price from API, so estimate is 0
      // This can be extended when inventory items carry pricing info
      return acc;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-500">Chargement des packages…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${
            toast.type === "error"
              ? "bg-rose-600"
              : toast.type === "warning"
                ? "bg-amber-500"
                : "bg-indigo-600"
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="flex justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Gestion des Packs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Offres commerciales composées (Matériel & Services)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 ${
                viewMode === "grid"
                  ? "bg-white shadow text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <i className="fas fa-th-large"></i> Grille
            </button>
            <button
              onClick={() => setViewMode("details")}
              className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 ${
                viewMode === "details"
                  ? "bg-white shadow text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <i className="fas fa-list"></i> Détails
            </button>
          </div>
          <button
            onClick={handleAddPackage}
            className="px-4 py-2 bg-tit-600 hover:bg-tit-700 text-white rounded-lg text-sm font-bold transition-colors shadow whitespace-nowrap"
          >
            <i className="fa-solid fa-plus mr-2"></i>Nouveau Pack
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {packages.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSelectedPkgId(p.id);
                setViewMode("details");
              }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all flex flex-col cursor-pointer group hover:ring-2 hover:ring-indigo-500"
              aria-label={`Ouvrir le détail du Pack ${p.name}`}
              role="button"
            >
              <div className="h-48 bg-slate-100 dark:bg-slate-900 relative">
                <div className="w-full h-full flex items-center justify-center">
                  <i className="fa-solid fa-box text-slate-300 text-5xl"></i>
                </div>
                <div className="absolute top-3 right-3 flex gap-1">
                  {p.is_active ? (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase">
                      Actif
                    </span>
                  ) : (
                    <span className="bg-slate-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase">
                      Inactif
                    </span>
                  )}
                </div>
                <div className="absolute top-3 left-3">
                  <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                    Offre / Matériel & Services
                  </span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">
                  {p.name}
                </h3>
                <div className="text-xl font-extrabold text-hah-600 mb-3">
                  {Number(p.price).toLocaleString("fr-FR")} Ar
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-1 line-clamp-2">
                  {p.description}
                </p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    <i className="fa-solid fa-layer-group mr-1.5"></i>
                    {p.lines?.length || 0} article(s)
                  </span>
                </div>
              </div>
            </div>
          ))}
          {packages.length === 0 && (
            <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <i className="fa-solid fa-boxes-stacked text-4xl mb-4 text-slate-300"></i>
              <p>Aucun pack disponible</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <h2 className="font-bold text-slate-700 dark:text-slate-300">
                Liste des packs
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {packages.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 cursor-pointer transition-colors flex gap-4 items-center ${
                    selectedPkgId === p.id
                      ? "bg-indigo-50 border-l-4 border-indigo-500"
                      : "hover:bg-slate-50 dark:bg-slate-900/50 border-l-4 border-transparent"
                  } ${!p.is_active ? "opacity-50" : ""}`}
                  onClick={() => setSelectedPkgId(p.id)}
                >
                  <div className="w-32 h-32 bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <i className="fa-solid fa-box text-slate-400 text-4xl"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 whitespace-normal break-words">
                          {p.name}
                        </h3>
                        <div className="flex flex-shrink-0 gap-1 mt-0.5">
                          {p.is_active ? (
                            <span className="status-badge status-active">
                              Actif
                            </span>
                          ) : (
                            <span className="status-badge status-inactive">
                              Inactif
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {p.description}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-hah-600">
                          {Number(p.price).toLocaleString("fr-FR")} Ar
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                          Offre
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {packages.length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-sm">
                  Aucun pack disponible
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedPkg && editingDraft ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative">
                <div className="absolute top-6 right-6 flex gap-2">
                  <button
                    className="primary-btn"
                    onClick={handleSaveDraft}
                    disabled={saving}
                  >
                    <i className="fas fa-save mr-2"></i>
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
                <div className="mb-6">
                  <p className="eyebrow">Offre Commerciale</p>
                  <h2 className="font-bold text-xl text-slate-800 dark:text-slate-100 mt-1">
                    Édition : {editingDraft.name}
                  </h2>
                  <div className="flex gap-2 mt-3">
                    {editingDraft.is_active ? (
                      <span className="status-badge status-active">Actif</span>
                    ) : (
                      <span className="status-badge status-inactive">
                        Inactif
                      </span>
                    )}
                    <span className="status-badge status-warning">
                      Matériel & Services
                    </span>
                  </div>
                </div>

                <div className="mb-6 flex flex-col md:flex-row items-start gap-6">
                  <div className="w-48 h-48 bg-slate-100 rounded-xl border border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden relative group">
                    <i className="fa-solid fa-image text-slate-300 text-4xl"></i>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nom du pack
                      </label>
                      <input
                        type="text"
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm"
                        value={editingDraft.name}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Prix forfaitaire (Ar)
                      </label>
                      <input
                        type="number"
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm"
                        value={editingDraft.price}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            price: parseFloat(e.target.value || "0"),
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Description courte
                      </label>
                      <input
                        type="text"
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm"
                        value={editingDraft.description}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-between items-center mt-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                            editingDraft.is_active
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                          onClick={() =>
                            setEditingDraft({
                              ...editingDraft,
                              is_active: !editingDraft.is_active,
                            })
                          }
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              editingDraft.is_active
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {editingDraft.is_active ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          className="text-sm font-medium text-rose-600 hover:text-rose-700"
                          onClick={() =>
                            handleDeletePackage(selectedPkgId!)
                          }
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">
                      Composition du pack
                    </h3>
                    <div className="flex gap-4 items-center">
                      <button
                        onClick={() => setIsAddMaterialOpen(true)}
                        className="px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold text-sm rounded-lg transition-colors"
                      >
                        <i className="fas fa-plus mr-2"></i>Ajouter du matériel
                      </button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                    {editingDraft.lines.length === 0 && (
                      <div className="p-8 text-center text-slate-500 italic text-sm border-2 border-dashed border-slate-200 rounded-xl">
                        Ce pack ne contient aucun article. <br />
                        <br />
                        <button
                          onClick={() => setIsAddMaterialOpen(true)}
                          className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-sm rounded-lg transition-colors"
                        >
                          <i className="fas fa-plus mr-2"></i>Ajouter du
                          matériel
                        </button>
                      </div>
                    )}
                    {editingDraft.lines.map((line) => {
                      const item = catalog.find(
                        (c) => c.id === line.inventory_item,
                      );
                      if (!item) return null;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 border rounded-lg transition-colors border-indigo-300 bg-white dark:bg-slate-800"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => toggleArticle(item.id)}
                              className="text-rose-400 hover:text-rose-600 p-1"
                              title="Retirer l'article"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded overflow-hidden flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                              <i className="fas fa-image text-slate-300 dark:text-slate-600 text-sm"></i>
                            </div>
                            <div>
                              <div className="font-medium text-sm text-slate-800 dark:text-slate-100">
                                {item.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {item.kind}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Qté:
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="w-16 border border-slate-300 dark:border-slate-600 rounded p-1 text-sm text-center font-medium"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateArticleQty(
                                    item.id,
                                    parseInt(e.target.value || "0", 10),
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                <i className="fa-solid fa-boxes-stacked text-4xl mb-4 text-slate-300 dark:text-slate-600"></i>
                <p>Sélectionnez un pack dans la liste pour le modifier</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddMaterialOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                Ajouter du matériel au pack
              </h3>
              <button
                onClick={() => setIsAddMaterialOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <input
                type="text"
                placeholder="Rechercher par nom ou type..."
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
              />
            </div>
            <div className="p-4 overflow-y-auto flex-1 grid gap-3">
              {catalog
                .filter(
                  (c) =>
                    c.name
                      .toLowerCase()
                      .includes(materialSearch.toLowerCase()) ||
                    c.kind
                      .toLowerCase()
                      .includes(materialSearch.toLowerCase()),
                )
                .map((item) => {
                  const isAlreadyInPack = editingDraft?.lines.some(
                    (l) => l.inventory_item === item.id,
                  );
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isAlreadyInPack
                          ? "bg-slate-50 opacity-50"
                          : "hover:border-indigo-300 cursor-pointer"
                      }`}
                      onClick={() => {
                        if (!isAlreadyInPack && editingDraft) {
                          toggleArticle(item.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                          <i className="fas fa-image text-slate-400"></i>
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.kind}
                          </div>
                        </div>
                      </div>
                      <div>
                        {isAlreadyInPack ? (
                          <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded">
                            Déjà ajouté
                          </span>
                        ) : (
                          <button className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded font-bold text-xs">
                            Ajouter
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {catalog.length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-sm">
                  Aucun élément d'inventaire disponible
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
