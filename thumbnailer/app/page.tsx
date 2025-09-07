"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { buildPrompt } from "../lib/prompt/builder";
import { profiles } from "../lib/prompt/profiles";
import TemplateGallery from "../components/TemplateGallery";
import { curatedMap } from "../lib/gallery/curatedStyles";

type Frame = { dataUrl: string; b64: string; kind: "frame" | "image"; filename?: string; hash?: string; importedAt?: number };

const DEFAULT_PROMPT = "";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<string>("vlog");
  const [selectedIds, setSelectedIds] = useState<string[]>(["vlog"]);
  const [aspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [headline, setHeadline] = useState<string>("");
  const [colors, setColors] = useState<string[]>([]);

  // Image import controls and limits
  const [importing, setImporting] = useState<{ total: number; done: number; errors: string[] } | null>(null);
  const [cancelImport, setCancelImport] = useState(false);
  const MAX_ITEMS = 300;
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"] as const;
  const [dedupeWarn, setDedupeWarn] = useState<string[]>([]);



  // Template consists of: title, exact prompt, colors, reference images
  type Preset = {
    title: string;
    prompt: string;
    colors: string[];
    referenceImages: string[];
  };
  const [customPresets, setCustomPresets] = useState<Record<string, Preset>>({});



  // Load saved custom profiles and prompt presets
  useEffect(() => {
    try {
      const cp2 = localStorage.getItem("cg_custom_presets_v2");
      const cp1 = !cp2 ? localStorage.getItem("cg_custom_presets_v1") : null;
      if (cp2) {
        const obj = JSON.parse(cp2) as Record<string, Preset>;
        if (obj && typeof obj === "object") setCustomPresets(obj);
      } else if (cp1) {
        // migrate v1 (label/template/colors/layout/subject) to v2 (title/prompt/colors/referenceImages)
        type OldPresetV1 = { label?: string; template?: string; colors?: string[]; referenceImages?: string[]; layout?: string; subject?: string };
        const old = JSON.parse(cp1) as Record<string, OldPresetV1>;
        const migrated: Record<string, Preset> = {};
        for (const [id, v] of Object.entries(old)) {
          migrated[id] = { title: v.label ?? "Custom", prompt: v.template ?? "", colors: Array.isArray(v.colors) ? v.colors : [], referenceImages: Array.isArray(v.referenceImages) ? v.referenceImages : [] };
        }
        setCustomPresets(migrated);
        try { localStorage.setItem("cg_custom_presets_v2", JSON.stringify(migrated)); } catch {}
      } else {
        const legacy = localStorage.getItem("cg_custom_style_profiles_v1");
        if (legacy) {
          const old = JSON.parse(legacy) as Record<string, { label: string; template: string }>;
          const migrated: Record<string, Preset> = {};
          for (const [id, v] of Object.entries(old)) {
            migrated[id] = { title: v.label, prompt: v.template, colors: [], referenceImages: [] };
          }
          setCustomPresets(migrated);
          try { localStorage.setItem("cg_custom_presets_v2", JSON.stringify(migrated)); } catch {}
        }
      }
    } catch {}
  }, []);

  const persistCustomPresets = (obj: Record<string, Preset>) => {
    setCustomPresets(obj);
    // Persist to v2 key to match loader and README
    try { localStorage.setItem("cg_custom_presets_v2", JSON.stringify(obj)); } catch {}
  };



  const deleteCustomPreset = (id: string) => {
    const next = { ...customPresets };
    delete next[id];
    persistCustomPresets(next);
    if (profile === id) {
      setProfile("vlog");
      setColors([]);
    }
  };

  const handleDuplicatePreset = (id: string) => {
    // If built-in/curated: seed from curatedMap/profiles; if custom: copy existing
    let baseLabel = "Preset";
    let baseTemplate = "";
    if (customPresets[id]) {
      baseLabel = customPresets[id].title;
      baseTemplate = customPresets[id].prompt;
    } else if (curatedMap[id]) {
      baseLabel = curatedMap[id].title;
      baseTemplate = curatedMap[id].prompt;
    } else {
      // built-in from profiles
      const p = profiles[id as keyof typeof profiles] as { title: string; prompt: string } | undefined;
      if (p) { baseLabel = p.title; baseTemplate = p.prompt; }
    }
    const label = `${baseLabel} Copy`;
    const newId = `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const newPreset: Preset = { title: label, prompt: baseTemplate, colors: [], referenceImages: [] };
    const next: Record<string, Preset> = { ...customPresets, [newId]: newPreset };
    persistCustomPresets(next);
    setProfile(newId);
    setColors([]);
  };
  // Persist frames (including imported images) and restore on load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cg_frames_v1");
      if (raw) {
        const arr = JSON.parse(raw) as Frame[];
        if (Array.isArray(arr)) setFrames(arr);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("cg_frames_v1", JSON.stringify(frames));
    } catch {}
  }, [frames]);




  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    setVideoReady(false);

    // Preserve any imported images when a new video is selected; drop only prior captured frames
    setFrames((prev) => prev.filter((f) => f.kind === "image"));
    setResults([]);
  };

  const moveFrame = (from: number, to: number) => {
    setFrames((prev) => {
      const arr = [...prev];
      if (to < 0 || to >= arr.length) return arr;
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
      return arr;
    });
  };

  const getExt = (name: string) => (name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
  const isAllowed = (file: File) => ALLOWED_EXT.includes(getExt(file.name) as typeof ALLOWED_EXT[number]);

  const bufToHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return bufToHex(digest);
  };

  const fileToPngDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read"));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          if (!ctx) return reject(new Error("ctx"));
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("img"));
      img.src = String(fr.result || "");
    };
    fr.readAsDataURL(file);
  });

  const importImages = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const allowed = list.filter((f) => isAllowed(f));
    const errors: string[] = [];
    if (allowed.length !== list.length) {
      errors.push("Some files were skipped due to unsupported format.");
    }
    if (frames.length + allowed.length > MAX_ITEMS) {
      errors.push(`Import would exceed max items (${MAX_ITEMS}).`);
    }
    setDedupeWarn([]);
    setCancelImport(false);
    setImporting({ total: allowed.length, done: 0, errors: [] });

    const existingHashes = new Set(frames.map((f) => f.hash).filter(Boolean) as string[]);

    for (let i = 0; i < allowed.length; i++) {
      if (cancelImport) break;
      const file = allowed[i];
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`);
        setImporting((s) => (s ? { ...s, done: s.done + 1 } : s));
        continue;
      }
      try {
        const hash = await hashFile(file);
        if (existingHashes.has(hash)) {
          setDedupeWarn((w) => [...w, `${file.name}: duplicate skipped`]);
          setImporting((s) => (s ? { ...s, done: s.done + 1 } : s));
          continue;
        }
        const dataUrl = await fileToPngDataUrl(file);
        const b64 = (dataUrl.split(",")[1] || "");
        setFrames((prev) => [...prev, { dataUrl, b64, kind: "image", filename: file.name, hash, importedAt: Date.now() }]);
        existingHashes.add(hash);
      } catch (e) {
        errors.push(`${file.name}: failed to import`);
      } finally {
        setImporting((s) => (s ? { ...s, done: s.done + 1, errors } : s));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    setImporting((s) => (s ? { ...s, errors } : s));
  };

  const onAddImages: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const input = e.currentTarget;
    const files = input.files;
    if (!files || files.length === 0) return;
    await importImages(files);
    input.value = ""; // clear after await; we cached the element
  };

  const onDropImages: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    await importImages(files);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (Array.from(e.dataTransfer?.items || []).some((it) => it.kind === "file")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };


  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/png");
    const b64 = dataUrl.split(",")[1] || "";
    setFrames((prev) => [...prev, { dataUrl, b64, kind: "frame" }]);
  };

  const removeFrame = (idx: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== idx));
  };

  const generate = async () => {
    setError(null);
    setLoading(true);
    setResults([]);
    try {
      const ids = selectedIds.length > 0 ? selectedIds : [profile];

      const allImagesAgg: string[] = [];

      // Shared headline/colors/aspect/notes; but promptOverride and references depend on template id
      for (const tid of ids) {
        const promptOverride = customPresets[tid]?.prompt ?? curatedMap[tid]?.prompt;

        const refUrls: string[] = (customPresets[tid]?.referenceImages ?? curatedMap[tid]?.referenceImages ?? []) as string[];
        const autoRefNote = refUrls.length > 0
          ? "Use the attached reference image(s) as the primary style and layout guide. Copy the reference closely: composition, color palette, typography, and the text style and placement. Keep all text extremely legible."
          : undefined;

        const finalPrompt = buildPrompt({
          profile: tid,
          promptOverride,
          headline,
          colors,
          aspect,
          notes: [autoRefNote, prompt].filter(Boolean).join("\n\n"),
        });

      // Fetch reference images as base64 for this template
      const refB64: string[] = [];
      for (const u of refUrls.slice(0, 3)) {
        try {
          const dataUrl = await fetch(u).then(r => r.ok ? r.blob() : Promise.reject(new Error("bad ref"))).then(blob => new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onerror = () => reject(new Error("reader"));
            fr.onload = () => resolve(String(fr.result || ""));
            fr.readAsDataURL(blob);
          }));
          const b64 = dataUrl.split(",")[1] || "";
          if (b64) refB64.push(b64);
        } catch {}
      }

      // Assemble frames: put reference images first to increase influence; if fewer than 3 total, duplicate the first reference to fill.
      let combinedFrames: string[] = [];
      if (refB64.length > 0) {
        const primary = frames.map((f) => f.b64);
        const ordered = [...refB64, ...primary];
        while (ordered.length < 3) ordered.push(refB64[0]);
        combinedFrames = ordered.slice(0, 3);
      } else {
        combinedFrames = frames.map((f) => f.b64).slice(0, 3);
      }

      const body = {
        prompt: finalPrompt,
        frames: combinedFrames,
        variants: count,
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unexpected error");
      const images: string[] = (data?.images || []).map(
        (b64: string) => `data:image/png;base64,${b64}`
      );
      allImagesAgg.push(...images);
      }
      setResults(allImagesAgg);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const download = (src: string, i: number) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `thumbnail_${i + 1}.png`;
    a.click();
  };

  const downloadAll = async () => {
    for (let i = 0; i < results.length; i++) {
      try {
        const resp = await fetch(results[i]);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `thumbnail_${i + 1}.png`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 75));
      } catch (e) {
        console.warn("Failed to download", i + 1, e);
      }
    }
  };

  const copyToClipboard = async (src: string) => {
    try {
      const resp = await fetch(src);

      const blob = await resp.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
    } catch {
      await navigator.clipboard.writeText(src);
    }
  };

  // Dev-only helper to import sample images from URLs
  const importTestImagesFromUrls = async (urls: string[]) => {
    try {
      const blobs = await Promise.all(urls.map(async (u) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`fetch failed: ${u}`);
        const blob = await res.blob();
        const name = u.split("/").pop() || `image-${Date.now()}.png`;
        return new File([blob], name, { type: blob.type || "image/png" });
      }));
      await importImages(blobs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import test images");
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main} onDragOver={onDragOver} onDrop={onDropImages}>
        <div className={styles.hero}>
          <h1 className={styles.title}>nana thumbnail creator</h1>
          <p className={styles.subtitle}>Upload a short video, scrub to the moment, and capture frames. Or add standalone images.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className={styles.fileInput} aria-label="Add Video(s)">
              <input style={{ display: "none" }} type="file" accept="video/*" onChange={onFile} />
              <span>Add Video(s)</span>
            </label>
            <label className={styles.fileInput} aria-label="Add Images">
              <input style={{ display: "none" }} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/tiff" multiple onChange={onAddImages} />
              <span>Add Images</span>
            </label>
            {(process.env.NODE_ENV !== "production" || (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)/.test(window.location.hostname))) && (
              <button
                type="button"
                data-test="dev-add-sample-images"
                onClick={() => importTestImagesFromUrls([
                  "/references/aicoding.jpg",
                  "/references/comparison.jpg",
                  "/references/contrast.jpg",
                  "/references/product.jpg",
                ])}
                style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6 }}
              >
                Add sample images (dev)
              </button>
            )}


          </div>
          {importing && (
            <div role="status" aria-live="polite" style={{ marginTop: 8, fontSize: 12 }}>
              Importing images… {importing.done}/{importing.total}
              <button style={{ marginLeft: 8 }} onClick={() => setCancelImport(true)}>Cancel</button>
            </div>
          )}
          {dedupeWarn.length > 0 && (
            <div style={{ marginTop: 6, color: "#555", fontSize: 12 }}>
              {dedupeWarn.slice(-3).map((w, i) => (<div key={i}>{w}</div>))}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>Tip: Drag and drop images anywhere on the gallery below.</div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>

          {videoUrl && (
            <div style={{ display: "grid", gap: 8 }}>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                onLoadedMetadata={() => setVideoReady(true)}
                style={{ maxWidth: "100%", background: "#000" }}
              />
              <button onClick={captureFrame} disabled={!videoReady}>
                Capture frame at current time
              </button>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />

          {frames.length > 0 && (
            <section>
              <h3>Selected frames ({frames.length})</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {frames.map((f, i) => (
                  <div key={i} style={{ border: "1px solid #ddd", padding: 8, position: "relative" }}>
                    <span title={f.kind === "image" ? "Imported image" : "Captured frame"} style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, padding: "2px 4px", borderRadius: 3 }}>
                      {f.kind === "image" ? "image" : "frame"}
                    </span>
                    <img src={f.dataUrl} alt={`item-${i}`} style={{ width: 220 }} />
                    <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                      <button onClick={() => moveFrame(i, i - 1)} disabled={i === 0} aria-label="Move left">◀</button>
                      <button onClick={() => moveFrame(i, i + 1)} disabled={i === frames.length - 1} aria-label="Move right">▶</button>
                      <button onClick={() => removeFrame(i)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ display: "grid", gap: 10 }}>
            {/* Aspect selection removed */}

            {/* Template Gallery */}
            <TemplateGallery
              selectedIds={selectedIds}
              onToggleSelect={(id) => {
                setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                // keep last selected as active profile for editing fields like colors/headline
                setProfile(id);
                const p = customPresets[id];
                if (p) {
                  setColors(p.colors || []);
                } else {
                  setColors([]);
                }
              }}
              customPresets={customPresets}
              onDuplicate={(id) => handleDuplicatePreset(id)}
              onDeletePreset={(id) => deleteCustomPreset(id)}
              onUpdatePreset={(id, update) => {
                const next = { ...customPresets, [id]: { ...customPresets[id], ...update } };
                persistCustomPresets(next);
                if (profile === id) {
                  if (update.colors) setColors(update.colors);
                }
              }}
              onCreatePreset={(p) => {
                const id = `custom:${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
                const next = { ...customPresets, [id]: p } as Record<string, Preset>;
                persistCustomPresets(next);
                setProfile(id);
                setColors(p.colors || []);
              }}
            />


            <label className={styles.formGroup}>
              <span className={styles.label}>Headline</span>
              <input
                type="text"
                placeholder="3–5 word hook (optional)"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className={styles.input}
              />
            </label>

            {/* Colors, layout, subject, and in-parent preset management removed in favor of card-centric editing */}

          </section>


          {/* Custom prompt mode removed; keep only Additional notes */}
          <label className={styles.formGroup}>
            <span className={styles.label}>Additional notes (optional)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className={styles.textarea}
            />
          </label>

          <div className={styles.inlineGroup}>
            <label className={styles.label} htmlFor="variants">Variants</label>
            <input
              id="variants"
              type="number"
              min={1}
              max={8}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value || "1", 10))}
              className={styles.number}
            />
          </div>

          <button className={styles.primary} onClick={generate} disabled={loading || frames.length === 0}>
            {loading ? "Generating..." : "Generate thumbnails"}
          </button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </div>

        {results.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Results ({results.length})</h3>
              <button onClick={downloadAll}>Download all</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {results.map((src, i) => (
                <div key={i} style={{ border: "1px solid #ddd", padding: 8 }}>
                  <img src={src} alt={`result-${i}`} style={{ width: 320 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => download(src, i)}>Download</button>
                    <button onClick={() => copyToClipboard(src)}>Copy</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
