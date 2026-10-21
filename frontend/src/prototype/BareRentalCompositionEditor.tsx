import type { BareRentalCompositionItem } from "../types";

export default function BareRentalCompositionEditor({ value, onChange, disabled = false }: {
  value: BareRentalCompositionItem[];
  onChange: (value: BareRentalCompositionItem[]) => void;
  disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-slate-200 p-4">
    <legend className="px-2 font-semibold">Composition de la location nue</legend>
    {value.map((item, index) => <div key={index} className="flex flex-wrap items-end gap-2">
      <label className="flex-1 text-sm">Élément {index + 1}<input required maxLength={200} value={item.label} onChange={event => onChange(value.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} className="block w-full rounded-lg border border-slate-300 p-2" /></label>
      <label className="text-sm">Quantité {index + 1}<input type="number" required min={1} max={9999} step={1} value={item.quantity || ""} onChange={event => onChange(value.map((row, i) => i === index ? { ...row, quantity: Number(event.target.value) } : row))} className="block w-24 rounded-lg border border-slate-300 p-2" /></label>
      <button type="button" disabled={index === 0} aria-label={`Monter l’élément ${index + 1}`} onClick={() => { const rows = [...value]; [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]]; onChange(rows); }}>↑</button>
      <button type="button" disabled={index === value.length - 1} aria-label={`Descendre l’élément ${index + 1}`} onClick={() => { const rows = [...value]; [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]]; onChange(rows); }}>↓</button>
      <button type="button" disabled={value.length === 1} aria-label={`Retirer l’élément ${index + 1}`} onClick={() => onChange(value.filter((_, i) => i !== index))} className="text-sm text-rose-700">Retirer</button>
    </div>)}
    <button type="button" disabled={value.length >= 50} onClick={() => onChange([...value, { label: "", quantity: 1 }])} className="text-sm font-semibold text-indigo-700">Ajouter un élément</button>
  </fieldset>;
}
