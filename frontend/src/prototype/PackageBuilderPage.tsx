import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  getMaterialPackages,
  createMaterialPackage,
  updateMaterialPackage,
  deleteMaterialPackage,
  getInventoryItems,
} from "../api";
import type {
  MaterialPackage,
  InventoryItem,
} from "../types";

export default function PackageBuilderPage() {
  const [packages, setPackages] = useState<MaterialPackage[]>([]);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "details" | "table">("details");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal Creation / Edition
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalForm, setModalForm] = useState({
    name: "",
    description: "",
    price: 0,
    image_url: "",
    is_active: true,
  });

  // Image source mode in modal / details
  const [imageSourceMode, setImageSourceMode] = useState<"file" | "url">("file");
  const [localFileName, setLocalFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation Modal
  const [packageToDelete, setPackageToDelete] = useState<MaterialPackage | null>(null);

  // Material picker modal
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialKindFilter, setMaterialKindFilter] = useState<string>("all");
  const [materialQuantities, setMaterialQuantities] = useState<Record<string, number>>({});

  // Editing draft for the selected package in Details mode
  const [editingDraft, setEditingDraft] = useState<{
    name: string;
    description: string;
    price: number;
    image_url: string;
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
        const loadedPackages = Array.isArray(pkgData) ? pkgData : [];
        setPackages(loadedPackages);
        setCatalog(Array.isArray(catData) ? catData : []);
        if (loadedPackages.length > 0) {
          setSelectedPkgId((prev) => prev || loadedPackages[0].id);
        }
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

  const selectedPkg = useMemo(
    () => packages.find((p) => p.id === selectedPkgId) || null,
    [packages, selectedPkgId],
  );

  // Synchronous draft fallback from selectedPkg
  const draft = useMemo(() => {
    if (editingDraft) return editingDraft;
    if (selectedPkg) {
      return {
        name: selectedPkg.name,
        description: selectedPkg.description || "",
        price: Number(selectedPkg.price) || 0,
        image_url: selectedPkg.image_url || "",
        is_active: selectedPkg.is_active,
        lines: (selectedPkg.lines || []).map((l) => ({
          inventory_item: l.inventory_item,
          quantity: l.quantity,
        })),
      };
    }
    return null;
  }, [editingDraft, selectedPkg]);

  const updateDraft = (updates: Partial<{
    name: string;
    description: string;
    price: number;
    image_url: string;
    is_active: boolean;
    lines: Array<{ inventory_item: string; quantity: number }>;
  }>) => {
    if (!draft) return;
    updateDraft({ ...updates });
  };

  // Handle local image file upload
  const handleLocalFileChange = async (file: File, isModal = false) => {
    if (!file.type.startsWith("image/")) {
      showToast("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP, SVG).", "warning");
      return;
    }

    try {
      if (file.size > 10 * 1024 * 1024) {
        showToast("Image trop volumineuse (> 10 Mo). Veuillez choisir une image plus légère.", "warning");
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Erreur de lecture du fichier local"));
        reader.readAsDataURL(file);
      });

      if (isModal) {
        setModalForm((prev) => ({ ...prev, image_url: dataUrl }));
      } else if (draft) {
        updateDraft({ image_url: dataUrl });
      }
      setLocalFileName(file.name);
      showToast(`Image "${file.name}" chargée avec succès.`, "success");
    } catch (err: any) {
      showToast(err?.message || "Erreur lors du chargement de l'image.", "error");
    }
  };

  // Open creation modal
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setModalForm({
      name: "",
      description: "",
      price: 0,
      image_url: "",
      is_active: true,
    });
    setImageSourceMode("file");
    setLocalFileName("");
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (pkg: MaterialPackage) => {
    setModalMode("edit");
    setModalForm({
      name: pkg.name,
      description: pkg.description || "",
      price: Number(pkg.price) || 0,
      image_url: pkg.image_url || "",
      is_active: pkg.is_active,
    });
    const isUrl =
      (pkg.image_url || "").startsWith("http") || (pkg.image_url || "").startsWith("/");
    setImageSourceMode(isUrl ? "url" : "file");
    setLocalFileName(
      pkg.image_url?.startsWith("data:") ? "Image locale" : "",
    );
    setSelectedPkgId(pkg.id);
    setIsModalOpen(true);
  };

  // Save Modal (Create or Update basic info)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.name.trim()) {
      showToast("Le nom du pack est obligatoire.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        const created = await createMaterialPackage({
          name: modalForm.name.trim(),
          description: modalForm.description.trim(),
          price: modalForm.price,
          image_url: modalForm.image_url,
          is_active: modalForm.is_active,
          lines: [],
        });
        setPackages((prev) => [...prev, created]);
        setSelectedPkgId(created.id);
        setViewMode("details");
        setIsModalOpen(false);
        showToast("Nouveau pack créé ! Vous pouvez maintenant y ajouter vos articles.", "success");
      } else if (selectedPkgId) {
        const updated = await updateMaterialPackage(selectedPkgId, {
          name: modalForm.name.trim(),
          description: modalForm.description.trim(),
          price: modalForm.price,
          image_url: modalForm.image_url,
          is_active: modalForm.is_active,
        });
        setPackages((prev) => prev.map((p) => (p.id === selectedPkgId ? updated : p)));
        setIsModalOpen(false);
        showToast("Pack mis à jour avec succès.", "success");
      }
    } catch {
      showToast("Erreur lors de l'enregistrement du pack.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Save complete draft in Details view
  const handleSaveDraft = async () => {
    if (!draft || !selectedPkgId) return;
    if (!draft.name.trim()) {
      showToast("Le nom du pack est requis.", "warning");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMaterialPackage(selectedPkgId, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        price: draft.price,
        image_url: draft.image_url,
        is_active: draft.is_active,
        lines: draft.lines,
      });
      setPackages((prev) => prev.map((p) => (p.id === selectedPkgId ? updated : p)));
      showToast("Pack et composition enregistrés avec succès.", "success");
    } catch {
      showToast("Erreur lors de la sauvegarde du pack.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Toggle active status directly
  const handleToggleActive = async (pkg: MaterialPackage) => {
    try {
      const nextActive = !pkg.is_active;
      const updated = await updateMaterialPackage(pkg.id, { is_active: nextActive });
      setPackages((prev) => prev.map((p) => (p.id === pkg.id ? updated : p)));
      showToast(nextActive ? "Pack activé." : "Pack désactivé.", "info");
    } catch {
      showToast("Erreur lors du changement de statut.", "error");
    }
  };

  // Duplicate a package
  const handleDuplicatePackage = async (pkg: MaterialPackage) => {
    try {
      const duplicated = await createMaterialPackage({
        name: `${pkg.name} (Copie)`,
        description: pkg.description || "",
        price: Number(pkg.price) || 0,
        image_url: pkg.image_url || "",
        is_active: true,
        lines: (pkg.lines || []).map((l) => ({
          inventory_item: l.inventory_item,
          quantity: l.quantity,
        })),
      });
      setPackages((prev) => [...prev, duplicated]);
      setSelectedPkgId(duplicated.id);
      setViewMode("details");
      showToast(`Pack "${duplicated.name}" dupliqué avec succès.`, "success");
    } catch {
      showToast("Erreur lors de la duplication du pack.", "error");
    }
  };

  // Confirm and delete package
  const confirmDeletePackage = async () => {
    if (!packageToDelete) return;
    try {
      await deleteMaterialPackage(packageToDelete.id);
      setPackages((prev) => prev.filter((p) => p.id !== packageToDelete.id));
      if (selectedPkgId === packageToDelete.id) {
        setSelectedPkgId(packages.find((p) => p.id !== packageToDelete.id)?.id || null);
      }
      setPackageToDelete(null);
      showToast("Pack supprimé définitivement.", "info");
    } catch {
      showToast("Erreur lors de la suppression du pack.", "error");
    }
  };

  // Line item management inside editing draft
  const toggleArticle = (articleId: string, quantity = 1) => {
    if (!draft) return;
    const exists = draft.lines.find((l) => l.inventory_item === articleId);
    if (exists) {
      updateDraft({
        lines: draft.lines.filter((l) => l.inventory_item !== articleId),
      });
    } else {
      updateDraft({
        lines: [...draft.lines, { inventory_item: articleId, quantity: Math.max(1, quantity) }],
      });
    }
  };

  const updateArticleQty = (articleId: string, rawQty: number) => {
    if (!draft) return;
    let qty = rawQty;
    if (Number.isNaN(qty)) qty = 0;
    if (qty <= 0) {
      toggleArticle(articleId);
    } else {
      updateDraft({
        lines: draft.lines.map((l) =>
          l.inventory_item === articleId ? { ...l, quantity: qty } : l,
        ),
      });
    }
  };

  // Retail value calculation
  const getPackageRetailTotal = useCallback(
    (lines: Array<{ inventory_item: string; quantity: number }>) => {
      return lines.reduce((acc, line) => {
        const catItem = catalog.find((c) => c.id === line.inventory_item);
        const unitPrice = Number(catItem?.rental_price ?? 0);
        return acc + unitPrice * line.quantity;
      }, 0);
    },
    [catalog],
  );

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && pkg.is_active) ||
        (statusFilter === "inactive" && !pkg.is_active);

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        pkg.name.toLowerCase().includes(q) ||
        (pkg.description || "").toLowerCase().includes(q) ||
        (pkg.lines || []).some((l) =>
          (l.inventory_item_name || "").toLowerCase().includes(q),
        );

      return matchesStatus && matchesSearch;
    });
  }, [packages, statusFilter, searchQuery]);

  // Catalog item categories
  const catalogKinds = useMemo(() => {
    const kinds = new Set<string>();
    catalog.forEach((item) => {
      if (item.kind) kinds.add(item.kind);
    });
    return Array.from(kinds);
  }, [catalog]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600"></i>
        <div className="text-sm font-semibold text-slate-500">Chargement des packages…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
        <i className="fa-solid fa-circle-exclamation text-xl"></i>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl text-white font-medium flex items-center gap-2.5 transition-all transform animate-bounce-short ${
            toast.type === "error"
              ? "bg-rose-600"
              : toast.type === "warning"
                ? "bg-amber-500"
                : toast.type === "success"
                  ? "bg-emerald-600"
                  : "bg-indigo-600"
          }`}
        >
          <i
            className={`fa-solid ${
              toast.type === "error"
                ? "fa-triangle-exclamation"
                : toast.type === "warning"
                  ? "fa-bell"
                  : toast.type === "success"
                    ? "fa-circle-check"
                    : "fa-info-circle"
            }`}
          ></i>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navigation Hub */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        <a
          href="#catalog"
          className="border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2"
        >
          <i className="fas fa-boxes-stacked"></i>
          <span>Catalogue Matériel</span>
        </a>
        <a
          href="#packages"
          className="border-b-2 border-tit-600 px-4 py-3 text-sm font-bold text-tit-700 flex items-center gap-2"
        >
          <i className="fas fa-box-open"></i>
          <span>Packs & Formules Commerciales</span>
        </a>
        <a
          href="#services"
          className="border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2"
        >
          <i className="fas fa-magic"></i>
          <span>Prestations & Scénographies</span>
        </a>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-tit-50 text-tit-700 border border-tit-200">
              Titan Rental • Formules Clé en Main
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {packages.length} pack(s) configuré(s)
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            Gestion des Packs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Assemblez des lots de mobilier, vaisselle et matériels avec photos, valorisation au détail et tarification forfaitaire remisée.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-tit-600 hover:bg-tit-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 self-start md:self-auto hover:shadow"
        >
          <i className="fa-solid fa-plus"></i>
          <span>Nouveau Pack</span>
        </button>
      </div>

      {/* Controls Bar: Search, Status Filters & Views */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <i className="fa-solid fa-search absolute left-3.5 top-3 text-slate-400 text-xs"></i>
          <input
            type="text"
            placeholder="Rechercher par nom de pack, description ou article..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-tit-500 focus:ring-1 focus:ring-tit-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tous ({packages.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Actifs ({packages.filter((p) => p.is_active).length})
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === "inactive"
                ? "bg-slate-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Inactifs ({packages.filter((p) => !p.is_active).length})
          </button>
        </div>

        {/* View Mode Switch */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-end sm:self-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "grid"
                ? "bg-white text-tit-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="fa-solid fa-grip"></i>
            <span>Grille</span>
          </button>
          <button
            onClick={() => setViewMode("details")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "details"
                ? "bg-white text-tit-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="fa-solid fa-pen-to-square"></i>
            <span>Détails</span>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "table"
                ? "bg-white text-tit-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="fa-solid fa-list"></i>
            <span>Tableau</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: GRID MODE */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((p) => {
            const retail = getPackageRetailTotal(
              (p.lines || []).map((l) => ({ inventory_item: l.inventory_item, quantity: l.quantity })),
            );
            const savings = retail - Number(p.price || 0);
            const discountPct = retail > 0 ? Math.round((savings / retail) * 100) : 0;

            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedPkgId(p.id);
                  setViewMode("details");
                }}
                className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden hover:shadow-md transition-all flex flex-col cursor-pointer group hover:border-tit-300"
                aria-label={`Ouvrir le détail du Pack ${p.name}`}
                role="button"
              >
                {/* Visual Banner / Photo */}
                <div className="h-48 bg-slate-100 relative overflow-hidden">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-slate-100 to-tit-50/50 text-slate-400">
                      <i className="fa-solid fa-box-open text-5xl text-tit-400/60 mb-2"></i>
                      <span className="text-[11px] font-semibold text-slate-400">Pack sans visuel</span>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs ${
                        p.is_active
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-600 text-white"
                      }`}
                    >
                      {p.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>

                  {/* Tag badge */}
                  <div className="absolute top-3 left-3">
                    <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                      <i className="fa-solid fa-layer-group text-tit-300"></i>
                      <span>{p.lines?.length || 0} article(s)</span>
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-base text-slate-900 mb-1 group-hover:text-tit-600 transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">
                    {p.description || "Aucune description renseignée."}
                  </p>

                  {/* Commercial Value Breakdown */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-medium text-slate-500">Tarif Pack forfaitaire :</span>
                      <span className="text-lg font-black text-tit-700">
                        {Number(p.price || 0).toLocaleString("fr-FR")} Ar
                      </span>
                    </div>
                    {retail > 0 && (
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                        <span className="text-slate-400">Valeur au détail :</span>
                        <span className="text-slate-500 line-through font-semibold">
                          {retail.toLocaleString("fr-FR")} Ar
                        </span>
                      </div>
                    )}
                    {savings > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-600 font-bold">
                        <span>Économie client :</span>
                        <span>-{savings.toLocaleString("fr-FR")} Ar ({discountPct}%)</span>
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicatePackage(p);
                      }}
                      className="text-slate-500 hover:text-tit-700 font-semibold flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Dupliquer ce pack"
                    >
                      <i className="fa-solid fa-copy"></i>
                      <span>Dupliquer</span>
                    </button>

                    <span className="text-tit-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      <span>Éditer le pack</span>
                      <i className="fa-solid fa-chevron-right text-[10px]"></i>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredPackages.length === 0 && (
            <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-3">
              <i className="fa-solid fa-boxes-stacked text-5xl text-slate-300"></i>
              <p className="font-semibold text-slate-600">Aucun pack ne correspond à vos critères</p>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-tit-600 text-white text-xs font-bold rounded-xl hover:bg-tit-700"
              >
                Créer un premier pack
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DETAILS & EDITOR MODE */}
      {viewMode === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Pack List Sidebar */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-[800px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Packs disponibles ({filteredPackages.length})
              </span>
              <button
                onClick={handleOpenCreateModal}
                className="text-xs font-bold text-tit-700 hover:text-tit-800 flex items-center gap-1"
              >
                <i className="fa-solid fa-plus"></i>
                <span>Nouveau</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filteredPackages.map((p) => {
                const isSelected = selectedPkgId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-4 cursor-pointer transition-all flex gap-3 items-center ${
                      isSelected
                        ? "bg-tit-50/70 border-l-4 border-tit-600"
                        : "hover:bg-slate-50 border-l-4 border-transparent"
                    } ${!p.is_active ? "opacity-60" : ""}`}
                    onClick={() => { setSelectedPkgId(p.id); setEditingDraft(null); }}
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200 relative">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <i className="fa-solid fa-box text-slate-400 text-xl"></i>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="font-bold text-sm text-slate-900 whitespace-normal break-words">
                          {p.name}
                        </h3>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            p.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.is_active ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {p.description || "Aucune description"}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-tit-700">
                          {Number(p.price || 0).toLocaleString("fr-FR")} Ar
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {p.lines?.length || 0} art.
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredPackages.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  Aucun pack trouvé
                </div>
              )}
            </div>
          </div>

          {/* Right: Detailed Composition Workspace */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPkg && draft ? (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
                {/* Header & Save Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-tit-700 uppercase tracking-wider">
                        Édition du Pack
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          draft.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {draft.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <h2 className="font-black text-xl text-slate-900 mt-1">
                      {draft.name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicatePackage(selectedPkg)}
                      className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-copy"></i>
                      <span>Dupliquer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackageToDelete(selectedPkg)}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-trash"></i>
                      <span>Supprimer</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="px-4 py-2 bg-tit-600 hover:bg-tit-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>{saving ? "Enregistrement..." : "Enregistrer"}</span>
                    </button>
                  </div>
                </div>

                {/* Pack Properties & Photo Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Visual Photo Card with Image Selector */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-slate-700">
                        Photo du pack
                      </label>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px]">
                        <button
                          type="button"
                          onClick={() => setImageSourceMode("file")}
                          className={`px-2 py-0.5 rounded font-semibold ${
                            imageSourceMode === "file" ? "bg-white text-tit-700 shadow-xs" : "text-slate-500"
                          }`}
                        >
                          Fichier
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageSourceMode("url")}
                          className={`px-2 py-0.5 rounded font-semibold ${
                            imageSourceMode === "url" ? "bg-white text-tit-700 shadow-xs" : "text-slate-500"
                          }`}
                        >
                          URL
                        </button>
                      </div>
                    </div>

                    {/* Preview Box */}
                    <div className="w-full h-44 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative group flex items-center justify-center">
                      {draft.image_url ? (
                        <>
                          <img
                            src={draft.image_url}
                            alt={draft.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              updateDraft({ image_url: "" });
                              setLocalFileName("");
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                            title="Retirer l'image"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400">
                          <i className="fa-solid fa-image text-3xl mb-1 text-slate-300"></i>
                          <span className="text-[11px]">Aucune image</span>
                        </div>
                      )}
                    </div>

                    {/* Image Input (File or URL) */}
                    {imageSourceMode === "file" ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          id="pack-image-file-details"
                          aria-label="Sélectionner une photo locale dans l'éditeur"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleLocalFileChange(f, false);
                            e.target.value = "";
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-tit-500 rounded-xl text-xs font-semibold text-slate-600 hover:text-tit-700 bg-slate-50 hover:bg-tit-50/30 transition-colors flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-upload text-tit-600"></i>
                          <span>Parcourir une photo...</span>
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="https://... (URL web)"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                        value={draft.image_url || ""}
                        onChange={(e) =>
                          updateDraft({ image_url: e.target.value })
                        }
                      />
                    )}
                  </div>

                  {/* Core Settings */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nom du pack *
                        </label>
                        <input
                          type="text"
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:border-tit-500 focus:ring-1 focus:ring-tit-500"
                          value={draft.name || ""}
                          onChange={(e) =>
                            updateDraft({ name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tarif forfaitaire du pack (Ariary) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-tit-700"
                          value={draft.price ?? 0}
                          onChange={(e) =>
                            updateDraft({ price: parseFloat(e.target.value || "0"),
                             })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Description commerciale & usage
                      </label>
                      <textarea
                        rows={2}
                        className="w-full border border-slate-300 rounded-xl p-2.5 text-sm"
                        placeholder="Précisez pour combien de convives le pack est prévu, occasions d'usage..."
                        value={draft.description || ""}
                        onChange={(e) =>
                          updateDraft({ description: e.target.value,
                           })
                        }
                      />
                    </div>

                    {/* Active toggle switch */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            draft.is_active ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          onClick={() =>
                            updateDraft({ is_active: !draft.is_active,
                             })
                          }
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              draft.is_active ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className="text-xs font-bold text-slate-700">
                          {draft.is_active ? "Pack actif pour les réservations" : "Pack inactif"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Commercial Value Comparison Banner */}
                {(() => {
                  const retail = getPackageRetailTotal(draft.lines);
                  const savings = retail - draft.price;
                  const discountPct = retail > 0 ? Math.round((savings / retail) * 100) : 0;

                  return (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-tit-100 text-tit-700 flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-calculator text-lg"></i>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-700">Analyse de la Valeur Commerciale</div>
                          <div className="text-xs text-slate-500">
                            {draft.lines.length} article(s) distinct(s) inclus dans ce lot
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-right">
                        <div>
                          <div className="text-[11px] text-slate-400">Total au détail</div>
                          <div className="text-sm font-bold text-slate-600">
                            {retail.toLocaleString("fr-FR")} Ar
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-tit-600 font-bold">Prix Pack Forfait</div>
                          <div className="text-base font-black text-tit-700">
                            {draft.price.toLocaleString("fr-FR")} Ar
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">Avantage client</div>
                          <div
                            className={`text-sm font-black ${
                              savings > 0 ? "text-emerald-600" : "text-slate-600"
                            }`}
                          >
                            {savings > 0
                              ? `-${savings.toLocaleString("fr-FR")} Ar (${discountPct}%)`
                              : "Tarif standard"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Composition Table / Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Articles inclus dans le pack
                      </h3>
                      <p className="text-xs text-slate-400">
                        Définissez les articles et leurs quantités unitaires composant ce lot
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddMaterialOpen(true)}
                      className="px-3 py-2 bg-tit-600 hover:bg-tit-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>Ajouter du matériel</span>
                    </button>
                  </div>

                  {/* Lines list */}
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {draft.lines.map((line) => {
                      const item = catalog.find((c) => c.id === line.inventory_item);
                      if (!item) return null;
                      const unitPrice = Number(item.rental_price ?? 0);
                      const lineTotal = unitPrice * line.quantity;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-tit-300 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-100 text-slate-400">
                              <i className="fa-solid fa-box text-slate-300 text-lg"></i>
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-900 truncate">
                                {item.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                {item.kind || "Matériel"} • {unitPrice.toLocaleString("fr-FR")} Ar / unité
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Stepper */}
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                              <button
                                type="button"
                                onClick={() => updateArticleQty(item.id, line.quantity - 1)}
                                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 font-bold text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                className="w-14 text-center bg-white border-x border-slate-200 py-1 text-xs font-bold text-slate-800"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateArticleQty(
                                    item.id,
                                    parseInt(e.target.value || "0", 10),
                                  )
                                }
                              />
                              <button
                                type="button"
                                onClick={() => updateArticleQty(item.id, line.quantity + 1)}
                                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 font-bold text-xs"
                              >
                                +
                              </button>
                            </div>

                            {/* Subtotal */}
                            <div className="w-24 text-right">
                              <span className="text-xs font-bold text-slate-700">
                                {lineTotal.toLocaleString("fr-FR")} Ar
                              </span>
                            </div>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => toggleArticle(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                              title="Retirer du pack"
                            >
                              <i className="fa-solid fa-trash-can text-sm"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {draft.lines.length === 0 && (
                      <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                        <i className="fa-solid fa-dolly text-3xl text-slate-300"></i>
                        <p className="text-xs text-slate-500 font-medium">
                          Ce pack ne contient encore aucun article d'inventaire.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsAddMaterialOpen(true)}
                          className="px-3 py-1.5 bg-tit-50 text-tit-700 hover:bg-tit-100 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-plus"></i>
                          <span>Ajouter du matériel</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-16 text-center text-slate-400 space-y-2">
                <i className="fa-solid fa-hand-pointer text-4xl text-slate-300"></i>
                <p className="font-semibold text-slate-600">Sélectionnez un pack dans la liste pour l'éditer</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: TABLE SUMMARY MODE */}
      {viewMode === "table" && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-4">Pack Commercial</th>
                <th className="p-4">Articles Inclus</th>
                <th className="p-4 text-right">Valeur au Détail</th>
                <th className="p-4 text-right">Tarif Forfaitaire</th>
                <th className="p-4 text-right">Avantage Client</th>
                <th className="p-4 text-center">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPackages.map((p) => {
                const retail = getPackageRetailTotal(
                  (p.lines || []).map((l) => ({ inventory_item: l.inventory_item, quantity: l.quantity })),
                );
                const savings = retail - Number(p.price || 0);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 flex-shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <i className="fa-solid fa-box text-slate-400"></i>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                          <div className="text-slate-400 line-clamp-1 max-w-xs">{p.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-slate-700">
                      {p.lines?.length || 0} article(s)
                    </td>
                    <td className="p-4 text-right font-medium text-slate-500">
                      {retail.toLocaleString("fr-FR")} Ar
                    </td>
                    <td className="p-4 text-right font-black text-tit-700 text-sm">
                      {Number(p.price || 0).toLocaleString("fr-FR")} Ar
                    </td>
                    <td className="p-4 text-right font-bold">
                      {savings > 0 ? (
                        <span className="text-emerald-600">-{savings.toLocaleString("fr-FR")} Ar</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPkgId(p.id);
                            setViewMode("details");
                          }}
                          className="p-1.5 text-slate-500 hover:text-tit-700 rounded-lg hover:bg-slate-100"
                          title="Éditer"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicatePackage(p)}
                          className="p-1.5 text-slate-500 hover:text-tit-700 rounded-lg hover:bg-slate-100"
                          title="Dupliquer"
                        >
                          <i className="fa-solid fa-copy"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPackageToDelete(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                          title="Supprimer"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: CREATE OR EDIT BASIC INFO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {modalMode === "create" ? "Créer un nouveau Pack Commercial" : "Modifier le Pack"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom du Pack Commercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Pack Mariage Champêtre 100 pax, Pack Vaisselle Prestige"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:border-tit-500"
                  value={modalForm.name}
                  onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tarif forfaitaire TTC (Ariary) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-tit-700"
                  value={modalForm.price}
                  onChange={(e) =>
                    setModalForm({ ...modalForm, price: parseFloat(e.target.value || "0") })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description commerciale
                </label>
                <textarea
                  rows={2}
                  placeholder="Présentez les avantages et la composition du pack..."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm"
                  value={modalForm.description}
                  onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                />
              </div>

              {/* Photo du Pack: Fichier local OU Lien URL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Photo ou visuel du pack</label>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setImageSourceMode("file")}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1.5 ${
                        imageSourceMode === "file" ? "bg-white text-tit-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <i className="fa-solid fa-folder-open text-xs"></i>
                      <span>Fichier local</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSourceMode("url")}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1.5 ${
                        imageSourceMode === "url" ? "bg-white text-tit-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <i className="fa-solid fa-link text-xs"></i>
                      <span>Lien URL</span>
                    </button>
                  </div>
                </div>

                {imageSourceMode === "file" ? (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="pack-image-file-modal"
                      aria-label="Sélectionner une photo locale dans la modale"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLocalFileChange(f, true);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleLocalFileChange(f, true);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                        isDragging
                          ? "border-tit-500 bg-tit-50/50"
                          : "border-slate-300 hover:border-tit-400 bg-slate-50/50 hover:bg-tit-50/20"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1 text-slate-500">
                        <i className="fa-solid fa-cloud-arrow-up text-2xl text-tit-600"></i>
                        <div className="text-xs font-semibold text-slate-700">
                          Cliquez ou glissez une photo du pack ici
                        </div>
                        <div className="text-[11px] text-slate-400">
                          JPG, PNG, WebP ou SVG depuis votre ordinateur
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="https://... ou /brand/packages/pack-mariage.jpg"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-sm"
                    value={modalForm.image_url || ""}
                    onChange={(e) => {
                      setModalForm({ ...modalForm, image_url: e.target.value });
                      setLocalFileName("");
                    }}
                  />
                )}

                {/* Preview */}
                {modalForm.image_url && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          modalForm.image_url.startsWith("data:")
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {modalForm.image_url.startsWith("data:") ? "📁 Fichier local" : "🌐 URL web"}
                      </span>
                      {localFileName && (
                        <span className="text-xs text-slate-600 truncate max-w-xs font-medium">
                          {localFileName}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setModalForm({ ...modalForm, image_url: "" });
                        setLocalFileName("");
                      }}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      Retirer
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pack_active"
                  checked={modalForm.is_active}
                  onChange={(e) => setModalForm({ ...modalForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-tit-600 rounded"
                />
                <label htmlFor="pack_active" className="text-xs font-semibold text-slate-700">
                  Pack immédiatement disponible à la location
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-tit-600 hover:bg-tit-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
                >
                  {saving
                    ? "Enregistrement..."
                    : modalMode === "create"
                      ? "Créer le pack"
                      : "Mettre à jour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD MATERIAL TO PACK */}
      {isAddMaterialOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Ajouter du matériel au pack
                </h3>
                <p className="text-xs text-slate-500">
                  Sélectionnez les articles du catalogue à intégrer dans l'offre groupée
                </p>
              </div>
              <button
                onClick={() => setIsAddMaterialOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Filter / Search inside modal */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <i className="fa-solid fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Rechercher par nom d'article, type ou référence..."
                  className="w-full pl-8 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-tit-500"
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                />
              </div>

              {/* Category pills */}
              <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setMaterialKindFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    materialKindFilter === "all"
                      ? "bg-tit-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  Tous
                </button>
                {catalogKinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMaterialKindFilter(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                      materialKindFilter === k
                        ? "bg-tit-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Items List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
              {catalog
                .filter((c) => {
                  const matchKind =
                    materialKindFilter === "all" || c.kind === materialKindFilter;
                  const matchSearch =
                    !materialSearch ||
                    c.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
                    (c.kind || "").toLowerCase().includes(materialSearch.toLowerCase());
                  return matchKind && matchSearch;
                })
                .map((item) => {
                  const existingLine = editingDraft?.lines.find(
                    (l) => l.inventory_item === item.id,
                  );
                  const isAlreadyInPack = Boolean(existingLine);
                  const chosenQty = materialQuantities[item.id] || (existingLine?.quantity ?? 1);
                  const unitPrice = Number(item.rental_price ?? 0);

                  return (
                    <div
                      key={item.id}
                      className={`py-3 flex items-center justify-between gap-3 ${
                        isAlreadyInPack ? "bg-tit-50/30 px-2 rounded-xl" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-slate-100 text-slate-400">
                          <i className="fa-solid fa-box text-slate-300"></i>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.kind || "Matériel"} • {unitPrice.toLocaleString("fr-FR")} Ar / unité
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Stepper */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              setMaterialQuantities({
                                ...materialQuantities,
                                [item.id]: Math.max(1, chosenQty - 1),
                              })
                            }
                            className="px-2 py-0.5 text-slate-500 hover:bg-slate-100 font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={chosenQty}
                            onChange={(e) =>
                              setMaterialQuantities({
                                ...materialQuantities,
                                [item.id]: Math.max(1, parseInt(e.target.value || "1", 10)),
                              })
                            }
                            className="w-12 text-center text-xs font-bold py-0.5"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setMaterialQuantities({
                                ...materialQuantities,
                                [item.id]: chosenQty + 1,
                              })
                            }
                            className="px-2 py-0.5 text-slate-500 hover:bg-slate-100 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>

                        {/* Add or Update Button */}
                        {isAlreadyInPack ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                              Inclus ({existingLine?.quantity})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                updateArticleQty(item.id, chosenQty);
                                showToast(`Quantité mise à jour : ${chosenQty}`, "info");
                              }}
                              className="px-2.5 py-1 bg-tit-50 text-tit-700 hover:bg-tit-100 rounded-lg font-bold text-xs"
                            >
                              Modifier
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              toggleArticle(item.id, chosenQty);
                              showToast(`${chosenQty} x "${item.name}" ajouté(s) au pack`, "success");
                            }}
                            className="px-3 py-1.5 bg-tit-600 text-white hover:bg-tit-700 rounded-lg font-bold text-xs transition-colors flex items-center gap-1"
                          >
                            <i className="fa-solid fa-plus text-[10px]"></i>
                            <span>Ajouter</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {catalog.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic text-xs">
                  Aucun matériel disponible dans le catalogue d'inventaire.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAddMaterialOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800"
              >
                Terminer la sélection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {packageToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Supprimer ce pack ?</h3>
              <p className="text-xs text-slate-500">
                Êtes-vous sûr de vouloir supprimer définitivement le pack «{" "}
                <span className="font-semibold text-slate-800">{packageToDelete.name}</span>{" "}
                » ? Les réservations existantes conserveront leurs lignes archivées.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPackageToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeletePackage}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
