"use client";

import React from "react";

export interface StepIndicatorProps {
  steps: string[];
  current: number; // 1-based index
  className?: string;
}

export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  return (
    <ol className={`flex flex-wrap items-center gap-3 text-sm ${className ?? ""}`}>
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        const base = "flex items-center gap-2";
        const dot = done
          ? "bg-primary text-primary-foreground"
          : active
          ? "border-2 border-primary text-primary"
          : "border border-border text-muted-foreground";
        return (
          <li key={label} className={`${base}`}>
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${dot}`}
            >
              {done ? "✓" : stepNum}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {stepNum !== steps.length && (
              <span className="mx-2 h-px w-6 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default StepIndicator;

