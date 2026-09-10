import React from "react";
import { Copy, FileText, Download } from "lucide-react";
import type { InteractiveComponent } from "../types";

interface ExportPanelProps {
  projectName: string;
  implementationGoal: string;
  components: InteractiveComponent[];
  onShowToast: (message: string) => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  projectName,
  implementationGoal,
  components,
  onShowToast,
}) => {
  const generateMarkdown = (): string => {
    let md = `# ${projectName}\n\n`;
    md += `## Objetivo de Implementación\n${implementationGoal}\n\n`;
    md += `## Componentes\n\n`;

    components.forEach((component) => {
      md += `### ${component.title}`;
      if (component.name) md += ` (\`${component.name}\`)`;
      md += `\n${component.description}\n\n`;

      component.features.forEach((feature) => {
        md += `#### [${feature.completed ? "x" : " "}] ${feature.title}\n`;
        if (feature.description) md += `${feature.description}\n\n`;
        if (feature.acceptance.length > 0) {
          md += `**Criterios de aceptación:**\n`;
          feature.acceptance.forEach((criterion) => {
            md += `- ${criterion}\n`;
          });
        }
        md += `\n`;
      });

      md += `---\n\n`;
    });

    return md.trim();
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(generateMarkdown());
    onShowToast("Contexto copiado como Markdown al portapapeles");
  };

  const downloadFile = (content: string, extension: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${projectName.toLowerCase().replace(/\s+/g, "_")}_context.${extension}`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMarkdown = () => {
    downloadFile(generateMarkdown(), "md", "text/markdown");
    onShowToast("Archivo Markdown descargado");
  };

  const handleExportJSON = () => {
    const rawData = {
      projectName,
      implementationGoal,
      components: components.map((component) => ({
        name: component.name,
        title: component.title,
        description: component.description,
        features: component.features.map((feature) => ({
          name: feature.name,
          title: feature.title,
          description: feature.description,
          completed: feature.completed,
          acceptance: feature.acceptance,
        })),
      })),
    };

    downloadFile(JSON.stringify(rawData, null, 2), "json", "application/json");
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
