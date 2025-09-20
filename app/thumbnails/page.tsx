"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { buildPrompt } from "@/lib/prompt/builder";
import { profiles } from "@/lib/prompt/profiles";
import TemplateGallery from "@/components/TemplateGallery";
import { curatedMap } from "@/lib/gallery/curatedStyles";
import ThumbnailRefinement from "@/components/ThumbnailRefinement";
import RefinementHistoryBrowser from "@/components/RefinementHistoryBrowser";
import { RefinementState, RefinementHistory, RefinementUtils } from "@/lib/types/refinement";
import { useRefinementHistory } from "@/lib/hooks/useRefinementHistory";

import { useHybridStorage } from "@/lib/storage/useHybridStorage";
import { enforceYouTubeDimensionsBatch, YOUTUBE_THUMBNAIL } from "@/lib/utils/thumbnailDimensions";


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

  // Cloud storage integration
  const hybridStorage = useHybridStorage();

  // Refinement history management
  const refinementHistory = useRefinementHistory();

  // Sync hybrid storage frames to local state
  useEffect(() => {
    if (!hybridStorage.isLoading) {
      // Hybrid storage already returns LegacyFrame[] format regardless of cloud/localStorage
      const storageFrames = hybridStorage.frames;
      const storageRefFrames = hybridStorage.refFrames;

      // Only update if we have no local frames yet (initial load) or if storage has more frames
      // This prevents overriding local changes during remove operations
      if ((frames.length === 0 && storageFrames.length > 0) ||
          (storageFrames.length > frames.length)) {
        setFrames(storageFrames);
      }

      if ((refFrames.length === 0 && storageRefFrames.length > 0) ||
          (storageRefFrames.length > refFrames.length)) {
        setRefFrames(storageRefFrames);
      }
    }
  }, [hybridStorage.frames, hybridStorage.refFrames, hybridStorage.isLoading]);

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

  // Refinement state
  const [refinementState, setRefinementState] = useState<RefinementState>({
    isRefinementMode: false,
    histories: [],
    isRefining: false,
    feedbackPrompt: "",
    isCopying: false,
    isDownloading: false,
  });
  const [showHistoryBrowser, setShowHistoryBrowser] = useState(false);

  // Sync refinement histories from persistent storage
  useEffect(() => {
    if (!refinementHistory.isLoading) {
      setRefinementState(prev => ({
        ...prev,
        histories: refinementHistory.histories,
      }));
    }
  }, [refinementHistory.histories, refinementHistory.isLoading]);

  // Authentication and credits state
  const isDevelopment = process.env.NODE_ENV === 'development';
  const [user, setUser] = useState<{ email: string; name: string; picture: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (isDevelopment) {
        // In development, use a mock user
        setUser({
          email: 'dev@example.com',
          name: 'Dev User',
          picture: '',
        });
        setAuthLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();

        if (data.authenticated && data.user) {
          setUser({
            email: data.user.email,
            name: data.user.name || '',
            picture: data.user.picture || '',
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [isDevelopment]);

  const credits = (() => {
    if (isDevelopment) return 999; // Mock credits in development
    return 0; // Will be handled by production logic if needed
  })();

  const loadingCustomer = false; // Mock loading state for development
  const [profile, setProfile] = useState<string>("");
  const isAuthed = !!user; // User is authenticated if user object exists
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
  // Use hybrid storage for templates instead of local state
  const customPresets = hybridStorage.templates;



  // Load saved custom profiles and prompt presets - now handled by hybrid storage
  useEffect(() => {
    // Migration is now handled by the hybrid storage system
    // This effect is kept for backward compatibility but the actual migration
    // happens in the hybrid storage hook
    if (!hybridStorage.isMigrated && !hybridStorage.isLoading) {
      // Trigger migration if needed
      hybridStorage.triggerMigration().catch(error => {
        console.error('Failed to trigger migration:', error);
      });
    }
  }, [hybridStorage.isMigrated, hybridStorage.isLoading, hybridStorage.triggerMigration]);

  const persistCustomPresets = async (obj: Record<string, Preset>) => {
    // This function is now handled by hybrid storage
    // Keep for backward compatibility but operations are async now
  };

  const deleteCustomPreset = async (id: string) => {
    try {
      await hybridStorage.deleteTemplate(id);
      if (profile === id) {
        setProfile("");
        setColors([]);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleDuplicatePreset = async (id: string) => {
    try {
      // If built-in/curated: seed from curatedMap/profiles; if custom: copy existing
      let baseLabel = "Preset";
      let baseTemplate = "";
      let baseColors: string[] = [];

      if (customPresets[id]) {
        baseLabel = customPresets[id].title;
        baseTemplate = customPresets[id].prompt;
        baseColors = customPresets[id].colors || [];
      } else if (curatedMap[id]) {
        baseLabel = curatedMap[id].title;
        baseTemplate = curatedMap[id].prompt;
      } else {
        // built-in from profiles
        const p = profiles[id as keyof typeof profiles] as { title: string; prompt: string } | undefined;
        if (p) { baseLabel = p.title; baseTemplate = p.prompt; }
      }

      const label = `${baseLabel} Copy`;
      const newPreset: Preset = { title: label, prompt: baseTemplate, colors: baseColors, referenceImages: [] };

      const newId = await hybridStorage.createTemplate(newPreset);
      setProfile(newId);
      setColors(baseColors);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };
  // Initialize frames from hybrid storage on component mount
  useEffect(() => {
    if (!hybridStorage.isLoading) {
      // Only set initial frames if we don't have any yet
      if (frames.length === 0 && hybridStorage.frames.length > 0) {
        const initialFrames = hybridStorage.frames.map(frame => ({
          dataUrl: frame.dataUrl || '',
          b64: frame.b64 || '',
          kind: frame.kind || 'image' as const,
          filename: frame.filename,
          hash: frame.hash,
          importedAt: frame.importedAt
        }));
        setFrames(initialFrames);
      }

      // Only set initial ref frames if we don't have any yet
      if (refFrames.length === 0 && hybridStorage.refFrames.length > 0) {
        const initialRefFrames = hybridStorage.refFrames.map(frame => ({
          dataUrl: frame.dataUrl || '',
          b64: frame.b64 || '',
          kind: frame.kind || 'image' as const,
          filename: frame.filename,
          hash: frame.hash,
          importedAt: frame.importedAt
        }));
        setRefFrames(initialRefFrames);
      }
    }
  }, [hybridStorage.isLoading, hybridStorage.frames, hybridStorage.refFrames]);




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
  }, []);


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
          // Always sync to hybrid storage (handles both cloud and localStorage)
          try {
            await hybridStorage.addFrame(nextItem);
          } catch (error) {
            console.error('Failed to sync frame to storage:', error);
          }
        } else {
          setRefFrames((prev) => [...prev, nextItem]);
          // Always sync to hybrid storage (handles both cloud and localStorage)
          try {
            await hybridStorage.addRefFrame(nextItem);
          } catch (error) {
            console.error('Failed to sync reference frame to storage:', error);
          }
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


  const captureFrame = async () => {
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

    const newFrame = { dataUrl, b64, kind: "frame" as const };
    setFrames((prev) => [...prev, newFrame]);

    // Also add to hybrid storage
    try {
      await hybridStorage.addFrame(newFrame);
    } catch (error) {
      console.error('Failed to add frame to storage:', error);
    }
  };

  const removeFrame = async (idx: number) => {
    const frameToRemove = frames[idx];
    setFrames((prev) => prev.filter((_, i) => i !== idx));

    // Also remove from hybrid storage (cloud or localStorage)
    if (frameToRemove) {
      try {
        await hybridStorage.removeFrame(idx);
      } catch (error) {
        console.error('Failed to remove frame from storage:', error);
      }
    }
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

  const removeRefFrame = async (idx: number) => {
    const frameToRemove = refFrames[idx];
    setRefFrames((prev) => prev.filter((_, i) => i !== idx));

    // Also remove from cloud storage if available
    if (hybridStorage.isCloudEnabled && frameToRemove) {
      try {
        await hybridStorage.removeRefFrame(idx);
      } catch (error) {
        console.error('Failed to remove reference frame from cloud:', error);
      }
    }
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
        const hasReferenceImages = useUserRefs || refUrls.length > 0;
        const hasSubjectImages = frames.length > 0;

        const finalPrompt = buildPrompt({
          profile: tid,
          promptOverride,
          headline,
          colors,
          aspect,
          notes: prompt, // User's custom notes only
          hasReferenceImages,
          hasSubjectImages,
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

        // Assemble frames: put subject images first, then reference images last
        // This gives priority to the user's content while still providing style reference
        let combinedFrames: string[] = [];
        if (refB64.length > 0) {
          const primary = frames.map((f) => f.b64);
          // Subject images first, then reference images
          const ordered = [...primary, ...refB64];
          combinedFrames = ordered.slice(0, 3);

          // If we don't have enough images, pad with the first subject image if available,
          // otherwise pad with the first reference image
          while (combinedFrames.length < 3) {
            const padImage = primary.length > 0 ? primary[0] : refB64[0];
            if (padImage) combinedFrames.push(padImage);
            else break;
          }
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

          // Enforce YouTube thumbnail dimensions (1280x720) on all generated images
          let processedImages: string[];
          try {
            processedImages = await enforceYouTubeDimensionsBatch(images, YOUTUBE_THUMBNAIL.QUALITY);
            // Convert back to data URLs with correct MIME type
            processedImages = processedImages.map(base64 => `data:${YOUTUBE_THUMBNAIL.MIME_TYPE};base64,${base64}`);
          } catch (error) {
            console.error("Failed to enforce YouTube dimensions:", error);
            // Fallback to original images if dimension enforcement fails
            processedImages = images;
          }

          // Push all images at once
          try {
            const newBlobUrls = processedImages.map((u: string) => {
              const dataUrl = toDataUrlString(u);
              const blob = dataUrlToBlob(dataUrl);
              return URL.createObjectURL(blob);
            });
            setResults((prev) => [...prev, ...newBlobUrls]);
            setBlobUrls((prev) => [...prev, ...newBlobUrls]);
          } catch {
            setResults((prev) => [...prev, ...processedImages]);
          }
          setProgressTotal(processedImages.length);
          setProgressDone(processedImages.length);
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
                  // Enforce YouTube thumbnail dimensions on the streamed image
                  let processedDataUrl: string;
                  try {
                    const originalDataUrl = toDataUrlString(evt.dataUrl);
                    const processedBase64 = await enforceYouTubeDimensionsBatch([originalDataUrl], YOUTUBE_THUMBNAIL.QUALITY);
                    processedDataUrl = `data:${YOUTUBE_THUMBNAIL.MIME_TYPE};base64,${processedBase64[0]}`;
                  } catch (error) {
                    console.error("Failed to enforce YouTube dimensions on streamed image:", error);
                    // Fallback to original image if dimension enforcement fails
                    processedDataUrl = toDataUrlString(evt.dataUrl);
                  }

                  const blob = dataUrlToBlob(processedDataUrl);
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

  // Refinement functions
  const handleSelectThumbnailForRefinement = async (thumbnailIndex: number) => {
    const thumbnailUrl = results[thumbnailIndex];
    if (!thumbnailUrl) return;

    try {
      // Convert thumbnail URL to base64 data for API calls
      let thumbnailData: string;

      if (thumbnailUrl.startsWith('blob:')) {
        // Convert blob URL to base64 using canvas method
        const img = new Image();
        img.crossOrigin = 'anonymous';

        thumbnailData = await new Promise<string>((resolve, reject) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
              }

              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);

              const dataUrl = canvas.toDataURL('image/png');
              const base64Data = dataUrl.split(',')[1] || dataUrl;
              resolve(base64Data);
            } catch (error) {
              reject(error);
            }
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = thumbnailUrl;
        });
      } else if (thumbnailUrl.startsWith('data:')) {
        // Extract base64 data from data URL
        thumbnailData = RefinementUtils.dataUrlToBase64(thumbnailUrl);
      } else {
        // Assume it's already base64 data
        thumbnailData = thumbnailUrl;
      }

      // Get the original prompt used for generation
      const originalPrompt = buildPrompt({
        profile: selectedIds[0] || "", // Use first selected template
        promptOverride: customPresets[selectedIds[0]]?.prompt ?? curatedMap[selectedIds[0]]?.prompt,
        headline,
        colors,
        aspect,
        notes: prompt,
        hasReferenceImages: refFrames.length > 0,
        hasSubjectImages: frames.length > 0,
      });

      // Create new refinement history
      const history = RefinementUtils.createHistoryFromThumbnail(
        thumbnailUrl,
        thumbnailData,
        originalPrompt,
        selectedIds[0] || "default"
      );

      setRefinementState({
        isRefinementMode: true,
        selectedThumbnailIndex: thumbnailIndex,
        selectedThumbnailUrl: thumbnailUrl,
        currentHistory: history,
        histories: [...refinementState.histories, history],
        isRefining: false,
        feedbackPrompt: "",
        isCopying: false,
        isDownloading: false,
      });
    } catch (error) {
      console.error('Failed to prepare thumbnail for refinement:', error);
      setError('Failed to prepare thumbnail for refinement. Please try again.');
    }
  };

  const handleUpdateRefinementState = (update: Partial<RefinementState>) => {
    setRefinementState(prev => {
      const newState = { ...prev, ...update };

      // If currentHistory is updated, save it to persistent storage (skip in development)
      if (update.currentHistory && process.env.NODE_ENV !== 'development') {
        try {
          refinementHistory.saveHistory(update.currentHistory);
        } catch (error) {
          console.error('Storage quota exceeded, attempting cleanup:', error);
          // Try to clean up storage and retry
          RefinementUtils.cleanupStorage();
          try {
            refinementHistory.saveHistory(update.currentHistory);
          } catch (retryError) {
            console.error('Failed to save even after cleanup:', retryError);
            setError('Storage quota exceeded. Refinement history may not be saved.');
          }
        }
      }

      // If histories array is updated, sync with persistent storage (skip in development)
      if (update.histories && process.env.NODE_ENV !== 'development') {
        // Save any new or updated histories
        update.histories.forEach(history => {
          const existing = refinementHistory.getHistoryById(history.id);
          if (!existing || existing.updatedAt < history.updatedAt) {
            try {
              refinementHistory.saveHistory(history);
            } catch (error) {
              console.error('Storage quota exceeded for history:', history.id, error);
            }
          }
        });
      }

      return newState;
    });
  };

  const handleExitRefinementMode = () => {
    setRefinementState(prev => ({
      ...prev,
      isRefinementMode: false,
      selectedThumbnailIndex: undefined,
      selectedThumbnailUrl: undefined,
      currentHistory: undefined,
      feedbackPrompt: "",
      refinementError: undefined,
    }));
  };

  const handleAuthRequired = () => {
    setAuthRequired(true);
    setShowAuthModal(true);
  };

  // History management functions
  const handleSelectHistoryForRefinement = (history: RefinementHistory) => {
    setRefinementState({
      isRefinementMode: true,
      currentHistory: history,
      histories: refinementState.histories,
      isRefining: false,
      feedbackPrompt: "",
      isCopying: false,
      isDownloading: false,
    });
    setShowHistoryBrowser(false);
  };

  const handleDeleteHistory = (historyId: string) => {
    refinementHistory.deleteHistory(historyId);
    // If we're currently viewing the deleted history, exit refinement mode
    if (refinementState.currentHistory?.id === historyId) {
      handleExitRefinementMode();
    }
  };

  const handleClearAllHistories = () => {
    refinementHistory.clearAllHistories();
    // Exit refinement mode if we were in it
    if (refinementState.isRefinementMode) {
      handleExitRefinementMode();
    }
    setShowHistoryBrowser(false);
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
            {process.env.NODE_ENV === "development" && (
              <>
                <button
                  type="button"
                  data-test="dev-add-sample-images"
                  onClick={() => importTestImagesFromUrls([
                    "/references/aicoding.jpg",
                    "/references/comparison.jpg",
                    "/references/contrast.jpg",
                    "/references/product.jpg",
                  ])}
                  style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, marginRight: 8 }}
                >
                  Add sample images (dev)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    RefinementUtils.cleanupStorage();
                    setError(null);
                    alert('Storage cleaned up! Refinement history has been cleared.');
                  }}
                  style={{ padding: "6px 10px", border: "1px solid #ff6b6b", borderRadius: 6, color: "#ff6b6b" }}
                  title="Clear localStorage to fix quota exceeded errors"
                >
                  Clear Storage (dev)
                </button>
              </>
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
                      {f.dataUrl ? (<img src={f.dataUrl} alt={`item-${i}`} style={{ width: 220 }} />) : null}
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
              {/* Cloud Storage Status */}
              {hybridStorage.isCloudEnabled && (
                <div style={{
                  padding: "8px 12px",
                  backgroundColor: hybridStorage.isOnline ? "#e6f7ff" : "#fff2e6",
                  border: `1px solid ${hybridStorage.isOnline ? "#91d5ff" : "#ffd591"}`,
                  borderRadius: "6px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: hybridStorage.isOnline ? "#52c41a" : "#fa8c16"
                  }}></span>
                  {hybridStorage.isOnline ? "Cloud sync enabled" : "Offline - using local storage"}
                  {hybridStorage.isLoading && " (syncing...)"}
                  {hybridStorage.error && (
                    <span style={{ color: "#ff4d4f", marginLeft: "8px" }}>
                      Error: {hybridStorage.error}
                    </span>
                  )}
                </div>
              )}

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
                onUpdatePreset={async (id, update) => {
                  try {
                    await hybridStorage.updateTemplate(id, update);
                    if (profile === id && update.colors) setColors(update.colors);
                  } catch (error) {
                    console.error('Failed to update template:', error);
                  }
                }}
                onCreatePreset={async (p) => {
                  try {
                    const id = await hybridStorage.createTemplate(p);
                    setProfile(id);
                    setColors(p.colors || []);
                  } catch (error) {
                    console.error('Failed to create template:', error);
                  }
                }}
                hybridStorage={hybridStorage}
              />

              <div className={styles.navRow}>
                <button onClick={() => goTo(1)}>← Back</button>
                <button onClick={() => goTo(3)} disabled={!step2Done}>Next: Generate →</button>
              </div>
            </section>
          )}

          {currentStep === 3 && step1Done && step2Done && (
            <section id="step3" style={{ display: "grid", gap: 8 }}>
              {!loading && results.length === 0 && (
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
                    disabled={authLoading || loading || frames.length === 0 || (!loadingCustomer && credits < (Math.max(1, count) * (selectedIds.length || 0)))}
                  >
                    {authLoading
                      ? "Loading..."
                      : !isAuthed
                        ? "Generate thumbnails (Free after sign-up)"
                        : (!loadingCustomer
                            ? `Generate thumbnails (uses ${Math.max(1, count) * (selectedIds.length || 0)} credit${(Math.max(1, count) * (selectedIds.length || 0)) === 1 ? '' : 's'})`
                            : "Generate thumbnails")}
                  </button>

                  <div style={{
                    fontSize: '12px',
                    color: '#666',
                    textAlign: 'center',
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    ✅ All thumbnails automatically sized to YouTube specs (1280×720)
                  </div>

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

              {!loading && results.length > 0 && !refinementState.isRefinementMode && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>Results ({results.length})</h3>
                    <button onClick={downloadAll} disabled={downloadingAll}>
                      {downloadingAll ? "Downloading..." : "Download all"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {results.map((src, i) => (
                      <div
                        key={i}
                        className={refinementState.selectedThumbnailIndex === i ? styles.selectedThumbnail : ""}
                        style={{
                          border: refinementState.selectedThumbnailIndex === i
                            ? "3px solid var(--nb-accent)"
                            : "1px solid #ddd",
                          padding: 8,
                          borderRadius: 8
                        }}
                      >
                        {src ? (<img src={src} alt={`result-${i}`} style={{ width: 320 }} />) : null}
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
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
                          <button
                            onClick={() => handleSelectThumbnailForRefinement(i)}
                            className={styles.refineButton}
                          >
                            Refine
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.navRow}>
                    <button onClick={() => { setResults([]); cleanupBlobUrls(); }}>← Generate More</button>
                    <button onClick={() => goTo(1)}>Start Over</button>
                  </div>
                </>
              )}

              {/* Refinement Interface */}
              {refinementState.isRefinementMode && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <button
                      onClick={handleExitRefinementMode}
                      style={{
                        padding: "8px 16px",
                        border: "1px solid #ddd",
                        background: "white",
                        borderRadius: 4,
                        cursor: "pointer"
                      }}
                    >
                      ← Back to Results
                    </button>
                    <h3 style={{ margin: 0 }}>Thumbnail Refinement</h3>
                  </div>

                  <ThumbnailRefinement
                    refinementState={refinementState}
                    onUpdateRefinementState={handleUpdateRefinementState}
                    originalPrompt={buildPrompt({
                      profile: selectedIds[0] || "",
                      promptOverride: customPresets[selectedIds[0]]?.prompt ?? curatedMap[selectedIds[0]]?.prompt,
                      headline,
                      colors,
                      aspect,
                      notes: prompt,
                      hasReferenceImages: refFrames.length > 0,
                      hasSubjectImages: frames.length > 0,
                    })}
                    templateId={selectedIds[0] || "default"}
                    credits={credits}
                    isAuthed={isAuthed}
                    onAuthRequired={handleAuthRequired}
                  />
                </>
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

        {/* Refinement History Browser */}
        {refinementHistory.histories.length > 0 && !refinementState.isRefinementMode && (
          <section style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button
                onClick={() => setShowHistoryBrowser(!showHistoryBrowser)}
                className={`${styles.historyButton} ${showHistoryBrowser ? styles.historyButtonActive : ""}`}
              >
                {showHistoryBrowser ? "Hide" : "Show"} Refinement History ({refinementHistory.histories.length})
              </button>
            </div>

            {showHistoryBrowser && (
              <RefinementHistoryBrowser
                histories={refinementHistory.histories}
                onSelectHistory={handleSelectHistoryForRefinement}
                onDeleteHistory={handleDeleteHistory}
                onClearAllHistories={handleClearAllHistories}
                currentHistoryId={refinementState.currentHistory?.id}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
