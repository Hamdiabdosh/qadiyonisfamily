import type { ReactNode } from "react";

import { InstallAppButton } from "@/components/InstallAppButton";

type Props = {
  title: string;
  icon?: ReactNode;
  leading?: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function PageTitleRow({ title, icon, leading, description, className }: Props) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {leading}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            <h2 className="page-title truncate">{title}</h2>
          </div>
          <InstallAppButton showLabel className="shrink-0" />
        </div>
      </div>
      <span className="page-title-accent" />
      {description}
    </div>
  );
}
