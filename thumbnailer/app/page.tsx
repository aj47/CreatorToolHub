"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { buildPrompt } from "../lib/prompt/builder";
import { profiles } from "../lib/prompt/profiles";
import TemplateGallery from "../components/TemplateGallery";
import { curatedStyles, curatedMap } from "../lib/gallery/curatedStyles";

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

  const [mode, setMode] = useState<"builder" | "custom">("builder");

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

  // Custom style profiles (augment built-ins)
  const [customStyleProfiles, setCustomStyleProfiles] = useState<
    Record<string, { label: string; template: string }>
  >({});
  const [newStyleLabel, setNewStyleLabel] = useState<string>("");
  const [newStyleTemplate, setNewStyleTemplate] = useState<string>("");

  const curatedProfiles: Record<string, { label: string; template: string }> = Object.fromEntries(
    curatedStyles.map((s) => [s.id, { label: s.label, template: s.template }])
  );
  const allProfiles: Record<string, { label: string; template: string }> = {
    ...curatedProfiles,
    ...profiles,
    ...customStyleProfiles,
  };

  // Load saved custom profiles and prompt presets
  useEffect(() => {
    try {
      const sp = localStorage.getItem("cg_custom_style_profiles_v1");
      if (sp) {
        const obj = JSON.parse(sp) as Record<string, { label: string; template: string }>;
        if (obj && typeof obj === "object") setCustomStyleProfiles(obj);
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

  const persistStyleProfiles = (obj: Record<string, { label: string; template: string }>) => {
    setCustomStyleProfiles(obj);
    try { localStorage.setItem("cg_custom_style_profiles_v1", JSON.stringify(obj)); } catch {}
  };
  const persistFullPrompts = (obj: Record<string, { label: string; prompt: string }>) => {
    setCustomPromptPresets(obj);
    try { localStorage.setItem("cg_custom_full_prompts_v1", JSON.stringify(obj)); } catch {}
  };

  const saveCustomStyleProfile = () => {
    const label = newStyleLabel.trim();
    const template = newStyleTemplate.trim();
    if (!label || !template) return;
    const id = `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const next = { ...customStyleProfiles, [id]: { label, template } };
    persistStyleProfiles(next);
    setProfile(id);
    setNewStyleLabel("");
    setNewStyleTemplate("");
  };
  const deleteCustomStyleProfile = (id: string) => {
    const next = { ...customStyleProfiles };
    delete next[id];
    persistStyleProfiles(next);
    if (profile === id) setProfile("vlog");
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
      const templateOverride = customStyleProfiles[profile]?.template || curatedMap[profile]?.template;
      const finalPrompt = mode === "custom"
        ? (fullPrompt || "")
        : buildPrompt({
            profile,
            templateOverride,
            headline,
            colors,
            layout,
            subject,
            aspect,
            notes: prompt,
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label>
              Mode:&nbsp;
              <select value={mode} onChange={(e) => setMode(e.target.value as "builder" | "custom")}>
                <option value="builder">Presets</option>
                <option value="custom">Custom prompt</option>
              </select>
            </label>
          </div>

          <section style={{ display: mode === "custom" ? "none" : "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label>
                Profile:&nbsp;
                <select
                  value={profile}
                  onChange={(e) => setProfile(e.target.value)}
                  disabled={mode === "custom"}
                >
                  {Object.entries(allProfiles).map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Aspect:&nbsp;
                <select
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value as "16:9" | "9:16" | "1:1")}
                >
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Vertical)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </label>
            </div>

            {/* Template Gallery */}
            <TemplateGallery
              currentId={profile}
              onApply={(id) => setProfile(id)}
              readOnly={mode === "custom"}
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

            <label style={{ display: "grid", gap: 6 }}>
              <span>Colors (comma-separated)</span>
              <input
                type="text"
                placeholder="#00E5FF, #111827"
                value={colors.join(", ")}
                onChange={(e) =>
                  setColors(
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                style={{ width: "100%" }}
              />
            </label>

            <div style={{ display: "grid", gap: 6 }}>
              <span>Pick colors</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {colors.map((c, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="color"
                      value={toHex6(c)}
                      onChange={(e) =>
                        setColors((prev) =>
                          prev.map((pc, i) => (i === idx ? e.target.value : pc))
                        )
                      }
                      aria-label={`Color ${idx + 1}`}
                    />
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {toHex6(c)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setColors((prev) => prev.filter((_, i) => i !== idx))
                      }
                      title="Remove color"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setColors((prev) => [...prev, "#00E5FF"]) }>
                  + Add color
                </button>
              </div>
            </div>


            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label>
                Layout:&nbsp;
                <select
                  value={layout}
                  onChange={(e) =>
                    setLayout(
                      e.target.value as
                        | "left_subject_right_text"
                        | "split_screen"
                        | "center_text"
                    )
                  }
                >
                  <option value="left_subject_right_text">
                    Left subject / Right text
                  </option>
                  <option value="split_screen">Split screen</option>
                  <option value="center_text">Center text</option>
                </select>
              </label>
              <label>
                Subject:&nbsp;
                <select
                  value={subject}
                  onChange={(e) =>
                    setSubject(
                      e.target.value as "face" | "product" | "ui" | "two_faces"
                    )
                  }
                >
                  <option value="face">Face</option>
                  <option value="product">Product</option>
                  <option value="ui">UI</option>
                  <option value="two_faces">Two faces</option>
                </select>
              </label>
            </div>

              {mode === "builder" && (
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  <span>Save as custom style profile</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Profile name"
                      value={newStyleLabel}
                      onChange={(e) => setNewStyleLabel(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Style template text"
                      value={newStyleTemplate}
                      onChange={(e) => setNewStyleTemplate(e.target.value)}
                      style={{ width: "50ch" }}
                    />
                    <button type="button" onClick={saveCustomStyleProfile}>Save</button>
                  </div>
                  {Object.keys(customStyleProfiles).length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span>My styles:</span>
                      {Object.entries(customStyleProfiles).map(([id, p]) => (
                        <span
                          key={id}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #ddd", padding: "2px 6px", borderRadius: 4 }}
                        >
                          {p.label}
                          <button type="button" onClick={() => deleteCustomStyleProfile(id)} title="Delete">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

          </section>


          {mode === "custom" && (
            <section style={{ display: "grid", gap: 10 }}>
              <h3>Custom prompt</h3>
              <textarea
                value={fullPrompt}
                onChange={(e) => setFullPrompt(e.target.value)}
                rows={10}
                style={{ width: "100%", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label>
                  Presets:&nbsp;
                  <select
                    value={selectedFullPreset}
                    onChange={(e) => loadFullPromptPreset(e.target.value)}
                  >
                    <option value="">-- Select preset --</option>
                    {Object.entries(customPromptPresets).map(([id, p]) => (
                      <option key={id} value={id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => selectedFullPreset && deleteFullPromptPreset(selectedFullPreset)}
                  disabled={!selectedFullPreset}
                >
                  Delete preset
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="New preset name"
                  value={newFullLabel}
                  onChange={(e) => setNewFullLabel(e.target.value)}
                />
                <button type="button" onClick={saveFullPromptPreset}>Save current as preset</button>
              </div>
            </section>
          )}

          {mode !== "custom" && (
            <label style={{ display: "grid", gap: 6 }}>
              <span>Advanced notes (optional)</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                style={{ width: "100%", fontFamily: "inherit" }}
              />
            </label>
          )}

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
