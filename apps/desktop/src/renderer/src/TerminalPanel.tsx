import { useEffect, useRef } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const LIGHT_THEME: ITheme = {
  background: "#faf6ee",
  foreground: "#2c2c3e",
  cursor: "#b8963e",
  cursorAccent: "#faf6ee",
  selectionBackground: "rgba(184, 150, 62, 0.28)",
  black: "#2c2c3e",
  red: "#b91c1c",
  green: "#166534",
  yellow: "#b48214",
  blue: "#1d4ed8",
  magenta: "#86198f",
  cyan: "#0e7490",
  white: "#6b6b82",
  brightBlack: "#6b6b82",
  brightRed: "#dc2626",
  brightGreen: "#15803d",
  brightYellow: "#d97706",
  brightBlue: "#2563eb",
  brightMagenta: "#a21caf",
  brightCyan: "#0891b2",
  brightWhite: "#2c2c3e",
};

const DARK_THEME: ITheme = {
  background: "#1a2140",
  foreground: "#e6e0d2",
  cursor: "#d4b667",
  cursorAccent: "#1a2140",
  selectionBackground: "rgba(212, 182, 103, 0.3)",
  black: "#39436b",
  red: "#f07b7b",
  green: "#57b884",
  yellow: "#d9a83c",
  blue: "#7da2f5",
  magenta: "#d18ad6",
  cyan: "#67c5d8",
  white: "#e6e0d2",
  brightBlack: "#9d9ab0",
  brightRed: "#f59a9a",
  brightGreen: "#7fd0a4",
  brightYellow: "#e7c06a",
  brightBlue: "#9db8f8",
  brightMagenta: "#dfa9e3",
  brightCyan: "#8cd6e5",
  brightWhite: "#f6f0e6",
};

export function TerminalPanel({ cwd, dark }: { cwd?: string; dark: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const initialCwd = useRef(cwd);
  const initialDark = useRef(dark);

  useEffect(() => {
    const host = hostRef.current!;
    const term = new Terminal({
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 12.5,
      cursorBlink: true,
      theme: initialDark.current ? DARK_THEME : LIGHT_THEME,
    });
    termRef.current = term;
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    window.kiyas.termStart(initialCwd.current);
    const offData = window.kiyas.onTermData((data) => term.write(data));
    const inputSub = term.onData((data) => window.kiyas.termInput(data));
    const sync = () => {
      fit.fit();
      window.kiyas.termResize(term.cols, term.rows);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(host);
    sync();
    term.focus();

    return () => {
      observer.disconnect();
      offData();
      inputSub.dispose();
      term.dispose();
      termRef.current = null;
      window.kiyas.termStop();
    };
  }, []);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = dark ? DARK_THEME : LIGHT_THEME;
    }
  }, [dark]);

  return <div className="term-host" ref={hostRef} />;
}
