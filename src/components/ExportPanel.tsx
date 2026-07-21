import React from "react";
import { Copy, FileText, Download } from "lucide-react";
import type { InteractiveWorkstream } from "../types";

interface ExportPanelProps {
  projectName: string;
  implementationGoal: string;
  workstreams: InteractiveWorkstream[];
  onShowToast: (message: string) => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  projectName,
  implementationGoal,
  workstreams,
  onShowToast,
}) => {
  
  const generateMarkdown = (): string => {
    let md = `# ${projectName}\n\n`;
    md += `## Objetivo de Implementación\n${implementationGoal}\n\n`;
    md += `## Workstreams\n\n`;

    workstreams.forEach((ws) => {
      md += `### ${ws.area}\n`;
      md += `${ws.specification}\n\n`;
      md += `#### Tareas\n`;
      ws.tasks.forEach((task) => {
        md += `- [${task.completed ? "x" : " "}] ${task.description}\n`;
      });
      md += `\n---\n\n`;
    });

    return md.trim();
  };

  const handleCopyAll = () => {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md);
    onShowToast("Contexto copiado como Markdown al portapapeles");
  };

  const handleExportMarkdown = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${projectName.toLowerCase().replace(/\s+/g, "_")}_context.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Archivo Markdown descargado");
  };

  const handleExportJSON = () => {
    const rawData = {
      projectName,
      implementationGoal,
      workstreams: workstreams.map((ws) => ({
        area: ws.area,
        specification: ws.specification,
        tasks: ws.tasks.map((t) => ({
          description: t.description,
          completed: t.completed,
        })),
      })),
    };

    const json = JSON.stringify(rawData, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${projectName.toLowerCase().replace(/\s+/g, "_")}_context.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Archivo JSON descargado");
  };

  return (
    <div className="dashboard-actions fade-in" data-testid="export-panel">
      <button
        onClick={handleCopyAll}
        className="btn-premium btn-secondary"
        title="Copiar todo en formato Markdown"
      >
        <Copy size={16} />
        Copiar Markdown
      </button>

      <button
        onClick={handleExportMarkdown}
        className="btn-premium btn-secondary"
        title="Exportar archivo .md"
      >
        <FileText size={16} />
        Exportar MD
      </button>

      <button
        onClick={handleExportJSON}
        className="btn-premium btn-secondary"
        title="Exportar archivo .json"
      >
        <Download size={16} />
        Exportar JSON
      </button>
    </div>
  );
};
