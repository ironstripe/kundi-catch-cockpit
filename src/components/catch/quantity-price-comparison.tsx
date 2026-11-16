import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoHelp } from "@/components/ui/info-help";
import { formatCurrency, formatPercentValue } from "@/lib/format";
import { compareQuantityPrice, type MassUnit } from "@/lib/quantity-price";

export function QuantityPriceComparison({
  grossPrice,
  quantityUnit,
  salePackKg = null,
}: {
  grossPrice: number | null;
  quantityUnit: string;
  /** Packungsmodus: bekanntes Nettogewicht der Verkaufspackung in kg. */
  salePackKg?: number | null;
}) {
  const id = useId();
  const [packPrice, setPackPrice] = useState("");
  const [packWeight, setPackWeight] = useState("");
  const [packWeightUnit, setPackWeightUnit] = useState<MassUnit>("g");
  const [soldUnitWeight, setSoldUnitWeight] = useState("");
  const [soldUnitWeightUnit, setSoldUnitWeightUnit] = useState<MassUnit>("g");
  const packMode = salePackKg !== null;
  const result = compareQuantityPrice({
    grossPrice,
    quantityUnit,
    knownSoldUnitKg: salePackKg,
    basis: "kg",
    packPrice,
    packWeight,
    packWeightUnit,
    soldUnitWeight,
    soldUnitWeightUnit,
  });
  const showInvalid = (packPrice !== "" || packWeight !== "") && result.competitor === null;
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center text-sm font-semibold">
          Preisvergleich pro kg
          <InfoHelp label="Preisvergleich">
            Preise inkl. MWST. Nur bekannte Nettofüllmengen verwenden. Normalpreis,
            gespeicherte Einheit und Kalkulation bleiben unverändert.
          </InfoHelp>
        </span>
      </div>
      {quantityUnit !== "kg" && !packMode ? (
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
          <div>
            <Label htmlFor={`${id}-sold`}>Bekanntes Nettogewicht pro {quantityUnit}</Label>
            <Input
              id={`${id}-sold`}
              aria-label="Nettogewicht pro Verkaufseinheit"
              type="number"
              min="0"
              step="any"
              value={soldUnitWeight}
              onChange={(event) => setSoldUnitWeight(event.target.value)}
            />
          </div>
          <WeightSelect
            label="Gewichtseinheit Verkaufseinheit"
            value={soldUnitWeightUnit}
            onChange={setSoldUnitWeightUnit}
          />
        </div>
      ) : null}
      {result.missingSoldWeight ? (
        <p className="text-xs text-muted-foreground">
          Nettogewicht fehlt — kein vergleichbarer Massenpreis.
        </p>
      ) : null}
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor={`${id}-price`}>Vergleichspreis pro Packung</Label>
          <Input
            id={`${id}-price`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={packPrice}
            onChange={(event) => setPackPrice(event.target.value)}
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor={`${id}-weight`}>Gewicht der Vergleichspackung</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-2">
            <Input
            id={`${id}-weight`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={packWeight}
            onChange={(event) => setPackWeight(event.target.value)}
            />
            <WeightSelect
              label="Gewichtseinheit der Vergleichspackung"
              value={packWeightUnit}
              onChange={setPackWeightUnit}
            />
          </div>
        </div>
      </div>
      {showInvalid ? (
        <p role="status" className="text-xs text-warning-foreground">
          Packpreis und Nettogewicht müssen grösser als null sein.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div>
          <dt className="text-xs text-muted-foreground">Unser VP / kg</dt>
          <dd>{result.ours === null ? "—" : formatCurrency(result.ours)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Vergleich / kg</dt>
          <dd>{result.competitor === null ? "—" : formatCurrency(result.competitor)}</dd>
        </div>
      </dl>
      {result.difference !== null ? (
        <p className="text-xs">
          Unser VP ist {formatPercentValue(Math.abs(result.difference))}{" "}
          {result.difference > 0 ? "höher" : result.difference < 0 ? "tiefer" : "gleich"} als der
          Vergleichspreis.
        </p>
      ) : null}
    </div>
  );
}

function WeightSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MassUnit;
  onChange: (unit: MassUnit) => void;
}) {
  return (
    <Select value={value} onValueChange={(unit) => onChange(unit as MassUnit)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="g">g</SelectItem>
        <SelectItem value="kg">kg</SelectItem>
      </SelectContent>
    </Select>
  );
}
