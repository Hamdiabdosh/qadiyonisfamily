import { useI18n } from "@/lib/i18n";

type Props = {
  className?: string;
  linkClassName?: string;
  prefix?: string;
};

export function BuiltByRaafat({
  className = "text-[11px] text-muted-foreground",
  linkClassName = "font-semibold hover:text-foreground transition-colors",
  prefix = "Built by",
}: Props) {
  return (
    <p className={className}>
      {prefix}{" "}
      <a href="https://raafat.site" target="_blank" rel="noopener noreferrer" className={linkClassName}>
        RAAFAT-DIGITAL
      </a>
    </p>
  );
}

export function BuiltByRaafatI18n(props: Omit<Props, "prefix">) {
  const { t } = useI18n();
  return <BuiltByRaafat prefix={t("footer.builtBy")} {...props} />;
}
