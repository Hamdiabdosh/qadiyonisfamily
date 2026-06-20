import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_LOCATION,
  formatLocation,
  getRegionNames,
  getZonesForRegion,
  regionRequiresZone,
  ZONE_DISPLAY_HINTS,
  type LocationSelection,
} from "@/lib/ethiopia-locations";

type Props = {
  value: LocationSelection;
  onChange: (value: LocationSelection) => void;
};

export function LocationSelector({ value, onChange }: Props) {
  const { t } = useI18n();
  const regions = getRegionNames();
  const zones = getZonesForRegion(value.region);
  const hideZonePicker = Boolean(value.region) && !regionRequiresZone(value.region);
  const showZonePicker = !value.isForeign && !hideZonePicker;

  const setForeign = (isForeign: boolean) => {
    if (isForeign) {
      onChange({ isForeign: true, region: value.region, zone: value.zone });
      return;
    }
    onChange({
      isForeign: false,
      region: value.region,
      zone: value.zone,
    });
  };

  return (
    <div className="space-y-3">
      {!value.isForeign && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs">{t("region")}</Label>
            <SearchableSelect
              value={value.region}
              onValueChange={(region) =>
                onChange({
                  ...value,
                  region,
                  zone: "",
                })
              }
              options={regions}
              placeholder={t("region")}
              searchPlaceholder={t("searchRegion")}
              emptyText={t("noResults")}
            />
          </div>
          {showZonePicker ? (
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">{t("zone")}</Label>
              <SearchableSelect
                value={value.zone}
                onValueChange={(zone) => onChange({ ...value, zone })}
                options={zones}
                placeholder={t("zone")}
                searchPlaceholder={t("searchZone")}
                emptyText={t("noResults")}
                disabled={!value.region}
                optionHints={ZONE_DISPLAY_HINTS}
              />
            </div>
          ) : (
            <div className="min-w-0" aria-hidden />
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
        <Checkbox
          checked={value.isForeign}
          onCheckedChange={(checked) => setForeign(checked === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <span className="text-sm font-medium">{t("foreignCountry")}</span>
          <p className="text-xs text-muted-foreground">{t("foreignCountryHint")}</p>
        </div>
      </label>
    </div>
  );
}

export function locationSelectionToString(value: LocationSelection): string {
  return formatLocation(value.region, value.zone, value.isForeign);
}

export { DEFAULT_LOCATION, type LocationSelection };
