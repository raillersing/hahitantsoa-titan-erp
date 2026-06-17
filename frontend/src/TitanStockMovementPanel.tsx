import './titan-styles.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createStockMovement, getStockMovements } from './api';
import type {
  InventoryItem,
  InventoryStockMovement,
  InventoryStockMovementDirection,
  InventoryStockMovementType,
  StockMovementCreatePayload,
} from './types';

// ─── Type labels ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<InventoryStockMovementType, string> = {
  outbound_delivery: 'Outbound Delivery',
  inbound_return: 'Inbound Return',
  adjustment_in: 'Adjustment In',
  adjustment_out: 'Adjustment Out',
  damage: 'Damage',
  loss: 'Loss',
  other: 'Other',
};

const DIRECTION_LABELS: Record<InventoryStockMovementDirection, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
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
  inventoryItems: InventoryItem[];
};

export function TitanStockMovementPanel({ inventoryItems }: Props) {
  const [movements, setMovements] = useState<InventoryStockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [inventoryItem, setInventoryItem] = useState('');
  const [movementType, setMovementType] = useState<InventoryStockMovementType>('outbound_delivery');
  const [direction, setDirection] = useState<InventoryStockMovementDirection>('outbound');
  const [quantity, setQuantity] = useState('1');
  const [sourceLabel, setSourceLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to load stock movements.');
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
      setFormError('Select an inventory item.');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      setFormError('Quantity must be a positive integer.');
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
      setFormError(err instanceof Error ? err.message : 'Failed to record movement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="titan-stock-panel" data-testid="titan-stock-movement-panel">
      <div className="titan-stock-panel__header">
        <h3 className="titan-stock-panel__title">Stock Movements</h3>
        <div className="titan-stock-panel__actions">
          <button
            className="titan-stock-panel__refresh"
            onClick={loadMovements}
            disabled={loading}
            aria-label="Refresh stock movements"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            className="titan-stock-panel__toggle"
            onClick={() => setShowForm((v) => !v)}
            aria-label={showForm ? 'Close record movement form' : 'Open record movement form'}
          >
            {showForm ? 'Cancel' : 'Record Movement'}
          </button>
        </div>
      </div>

      {error && (
        <p className="titan-stock-panel__error" role="alert">{error}</p>
      )}

      {showForm && (
        <form
          className="titan-stock-form"
          onSubmit={handleSubmit}
          aria-label="Record stock movement form"
        >
          <div className="titan-stock-form__row">
            <label className="titan-stock-form__label">
              Inventory Item
              <select
                value={inventoryItem}
                onChange={(e) => setInventoryItem(e.target.value)}
                disabled={submitting}
                aria-label="Select inventory item"
              >
                <option value="">— select item —</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className="titan-stock-form__label">
              Movement Type
              <select
                value={movementType}
                onChange={(e) => handleMovementTypeChange(e.target.value as InventoryStockMovementType)}
                disabled={submitting}
                aria-label="Movement type"
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
                  aria-label="Movement direction"
                >
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
              </label>
            )}

            <label className="titan-stock-form__label">
              Quantity
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={submitting}
                aria-label="Quantity"
              />
            </label>
          </div>

          <div className="titan-stock-form__row">
            <label className="titan-stock-form__label titan-stock-form__label--wide">
              Source / Reference
              <input
                type="text"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                disabled={submitting}
                placeholder="e.g. DR-2026-001, supplier ref…"
                aria-label="Source label"
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
            aria-label="Submit stock movement"
          >
            {submitting ? 'Recording…' : 'Record Movement'}
          </button>
        </form>
      )}

      <div className="titan-stock-panel__list" role="list" aria-label="Stock movements list">
        {!loading && movements.length === 0 && (
          <p className="titan-stock-panel__empty">No stock movements recorded yet.</p>
        )}
        {movements.map((m) => (
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
