import React from "react";
import { Sun, Moon, Cpu } from "lucide-react";

interface HeaderProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo-container">
            <Cpu className="logo-icon" size={28} />
            <div className="logo-glow" />
          </div>
          <div>
            <h1 className="gradient-text">Development Context Agent</h1>
            <p className="subtitle">Capacidad 3 · Generación automática de componentes y features desde HLD</p>
          </div>
        </div>
        
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
          title={theme === "light" ? "Modo Oscuro" : "Modo Claro"}
        >
          {theme === "light" ? (
            <Moon className="theme-icon" size={20} />
          ) : (
            <Sun className="theme-icon" size={20} />
          )}
        </button>
      </div>
    </header>
  );
};
