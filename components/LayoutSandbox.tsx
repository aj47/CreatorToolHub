"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Aspect = "16:9" | "9:16" | "1:1";
export type LayoutItem = {
  id: string;
  label: string;
  x: number; // 0-1
  y: number; // 0-1
  w: number; // 0-1
  h: number; // 0-1
  z: number;
  color?: string;
  hidden?: boolean;
};

function aspectToWH(aspect: Aspect): [number, number] {
  if (aspect === "9:16") return [9, 16];
  if (aspect === "1:1") return [1, 1];
  return [16, 9];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function LayoutSandbox({
  aspect,
  onExport,
}: {
  aspect: Aspect;
  onExport?: (args: { imageB64: string; description: string }) => void;
}) {
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [history, setHistory] = useState<LayoutItem[][]>([]);
  const [future, setFuture] = useState<LayoutItem[][]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const lsKey = `cg_layout_sandbox_v1_${aspect.replace(":", "x")}`;

  // Load/save per-aspect
  useEffect(() => {
    try {
      const s = localStorage.getItem(lsKey);
      if (s) setItems(JSON.parse(s));
    } catch {}
  }, [lsKey]);
  useEffect(() => {
    try { localStorage.setItem(lsKey, JSON.stringify(items)); } catch {}
  }, [items, lsKey]);

  const pushHistory = useCallback((next: LayoutItem[]) => {
    setHistory((h) => {
      const nh = [...h, next];
      // cap to 10 steps
      return nh.slice(-10);
    });
    setFuture([]);
  }, []);

  const addItem = (label: string) => {
    const it: LayoutItem = {
      id: `itm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      x: 0.1,
      y: 0.1,
      w: 0.3,
      h: 0.2,
      z: (items[items.length - 1]?.z ?? 0) + 1,
      color: "#FFD166",
    };
    const next = [...items, it];
    pushHistory(items);
    setItems(next);
    setActiveId(it.id);
  };

  const removeItem = (id: string) => {
    pushHistory(items);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [...f, items]);
      setItems(prev);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nxt = f[f.length - 1];
      setHistory((h) => [...h, items].slice(-10));
      setItems(nxt);
      return f.slice(0, -1);
    });
  };

  const startDrag = (
    e: React.MouseEvent,
    id: string,
    mode: "move" | "se",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { x, y, w, h } = item;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          if (mode === "move") {
            return {
              ...it,
              x: clamp01(x + dx),
              y: clamp01(y + dy),
            };
          } else {
            return {
              ...it,
              w: clamp01(Math.max(0.05, w + dx)),
              h: clamp01(Math.max(0.05, h + dy)),
            };
          }
        })
      );
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      pushHistory(items);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!activeId) return;
    const delta = e.shiftKey ? 0.02 : 0.01;
    const grow = 0.01;
    let handled = true;
    if (e.key === "ArrowLeft") {
      setItems((prev) => prev.map((it) => it.id === activeId ? { ...it, x: clamp01(it.x - delta) } : it));
    } else if (e.key === "ArrowRight") {
      setItems((prev) => prev.map((it) => it.id === activeId ? { ...it, x: clamp01(it.x + delta) } : it));
    } else if (e.key === "ArrowUp") {
      setItems((prev) => prev.map((it) => it.id === activeId ? { ...it, y: clamp01(it.y - delta) } : it));
    } else if (e.key === "ArrowDown") {
      setItems((prev) => prev.map((it) => it.id === activeId ? { ...it, y: clamp01(it.y + delta) } : it));
    } else if (e.key === "+" || e.key === "=") {
      setItems((prev) => prev.map((it) => it.id === activeId ? { ...it, w: clamp01(it.w + grow), h: clamp01(it.h + grow) } : it));
    } else if (e.key === "-" || e.key === "_") {
      setItems((prev) => prev.map((it) => it.id === activeId ? { ...it, w: clamp01(it.w - grow), h: clamp01(it.h - grow) } : it));
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      pushHistory(items);
    }
  };

  const exportImage = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const [aw, ah] = aspectToWH(aspect);
    const targetW = aspect === "9:16" ? 640 : 640; // keep small
    const targetH = Math.round(targetW * (ah / aw));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);

    // draw boxes
    items
      .slice()
      .sort((a, b) => (a.z || 0) - (b.z || 0))
      .forEach((it) => {
        if (it.hidden) return;
        const x = Math.round(it.x * targetW);
        const y = Math.round(it.y * targetH);
        const w = Math.round(it.w * targetW);
        const h = Math.round(it.h * targetH);
        ctx.strokeStyle = it.color || "#111827";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#111827";
        const text = it.label.toUpperCase();
        ctx.fillText(text, x + 6, y + 20);
      });

    const b64 = canvas.toDataURL("image/png").split(",")[1] || "";

    // textual description
    const desc = items
      .filter((it) => !it.hidden)
      .map((it) => {
        const cx = Math.round(it.x * 100);
        const cy = Math.round(it.y * 100);
        const cw = Math.round(it.w * 100);
        const ch = Math.round(it.h * 100);
        return `${it.label}: at ${cx}% x, ${cy}% y, size ${cw}% w × ${ch}% h`;
      })
      .join("; ");

    onExport?.({ imageB64: b64, description: desc });
  };

  const [aw, ah] = aspectToWH(aspect);
  const padTop = useMemo(() => (ah / aw) * 100, [aw, ah]);

  return (
    <div style={{ display: "grid", gap: 8 }} onKeyDown={onKey}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Layout Sandbox</strong>
        <button type="button" onClick={() => addItem("SUBJECT")}>+ Subject</button>
        <button type="button" onClick={() => addItem("HEADLINE")}>+ Headline</button>
        <button type="button" onClick={() => addItem("BADGE")}>+ Badge</button>
        <button type="button" onClick={undo} disabled={history.length === 0}>Undo</button>
        <button type="button" onClick={redo} disabled={future.length === 0}>Redo</button>
        <button type="button" onClick={exportImage} title="Export PNG and description">Export</button>
      </div>
      <div
        ref={wrapRef}
        tabIndex={0}
        aria-label="Layout sandbox artboard"
        style={{ position: "relative", width: "100%", paddingTop: `${padTop}%`, outline: "1px dashed #94a3b8", borderRadius: 6 }}
      >
        {/* absolute children inside */}
        {items.map((it) => (
          <div
            key={it.id}
            role="button"
            tabIndex={0}
            aria-label={`Box ${it.label}`}
            onFocus={() => setActiveId(it.id)}
            onMouseDown={(e) => startDrag(e, it.id, "move")}
            style={{
              position: "absolute",
              left: `${it.x * 100}%`,
              top: `${it.y * 100}%`,
              width: `${it.w * 100}%`,
              height: `${it.h * 100}%`,
              border: activeId === it.id ? "2px solid #2563eb" : "2px solid #94a3b8",
              background: "rgba(148,163,184,0.08)",
              boxSizing: "border-box",
              cursor: "move",
              userSelect: "none",
            }}
          >
            <div style={{ position: "absolute", left: 6, top: 4, fontSize: 12, fontWeight: 700 }}>{it.label}</div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
              title="Remove"
              style={{ position: "absolute", right: 4, top: 4 }}
            >×</button>
            <div
              onMouseDown={(e) => startDrag(e, it.id, "se")}
              title="Resize"
              style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: "#2563eb", cursor: "nwse-resize", borderRadius: 2 }}
            />
          </div>
        ))}
      </div>
      <small>
        Tips: Use mouse to drag/resize. With a box focused, use arrow keys to nudge, Shift+arrows to move faster, +/- to resize. Export to attach the layout to your request.
      </small>
    </div>
  );
}

