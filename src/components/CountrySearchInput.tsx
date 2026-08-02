import { useEffect, useMemo, useRef, useState } from "react";
import { flagFor, searchCountries } from "@/lib/countries";

/**
 * Tactical country search field for mission creation.
 * Type-ahead filters the full ISO country list; the selected country is shown
 * with its emoji flag.
 */
export function CountrySearchInput({
  value,
  onChange,
  placeholder,
  inputStyle,
  accent = "#E0B04E",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputStyle: React.CSSProperties;
  accent?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const results = useMemo(() => searchCountries(query), [query]);
  const flag = flagFor(value);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (query.trim() !== value) onChange(query.trim()); }}
          placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: flag ? 40 : (inputStyle as any).paddingRight }}
          autoComplete="off"
        />
        {flag && (
          <span
            aria-hidden
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 18, lineHeight: 1 }}
          >
            {flag}
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <ul
          style={{
            position: "absolute", zIndex: 40, left: 0, right: 0, top: "calc(100% + 4px)",
            background: "#0d100b", border: `1px solid ${accent}55`,
            maxHeight: 220, overflowY: "auto", margin: 0, padding: 0, listStyle: "none",
            boxShadow: "0 16px 30px -12px rgba(0,0,0,0.8)",
          }}
        >
          {results.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(c.name); setQuery(c.name); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: "none",
                  padding: "8px 10px", cursor: "pointer", color: "#ece3c4",
                  fontFamily: "monospace", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span aria-hidden style={{ fontSize: 15 }}>{flagFor(c.name)}</span>
                <span>{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
