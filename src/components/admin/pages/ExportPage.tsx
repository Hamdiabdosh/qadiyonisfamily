import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminActions, AdminData } from "../types";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

export function ExportPage({ data, actions }: Props) {
  const formats = [
    {
      title: "CSV",
      description: "Spreadsheet-friendly export of all members (approved + pending).",
      icon: FileSpreadsheet,
      onClick: actions.exportCSV,
    },
    {
      title: "JSON",
      description: "Full structured data dump for backups or integrations.",
      icon: FileJson,
      onClick: actions.exportJSON,
    },
    {
      title: "GEDCOM",
      description: "Genealogy standard format for import into other tree tools.",
      icon: FileText,
      onClick: actions.exportGEDCOM,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dataset summary</CardTitle>
          <CardDescription>
            {data.all.length} total records ({data.approved.length} approved, {data.pending.length}{" "}
            pending)
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {formats.map(({ title, description, icon: Icon, onClick }) => (
          <Card key={title}>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-5 text-primary" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={onClick}>
                <Download className="size-4 mr-2" />
                Export {title}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            For a visual PDF tree export, open the Family App tree page and use your browser&apos;s
            Print function.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
