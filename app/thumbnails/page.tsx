"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { buildPrompt } from "@/lib/prompt/builder";
import { profiles } from "@/lib/prompt/profiles";
import TemplateGallery from "@/components/TemplateGallery";
import { curatedMap } from "@/lib/gallery/curatedStyles";
import { useCustomer } from "autumn-js/react";

type Frame = { dataUrl: string; b64: string; kind: "frame" | "image"; filename?: string; hash?: string; importedAt?: number };

const DEFAULT_PROMPT = "";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [videoSize, setVideoSize] = useState({ width: 37.5, height: 'auto' }); // 50% of original 75%
  const [isResizing, setIsResizing] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [refFrames, setRefFrames] = useState<Frame[]>([]);

  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [blobUrls, setBlobUrls] = useState<string[]>([]); // Track blob URLs for cleanup
  const [copyingIndex, setCopyingIndex] = useState<number | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // Autumn: load customer and derive credits - bypass in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  const { customer, isLoading: loadingCustomer, error: customerError } = isDevelopment
    ? { customer: null, isLoading: false, error: null }
    : useCustomer({ errorOnNotFound: false });
  const credits = (() => {
    if (isDevelopment) return 999; // Mock credits in development
    const f = customer?.features?.[FEATURE_ID as string] as any;
    if (!f) return 0;
    if (typeof f.balance === "number") return f.balance;
    if (typeof f.included_usage === "number" && typeof f.usage === "number") return Math.max(0, (f.included_usage ?? 0) - (f.usage ?? 0));
    return 0;
  })();
  const [profile, setProfile] = useState<string>("");
  const isAuthed = isDevelopment ? true : (!!customer && !customerError);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [aspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [headline, setHeadline] = useState<string>("");
  const [colors, setColors] = useState<string[]>([]);

  // Wizard/stepper state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const step1Done = frames.length > 0; // at least one subject image/frame
  const step2Done = selectedIds.length > 0; // at least one template selected
  const step3Done = true; // headline/notes optional, always allow progression
  const canGoTo = (n: number) => {
    if (n <= 1) return true;
    if (n === 2) return step1Done;
    if (n === 3) return step1Done && step2Done;
    return true;
  };
  const goTo = (n: number) => {
    if (!canGoTo(n)) return;
    setCurrentStep(n);
    const el = typeof document !== 'undefined' ? document.getElementById(`step${n}`) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Image import controls and limits
  const [importing, setImporting] = useState<{ total: number; done: number; errors: string[] } | null>(null);
  const [cancelImport, setCancelImport] = useState(false);
  const MAX_ITEMS = 3;
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"] as const;
  const [dedupeWarn, setDedupeWarn] = useState<string[]>([]);
  const framesFull = frames.length >= MAX_ITEMS;
  const refsFull = refFrames.length >= MAX_ITEMS;


  // Client-side image downscaling/compression to reduce payload sizes
  const MAX_DIMENSION = 768; // limit max width/height in pixels
  const TARGET_MIME: "image/jpeg" | "image/png" = "image/jpeg";
  const JPEG_QUALITY = 0.82; // 0..1

  const computeTargetSize = (w: number, h: number) => {
    const maxD = Math.max(w, h);
    if (maxD <= MAX_DIMENSION) return { tw: w, th: h };
    const scale = MAX_DIMENSION / maxD;
    return { tw: Math.round(w * scale), th: Math.round(h * scale) };
  };

  const downscaleDataUrl = (dataUrl: string, mime: string = TARGET_MIME, quality = JPEG_QUALITY) => new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;
        const { tw, th } = computeTargetSize(w, h);
        const c = document.createElement("canvas");
        c.width = tw; c.height = th;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        ctx.drawImage(img, 0, 0, w, h, 0, 0, tw, th);
        if (mime === "image/jpeg") {
          resolve(c.toDataURL("image/jpeg", quality));
        } else {
          resolve(c.toDataURL("image/png"));
        }
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("img"));
    img.src = dataUrl;
  });

  const fileToResizedDataUrl = (file: File, mime: string = TARGET_MIME, quality = JPEG_QUALITY) => new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read"));
    fr.onload = async () => {
      try {
        const base = String(fr.result || "");
        const out = await downscaleDataUrl(base, mime, quality);
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    fr.readAsDataURL(file);
  });

  // Convert potentially huge data URLs into short-lived blob: URLs
  // This avoids "ERR_INVALID_URL" in some browsers for very long data URIs
  const dataUrlToObjectUrl = (dataUrl: string): string => {
    try {
      if (!dataUrl.startsWith("data:")) return dataUrl; // pass-through
      const [head, b64raw] = dataUrl.split(",");
      const mimeMatch = /^data:([^;]+);base64$/i.exec(head || "");
      const mime = mimeMatch?.[1] || "image/png";
      const b64 = (b64raw || "").replace(/\s+/g, "");
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      return URL.createObjectURL(blob);
    } catch {
      return dataUrl;
    }
  };


  // Helpers for robust conversions without fetch() to avoid CSP connect-src issues
  // Normalize: ensure a single data:<mime>;base64,<clean-b64> and strip any nested data: prefixes
  const toDataUrlString = (u: string, mime: string = "image/png") => {
    const s = (u || "").trim();
    if (s.startsWith("data:")) {
      const i = s.indexOf(",");
      if (i === -1) return s;
      const head = s.slice(0, i);
      let payload = s.slice(i + 1).trim();
      // Remove any nested data:* prefixes inside payload
      while (payload.startsWith("data:")) {
        const j = payload.indexOf(",");
        if (j === -1) break;
        payload = payload.slice(j + 1).trim();
      }
      const clean = payload.replace(/[^A-Za-z0-9+/=]/g, "");
      return `${head},${clean}`;
    }
    const clean = s.replace(/[^A-Za-z0-9+/=]/g, "");
    return `data:${mime};base64,${clean}`;
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [head, b64raw] = (dataUrl || "").split(",");
    const mime = /^data:([^;]+);base64$/i.exec(head || "")?.[1] || "image/png";
    const b64 = (b64raw || "").replace(/[^A-Za-z0-9+/=]/g, "");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const blobFromBlobUrlViaCanvas = (blobUrl: string) =>
    new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth || 1;
          c.height = img.naturalHeight || 1;
          const ctx = c.getContext("2d");
          if (!ctx) return reject(new Error("ctx"));
          ctx.drawImage(img, 0, 0);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png");
        } catch (e) { reject(e as any); }
      };
      img.onerror = () => reject(new Error("img"));
      img.src = blobUrl;
    });



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
      setProfile("");
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

  // Revoke blob URLs created for results to prevent memory leaks
  useEffect(() => {
    return () => {
      // Only revoke URLs on unmount, don't modify state
      blobUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [blobUrls]);


  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    setVideoReady(false);

    // Do not clear previously captured frames; allow accumulating frames across videos
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

  // Back-compat name: now resizes and outputs JPEG by default
  const fileToPngDataUrl = (file: File) => fileToResizedDataUrl(file, TARGET_MIME, JPEG_QUALITY);

  const importImages = async (files: FileList | File[], target: "frames" | "refs" = "frames") => {
    const list = Array.from(files);
    const allowed = list.filter((f) => isAllowed(f));
    const errors: string[] = [];
    if (allowed.length !== list.length) {
      errors.push("Some files were skipped due to unsupported format.");
    }
    const existingTarget = target === "frames" ? frames : refFrames;
    if (existingTarget.length + allowed.length > MAX_ITEMS) {
      errors.push(`Import would exceed max ${target === "frames" ? "subject images" : "reference images"} (${MAX_ITEMS}).`);
      const remaining = Math.max(0, MAX_ITEMS - existingTarget.length);
      if (remaining < allowed.length) {
        // Trim to fit available slots
        allowed.splice(remaining);
      }
    }
    setDedupeWarn([]);
    setCancelImport(false);
    setImporting({ total: allowed.length, done: 0, errors: [] });

    const existingHashes = new Set(existingTarget.map((f) => f.hash).filter(Boolean) as string[]);

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
        const nextItem: Frame = { dataUrl, b64, kind: "image", filename: file.name, hash, importedAt: Date.now() };
        if (target === "frames") {
          setFrames((prev) => [...prev, nextItem]);
        } else {
          setRefFrames((prev) => [...prev, nextItem]);
        }
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

  const onAddRefImages: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const input = e.currentTarget;
    const files = input.files;
    if (!files || files.length === 0) return;
    await importImages(files, "refs");
    input.value = ""; // clear after await; we cached the element
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
    if (framesFull) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const { tw, th } = computeTargetSize(w, h);
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h, 0, 0, tw, th);
    const dataUrl = TARGET_MIME === "image/jpeg"
      ? canvas.toDataURL("image/jpeg", JPEG_QUALITY)
      : canvas.toDataURL("image/png");
    const b64 = dataUrl.split(",")[1] || "";
    setFrames((prev) => [...prev, { dataUrl, b64, kind: "frame" }]);
  };

  const removeFrame = (idx: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== idx));
  };

  // Video resize functionality
  const startVideoResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = videoSize.width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const widthChange = (deltaX / window.innerWidth) * 100; // Convert to percentage
      const newWidth = Math.max(20, Math.min(90, startWidth + widthChange)); // Clamp between 20% and 90%
      setVideoSize({ width: newWidth, height: 'auto' });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // No longer need polling - direct generation

  const removeRefFrame = (idx: number) => {
    setRefFrames((prev) => prev.filter((_, i) => i !== idx));
  };

  // Cleanup function for blob URLs
  const cleanupBlobUrls = () => {
    blobUrls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    setBlobUrls([]);
  };

  const generate = async () => {
    // Client-side gate: block if out of credits for the number of generations requested
    const perTemplate = Math.max(1, count);
    const needed = perTemplate * (selectedIds.length || 0);
    if (!loadingCustomer && credits < needed) {
      setError(needed <= 0 ? "Please select at least one template." : `You need ${needed} credit${needed === 1 ? '' : 's'} to run this. You have ${credits}.`);
      return;
    }
    setAuthRequired(false);
    setShowAuthModal(false);
    setError(null);
    setLoading(true);
    // Clean up previous blob URLs before generating new ones
    cleanupBlobUrls();
    setResults([]);
    setProgressDone(0);
    setProgressTotal(0);
    try {
      const ids = selectedIds;
      if (ids.length === 0) {
        setLoading(false);
        setError("Please select at least one template.");
        return;
      }

      // For each selected template, we will stream NDJSON and update UI incrementally
      for (const tid of ids) {
        const promptOverride = customPresets[tid]?.prompt ?? curatedMap[tid]?.prompt;
        const refUrls: string[] = (customPresets[tid]?.referenceImages ?? curatedMap[tid]?.referenceImages ?? []) as string[];
        const useUserRefs = refFrames.length > 0;
        const autoRefNote = (useUserRefs || refUrls.length > 0)
          ? "Use the attached reference image(s) strictly as style and layout guidance. Copy the reference closely for composition, color palette, typography, and text placement. Use the people/subjects from the provided frames/images (do not copy subjects from the reference). Keep all text extremely legible."
          : undefined;

        const finalPrompt = buildPrompt({
          profile: tid,
          promptOverride,
          headline,
          colors,
          aspect,
          notes: [autoRefNote, prompt].filter(Boolean).join("\n\n"),
        });

        // Build reference images: prefer user-provided reference images; otherwise fetch template reference URLs
        let refB64: string[] = [];
        if (useUserRefs) {
          refB64 = refFrames.map((f) => f.b64).slice(0, 3);
        } else {
          for (const u of refUrls.slice(0, 3)) {
            try {
              const dataUrl = await fetch(u)
                .then(r => r.ok ? r.blob() : Promise.reject(new Error("bad ref")))
                .then(blob => new Promise<string>((resolve, reject) => {
                  const fr = new FileReader();
                  fr.onerror = () => reject(new Error("reader"));
                  fr.onload = () => resolve(String(fr.result || ""));
                  fr.readAsDataURL(blob);
                }));
              const resized = await downscaleDataUrl(dataUrl, TARGET_MIME, JPEG_QUALITY);
              const b64 = resized.split(",")[1] || "";
              if (b64) refB64.push(b64);
            } catch {}
          }
        }

        // Assemble frames: put reference images first, ensure up to 3 total
        let combinedFrames: string[] = [];
        if (refB64.length > 0) {
          const primary = frames.map((f) => f.b64);
          const ordered = [...refB64, ...primary];
          while (ordered.length < 3) ordered.push(refB64[0]);
          combinedFrames = ordered.slice(0, 3);
        } else {
          combinedFrames = frames.map((f) => f.b64).slice(0, 3);
        }

        const body = { prompt: finalPrompt, frames: combinedFrames, framesMime: TARGET_MIME, variants: count };
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          setAuthRequired(true);
          setShowAuthModal(true);
          setError("You're not signed in. Please sign in to generate thumbnails — it's free after you sign up.");
          setLoading(false);
          return;
        }
        if (res.status === 402) {
          try {
            const d = await res.json();
            setError(d?.error || "Insufficient credits. Visit Pricing to add credits.");
          } catch {
            setError("Insufficient credits. Visit Pricing to add credits.");
          }
          setLoading(false);
          return;
        }

        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const isNdjson = ct.includes('application/x-ndjson');
        if (!isNdjson) {
          // Fallback for local dev (Next.js API returns JSON all-at-once)
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Unexpected error");
          const images = data?.images;
          if (!Array.isArray(images) || images.length === 0) {
            throw new Error("No images returned");
          }
          // Push all images at once
          try {
            const newBlobUrls = images.map((u: string) => {
              const dataUrl = toDataUrlString(u);
              const blob = dataUrlToBlob(dataUrl);
              return URL.createObjectURL(blob);
            });
            setResults((prev) => [...prev, ...newBlobUrls]);
            setBlobUrls((prev) => [...prev, ...newBlobUrls]);
          } catch {
            setResults((prev) => [...prev, ...images]);
          }
          setProgressTotal(images.length);
          setProgressDone(images.length);
        } else {
          // Stream NDJSON response: handle start/progress/image/done events
          if (!res.body) throw new Error("No response body");
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              if (!line) continue; // skip heartbeats and empty lines
              if (line.startsWith(":")) continue; // comment/heartbeat
              let evt: any = null;
              try { evt = JSON.parse(line); } catch { continue; }
              if (evt.type === "start") {
                setProgressTotal(Number(evt.total) || 0);
                setProgressDone(0);
              } else if (evt.type === "progress") {
                if (typeof evt.done === 'number' && typeof evt.total === 'number') {
                  setProgressDone(evt.done);
                  setProgressTotal(evt.total);
                }
              } else if (evt.type === "image") {
                try {
                  const dataUrl = toDataUrlString(evt.dataUrl);
                  const blob = dataUrlToBlob(dataUrl);
                  const blobUrl = URL.createObjectURL(blob);
                  setResults((prev) => [...prev, blobUrl]);
                  setBlobUrls((prev) => [...prev, blobUrl]);
                } catch {
                  setResults((prev) => [...prev, evt.dataUrl]);
                }
              } else if (evt.type === "variant_error") {
                // Could surface per-variant errors if desired
                console.warn("Variant error:", evt.error);
              } else if (evt.type === "error") {
                throw new Error(evt.message || "Server error");
              } else if (evt.type === "done") {
                // stream end will break outer loop
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const download = async (src: string, i: number) => {
    setDownloadingIndex(i);
    try {
      let href = src;
      let revokeTemp: string | null = null;

      // Handle different source types
      if (src.startsWith('data:')) {
        const blob = dataUrlToBlob(src);
        href = URL.createObjectURL(blob);
        revokeTemp = href;
      } else if (src.startsWith('blob:')) {
        // Use blob URL directly
        href = src;
      }

      const a = document.createElement("a");
      a.href = href;
      a.download = `thumbnail_${i + 1}.png`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up temporary blob URL
      if (revokeTemp) {
        setTimeout(() => URL.revokeObjectURL(revokeTemp!), 100);
      }
    } catch (e) {
      console.error("Failed to download image", i + 1, e);
      // Fallback: try simple download
      const a = document.createElement("a");
      a.href = src;
      a.download = `thumbnail_${i + 1}.png`;
      a.click();
    } finally {
      setDownloadingIndex(null);
    }
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    try {
      for (let i = 0; i < results.length; i++) {
        try {
          await download(results[i], i);
          // Add delay between downloads to prevent browser blocking
          await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
          console.warn("Failed to download", i + 1, e);
        }
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  const copyToClipboard = async (src: string, index: number) => {
    setCopyingIndex(index);
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('Clipboard API not available');
      }

      let blob: Blob;
      if (src.startsWith('blob:')) {
        blob = await blobFromBlobUrlViaCanvas(src);
      } else if (src.startsWith('data:')) {
        blob = dataUrlToBlob(src);
      } else if (/^https?:/i.test(src)) {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
        blob = await resp.blob();
      } else {
        // Assume raw base64
        blob = dataUrlToBlob(toDataUrlString(src));
      }

      // Ensure blob is valid
      if (!blob || blob.size === 0) {
        throw new Error('Invalid image data');
      }

      // Create clipboard item with proper MIME type
      const mimeType = blob.type || 'image/png';
      const clipboardItem = new ClipboardItem({ [mimeType]: blob });

      await navigator.clipboard.write([clipboardItem]);

      // Optional: Show success feedback
      console.log('Image copied to clipboard successfully');

    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);

      // Fallback: try to copy as text (data URL)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(src);
          console.log('Copied image URL as text fallback');
        } else {
          throw new Error('No clipboard access available');
        }
      } catch (fallbackError) {
        console.error('Clipboard fallback also failed:', fallbackError);
        // Could show user notification here
      }
    } finally {
      setCopyingIndex(null);
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
          <h1 className={styles.title}>Thumbnail Creator</h1>
        </div>

        {/* Stepper */}
        <nav className={styles.stepper} aria-label="Thumbnail creation steps">
          {[1,2,3].map((n) => {
            const unlocked = canGoTo(n);
            const active = currentStep === n;
            const label = n === 1 ? 'Input' : n === 2 ? 'Templates' : 'Generate';
            return (
              <button key={n} type="button"
                className={`${styles.step} ${active ? styles.stepActive : ''} ${unlocked && n < currentStep ? styles.stepDone : ''}`}
                onClick={() => goTo(n)} disabled={!unlocked}
                aria-current={active ? 'step' : undefined} aria-controls={`step${n}`}>
                <span className={styles.stepIndex}>{n}</span>
                <span className={styles.stepLabel}>{label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ display: "grid", gap: 8 }}>
        {currentStep === 1 && (
          <>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <label className={styles.fileInput} aria-label="Add Video(s)">
              <input style={{ display: "none" }} type="file" accept="video/*" onChange={onFile} />
              <span>Add Video(s)</span>
            </label>
            <label
              className={styles.fileInput}
              aria-label="Add Images"
              style={{ opacity: framesFull ? 0.6 : undefined, pointerEvents: framesFull ? "none" : undefined }}
              title={framesFull ? "Limit reached (3 subject images)" : undefined}
            >
              <input style={{ display: "none" }} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/tiff" multiple onChange={onAddImages} disabled={framesFull} />
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

          <div style={{ fontSize: 12, color: "#666", textAlign: "center" }}>
            We send at most 3 images per generation. Tip: Drag and drop images anywhere below.
          </div>

          {importing && (
            <div role="status" aria-live="polite" style={{ fontSize: 12, textAlign: "center" }}>
              Importing images… {importing.done}/{importing.total}
              <button style={{ marginLeft: 8 }} onClick={() => setCancelImport(true)}>Cancel</button>
            </div>
          )}
          {importing?.errors?.length ? (
            <div style={{ color: "crimson", fontSize: 12, textAlign: "center" }}>
              {importing.errors.slice(-3).map((msg, i) => (<div key={i}>{msg}</div>))}
            </div>
          ) : null}

          {dedupeWarn.length > 0 && (
            <div style={{ color: "#555", fontSize: 12, textAlign: "center" }}>
              {dedupeWarn.slice(-3).map((w, i) => (<div key={i}>{w}</div>))}
            </div>
          )}
          </>
        )}
        </div>





          {currentStep === 1 && (
            <>
            {videoUrl && (
              <div style={{ display: "grid", gap: 8 }}>
                <div className={styles.callout} style={{ maxWidth: 600, margin: '0 auto' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span role="img" aria-label="video">🎬</span>
                    <strong>Scrub your video to find the best moment, then click</strong>
                    <span role="img" aria-label="camera">📸</span>
                    <strong>Capture frame</strong>
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                    Video size: {Math.round(videoSize.width)}% • Drag corner to resize
                  </div>
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    onLoadedMetadata={() => setVideoReady(true)}
                    style={{
                      width: `${videoSize.width}%`,
                      height: videoSize.height,
                      background: "#000",
                      cursor: isResizing ? 'nwse-resize' : 'default'
                    }}
                  />
                  {/* Resize handle */}
                  <div
                    onMouseDown={startVideoResize}
                    style={{
                      position: 'absolute',
                      bottom: -6,
                      right: `${(100 - videoSize.width) / 2 - 1}%`,
                      width: 12,
                      height: 12,
                      background: isResizing ? '#1d4ed8' : '#2563eb',
                      cursor: 'nwse-resize',
                      borderRadius: 2,
                      border: '1px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      zIndex: 10,
                      transition: 'background-color 0.15s ease'
                    }}
                    title="Drag to resize video"
                    onMouseEnter={(e) => {
                      if (!isResizing) {
                        e.currentTarget.style.background = '#1d4ed8';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isResizing) {
                        e.currentTarget.style.background = '#2563eb';
                      }
                    }}
                  />
                </div>
                <button onClick={captureFrame} disabled={!videoReady || framesFull} title={framesFull ? "Limit reached (3 subject images)" : undefined}>
                  Capture frame at current time
                </button>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: "none" }} />

            {frames.length > 0 && (
              <section>
                <h3>Subject frames/images ({frames.length}/3)</h3>
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

            <div className={styles.navRow}>
              <button onClick={() => goTo(2)} disabled={!step1Done}>Next: Templates →</button>
            </div>
            </>
          )}




          {currentStep === 2 && step1Done && (
            <section style={{ display: "grid", gap: 8 }}>
              {/* Template Gallery */}
              <TemplateGallery
                selectedIds={selectedIds}
                onToggleSelect={(id) => {
                  setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                  setProfile(id);
                  const p = customPresets[id];
                  if (p) { setColors(p.colors || []); } else { setColors([]); }
                }}
                customPresets={customPresets}
                onDuplicate={(id) => handleDuplicatePreset(id)}
                onDeletePreset={(id) => deleteCustomPreset(id)}
                onUpdatePreset={(id, update) => {
                  const next = { ...customPresets, [id]: { ...customPresets[id], ...update } };
                  persistCustomPresets(next);
                  if (profile === id && update.colors) setColors(update.colors);
                }}
                onCreatePreset={(p) => {
                  const id = `custom:${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
                  const next = { ...customPresets, [id]: p } as Record<string, Preset>;
                  persistCustomPresets(next);
                  setProfile(id);
                  setColors(p.colors || []);
                }}
              />

              <div className={styles.navRow}>
                <button onClick={() => goTo(1)}>← Back</button>
                <button onClick={() => goTo(3)} disabled={!step2Done}>Next: Generate →</button>
              </div>
            </section>
          )}

          {currentStep === 3 && step1Done && step2Done && (
            <section id="step3" style={{ display: "grid", gap: 8 }}>
              {!loading && (
                <>
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

                  <label className={styles.formGroup}>
                    <span className={styles.label}>Additional notes (optional)</span>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
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

                  <button
                    className={styles.primary}
                    onClick={(e) => {
                      if (!isAuthed) { e.preventDefault(); setAuthRequired(true); setShowAuthModal(true); return; }
                      generate();
                    }}
                    disabled={loading || frames.length === 0 || (!loadingCustomer && credits < (Math.max(1, count) * (selectedIds.length || 0)))}
                  >
                    {!isAuthed
                      ? "Generate thumbnails (Free after sign-up)"
                      : (!loadingCustomer
                          ? `Generate thumbnails (uses ${Math.max(1, count) * (selectedIds.length || 0)} credit${(Math.max(1, count) * (selectedIds.length || 0)) === 1 ? '' : 's'})`
                          : "Generate thumbnails")}
                  </button>

                  <div className={styles.navRow}>
                    <button onClick={() => goTo(2)}>← Back</button>
                  </div>
                </>
              )}

              {loading && (
                <div style={{ display: "grid", gap: 16, textAlign: "center", padding: "32px 16px" }}>
                  <div style={{ fontSize: "18px", fontWeight: "600" }}>Generating thumbnails...</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, justifyContent: 'center' }}>
                    <strong>Progress</strong>
                    <span>
                      {progressTotal > 0 ? `${progressDone}/${progressTotal}` : (results.length > 0 ? `${results.length}…` : 'starting…')}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.round((progressDone / (progressTotal || Math.max(1, results.length))) * 100))}%`,
                        background: "linear-gradient(90deg, #3b82f6, #1d4ed8)",
                        borderRadius: "4px",
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "14px", opacity: 0.7 }}>
                    Creating {Math.max(1, count) * (selectedIds.length || 0)} thumbnail{(Math.max(1, count) * (selectedIds.length || 0)) === 1 ? '' : 's'}...
                  </div>
                </div>
              )}

              {error && !authRequired && (
                <p style={{ color: "crimson" }}>{error}</p>
              )}
            </section>
          )}


          {authRequired && (
            <div style={{ color: "#111", background: "#ffe5e5", border: "2px solid #d33", padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Sign in required</div>
              <div style={{ marginBottom: 8 }}>You need to be signed in to generate thumbnails. It’s free after you sign up.</div>
              <button onClick={() => (window.location.href = '/api/auth/signin')} style={{ border: '3px solid var(--nb-border)', borderRadius: 8, background: '#fff', padding: '8px 12px', fontWeight: 700, boxShadow: '4px 4px 0 var(--nb-border)', cursor: 'pointer' }}>
                Sign in with Google
              </button>
            </div>
          )}

          {showAuthModal && (
            <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', color: '#111', padding: 20, borderRadius: 10, border: '3px solid var(--nb-border)', boxShadow: '8px 8px 0 var(--nb-border)', maxWidth: 420 }}>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Sign in to generate — it’s free</div>
                <p style={{ marginTop: 0 }}>Create thumbnails for free after you sign up. We’ll also track your credits.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => (window.location.href = '/api/auth/signin')} className="nb-btn nb-btn--accent">Sign in with Google</button>
                  <button onClick={() => setShowAuthModal(false)} className="nb-btn">Close</button>
                </div>
              </div>
            </div>
          )}

        {results.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Results ({results.length})</h3>
              <button onClick={downloadAll} disabled={downloadingAll}>
                {downloadingAll ? "Downloading..." : "Download all"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {results.map((src, i) => (
                <div key={i} style={{ border: "1px solid #ddd", padding: 8 }}>
                  <img src={src} alt={`result-${i}`} style={{ width: 320 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => download(src, i)}
                      disabled={downloadingIndex === i}
                    >
                      {downloadingIndex === i ? "Downloading..." : "Download"}
                    </button>
                    <button
                      onClick={() => copyToClipboard(src, i)}
                      disabled={copyingIndex === i}
                    >
                      {copyingIndex === i ? "Copying..." : "Copy"}
                    </button>
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
