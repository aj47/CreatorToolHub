"use client";
import { useEffect, useMemo, useState } from "react";
import { curatedStyles, isBuiltinProfileId } from "../lib/gallery/curatedStyles";

export default function TemplateGallery(props: {
  currentId: string;
  onApply: (id: string) => void;
  readOnly?: boolean;
}) {
  const { currentId, onApply, readOnly } = props;

  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cg_style_favs_v1");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("cg_style_favs_v1", JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  const list = useMemo(() => {
    return curatedStyles.filter((s) => (showOnlyFavs ? favorites[s.id] : true));
  }, [favorites, showOnlyFavs]);

  const toggleFav = (id: string) => {
    setFavorites((f) => ({ ...f, [id]: !f[id] }));
  };

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Template Gallery</h3>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showOnlyFavs} onChange={(e) => setShowOnlyFavs(e.target.checked)} />
          <span>Favorites only</span>
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {list.map((s) => (
          <article key={s.id} style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ position: "relative" }}>
              <img src={s.previewUrl} alt={s.label} style={{ display: "block", width: "100%" }} />
              <button
                onClick={() => toggleFav(s.id)}
                title={favorites[s.id] ? "Unfavorite" : "Favorite"}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: favorites[s.id] ? "#ef4444" : "#00000088",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                {favorites[s.id] ? "\u2665" : "\u2661"}
              </button>
            </div>
            <div style={{ padding: 10, display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{s.label}</span>
                {isBuiltinProfileId(s.id) && (
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Built-in</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8, lineHeight: 1.3 }}>{s.template}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  onClick={() => onApply(s.id)}
                  disabled={readOnly || currentId === s.id}
                  style={{ cursor: readOnly || currentId === s.id ? "default" : "pointer" }}
                  title={readOnly ? "Switch to Presets mode to apply" : undefined}
                >
                  {currentId === s.id ? "Active" : readOnly ? "Apply (Presets only)" : "Apply"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

