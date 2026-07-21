import './titan-styles.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { checkEndpointPermission, createStockMovement, getInventoryItems, getStockMovements } from './api';
import type {
  InventoryItem,
  InventoryStockMovement,
  InventoryStockMovementDirection,
  InventoryStockMovementType,
  StockMovementCreatePayload,
} from './types';

// ─── Type labels ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<InventoryStockMovementType, string> = {
  outbound_delivery: 'Livraison sortante',
  inbound_return: 'Retour entrant',
  adjustment_in: 'Ajustement entrant',
  adjustment_out: 'Ajustement sortant',
  damage: 'Dommage',
  loss: 'Perte',
  other: 'Autre',
};

const DIRECTION_LABELS: Record<InventoryStockMovementDirection, string> = {
  inbound: 'Entrant',
  outbound: 'Sortant',
};

// Direction is determined by movement_type for most types.
// Only 'other' requires explicit direction.
const FIXED_DIRECTIONS: Partial<Record<InventoryStockMovementType, InventoryStockMovementDirection>> = {
  outbound_delivery: 'outbound',
  inbound_return: 'inbound',
  adjustment_in: 'inbound',
  adjustment_out: 'outbound',
  damage: 'outbound',
  loss: 'outbound',
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  inventoryItems?: InventoryItem[];
};

export function TitanStockMovementPanel({ inventoryItems: propItems }: Props) {
  const [movements, setMovements] = useState<InventoryStockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [internalItems, setInternalItems] = useState<InventoryItem[]>([]);

  const inventoryItems = propItems && propItems.length > 0 ? propItems : internalItems;

  // Form state
  const [inventoryItem, setInventoryItem] = useState('');
  const [movementType, setMovementType] = useState<InventoryStockMovementType>('outbound_delivery');
  const [direction, setDirection] = useState<InventoryStockMovementDirection>('outbound');
  const [quantity, setQuantity] = useState('1');
  const [sourceLabel, setSourceLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterDirection, setFilterDirection] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/inventory/stock-movements/", "OPTIONS", controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (propItems && propItems.length > 0) return;
    const controller = new AbortController();
    getInventoryItems(controller.signal)
      .then((items) => { if (!controller.signal.aborted) setInternalItems(Array.isArray(items) ? items : []); })
      .catch(() => { /* non-fatal */ });
    return () => controller.abort();
  }, [propItems]);

  const abortRef = useRef<AbortController | null>(null);

  const loadMovements = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const data = await getStockMovements(abortRef.current.signal);
      setMovements(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : "Échec du chargement des mouvements de stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMovements();
    return () => abortRef.current?.abort();
  }, [loadMovements]);

  // When movement type changes, fix the direction if not 'other'
  const handleMovementTypeChange = (type: InventoryStockMovementType) => {
    setMovementType(type);
    const fixed = FIXED_DIRECTIONS[type];
    if (fixed) {
      setDirection(fixed);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryItem) {
      setFormError("Sélectionnez un article d'inventaire.");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      setFormError("La quantité doit être un entier positif.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const payload: StockMovementCreatePayload = {
      inventory_item: inventoryItem,
      movement_type: movementType,
      direction: FIXED_DIRECTIONS[movementType] ?? direction,
      quantity: qty,
      source_label: sourceLabel,
      notes,
    };
    try {
      const created = await createStockMovement(payload);
      setMovements((prev) => [created, ...prev]);
      setShowForm(false);
      setInventoryItem('');
      setMovementType('outbound_delivery');
      setDirection('outbound');
      setQuantity('1');
      setSourceLabel('');
      setNotes('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Échec de l'enregistrement du mouvement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="titan-stock-panel" data-testid="titan-stock-movement-panel">
      <div className="titan-stock-panel__header">
        <h3 className="titan-stock-panel__title">Mouvements de stock</h3>
        <div className="titan-stock-panel__actions">
          <button
            className="titan-stock-panel__refresh"
            onClick={loadMovements}
            disabled={loading}
            aria-label="Actualiser les mouvements de stock"
          >
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
          {canWrite ? (
          <button
            className="titan-stock-panel__toggle"
            onClick={() => setShowForm((v) => !v)}
            aria-label={showForm ? "Fermer le formulaire d'enregistrement" : "Ouvrir le formulaire d'enregistrement"}
          >
            {showForm ? 'Annuler' : 'Enregistrer un mouvement'}
          </button>
          ) : (
            <p className="status">Connectez-vous avec un accès en écriture pour enregistrer des mouvements.</p>
          )}
        </div>
      </div>

      {error && (
        <p className="titan-stock-panel__error" role="alert">{error}</p>
      )}

      {showForm && (
        <form
          className="titan-stock-form"
          onSubmit={handleSubmit}
          aria-label="Formulaire d'enregistrement d'un mouvement de stock"
        >
          <div className="titan-stock-form__row">
            <label className="titan-stock-form__label">
              Article d'inventaire
              <select
                value={inventoryItem}
                onChange={(e) => setInventoryItem(e.target.value)}
                disabled={submitting}
                aria-label="Sélectionner un article d'inventaire"
              >
                <option value="">— sélectionner un article —</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className="titan-stock-form__label">
              Type de mouvement
              <select
                value={movementType}
                onChange={(e) => handleMovementTypeChange(e.target.value as InventoryStockMovementType)}
                disabled={submitting}
                aria-label="Type de mouvement"
              >
                {(Object.keys(TYPE_LABELS) as InventoryStockMovementType[]).map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>

            {!FIXED_DIRECTIONS[movementType] && (
              <label className="titan-stock-form__label">
                Direction
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as InventoryStockMovementDirection)}
                  disabled={submitting}
                  aria-label="Direction du mouvement"
                >
                  <option value="inbound">Entrant</option>
                  <option value="outbound">Sortant</option>
                </select>
              </label>
            )}

            <label className="titan-stock-form__label">
              Quantité
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={submitting}
                aria-label="Quantité"
              />
            </label>
          </div>

          <div className="titan-stock-form__row">
            <label className="titan-stock-form__label titan-stock-form__label--wide">
              Source / Référence
              <input
                type="text"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                disabled={submitting}
                placeholder="ex: DR-2026-001, réf. fournisseur…"
                aria-label="Référence source"
              />
            </label>

            <label className="titan-stock-form__label titan-stock-form__label--wide">
              Notes
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                aria-label="Notes"
              />
            </label>
          </div>

          {formError && (
            <p className="titan-stock-form__error" role="alert">{formError}</p>
          )}

          <button
            type="submit"
            className="titan-stock-form__submit"
            disabled={submitting || !inventoryItem}
            aria-label="Enregistrer le mouvement de stock"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer le mouvement'}
          </button>
        </form>
      )}

      <div className="titan-stock-panel__list" role="list" aria-label="Liste des mouvements de stock">
        {!loading && movements.length > 0 && (
          <div className="titan-stock-panel__filters" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filtrer par type"
              style={{ padding: '4px 8px', fontSize: '0.85rem' }}
            >
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              aria-label="Filtrer par direction"
              style={{ padding: '4px 8px', fontSize: '0.85rem' }}
            >
              <option value="">Toutes les directions</option>
              {Object.entries(DIRECTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}
        {!loading && movements.length === 0 && (
          <p className="titan-stock-panel__empty">Aucun mouvement de stock enregistré.</p>
        )}
        {movements
          .filter((m) => !filterType || m.movement_type === filterType)
          .filter((m) => !filterDirection || m.direction === filterDirection)
          .map((m) => (
          <div key={m.id} className="titan-stock-row" data-testid={`stock-movement-row-${m.id}`} role="listitem">
            <span className={`titan-stock-row__dir titan-stock-row__dir--${m.direction}`}>
              {DIRECTION_LABELS[m.direction]}
            </span>
            <span className="titan-stock-row__type">{TYPE_LABELS[m.movement_type]}</span>
            <span className="titan-stock-row__qty">×{m.quantity}</span>
            {m.source_label && (
              <span className="titan-stock-row__ref">{m.source_label}</span>
            )}
            <span className="titan-stock-row__date">
              {new Date(m.effective_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TitanStockMovementPanel;
