"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { buildPrompt } from "../lib/prompt/builder";
import { profiles } from "../lib/prompt/profiles";
import TemplateGallery from "../components/TemplateGallery";
import { curatedMap, isBuiltinProfileId } from "../lib/gallery/curatedStyles";

type Frame = { dataUrl: string; b64: string };

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
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [headline, setHeadline] = useState<string>("");
  const [colors, setColors] = useState<string[]>([]);
  const [layout, setLayout] = useState<
    | "left_subject_right_text"
    | "split_screen"
    | "center_text"
  >("left_subject_right_text");
  const [subject, setSubject] = useState<"face" | "product" | "ui" | "two_faces">(
    "face"
  );

  // Custom prompt (raw) mode
  const [fullPrompt, setFullPrompt] = useState<string>("");
  const [customPromptPresets, setCustomPromptPresets] = useState<
    Record<string, { label: string; prompt: string }>
  >({});
  const [newFullLabel, setNewFullLabel] = useState<string>("");
  const [selectedFullPreset, setSelectedFullPreset] = useState<string>("");

  // Unified custom presets (label, template, plus colors/layout/subject)
  type Preset = {
    label: string;
    template: string;
    colors: string[];
    layout: "left_subject_right_text" | "split_screen" | "center_text";
    subject: "face" | "product" | "ui" | "two_faces";
  };
  const [customPresets, setCustomPresets] = useState<Record<string, Preset>>({});
  const [newStyleLabel, setNewStyleLabel] = useState<string>("");
  const [newStyleTemplate, setNewStyleTemplate] = useState<string>("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);



  // Load saved custom profiles and prompt presets
  useEffect(() => {
    try {
      const cp = localStorage.getItem("cg_custom_presets_v1");
      if (cp) {
        const obj = JSON.parse(cp) as Record<string, Preset>;
        if (obj && typeof obj === "object") setCustomPresets(obj);
      } else {
        const legacy = localStorage.getItem("cg_custom_style_profiles_v1");
        if (legacy) {
          const old = JSON.parse(legacy) as Record<string, { label: string; template: string }>;
          const migrated: Record<string, Preset> = {};
          for (const [id, v] of Object.entries(old)) {
            migrated[id] = { label: v.label, template: v.template, colors: [], layout: "left_subject_right_text", subject: "face" };
          }
          setCustomPresets(migrated);
          try { localStorage.setItem("cg_custom_presets_v1", JSON.stringify(migrated)); } catch {}
        }
      }
    } catch {}
    try {
      const pp = localStorage.getItem("cg_custom_full_prompts_v1");
      if (pp) {
        const obj = JSON.parse(pp) as Record<string, { label: string; prompt: string }>;
        if (obj && typeof obj === "object") {
          setCustomPromptPresets(obj);
          const first = Object.keys(obj)[0];
          if (first) {
            setSelectedFullPreset(first);
            setFullPrompt(obj[first].prompt);
          }
        }
      }
    } catch {}
  }, []);

  const persistCustomPresets = (obj: Record<string, Preset>) => {
    setCustomPresets(obj);
    try { localStorage.setItem("cg_custom_presets_v1", JSON.stringify(obj)); } catch {}
  };
  const persistFullPrompts = (obj: Record<string, { label: string; prompt: string }>) => {
    setCustomPromptPresets(obj);
    try { localStorage.setItem("cg_custom_full_prompts_v1", JSON.stringify(obj)); } catch {}
  };

  const saveCustomPreset = () => {
    const label = newStyleLabel.trim();
    const template = newStyleTemplate.trim();
    if (!label || !template) return;
    if (editingPresetId) {
      const next = { ...customPresets, [editingPresetId]: { ...customPresets[editingPresetId], label, template, colors, layout, subject } };
      persistCustomPresets(next);
      setEditingPresetId(null);
    } else {
      const id = `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
      const next = { ...customPresets, [id]: { label, template, colors, layout, subject } };
      persistCustomPresets(next);
      setProfile(id);
    }
    setNewStyleLabel("");
    setNewStyleTemplate("");
  };
  const deleteCustomPreset = (id: string) => {
    const next = { ...customPresets };
    delete next[id];
    persistCustomPresets(next);
    if (profile === id) {
      setProfile("vlog");
      setColors([]);
      setLayout("left_subject_right_text");
      setSubject("face");
    }
  };

  const handleDuplicatePreset = (id: string) => {
    // If built-in/curated: seed from curatedMap/profiles; if custom: copy existing
    let baseLabel = "Preset";
    let baseTemplate = "";
    if (customPresets[id]) {
      baseLabel = customPresets[id].label;
      baseTemplate = customPresets[id].template;
    } else if (curatedMap[id]) {
      baseLabel = curatedMap[id].label;
      baseTemplate = curatedMap[id].template;
    } else {
      // built-in from profiles
      const p = (profiles as any)[id];
      if (p) { baseLabel = p.label; baseTemplate = p.template; }
    }
    const label = `${baseLabel} Copy`;
    const newId = `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const newPreset: Preset = { label, template: baseTemplate, colors: [], layout: "left_subject_right_text", subject: "face" };
    const next: Record<string, Preset> = { ...customPresets, [newId]: newPreset };
    persistCustomPresets(next);
    setProfile(newId);
    setColors([]);
    setLayout("left_subject_right_text");
    setSubject("face");
  };


  const saveFullPromptPreset = () => {
    const label = newFullLabel.trim();
    const promptStr = fullPrompt.trim();
    if (!label || !promptStr) return;
    const id = `preset:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const next = { ...customPromptPresets, [id]: { label, prompt: promptStr } };
    persistFullPrompts(next);
    setSelectedFullPreset(id);
    setNewFullLabel("");
  };
  const loadFullPromptPreset = (id: string) => {
    setSelectedFullPreset(id);
    const p = customPromptPresets[id]?.prompt || "";
    setFullPrompt(p);
  };
  const deleteFullPromptPreset = (id: string) => {
    const next = { ...customPromptPresets };
    delete next[id];
    persistFullPrompts(next);
    if (selectedFullPreset === id) setSelectedFullPreset("");
  };


  const toHex6 = (s: string) => {
    const t = String(s || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
    if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`;
    if (/^#[0-9a-fA-F]{3}$/.test(t)) {
      const r = t.slice(1);
      return `#${r[0]}${r[0]}${r[1]}${r[1]}${r[2]}${r[2]}`;
    }
    if (/^[0-9a-fA-F]{3}$/.test(t)) {
      return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`;
    }
    return "#000000";
  };

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
    setFrames([]);
    setResults([]);
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
    setFrames((prev) => [...prev, { dataUrl, b64 }]);
  };

  const removeFrame = (idx: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== idx));
  };

  const generate = async () => {
    setError(null);
    setLoading(true);
    setResults([]);
    try {
      const templateOverride = isBuiltinProfileId(profile) ? undefined : (customPresets[profile]?.template ?? curatedMap[profile]?.template);
      const finalPrompt = buildPrompt({
            profile,
            templateOverride,
            headline,
            colors,
            layout,
            subject,
            aspect,
            notes: [prompt].filter(Boolean).join("\n\n"),
          });
      const body = {
        prompt: finalPrompt,
        frames: frames.slice(0, 3).map((f) => f.b64),
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
      setResults(images);
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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>AI Thumbnail Generator</h1>
        <p>Select a local video, scrub to a moment, and capture frames.</p>

        <div style={{ display: "grid", gap: 12 }}>
          <input type="file" accept="video/*" onChange={onFile} />

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
                  <div key={i} style={{ border: "1px solid #ddd", padding: 8 }}>
                    <img src={f.dataUrl} alt={`frame-${i}`} style={{ width: 220 }} />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
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
              currentId={profile}
              onApply={(id) => {
                setProfile(id);
                const p = customPresets[id];
                if (p) {
                  setColors(p.colors || []);
                  setLayout(p.layout);
                  setSubject(p.subject);
                } else {
                  // applying built-in/curated resets to defaults unless a custom preset is selected later
                  setColors([]);
                  setLayout("left_subject_right_text");
                  setSubject("face");
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
                  if (update.layout) setLayout(update.layout);
                  if (update.subject) setSubject(update.subject);
                }
              }}
              onCreatePreset={(p) => {
                const id = `custom:${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
                const next = { ...customPresets, [id]: p };
                persistCustomPresets(next);
                setProfile(id);
                setColors(p.colors || []);
                setLayout(p.layout);
                setSubject(p.subject);
              }}
            />


            <label style={{ display: "grid", gap: 6 }}>
              <span>Headline</span>
              <input
                type="text"
                placeholder="3–5 word hook (optional)"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            {/* Colors, layout, subject, and in-parent preset management removed in favor of card-centric editing */}

          </section>


          {/* Custom prompt mode removed; keep only Additional notes */}
          <label style={{ display: "grid", gap: 6 }}>
            <span>Additional notes (optional)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              style={{ width: "100%", fontFamily: "inherit" }}
            />
          </label>

          <label>
            Variants:&nbsp;
            <input
              type="number"
              min={1}
              max={8}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value || "1", 10))}
              style={{ width: 64 }}
            />
          </label>

          <button onClick={generate} disabled={loading || frames.length === 0}>
            {loading ? "Generating..." : "Generate thumbnails"}
          </button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </div>

        {results.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h3>Results ({results.length})</h3>
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
