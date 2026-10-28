import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoHelp } from "@/components/ui/info-help";
import { formatCurrency, formatPercentValue } from "@/lib/format";
import { compareQuantityPrice, type DisplayBasis, type MassUnit } from "@/lib/quantity-price";

export function QuantityPriceComparison({ grossPrice, quantityUnit }: {
  grossPrice: number | null;
  quantityUnit: string;
}) {
  const id = useId();
  const [basis, setBasis] = useState<DisplayBasis>("kg");
  const [packPrice, setPackPrice] = useState("");
  const [packWeight, setPackWeight] = useState("");
  const [packWeightUnit, setPackWeightUnit] = useState<MassUnit>("g");
  const [soldUnitWeight, setSoldUnitWeight] = useState("");
  const [soldUnitWeightUnit, setSoldUnitWeightUnit] = useState<MassUnit>("g");
  const result = compareQuantityPrice({ grossPrice, quantityUnit, basis, packPrice, packWeight, packWeightUnit, soldUnitWeight, soldUnitWeightUnit });
  const suffix = basis === "kg" ? "kg" : "100 g";
  const showInvalid = (packPrice !== "" || packWeight !== "") && result.competitor === null;
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center text-sm font-semibold">Preisvergleich inkl. MWST
          <InfoHelp label="Preisvergleich">Lokaler Packpreis-Vergleich. Nur bekannte Nettofüllmengen verwenden. Normalpreis, gespeicherte Einheit und Kalkulation bleiben unverändert.</InfoHelp>
        </span>
        <Select value={basis} onValueChange={(value) => setBasis(value as DisplayBasis)}>
          <SelectTrigger aria-label="Vergleichsbasis" className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="kg">pro kg</SelectItem><SelectItem value="100g">pro 100 g</SelectItem></SelectContent>
        </Select>
      </div>
      {quantityUnit !== "kg" ? (
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
          <div><Label htmlFor={`${id}-sold`}>Bekanntes Nettogewicht pro {quantityUnit}</Label><Input id={`${id}-sold`} aria-label="Nettogewicht pro Verkaufseinheit" type="number" min="0" step="any" value={soldUnitWeight} onChange={(event) => setSoldUnitWeight(event.target.value)} /></div>
          <WeightSelect label="Gewichtseinheit Verkaufseinheit" value={soldUnitWeightUnit} onChange={setSoldUnitWeightUnit} />
        </div>
      ) : null}
      {result.missingSoldWeight ? <p className="text-xs text-muted-foreground">Nettogewicht fehlt — kein vergleichbarer Massenpreis.</p> : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem]">
        <div><Label htmlFor={`${id}-price`}>Vergleich: Packpreis inkl. MWST</Label><Input id={`${id}-price`} type="number" min="0" step="any" inputMode="decimal" value={packPrice} onChange={(event) => setPackPrice(event.target.value)} /></div>
        <div><Label htmlFor={`${id}-weight`}>Nettofüllmenge der Packung</Label><Input id={`${id}-weight`} type="number" min="0" step="any" inputMode="decimal" value={packWeight} onChange={(event) => setPackWeight(event.target.value)} /></div>
        <WeightSelect label="Gewichtseinheit Packung" value={packWeightUnit} onChange={setPackWeightUnit} />
      </div>
      {showInvalid ? <p role="status" className="text-xs text-warning-foreground">Packpreis und Nettogewicht müssen grösser als null sein.</p> : null}
      <dl className="grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div><dt className="text-xs text-muted-foreground">Unser VP / {suffix}</dt><dd>{result.ours === null ? "—" : formatCurrency(result.ours)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Vergleich / {suffix}</dt><dd>{result.competitor === null ? "—" : formatCurrency(result.competitor)}</dd></div>
      </dl>
      {result.difference !== null ? <p className="text-xs">Unser VP ist {formatPercentValue(Math.abs(result.difference))} {result.difference > 0 ? "höher" : result.difference < 0 ? "tiefer" : "gleich"} als der Vergleichspreis.</p> : null}
    </div>
  );
}

function WeightSelect({ label, value, onChange }: { label: string; value: MassUnit; onChange: (unit: MassUnit) => void }) {
  return <Select value={value} onValueChange={(unit) => onChange(unit as MassUnit)}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="g">g</SelectItem><SelectItem value="kg">kg</SelectItem></SelectContent></Select>;
}