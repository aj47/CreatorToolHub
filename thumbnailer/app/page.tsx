"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type Frame = { dataUrl: string; b64: string };

const DEFAULT_PROMPT = `Generate a YouTube thumbnail with a 16:9 aspect ratio and a resolution of 1280x720 pixels. The thumbnail should be a vibrant and high-contrast image that is easily readable on a small mobile screen.
The central focus should be a cutout of the tech influencer from the webcam footage, expressing a clear emotion of excitement or surprise. This cutout should be placed on the left or right third of the frame.
The background should be a stylized and slightly blurred version of the user interface from the screen share. A key element from the interface, such as the 'Enhance prompt' button and the sparkle icon, should be enlarged, given a subtle glowing outline, and positioned as a focal point to create intrigue.
Incorporate a short, bold, and easily readable sans-serif text overlay with a maximum of 3-5 words, such as 'NEW AI TRICK!' or 'SECRET WEAPON'. The text should have a strong contrasting color to the background, possibly with a subtle drop shadow or outline to ensure it pops.
Maintain a consistent brand aesthetic by using a specific color palette [insert brand colors here, e.g., electric blue and charcoal gray]. The overall mood should be energetic and intriguing, promising a valuable takeaway for the viewer without being misleading clickbait.`;

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
      const body = {
        prompt,
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

          <label style={{ display: "grid", gap: 6 }}>
            <span>Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
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
