"use client";
import { useEffect, useMemo, useState } from "react";
import { curatedStyles, isBuiltinProfileId } from "../lib/gallery/curatedStyles";

type Preset = {
  title: string;
  prompt: string;
  colors: string[];
  referenceImages: string[];
};

type ReferenceImage = {
  id: string;
  filename: string;
  url: string;
};

export default function TemplateGallery(props: {
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  customPresets: Record<string, Preset>;
  onDuplicate: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onUpdatePreset: (id: string, update: Partial<Preset>) => void;
  onCreatePreset: (p: Preset) => void;
  hybridStorage?: any; // Add hybrid storage for file uploads
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
  const [newRefFiles, setNewRefFiles] = useState<File[]>([]);
  const [editRefFiles, setEditRefFiles] = useState<File[]>([]);
  const [uploadingRefs, setUploadingRefs] = useState(false);

  // Helper function to handle reference image file uploads
  const handleRefFileUpload = (files: FileList | null, isEdit: boolean = false) => {
    if (!files) return;

    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/') && file.size <= 25 * 1024 * 1024 // 25MB limit
    );

    if (isEdit) {
      setEditRefFiles(prev => [...prev, ...imageFiles].slice(0, 3)); // Max 3 images
    } else {
      setNewRefFiles(prev => [...prev, ...imageFiles].slice(0, 3)); // Max 3 images
    }
  };

  // Helper: file -> data URL (for local mode previews)
  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Helper function to remove reference image file
  const removeRefFile = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditRefFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setNewRefFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

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
    // Build customs in reverse insertion order so newly created appear first
    const customEntries = Object.entries(customPresets);
    const customs = customEntries.reverse().map(([id, p]) => {
      const title = p.title || "Custom";
      const prompt = p.prompt || "";
      const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const referenceImages = p.referenceImages || [];
      const refPreview = referenceImages.find((u) => typeof u === 'string' && (/^data:image/.test(u) || /^https?:\/\//.test(u) || u.startsWith('/')));
      const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='480' height='270'><rect width='100%' height='100%' fill='%2364748B'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Inter, ui-sans-serif, system-ui' font-size='28' font-weight='700' fill='#ffffff'>${safeTitle}</text></svg>`)}`;
      const previewUrl = refPreview || fallback;
      return { id, title, prompt, previewUrl, referenceImages, source: "custom" as const };
    });
    const curated = curatedStyles.map((s) => ({ ...s, source: isBuiltinProfileId(s.id) ? "builtin" as const : "curated" as const }));
    // Custom templates first, then curated
    return [...customs, ...curated];
  }, [customPresets]);

  const list = useMemo(() => {
    const filtered = combined.filter((s) => (showOnlyFavs ? favorites[s.id] : true));
    // Within each group, show items with reference images first
    const custom = filtered.filter((s: any) => (s as any).source === "custom");
    const curatedOnly = filtered.filter((s: any) => (s as any).source !== "custom");

    const splitByRef = (arr: any[]) => {
      const withRef = arr.filter((s: any) => Array.isArray(s.referenceImages) && s.referenceImages.length > 0);
      const withoutRef = arr.filter((s: any) => !Array.isArray(s.referenceImages) || s.referenceImages.length === 0);
      return [...withRef, ...withoutRef];
    };

    return [...splitByRef(custom), ...splitByRef(curatedOnly)];
  }, [combined, favorites, showOnlyFavs]);

  const toggleFav = (id: string) => setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {newOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div role="dialog" aria-modal="true" style={{ width: "min(520px, 92vw)", maxHeight: "85vh", overflowY: "auto", background: "var(--nb-card)", border: "2px solid #000", boxShadow: "8px 8px 0 #000", borderRadius: 10, padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>Create New Template</h4>
              <button onClick={() => { setNewOpen(false); setNewTitle(""); setNewPrompt(""); setNewRefs(""); setNewColors([]); setNewRefFiles([]); }} aria-label="Close">×</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Title</span>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Exact prompt</span>
                <input type="text" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="Exact prompt" style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
              </label>

              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Colors</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {newColors.map((c, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="color"
                        value={/^#?[0-9a-fA-F]{6}$/.test(c) ? (c.startsWith('#') ? c : `#${c}`) : "#000000"}
                        onChange={(e) => setNewColors((prev) => prev.map((pc, i) => (i === idx ? e.target.value : pc)))}
                        aria-label={`Color ${idx + 1}`}
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

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Reference Images (max 3, for style/layout guidance)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleRefFileUpload(e.target.files, false)}
                  style={{ fontSize: 12 }}
                />
                {newRefFiles.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {newRefFiles.map((file, idx) => (
                      <div key={idx} style={{ position: "relative", display: "inline-block" }}>
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeRefFile(idx, false)}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            border: "none",
                            background: "#ff4444",
                            color: "white",
                            fontSize: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="text" value={newRefs} onChange={(e) => setNewRefs(e.target.value)} placeholder="Or paste image URLs (comma-separated)" style={{ fontSize: 12, padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={async () => {
                    const title = newTitle.trim();
                    const prompt = newPrompt.trim();
                    if (!title || !prompt) return;

                    if (!props.hybridStorage) {
                      // Fallback to URL-based approach
                      const referenceImages = newRefs.split(',').map((s) => s.trim()).filter(Boolean);
                      onCreatePreset({ title, prompt, colors: newColors, referenceImages });
                      setNewOpen(false);
                      setNewTitle("");
                      setNewPrompt("");
                      setNewRefs("");
                      setNewColors([]);
                      return;
                    }

                    try {
                      setUploadingRefs(true);
                      const referenceImages = newRefs.split(',').map((s) => s.trim()).filter(Boolean);

                      // Add reference image files
                      for (const file of newRefFiles) {
                        if (props.hybridStorage?.isCloudEnabled) {
                          const uploadedImage = await props.hybridStorage.uploadRefFrame(file);
                          referenceImages.push(`uploaded:${uploadedImage.id}`);
                        } else {
                          // Store as data URL in local mode so it shows as a thumbnail
                          const dataUrl = await fileToDataUrl(file);
                          referenceImages.push(dataUrl);
                        }
                      }

                      onCreatePreset({ title, prompt, colors: newColors, referenceImages });
                      setNewOpen(false);
                      setNewTitle("");
                      setNewPrompt("");
                      setNewRefs("");
                      setNewColors([]);
                      setNewRefFiles([]);
                    } catch (error) {
                      console.error('Failed to upload reference images:', error);
                      alert('Failed to upload reference images. Please try again.');
                    } finally {
                      setUploadingRefs(false);
                    }
                  }}
                  disabled={uploadingRefs}
                  style={{ background: "var(--nb-accent)", color: "#000", border: "2px solid #000", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
                >
                  {uploadingRefs ? 'Creating...' : 'Create'}
                </button>
                <button onClick={() => { setNewOpen(false); setNewTitle(""); setNewPrompt(""); setNewRefs(""); setNewColors([]); setNewRefFiles([]); }}
                  style={{ background: "#fff", border: "1px solid #ccc", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
      {/* Container height set to 1.1x card height (~256px per card = ~282px for 1.1 cards) */}
      <div style={{ maxHeight: 282, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {/* New Template card (opens modal) */}
          <article key="__new_card__" style={{ border: "2px dashed #cbd5e1", borderRadius: 8, padding: 12, display: "grid", placeContent: "center", minHeight: 120 }}>
            <button onClick={() => setNewOpen(true)} style={{ padding: "24px 12px", cursor: "pointer" }}>+ New template</button>
          </article>

        {list.map((s) => { const selected = selectedIds.includes(s.id); return (
          <article
            key={s.id}
            onClick={() => onToggleSelect(s.id)}
            style={{
              border: selected ? "3px solid var(--nb-accent)" : "3px solid #000",
              boxShadow: "6px 6px 0 #000",
              borderRadius: 8,
              overflow: "hidden",
              cursor: "pointer",
              background: "var(--nb-card)",
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
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Reference Images (for style/layout guidance)</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleRefFileUpload(e.target.files, true)}
                      style={{ fontSize: 12 }}
                    />
                    {editRefFiles.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {editRefFiles.map((file, idx) => (
                          <div key={idx} style={{ position: "relative", display: "inline-block" }}>
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
                            />
                            <button
                              type="button"
                              onClick={() => removeRefFile(idx, true)}
                              style={{
                                position: "absolute",
                                top: -4,
                                right: -4,
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                border: "none",
                                background: "#ff4444",
                                color: "white",
                                fontSize: 10,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input type="text" value={draftRefs} onChange={(e) => setDraftRefs(e.target.value)} placeholder="Or paste URLs (comma-separated)" style={{ fontSize: 12 }} />
                  </div>
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
                    <button
                      onClick={async () => {
                        if (!props.hybridStorage) {
                          // Fallback to URL-based approach
                          const colors = draftColors.split(',').map((s) => s.trim()).filter(Boolean);
                          const referenceImages = draftRefs.split(',').map((s) => s.trim()).filter(Boolean);
                          onUpdatePreset(s.id, { title: draftTitle, prompt: draftPrompt, colors, referenceImages });
                          setEditingId(null);
                          return;
                        }

                        try {
                          setUploadingRefs(true);
                          const colors = draftColors.split(',').map((s) => s.trim()).filter(Boolean);
                          const referenceImages = draftRefs.split(',').map((s) => s.trim()).filter(Boolean);

                          // Add reference image files
                          for (const file of editRefFiles) {
                            if (props.hybridStorage?.isCloudEnabled) {
                              const uploadedImage = await props.hybridStorage.uploadRefFrame(file);
                              referenceImages.push(`uploaded:${uploadedImage.id}`);
                            } else {
                              const dataUrl = await fileToDataUrl(file);
                              referenceImages.push(dataUrl);
                            }
                          }

                          onUpdatePreset(s.id, { title: draftTitle, prompt: draftPrompt, colors, referenceImages });
                          setEditingId(null);
                          setEditRefFiles([]);
                        } catch (error) {
                          console.error('Failed to upload reference images:', error);
                          alert('Failed to upload reference images. Please try again.');
                        } finally {
                          setUploadingRefs(false);
                        }
                      }}
                      disabled={uploadingRefs}
                    >
                      {uploadingRefs ? 'Uploading...' : 'Save'}
                    </button>
                    <button onClick={() => {
                      setEditingId(null);
                      setEditRefFiles([]);
                    }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ); })}

        </div>
      </div>
    </section>
    </>
  );
}

