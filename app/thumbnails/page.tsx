"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPrompt } from "@/lib/prompt/builder";
import { profiles } from "@/lib/prompt/profiles";
import { useCustomer } from "autumn-js/react";

import TemplateGallery from "@/components/TemplateGallery";
import { curatedMap } from "@/lib/gallery/curatedStyles";
import ThumbnailRefinement from "@/components/ThumbnailRefinement";
import RefinementHistoryBrowser from "@/components/RefinementHistoryBrowser";
import { RefinementState, RefinementHistory, RefinementUtils } from "@/lib/types/refinement";
import { useRefinementHistory } from "@/lib/hooks/useRefinementHistory";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth/AuthProvider";

import { useHybridStorage } from "@/lib/storage/useHybridStorage";
import { enforceYouTubeDimensionsBatch, fitImageToYouTubeTransparent, YOUTUBE_THUMBNAIL } from "@/lib/utils/thumbnailDimensions";


type Frame = { dataUrl: string; b64: string; kind: "frame" | "image"; filename?: string; hash?: string; importedAt?: number };

const DEFAULT_PROMPT = "";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

const thumbnailFaqItems: { question: string; answer: string }[] = [
  {
    question: "How does the AI YouTube thumbnail generator work?",
    answer: "Upload frames or images, pick a template, and our AI designs multiple thumbnail concepts you can refine in seconds.",
  },
  {
    question: "Can I use my own images and reference styles?",
    answer: "Yes. Drop in frames from your video, add reference images, and Creator Tool Hub will blend them into on-brand layouts.",
  },
  {
    question: "Do the thumbnails follow YouTube size requirements?",
    answer: "Every image exports at 1280×720 in the preferred aspect ratio, so you can publish immediately without manual resizing.",
  },
  {
    question: "Do I need design experience to create thumbnails?",
    answer: "No design background required—select a template, describe your hook, and iterate with guided refinements until it looks perfect.",
  },
];

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

  const faqJsonLd = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: thumbnailFaqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }),
    []
  );

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

  // Suggested refinements state - map of thumbnail index to suggestions
  const [suggestedRefinements, setSuggestedRefinements] = useState<Record<number, string[]>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<number, boolean>>({});

  // Sync refinement histories from persistent storage
  useEffect(() => {
    if (!refinementHistory.isLoading) {
      setRefinementState(prev => ({
        ...prev,
        histories: refinementHistory.histories,
      }));
    }
  }, [refinementHistory.histories, refinementHistory.isLoading]);

  // Fetch suggested refinements when results are generated
  useEffect(() => {
    if (results.length > 0 && !refinementState.isRefinementMode) {
      // Fetch suggestions for each result
      results.forEach((thumbnailUrl, index) => {
        if (thumbnailUrl && !suggestedRefinements[index] && !loadingSuggestions[index]) {
          // Call the fetch function inline to avoid dependency issues
          const fetchSuggestions = async () => {
            setLoadingSuggestions(prev => ({ ...prev, [index]: true }));

            try {
              const originalPrompt = buildPrompt({
                profile: selectedIds[0] || "",
                promptOverride: customPresets[selectedIds[0]]?.prompt ?? curatedMap[selectedIds[0]]?.prompt,
                headline,
                colors,
                aspect,
                notes: prompt,
                hasReferenceImages: refFrames.length > 0,
                hasSubjectImages: frames.length > 0,
              });

              const response = await fetch("/api/suggest-refinements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  thumbnailUrl,
                  originalPrompt,
                  templateId: selectedIds[0] || "default",
                }),
              });

              const data = await response.json();

              if (data.success && data.suggestions) {
                setSuggestedRefinements(prev => ({
                  ...prev,
                  [index]: data.suggestions,
                }));
              }
            } catch (error) {
              console.error("Failed to fetch suggested refinements:", error);
            } finally {
              setLoadingSuggestions(prev => ({ ...prev, [index]: false }));
            }
          };

          fetchSuggestions();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length]); // Only trigger when results length changes

  // Authentication and credits state
  const isDevelopment = process.env.NODE_ENV === 'development';
  const { user, loading: authLoading } = useAuth();

  const { customer, isLoading: customerLoading } = useCustomer({ errorOnNotFound: false });

  const credits = useMemo(() => {
    if (isDevelopment) return 999;
    if (!customer) return 0;

    // Handle flat balance structure (from Autumn API)
    const customerAny = customer as any;
    if (typeof customerAny.balance === "number") return customerAny.balance;

    // Handle nested features structure (expected by autumn-js)
    if (customer.features) {
      const feature = customer.features[FEATURE_ID as string] as {
        balance?: number;
        included_usage?: number;
        usage?: number;
      } | undefined;
      if (!feature) return 0;
      if (typeof feature.balance === "number") return feature.balance;
      if (typeof feature.included_usage === "number" && typeof feature.usage === "number") {
        return Math.max(0, (feature.included_usage ?? 0) - (feature.usage ?? 0));
      }
    }
    return 0;
  }, [customer, isDevelopment]);

  const loadingCustomer = isDevelopment ? false : customerLoading;
  const [profile, setProfile] = useState<string>("");
  const isAuthed = !!user; // User is authenticated if user object exists
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Debug logging for selectedIds state
  useEffect(() => {
  }, [selectedIds]);

  // Persist selectedIds in localStorage to prevent loss during navigation
  useEffect(() => {
    const saved = localStorage.getItem('thumbnails-selectedIds');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedIds(parsed);
        }
      } catch (e) {
      }
    }
  }, []);

  useEffect(() => {
    if (selectedIds.length > 0) {
      localStorage.setItem('thumbnails-selectedIds', JSON.stringify(selectedIds));
    } else {
      localStorage.removeItem('thumbnails-selectedIds');
    }
  }, [selectedIds]);
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


  // Client-side image normalization to YouTube-friendly dimensions
  const MAX_DIMENSION = YOUTUBE_THUMBNAIL.WIDTH; // limit max width/height in pixels
  const TARGET_MIME = "image/png" as const;

  const computeTargetSize = (w: number, h: number) => {
    const maxD = Math.max(w, h);
    if (maxD <= MAX_DIMENSION) return { tw: w, th: h };
    const scale = MAX_DIMENSION / maxD;
    return { tw: Math.round(w * scale), th: Math.round(h * scale) };
  };

  const downscaleDataUrl = (dataUrl: string) => new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;
        const { tw, th } = computeTargetSize(w, h);
        if (tw === w && th === h) {
          resolve(dataUrl);
          return;
        }
        const c = document.createElement("canvas");
        c.width = tw; c.height = th;
        const ctx = c.getContext("2d");
        if (!ctx) {
          reject(new Error("ctx"));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h, 0, 0, tw, th);
        resolve(c.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("img"));
    img.src = dataUrl;
  });

  const normalizeToYouTubeDataUrl = async (dataUrl: string) => {
    const resized = await downscaleDataUrl(dataUrl);
    return fitImageToYouTubeTransparent(resized);
  };

  const fileToResizedDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read"));
    fr.onload = async () => {
      try {
        const base = String(fr.result || "");
        const normalized = await normalizeToYouTubeDataUrl(base);
        resolve(normalized);
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


  const loadVideoFromFile = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoReady(false);

    // Do not clear previously captured frames; allow accumulating frames across videos
    setResults([]);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const nextVideo = Array.from(files).find((file) => file.type.startsWith("video/"));
    loadVideoFromFile(nextVideo ?? files[0]);
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

  // Back-compat name: now normalizes to 1280x720 transparent PNG
  const fileToPngDataUrl = (file: File) => fileToResizedDataUrl(file);

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
          }
        } else {
          setRefFrames((prev) => [...prev, nextItem]);
          // Always sync to hybrid storage (handles both cloud and localStorage)
          try {
            await hybridStorage.addRefFrame(nextItem);
          } catch (error) {
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

  const onDropMedia: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    const fileList = e.dataTransfer?.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const videoFiles = files.filter((file) => file.type.startsWith("video/"));
    const nonVideoFiles = files.filter((file) => !file.type.startsWith("video/"));

    if (nonVideoFiles.length > 0) {
      await importImages(nonVideoFiles);
    }

    if (videoFiles.length > 0) {
      loadVideoFromFile(videoFiles[0]);
    }
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (Array.from(e.dataTransfer?.items || []).some((it) => it.kind === "file")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  // Clipboard paste handler for images
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // Only handle paste when we're on step 1 (input step) and not at max capacity
    if (currentStep !== 1 || framesFull) return;

    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;

    e.preventDefault();

    try {
      const files: File[] = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }

      if (files.length > 0) {
        await importImages(files);
      }
    } catch (error) {
      setError('Failed to paste images from clipboard. Please try again.');
    }
  }, [currentStep, framesFull, importImages]);

  // Add paste event listener
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handlePasteEvent);

    return () => {
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [handlePaste]);


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
    const baseDataUrl = canvas.toDataURL("image/png");
    let normalizedDataUrl = baseDataUrl;
    try {
      normalizedDataUrl = await normalizeToYouTubeDataUrl(baseDataUrl);
    } catch (error) {
    }
    const b64 = normalizedDataUrl.split(",")[1] || "";

    const newFrame = { dataUrl: normalizedDataUrl, b64, kind: "frame" as const };
    setFrames((prev) => [...prev, newFrame]);

    // Also add to hybrid storage
    try {
      await hybridStorage.addFrame(newFrame);
    } catch (error) {
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
    setSuggestedRefinements({});
    setLoadingSuggestions({});
    setProgressDone(0);
    setProgressTotal(0);
    try {
      const ids = selectedIds;
      if (ids.length === 0) {
        setLoading(false);
        setError("Please select at least one template.");
        return;
      }


        // Initialize overall progress across all selected templates
        const perTemplate = Math.max(1, count);
        const overallTotal = perTemplate * ids.length;
        let overallDone = 0;
        setProgressTotal(overallTotal);
        setProgressDone(0);

      // For each selected template, we will stream NDJSON and update UI incrementally
      for (const tid of ids) {
        let batchDone = 0; // Track progress within this template

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
              const normalized = await normalizeToYouTubeDataUrl(dataUrl);
              const b64 = normalized.split(",")[1] || "";
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

        let normalizedFrames = combinedFrames;
        try {
          normalizedFrames = await Promise.all(
            combinedFrames.map(async (b64) => {
              if (!b64) return b64;
              try {
                const normalizedDataUrl = await normalizeToYouTubeDataUrl(toDataUrlString(b64, TARGET_MIME));
                return normalizedDataUrl.split(",")[1] || b64;
              } catch (error) {
                return b64;
              }
            })
          );
        } catch (error) {
          normalizedFrames = combinedFrames;
        }

        const body = {
          prompt: finalPrompt,
          frames: normalizedFrames,
          framesMime: TARGET_MIME,
          variants: count,
          source: "thumbnails"
        };
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
          overallDone += processedImages.length;
          setProgressDone(overallDone);
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
                // Keep overall total; reflect current cumulative progress
                setProgressDone(overallDone);
              } else if (evt.type === "progress") {
                if (typeof evt.done === 'number') {
                  batchDone = Math.max(batchDone, evt.done);
                  setProgressDone(overallDone + batchDone);
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
                    // Fallback to original image if dimension enforcement fails
                    processedDataUrl = toDataUrlString(evt.dataUrl);
                  }

                  const blob = dataUrlToBlob(processedDataUrl);
                  const blobUrl = URL.createObjectURL(blob);
                  setResults((prev) => [...prev, blobUrl]);
                  setBlobUrls((prev) => [...prev, blobUrl]);
                  // Update cumulative progress for each streamed image (success path)
                  batchDone += 1;
                  setProgressDone(overallDone + batchDone);

                } catch {
                  setResults((prev) => [...prev, evt.dataUrl]);
                  // Update cumulative progress for each streamed image (fallback path)
                  batchDone += 1;
                  setProgressDone(overallDone + batchDone);

                }
              } else if (evt.type === "variant_error") {
                // Could surface per-variant errors if desired
              } else if (evt.type === "error") {
                throw new Error(evt.message || "Server error");
              } else if (evt.type === "done") {
                // stream end will break outer loop
              }
            }
          }
          // Accumulate progress for this template before moving to the next
          overallDone += batchDone;

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

    } catch (error) {

      // Fallback: try to copy as text (data URL)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(src);
        } else {
          throw new Error('No clipboard access available');
        }
      } catch (fallbackError) {
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
  const handleSelectThumbnailForRefinement = async (thumbnailIndex: number, initialFeedback: string = "") => {
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
        feedbackPrompt: initialFeedback,
        isCopying: false,
        isDownloading: false,
      });
    } catch (error) {
      setError('Failed to prepare thumbnail for refinement. Please try again.');
    }
  };

  const fetchSuggestedRefinements = async (thumbnailIndex: number, thumbnailUrl: string) => {
    // Don't fetch if already loading or already have suggestions
    if (loadingSuggestions[thumbnailIndex] || suggestedRefinements[thumbnailIndex]) {
      return;
    }

    setLoadingSuggestions(prev => ({ ...prev, [thumbnailIndex]: true }));

    try {
      const originalPrompt = buildPrompt({
        profile: selectedIds[0] || "",
        promptOverride: customPresets[selectedIds[0]]?.prompt ?? curatedMap[selectedIds[0]]?.prompt,
        headline,
        colors,
        aspect,
        notes: prompt,
        hasReferenceImages: refFrames.length > 0,
        hasSubjectImages: frames.length > 0,
      });

      const response = await fetch("/api/suggest-refinements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thumbnailUrl,
          originalPrompt,
          templateId: selectedIds[0] || "default",
        }),
      });

      const data = await response.json();

      if (data.success && data.suggestions) {
        setSuggestedRefinements(prev => ({
          ...prev,
          [thumbnailIndex]: data.suggestions,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch suggested refinements:", error);
    } finally {
      setLoadingSuggestions(prev => ({ ...prev, [thumbnailIndex]: false }));
    }
  };

  const handleApplySuggestedRefinement = (thumbnailIndex: number, suggestion: string) => {
    // Select the thumbnail for refinement with the suggestion pre-filled
    if (refinementState.selectedThumbnailIndex !== thumbnailIndex) {
      handleSelectThumbnailForRefinement(thumbnailIndex, suggestion);
    } else {
      // If already selected, just update the feedback prompt
      setRefinementState(prev => ({
        ...prev,
        feedbackPrompt: suggestion,
      }));
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
          // Try to clean up storage and retry
          RefinementUtils.cleanupStorage();
          try {
            refinementHistory.saveHistory(update.currentHistory);
          } catch (retryError) {
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
	  <div className="bg-slate-50">
	    <main
	      className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-8 sm:px-6 lg:pb-16 lg:pt-10"
	      onDragOver={onDragOver}
	      onDrop={onDropMedia}
	    >
	      <header className="mb-4 space-y-3 text-center md:mb-6 md:text-left">
	        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
	          Tool / Thumbnails
	        </p>
	        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
	          AI YouTube thumbnail generator
	        </h1>
	        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
	          Capture frames, apply on-brand templates, and export 1280x720 thumbnails your audience will click.
	        </p>
	      </header>

	      <script
	        type="application/ld+json"
	        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
	      />

	      <AuthGuard
	        message="You need to be signed in to create thumbnails. It's free after you sign up and you'll get credits to start generating immediately."
	      >
	        {/* Stepper */}
	        <nav
	          className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between"
	          aria-label="Thumbnail creation steps"
	        >
	          <div className="flex flex-1 items-center gap-2">
	            {[1, 2, 3].map((n) => {
	              const unlocked = canGoTo(n);
	              const active = currentStep === n;
	              const complete = unlocked && n < currentStep;
	              const label = n === 1 ? "Input" : n === 2 ? "Templates" : "Generate";
	              return (
	                <Button
	                  key={n}
	                  type="button"
	                  variant={active ? "default" : "outline"}
	                  size="sm"
	                  className={`flex flex-1 items-center justify-start gap-2 rounded-full border text-xs md:text-sm ${
	                    active
	                      ? "border-red-500 bg-red-50 text-red-700"
	                      : complete
	                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
	                        : unlocked
	                          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
	                          : "border-slate-100 bg-slate-50 text-slate-400"
	                  }`}
	                  onClick={() => goTo(n)}
	                  disabled={!unlocked}
	                  aria-current={active ? "step" : undefined}
	                  aria-controls={`step${n}`}
	                >
	                  <span
	                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
	                      active || complete
	                        ? "bg-red-600 text-white"
	                        : "bg-slate-200 text-slate-700"
	                    }`}
	                  >
	                    {n}
	                  </span>
	                  <span className="text-left font-medium">{label}</span>
	                </Button>
	              );
	            })}
	          </div>
	          <p className="text-xs text-slate-500 md:text-sm">
	            {currentStep === 1 && "1. Input - add frames and reference images."}
	            {currentStep === 2 && "2. Configure - choose templates and on-brand colors."}
	            {currentStep === 3 && "3. Generate - create and refine thumbnails."}
	          </p>
	        </nav>

	        <div className="mt-6 grid gap-6">
	        {currentStep === 1 && (
	          <>
	            <div className="flex flex-wrap items-center justify-center gap-3">
	              <label
	                className="inline-flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50"
	                aria-label="Add Video(s)"
	              >
	                <input
	                  type="file"
	                  accept="video/*"
	                  onChange={onFile}
	                  className="hidden"
	                />
	                <span>Add video</span>
	              </label>
	
	              <label
	                className={`inline-flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 ${
	                  framesFull ? "pointer-events-none opacity-50" : ""
	                }`}
	                aria-label="Add Images"
	                title={framesFull ? "Limit reached (3 subject images)" : undefined}
	              >
	                <input
	                  type="file"
	                  accept="image/png,image/jpeg,image/webp,image/gif,image/tiff"
	                  multiple
	                  onChange={onAddImages}
	                  disabled={framesFull}
	                  className="hidden"
	                />
	                <span>Add images</span>
	              </label>
	
	              {process.env.NODE_ENV === "development" && (
	                <>
	                  <Button
	                    type="button"
	                    variant="outline"
	                    size="sm"
	                    data-test="dev-add-sample-images"
	                    onClick={() =>
	                      importTestImagesFromUrls([
	                        "/references/aicoding.jpg",
	                        "/references/comparison.jpg",
	                        "/references/contrast.jpg",
	                        "/references/product.jpg",
	                      ])
	                    }
	                    className="text-xs"
	                  >
	                    Add sample images (dev)
	                  </Button>
	                  <Button
	                    type="button"
	                    variant="outline"
	                    size="sm"
	                    onClick={() => {
	                      RefinementUtils.cleanupStorage();
	                      setError(null);
	                      alert("Storage cleaned up! Refinement history has been cleared.");
	                    }}
	                    title="Clear localStorage to fix quota exceeded errors"
	                    className="border-red-300 text-xs text-red-600 hover:bg-red-50"
	                  >
	                    Clear storage (dev)
	                  </Button>
	                </>
	              )}
	            </div>
	
	            <p className="mt-2 text-center text-xs text-slate-500">
	              We send at most 3 images per generation. Tip: drag and drop images anywhere below, or paste from clipboard (Ctrl+V/Cmd+V).
	            </p>
	
	            {importing && (
	              <div
	                role="status"
	                aria-live="polite"
	                className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-700"
	              >
	                <span>
	                  Importing images… {importing.done}/{importing.total}
	                </span>
	                <Button
	                  type="button"
	                  variant="ghost"
	                  size="sm"
	                  onClick={() => setCancelImport(true)}
	                  className="h-7 px-2 text-xs"
	                >
	                  Cancel
	                </Button>
	              </div>
	            )}
	            {importing?.errors?.length ? (
	              <div className="mt-2 space-y-1 text-center text-xs text-red-600">
	                {importing.errors.slice(-3).map((msg, i) => (
	                  <div key={i}>{msg}</div>
	                ))}
	              </div>
	            ) : null}
	
	            {dedupeWarn.length > 0 && (
	              <div className="mt-2 space-y-1 text-center text-xs text-slate-500">
	                {dedupeWarn.slice(-3).map((w, i) => (
	                  <div key={i}>{w}</div>
	                ))}
	              </div>
	            )}
	          </>
	        )}
	        </div>





          {currentStep === 1 && (
            <>
              {videoUrl && (
                <div className="mt-6 space-y-4">
                  <Card className="mx-auto max-w-xl border-slate-200 bg-slate-50">
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-800">
                        <span role="img" aria-label="video">
                          🎬
                        </span>
                        <span className="font-medium">Scrub your video to find the best moment, then click</span>
                        <span role="img" aria-label="camera">
                          📸
                        </span>
                        <span className="font-semibold">Capture frame</span>
                      </div>
                      <p className="mt-2 text-center text-xs text-slate-500">
                        Video size: {Math.round(videoSize.width)}% · drag the handle in the corner to resize
                      </p>
                    </CardContent>
                  </Card>

                  <div className="relative flex justify-center">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      onLoadedMetadata={() => setVideoReady(true)}
                      style={{
                        width: `${videoSize.width}%`,
                        height: videoSize.height,
                      }}
                      className="max-w-full rounded-lg border border-slate-900/10 bg-black shadow-sm"
                    />
                    {/* Resize handle */}
                    <div
                      onMouseDown={startVideoResize}
                      style={{
                        position: "absolute",
                        bottom: -6,
                        right: `${(100 - videoSize.width) / 2 - 1}%`,
                        width: 12,
                        height: 12,
                        cursor: "nwse-resize",
                        borderRadius: 2,
                        border: "1px solid white",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        zIndex: 10,
                      }}
                      className={`${isResizing ? "bg-indigo-600" : "bg-indigo-500"} transition-colors`}
                      title="Drag to resize video"
                      onMouseEnter={(e) => {
                        if (!isResizing) {
                          e.currentTarget.style.background = "#1d4ed8";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isResizing) {
                          e.currentTarget.style.background = "#2563eb";
                        }
                      }}
                    />
                  </div>

                  <div className="flex justify-center">
                    <Button
                      type="button"
                      onClick={captureFrame}
                      disabled={!videoReady || framesFull}
                      title={framesFull ? "Limit reached (3 subject images)" : undefined}
                      size="sm"
                      className="px-4"
                    >
                      Capture frame at current time
                    </Button>
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />

              {frames.length > 0 && (
                <section className="mt-6">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Subject frames/images ({frames.length}/3)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tip: include 2–3 strong subject shots.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {frames.map((f, i) => (
                      <div
                        key={i}
                        className="relative flex w-56 flex-col rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
                      >
                        <span
                          title={f.kind === "image" ? "Imported image" : "Captured frame"}
                          className="absolute left-2 top-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white"
                        >
                          {f.kind === "image" ? "image" : "frame"}
                        </span>
                        {f.dataUrl ? (
                          <img
                            src={f.dataUrl}
                            alt={`item-${i}`}
                            className="mt-5 w-full rounded-sm border border-slate-900/5 object-cover"
                          />
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => moveFrame(i, i - 1)}
                            disabled={i === 0}
                            aria-label="Move left"
                          >
                            ◀
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => moveFrame(i, i + 1)}
                            disabled={i === frames.length - 1}
                            aria-label="Move right"
                          >
                            ▶
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFrame(i)}
                            className="ml-auto h-8 px-2 text-xs text-slate-600 hover:text-red-600"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  onClick={() => goTo(2)}
                  disabled={!step1Done}
                  className="min-w-[160px]"
                >
                  Next: Templates →
                </Button>
              </div>
            </>
          )}




          {currentStep === 2 && step1Done && (
            <section className="mt-6 grid gap-4">
              {/* Cloud Storage Status */}
              {hybridStorage.isCloudEnabled && (
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    hybridStorage.isOnline
                      ? "border-sky-200 bg-sky-50 text-sky-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      hybridStorage.isOnline ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span>
                    {hybridStorage.isOnline
                      ? "Cloud sync enabled"
                      : "Offline - using local storage"}
                    {hybridStorage.isLoading && " (syncing...)"}
                  </span>
                  {hybridStorage.error && (
                    <span className="ml-2 text-xs font-medium text-red-600">
                      Error: {hybridStorage.error}
                    </span>
                  )}
                </div>
              )}

              {/* Template Gallery */}
              <TemplateGallery
                selectedIds={selectedIds}
                onToggleSelect={(id) => {
                  setSelectedIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  );
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
                onUpdatePreset={async (id, update) => {
                  try {
                    await hybridStorage.updateTemplate(id, update);
                    if (profile === id && update.colors) setColors(update.colors);
                  } catch (error) {
                    // no-op
                  }
                }}
                onCreatePreset={async (p) => {
                  try {
                    const id = await hybridStorage.createTemplate(p);
                    setProfile(id);
                    setColors(p.colors || []);
                  } catch (error) {
                    // no-op
                  }
                }}
                hybridStorage={hybridStorage}
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => goTo(1)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => goTo(3)}
                  disabled={!step2Done}
                  className="min-w-[180px]"
                >
                  Next: Generate →
                </Button>
              </div>
            </section>
          )}

	          {currentStep === 3 && step1Done && step2Done && (
	            <section id="step3" className="mt-6 grid gap-6">
	              {!loading && results.length === 0 && (
	                <Card className="border-slate-200 bg-white/80 shadow-sm">
	                  <CardContent className="space-y-4 p-4 sm:p-5">
	                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
	                      <div className="space-y-4">
	                        <div className="space-y-1.5">
	                          <label
	                            htmlFor="headline"
	                            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
	                          >
	                            Headline
	                            <span className="ml-1 text-[10px] font-normal text-slate-400">
	                              (optional)
	                            </span>
	                          </label>
	                          <Input
	                            id="headline"
	                            type="text"
	                            placeholder="3–5 word hook"
	                            value={headline}
	                            onChange={(e) => setHeadline(e.target.value)}
	                          />
	                        </div>
	
	                        <div className="space-y-1.5">
	                          <label
	                            htmlFor="notes"
	                            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
	                          >
	                            Additional notes
	                            <span className="ml-1 text-[10px] font-normal text-slate-400">
	                              (optional)
	                            </span>
	                          </label>
	                          <Textarea
	                            id="notes"
	                            value={prompt}
	                            onChange={(e) => setPrompt(e.target.value)}
	                            rows={4}
	                            className="min-h-[120px] resize-none"
	                          />
	                        </div>
	                      </div>
	
	                      <div className="space-y-4">
	                        <div className="space-y-1.5">
	                          <label
	                            htmlFor="variants"
	                            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
	                          >
	                            Variants
	                          </label>
	                          <Input
	                            id="variants"
	                            type="number"
	                            min={1}
	                            max={8}
	                            value={count}
	                            onChange={(e) =>
	                              setCount(parseInt(e.target.value || "1", 10))
	                            }
	                            className="max-w-[112px]"
	                          />
	                          <p className="text-xs text-slate-500">
	                            Number of variations to generate per selected template
	                            (max 8).
	                          </p>
	                        </div>
	
	                        <Card className="border-dashed border-slate-200 bg-slate-50">
	                          <CardContent className="space-y-1.5 py-3 text-xs text-slate-600">
	                            <p className="font-medium text-slate-800">
	                              What you&apos;ll get
	                            </p>
	                            <ul className="list-disc space-y-1 pl-4">
	                              <li>On-brand thumbnails sized to 1280×720.</li>
	                              <li>
	                                One image per selected template × variant count.
	                              </li>
	                              <li>
	                                Ready to download or refine in the next step.
	                              </li>
	                            </ul>
	                          </CardContent>
	                        </Card>
	                      </div>
	                    </div>
	
	                    <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
	                      <p className="text-xs text-slate-500">
	                        ✅ All thumbnails automatically sized to YouTube specs
	                        (1280×720).
	                      </p>
	                      <Button
	                        type="button"
	                        onClick={(e) => {
	                          if (!isAuthed) {
	                            e.preventDefault();
	                            setAuthRequired(true);
	                            setShowAuthModal(true);
	                            return;
	                          }
	                          generate();
	                        }}
	                        disabled={
	                          authLoading ||
	                          loading ||
	                          frames.length === 0 ||
	                          (!loadingCustomer &&
	                            credits <
	                              Math.max(1, count) * (selectedIds.length || 0))
	                        }
	                        size="sm"
	                        className="min-w-[220px]"
	                      >
	                        {authLoading
	                          ? "Loading..."
	                          : !isAuthed
	                            ? "Generate thumbnails (Free after sign-up)"
	                            : !loadingCustomer
	                              ? `Generate thumbnails (uses ${
	                                  Math.max(1, count) * (selectedIds.length || 0)
	                                } credit${
	                                  Math.max(1, count) * (selectedIds.length || 0) === 1
	                                    ? ""
	                                    : "s"
	                                })`
	                              : "Generate thumbnails"}
	                      </Button>
	                    </div>
	
	                    <div className="mt-3 flex justify-start">
	                      <Button
	                        type="button"
	                        variant="ghost"
	                        size="sm"
	                        onClick={() => goTo(2)}
	                        className="text-slate-600 hover:text-slate-900"
	                      >
	                        ← Back
	                      </Button>
	                    </div>
	                  </CardContent>
	                </Card>
	              )}
	
	              {loading && (
	                <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm">
	                  <div className="text-base font-semibold text-slate-900">
	                    Generating thumbnails...
	                  </div>
	                  <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
	                    <span className="font-semibold text-slate-800">Progress</span>
	                    <span>
	                      {progressTotal > 0
	                        ? `${progressDone}/${progressTotal}`
	                        : results.length > 0
	                          ? `${results.length}…`
	                          : "starting…"}
	                    </span>
	                  </div>
	                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
	                    <div
	                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-[width] duration-300"
	                      style={{
	                        width: `${Math.min(
	                          100,
	                          Math.round(
	                            (progressDone /
	                              (progressTotal ||
	                                Math.max(1, results.length))) *
	                              100,
	                          ),
	                        )}%`,
	                      }}
	                    />
	                  </div>
	                  <div className="text-sm text-slate-600">
	                    Creating {Math.max(1, count) * (selectedIds.length || 0)}
	                    {" "}
	                    thumbnail
	                    {Math.max(1, count) * (selectedIds.length || 0) === 1
	                      ? ""
	                      : "s"}
	                    ...
	                  </div>
	                </div>
	              )}
	
	              {!loading &&
	                results.length > 0 &&
	                !refinementState.isRefinementMode && (
	                  <>
	                    <div className="mb-3 flex flex-wrap items-center gap-3">
	                      <h3 className="text-sm font-semibold text-slate-900">
	                        Results ({results.length})
	                      </h3>
	                      <Button
	                        type="button"
	                        size="sm"
	                        variant="outline"
	                        onClick={downloadAll}
	                        disabled={downloadingAll}
	                      >
	                        {downloadingAll ? "Downloading..." : "Download all"}
	                      </Button>
	                    </div>
	                    <div className="flex flex-wrap gap-4">
	                      {results.map((src, i) => {
	                        const isSelected =
	                          refinementState.selectedThumbnailIndex === i;
	                        return (
	                          <div
	                            key={i}
	                            className={`flex w-80 flex-col rounded-xl border bg-white p-3 shadow-sm ${
	                              isSelected
	                                ? "border-red-500 ring-2 ring-red-200"
	                                : "border-slate-200"
	                            }`}
	                          >
	                            {src ? (
	                              <img
	                                src={src}
	                                alt={`result-${i}`}
	                                className="w-full rounded-md border border-slate-900/5 object-cover"
	                              />
	                            ) : null}
	
	                            <div className="mt-3 flex flex-wrap gap-2">
	                              <Button
	                                type="button"
	                                size="sm"
	                                variant="outline"
	                                onClick={() => download(src, i)}
	                                disabled={downloadingIndex === i}
	                              >
	                                {downloadingIndex === i
	                                  ? "Downloading..."
	                                  : "Download"}
	                              </Button>
	                              <Button
	                                type="button"
	                                size="sm"
	                                variant="outline"
	                                onClick={() => copyToClipboard(src, i)}
	                                disabled={copyingIndex === i}
	                              >
	                                {copyingIndex === i ? "Copying..." : "Copy"}
	                              </Button>
	                            </div>
	
	                            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
	                              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
	                                <span className="text-base">✨</span>
	                                <span>Refine this thumbnail</span>
	                              </div>
	                              <p className="mt-1 text-xs text-slate-600">
	                                AI-powered improvements to make your thumbnail even
	                                better.
	                              </p>
	
	                              {loadingSuggestions[i] && (
	                                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
	                                  <span className="h-4 w-4 animate-spin rounded-full border-[2px] border-slate-300 border-t-slate-500" />
	                                  <span>Generating AI suggestions...</span>
	                                </div>
	                              )}
	
	                              {!loadingSuggestions[i] &&
	                                suggestedRefinements[i] &&
	                                suggestedRefinements[i].length > 0 && (
	                                  <div className="mt-3 space-y-2">
	                                    <div className="text-xs font-medium text-slate-700">
	                                      💡 Quick refinements (click to apply):
	                                    </div>
	                                    <div className="flex flex-wrap gap-2">
	                                      {suggestedRefinements[i].map(
	                                        (suggestion, idx) => (
	                                          <Button
	                                            key={idx}
	                                            type="button"
	                                            size="sm"
	                                            variant="outline"
	                                            onClick={() =>
	                                              handleApplySuggestedRefinement(
	                                                i,
	                                                suggestion,
	                                              )
	                                            }
	                                            className="whitespace-normal text-left text-xs"
	                                            title={`Click to apply: ${suggestion}`}
	                                          >
	                                            {suggestion}
	                                          </Button>
	                                        ),
	                                      )}
	                                    </div>
	                                  </div>
	                                )}
	
	                              <div className="mt-3">
	                                <Button
	                                  type="button"
	                                  size="sm"
	                                  variant="ghost"
	                                  onClick={() =>
	                                    handleSelectThumbnailForRefinement(i)
	                                  }
	                                  title="Write your own custom refinement instructions to improve this thumbnail exactly how you want"
	                                  className="text-xs text-slate-700 hover:text-red-600"
	                                >
	                                  ✏️ Custom refine
	                                </Button>
	                              </div>
	                            </div>
	                          </div>
	                        );
	                      })}
	                    </div>
	
	                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
	                      <Button
	                        type="button"
	                        size="sm"
	                        variant="outline"
	                        onClick={() => {
	                          setResults([]);
	                          cleanupBlobUrls();
	                          setSuggestedRefinements({});
	                          setLoadingSuggestions({});
	                        }}
	                      >
	                        ← Generate more
	                      </Button>
	                      <Button
	                        type="button"
	                        size="sm"
	                        variant="ghost"
	                        onClick={() => goTo(1)}
	                        className="text-slate-600 hover:text-slate-900"
	                      >
	                        Start over
	                      </Button>
	                    </div>
	                  </>
	                )}
	
	              {/* Refinement Interface */}
	              {refinementState.isRefinementMode && (
	                <>
	                  <div className="mb-4 flex items-center gap-3">
	                    <Button
	                      type="button"
	                      size="sm"
	                      variant="ghost"
	                      onClick={handleExitRefinementMode}
	                    >
	                      ← Back to results
	                    </Button>
	                    <h3 className="text-sm font-semibold text-slate-900">
	                      Thumbnail refinement
	                    </h3>
	                  </div>
	
	                  <ThumbnailRefinement
	                    refinementState={refinementState}
	                    onUpdateRefinementState={handleUpdateRefinementState}
	                    originalPrompt={buildPrompt({
	                      profile: selectedIds[0] || "",
	                      promptOverride:
	                        customPresets[selectedIds[0]]?.prompt ??
	                        curatedMap[selectedIds[0]]?.prompt,
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
	                <p className="mt-3 text-sm text-red-600">{error}</p>
	              )}
	            </section>
	          )}


	          {authRequired && (
	            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
	              <div className="font-semibold">Sign in required</div>
	              <p className="mt-1 text-red-800">
	                You need to be signed in to generate thumbnails. It’s free after you
	                sign up.
	              </p>
	              <Button
	                type="button"
	                size="sm"
	                onClick={() => (window.location.href = "/api/auth/signin")}
	                className="mt-3 bg-white text-red-700 shadow-sm hover:bg-red-50"
	              >
	                Sign in with Google
	              </Button>
	            </div>
	          )}

	          {showAuthModal && (
	            <div
	              role="dialog"
	              aria-modal="true"
	              className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4"
	            >
	              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl">
	                <div className="text-base font-semibold">
	                  Sign in to generate — it’s free
	                </div>
	                <p className="mt-2 text-sm text-slate-600">
	                  Create thumbnails for free after you sign up. We’ll also track your
	                  credits.
	                </p>
	                <div className="mt-4 flex flex-wrap gap-2">
	                  <Button
	                    type="button"
	                    onClick={() => (window.location.href = "/api/auth/signin")}
	                  >
	                    Sign in with Google
	                  </Button>
	                  <Button
	                    type="button"
	                    variant="ghost"
	                    onClick={() => setShowAuthModal(false)}
	                  >
	                    Close
	                  </Button>
	                </div>
	              </div>
	            </div>
	          )}

	        {/* Refinement History Browser */}
	        {refinementHistory.histories.length > 0 &&
	          !refinementState.isRefinementMode && (
	            <section className="mt-6">
	              <div className="mb-4 flex items-center gap-3">
	                <Button
	                  type="button"
	                  size="sm"
	                  variant={showHistoryBrowser ? "default" : "outline"}
	                  onClick={() => setShowHistoryBrowser(!showHistoryBrowser)}
	                >
	                  {showHistoryBrowser ? "Hide" : "Show"} Refinement History ({
	                    refinementHistory.histories.length
	                  })
	                </Button>
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
	        </AuthGuard>

	        <section
	          aria-labelledby="thumbnailFaq"
	          className="mt-12 space-y-4"
	        >
	          <div className="text-center">
	            <h2
	              id="thumbnailFaq"
	              className="text-2xl font-semibold tracking-tight text-slate-900"
	            >
	              YouTube thumbnail generator FAQ
	            </h2>
	            <p className="mt-1 text-sm text-slate-600">
	              Answers to common questions about thumbnail quality, credits, and
	              exports.
	            </p>
	          </div>

	          <Card className="border-slate-200 bg-white">
	            <CardHeader className="pb-3">
	              <CardTitle className="text-base">
	                Frequently asked questions
	              </CardTitle>
	              <CardDescription>
	                Helpful details about how the thumbnail generator works.
	              </CardDescription>
	            </CardHeader>
	            <CardContent className="pt-0">
	              <div className="space-y-3">
	                {thumbnailFaqItems.map((item) => (
	                  <details
	                    key={item.question}
	                    className="group rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
	                  >
	                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
	                      <span>{item.question}</span>
	                      <span className="text-slate-400 transition-transform group-open:rotate-180">
	                        <svg
	                          xmlns="http://www.w3.org/2000/svg"
	                          viewBox="0 0 20 20"
	                          fill="currentColor"
	                          className="h-4 w-4"
	                          aria-hidden="true"
	                        >
	                          <path
	                            fillRule="evenodd"
	                            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
	                            clipRule="evenodd"
	                          />
	                        </svg>
	                      </span>
	                    </summary>
	                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
	                      {item.answer}
	                    </p>
	                  </details>
	                ))}
	              </div>
	            </CardContent>
	          </Card>
	        </section>
      </main>
    </div>
  );
}
