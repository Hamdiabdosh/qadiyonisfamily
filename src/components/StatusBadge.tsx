import { statusOf, statusClass, type Member } from "@/lib/family";
import { useI18n } from "@/lib/i18n";

export function StatusBadge({ m }: { m: Member }) {
  const { t } = useI18n();
  const s = statusOf(m);
  const label =
    s === "root" ? t("rootPerson") :
    s === "kinAlive" ? `${t("kin")} • ${t("alive")}` :
    s === "kinDead" ? `${t("kin")} • ${t("dead")}` :
    s === "outAlive" ? `${t("outOfKin")} • ${t("alive")}` :
    `${t("outOfKin")} • ${t("dead")}`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border shadow-sm ${statusClass[s]}`}>
      {label}
    </span>
  );
}
