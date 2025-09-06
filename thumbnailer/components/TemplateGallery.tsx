"use client";
import { useEffect, useMemo, useState } from "react";
import { curatedStyles, isBuiltinProfileId } from "../lib/gallery/curatedStyles";

type Preset = {
  label: string;
  template: string;
  colors: string[];
  layout: "left_subject_right_text" | "split_screen" | "center_text";
  subject: "face" | "product" | "ui" | "two_faces";
};

export default function TemplateGallery(props: {
  currentId: string;
  onApply: (id: string) => void;
  customPresets: Record<string, Preset>;
  onDuplicate: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onUpdatePreset: (id: string, update: Partial<Preset>) => void;
  onCreatePreset: (p: Preset) => void;
}) {
  const { currentId, onApply, customPresets, onDuplicate, onDeletePreset, onUpdatePreset, onCreatePreset } = props;

  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftTemplate, setDraftTemplate] = useState("");
  const [draftColors, setDraftColors] = useState("");
  const [draftSubject, setDraftSubject] = useState<Preset["subject"]>("face");
  const [draftLayout, setDraftLayout] = useState<Preset["layout"]>("left_subject_right_text");

  // New preset draft state
  const [newOpen, setNewOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [newColors, setNewColors] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState<Preset["subject"]>("face");
  const [newLayout, setNewLayout] = useState<Preset["layout"]>("left_subject_right_text");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cg_style_favs_v1");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("cg_style_favs_v1", JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  const combined = useMemo(() => {
    const curated = curatedStyles.map((s) => ({ ...s, source: isBuiltinProfileId(s.id) ? "builtin" as const : "curated" as const }));
    const customs = Object.entries(customPresets).map(([id, p]) => ({ id, label: p.label, template: p.template, previewUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='480' height='270'><rect width='100%' height='100%' fill='%2364748B'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Inter, ui-sans-serif, system-ui' font-size='28' font-weight='700' fill='#ffffff'>${p.label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text></svg>`)}`, source: "custom" as const }));
    return [...curated, ...customs];
  }, [customPresets]);

  const list = useMemo(() => {
    return combined.filter((s) => (showOnlyFavs ? favorites[s.id] : true));
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
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










                {favorites[s.id] ? "★" : "☆"}
              </button>
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong>{s.label}</strong>
                {isBuiltinProfileId(s.id) && <span style={{ fontSize: 10, opacity: 0.6 }}>Built-in</span>}
              </div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8, lineHeight: 1.3 }}>{s.template}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => onApply(s.id)}
                  disabled={currentId === s.id}
                  style={{ cursor: currentId === s.id ? "default" : "pointer" }}
                >
                  {currentId === s.id ? "Active" : "Apply"}
                </button>
                <button onClick={() => onDuplicate(s.id)}>Duplicate</button>
                {customPresets[s.id] && (
                  <>
                    <button onClick={() => {
                      setEditingId(s.id);
                      const p = customPresets[s.id];
                      setDraftLabel(p.label);
                      setDraftTemplate(p.template);
                      setDraftColors((p.colors || []).join(", "));
                      setDraftSubject(p.subject);
                      setDraftLayout(p.layout);
                    }}>Edit</button>
                    <button onClick={() => onDeletePreset(s.id)} title="Delete">×</button>
                  </>
                )}
              </div>

              {editingId === s.id && (
                <div style={{ display: "grid", gap: 6, marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
                  <input type="text" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="Preset name" />
                  <input type="text" value={draftTemplate} onChange={(e) => setDraftTemplate(e.target.value)} placeholder="Style template" />
                  <input type="text" value={draftColors} onChange={(e) => setDraftColors(e.target.value)} placeholder="Colors comma-separated" />
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12 }}>Pick colors</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {draftColors.split(',').map((s, idx) => s.trim()).filter(Boolean).map((c, idx) => (
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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label>
                      Subject:&nbsp;
                      <select value={draftSubject} onChange={(e) => setDraftSubject(e.target.value as any)}>
                        <option value="face">Face</option>
                        <option value="product">Product</option>
                        <option value="ui">UI</option>
                        <option value="two_faces">Two faces</option>
                      </select>
                    </label>
                    <label>
                      Layout:&nbsp;
                      <select value={draftLayout} onChange={(e) => setDraftLayout(e.target.value as any)}>
                        <option value="left_subject_right_text">Left subject / Right text</option>
                        <option value="split_screen">Split screen</option>
                        <option value="center_text">Center text</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => {
                      const colors = draftColors.split(',').map((s) => s.trim()).filter(Boolean);
                      onUpdatePreset(s.id, { label: draftLabel, template: draftTemplate, colors, subject: draftSubject, layout: draftLayout });
                      setEditingId(null);
                    }}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
        {/* New template placeholder card */}
        <article key="__new__" style={{ border: "2px dashed #cbd5e1", borderRadius: 8, padding: 12, display: "grid", gap: 8, alignItems: "start" }}>
          {!newOpen ? (
            <button onClick={() => setNewOpen(true)} style={{ padding: "24px 12px", cursor: "pointer" }}>+ New template</button>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Preset name" />
              <input type="text" value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)} placeholder="Style template" />
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  Subject:&nbsp;
                  <select value={newSubject} onChange={(e) => setNewSubject(e.target.value as any)}>
                    <option value="face">Face</option>
                    <option value="product">Product</option>
                    <option value="ui">UI</option>
                    <option value="two_faces">Two faces</option>
                  </select>
                </label>
                <label>
                  Layout:&nbsp;
                  <select value={newLayout} onChange={(e) => setNewLayout(e.target.value as any)}>
                    <option value="left_subject_right_text">Left subject / Right text</option>
                    <option value="split_screen">Split screen</option>
                    <option value="center_text">Center text</option>
                  </select>
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  const label = newLabel.trim();
                  const template = newTemplate.trim();
                  if (!label || !template) return;
                  onCreatePreset({ label, template, colors: newColors, layout: newLayout, subject: newSubject });
                  setNewOpen(false);
                  setNewLabel("");
                  setNewTemplate("");
                  setNewColors([]);
                  setNewSubject("face");
                  setNewLayout("left_subject_right_text");
                }}>Create</button>
                <button onClick={() => { setNewOpen(false); setNewLabel(""); setNewTemplate(""); setNewColors([]); setNewSubject("face"); setNewLayout("left_subject_right_text"); }}>Cancel</button>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

