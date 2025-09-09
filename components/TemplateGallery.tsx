"use client";
import { useEffect, useMemo, useState } from "react";
import { curatedStyles, isBuiltinProfileId } from "../lib/gallery/curatedStyles";

type Preset = {
  title: string;
  prompt: string;
  colors: string[];
  referenceImages: string[];
};

export default function TemplateGallery(props: {
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  customPresets: Record<string, Preset>;
  onDuplicate: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onUpdatePreset: (id: string, update: Partial<Preset>) => void;
  onCreatePreset: (p: Preset) => void;
}) {
  const { selectedIds, onToggleSelect, customPresets, onDuplicate, onDeletePreset, onUpdatePreset, onCreatePreset } = props;

  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftColors, setDraftColors] = useState("");
  const [draftRefs, setDraftRefs] = useState("");

  // New preset draft state
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newColors, setNewColors] = useState<string[]>([]);
  const [newRefs, setNewRefs] = useState<string>("");

  useEffect(() => {
    try {
      const raw2 = localStorage.getItem("cg_style_favs_v2");
      const raw1 = !raw2 ? localStorage.getItem("cg_style_favs_v1") : null;
      const raw = raw2 || raw1;
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
    // Load "Favorites only" preference
    try {
      const so = localStorage.getItem("cg_gallery_only_favs_v1");
      if (so != null) setShowOnlyFavs(so === "1" || so === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("cg_style_favs_v2", JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  useEffect(() => {
    try { localStorage.setItem("cg_gallery_only_favs_v1", showOnlyFavs ? "1" : "0"); } catch {}
  }, [showOnlyFavs]);

  const combined = useMemo(() => {
    const curated = curatedStyles.map((s) => ({ ...s, source: isBuiltinProfileId(s.id) ? "builtin" as const : "curated" as const }));
    const customs = Object.entries(customPresets).map(([id, p]) => {
      const title = p.title || "Custom";
      const prompt = p.prompt || "";
      const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const previewUrl = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='480' height='270'><rect width='100%' height='100%' fill='%2364748B'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Inter, ui-sans-serif, system-ui' font-size='28' font-weight='700' fill='#ffffff'>${safeTitle}</text></svg>`)}`;
      const referenceImages = p.referenceImages || [];
      return { id, title, prompt, previewUrl, referenceImages, source: "custom" as const };
    });
    return [...curated, ...customs];
  }, [customPresets]);

  const list = useMemo(() => {
    const filtered = combined.filter((s) => (showOnlyFavs ? favorites[s.id] : true));
    // Sort: items with reference images first, preserve relative order otherwise
    const withRef = filtered.filter((s: any) => Array.isArray((s as any).referenceImages) && (s as any).referenceImages.length > 0);
    const withoutRef = filtered.filter((s: any) => !Array.isArray((s as any).referenceImages) || (s as any).referenceImages.length === 0);
    return [...withRef, ...withoutRef];
  }, [combined, favorites, showOnlyFavs]);

  const toggleFav = (id: string) => setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Template Gallery</h3>
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={showOnlyFavs} onChange={(e) => setShowOnlyFavs(e.target.checked)} /> Favorites only
        </label>
      </div>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
        Templates with example reference images (style/layout only) are shown first. Subjects come from your frames/images below. Use Favorites to curate your list.
      </p>
      <div style={{ maxHeight: 600, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {list.map((s) => { const selected = selectedIds.includes(s.id); return (
          <article
            key={s.id}
            onClick={() => onToggleSelect(s.id)}
            style={{
              border: selected ? "2px solid #3b82f6" : "1px solid #ddd",
              boxShadow: selected ? "0 0 0 2px rgba(59,130,246,0.2)" : undefined,
              borderRadius: 8,
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            <div style={{ position: "relative" }}>
              <img src={s.previewUrl} alt={s.title} style={{ display: "block", width: "100%" }} />
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(s.id); }}
                title="Duplicate"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 48,
                  background: "#00000088",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 10px",
                  cursor: "pointer"
                }}
              >
                ⧉
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); toggleFav(s.id); }}
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










                {favorites[s.id] ? "★" : "☆"}
              </button>
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong>{s.title}</strong>
                {isBuiltinProfileId(s.id) && <span style={{ fontSize: 10, opacity: 0.6 }}>Built-in</span>}
              </div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" } as any}>{s.prompt}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>

                {customPresets[s.id] && (
                  <>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(s.id);
                      const p = customPresets[s.id];
                      setDraftTitle(p.title);
                      setDraftPrompt(p.prompt);
                      setDraftColors((p.colors || []).join(", "));
                      setDraftRefs((p.referenceImages || []).join(", "));
                    }}>Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); onDeletePreset(s.id); }} title="Delete">×</button>
                  </>
                )}
              </div>

              {editingId === s.id && (
                <div style={{ display: "grid", gap: 6, marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
                  <input type="text" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Title" />
                  <input type="text" value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} placeholder="Exact prompt" />
                  <input type="text" value={draftColors} onChange={(e) => setDraftColors(e.target.value)} placeholder="Colors comma-separated" />
                  <input type="text" value={draftRefs} onChange={(e) => setDraftRefs(e.target.value)} placeholder="Reference images (comma-separated URLs)" />
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12 }}>Pick colors</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {draftColors.split(',').map((s) => s.trim()).filter(Boolean).map((c, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="color"
                            value={/^#?[0-9a-fA-F]{6}$/.test(c) ? (c.startsWith('#') ? c : `#${c}`) : "#000000"}
                            onChange={(e) => {
                              const parts = draftColors.split(',').map((x) => x.trim());
                              parts[idx] = e.target.value;
                              setDraftColors(parts.join(', '));
                            }}
                            aria-label={`Color ${idx + 1}`}
                          />
                          <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                            {/^#?[0-9a-fA-F]{6}$/.test(c) ? (c.startsWith('#') ? c : `#${c}`) : "#000000"}
                          </span>
                          <button type="button" onClick={() => {
                            const parts = draftColors.split(',').map((x) => x.trim()).filter(Boolean);
                            const next = parts.filter((_, i) => i !== idx);
                            setDraftColors(next.join(', '));
                          }}>Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        const parts = draftColors.split(',').map((x) => x.trim()).filter(Boolean);
                        parts.push('#00E5FF');
                        setDraftColors(parts.join(', '));
                      }}>+ Add color</button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => {
                      const colors = draftColors.split(',').map((s) => s.trim()).filter(Boolean);
                      const referenceImages = draftRefs.split(',').map((s) => s.trim()).filter(Boolean);
                      onUpdatePreset(s.id, { title: draftTitle, prompt: draftPrompt, colors, referenceImages });
                      setEditingId(null);
                    }}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ); })}
        {/* New template placeholder card */}
        <article key="__new__" style={{ border: "2px dashed #cbd5e1", borderRadius: 8, padding: 12, display: "grid", gap: 8, alignItems: "start" }}>
          {!newOpen ? (
            <button onClick={() => setNewOpen(true)} style={{ padding: "24px 12px", cursor: "pointer" }}>+ New template</button>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" />
              <input type="text" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="Exact prompt" />
              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12 }}>Pick colors</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {newColors.map((c, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="color"
                        value={/^#?[0-9a-fA-F]{6}$/.test(c) ? (c.startsWith('#') ? c : `#${c}`) : "#000000"}
                        onChange={(e) => setNewColors((prev) => prev.map((pc, i) => (i === idx ? e.target.value : pc)))}
                      />
                      <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                        {/^#?[0-9a-fA-F]{6}$/.test(c) ? (c.startsWith('#') ? c : `#${c}`) : "#000000"}
                      </span>
                      <button type="button" onClick={() => setNewColors((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewColors((prev) => [...prev, "#00E5FF"]) }>+ Add color</button>
                </div>
              </div>
              <input type="text" value={newRefs} onChange={(e) => setNewRefs(e.target.value)} placeholder="Reference images (comma-separated URLs)" />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  const title = newTitle.trim();
                  const prompt = newPrompt.trim();
                  if (!title || !prompt) return;
                  const referenceImages = newRefs.split(',').map((s) => s.trim()).filter(Boolean);
                  onCreatePreset({ title, prompt, colors: newColors, referenceImages });
                  setNewOpen(false);
                  setNewTitle("");
                  setNewPrompt("");
                  setNewRefs("");
                  setNewColors([]);
                }}>Create</button>
                <button onClick={() => { setNewOpen(false); setNewTitle(""); setNewPrompt(""); setNewRefs(""); setNewColors([]); }}>Cancel</button>
              </div>
            </div>
          )}
        </article>
        </div>
      </div>
    </section>
  );
}

