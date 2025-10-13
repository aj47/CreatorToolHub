"use client";

import { useState, useEffect } from "react";
import { CloudGeneration, CloudGenerationInput } from "@/lib/storage/client";
import styles from "./GenerationDetail.module.css";

interface GenerationDetailProps {
  generation: CloudGeneration;
  onClose: () => void;
  onDelete: () => void;
}

export default function GenerationDetail({
  generation,
  onClose,
  onDelete,
}: GenerationDetailProps) {
  const [inputs, setInputs] = useState<CloudGenerationInput[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchInputs = async () => {
      try {
        const isLocal = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
        const base = isLocal ? (process.env.NEXT_PUBLIC_WORKER_API_URL || "") : "";
        const url = `${base}/api/user/generations/${generation.id}`;

        const response = await fetch(url, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setInputs(data.inputs || []);
        }
      } catch (err) {
        console.error("Failed to fetch generation inputs:", err);
      }
    };

    fetchInputs();
  }, [generation.id]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Generation Details</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Status & Metadata */}
          <section className={styles.section}>
            <h3>Status & Metadata</h3>
            <div className={styles.grid}>
              <div>
                <label>Status</label>
                <span className={`nb-badge ${styles[`status-${generation.status}`]}`}>
                  {generation.status}
                </span>
              </div>
              <div>
                <label>Created</label>
                <span>{new Date(generation.created_at).toLocaleString()}</span>
              </div>
              <div>
                <label>Source</label>
                <span>{generation.source || "—"}</span>
              </div>
              <div>
                <label>Variants</label>
                <span>{generation.variants_requested}</span>
              </div>
            </div>
          </section>

          {/* Prompt */}
          <section className={styles.section}>
            <h3>Prompt</h3>
            <div className={styles.promptBox}>
              <p>{generation.prompt}</p>
              <button
                className="nb-btn nb-btn--small"
                onClick={() => copyToClipboard(generation.prompt, "prompt")}
              >
                {copied === "prompt" ? "Copied!" : "Copy"}
              </button>
            </div>
          </section>

          {/* Outputs */}
          {generation.outputs && generation.outputs.length > 0 && (
            <section className={styles.section}>
              <h3>Generated Images ({generation.outputs.length})</h3>
              <div className={styles.outputsGrid}>
                {generation.outputs.map((output, idx) => (
                  <div key={output.id} className={styles.outputCard}>
                    {output.url && (
                      <img src={output.url} alt={`Variant ${idx + 1}`} />
                    )}
                    <div className={styles.outputInfo}>
                      <span>Variant {output.variant_index + 1}</span>
                      {output.width && output.height && (
                        <span className="nb-muted">
                          {output.width}×{output.height}
                        </span>
                      )}
                      {output.size_bytes && (
                        <span className="nb-muted">
                          {(output.size_bytes / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                    {output.url && (
                      <button
                        className="nb-btn nb-btn--small"
                        onClick={() =>
                          downloadImage(
                            output.url!,
                            `generation-${generation.id}-${idx + 1}.png`
                          )
                        }
                      >
                        Download
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Inputs */}
          {inputs.length > 0 && (
            <section className={styles.section}>
              <h3>Inputs ({inputs.length})</h3>
              <div className={styles.inputsList}>
                {inputs.map((input) => (
                  <div key={input.id} className={styles.inputItem}>
                    <span className="nb-badge">{input.input_type}</span>
                    {input.metadata && (
                      <pre className={styles.metadata}>
                        {JSON.stringify(input.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Template Info */}
          {generation.template_id && (
            <section className={styles.section}>
              <h3>Template</h3>
              <p className="nb-muted">Template ID: {generation.template_id}</p>
            </section>
          )}

          {/* Error Message */}
          {generation.error_message && (
            <section className={styles.section}>
              <h3>Error</h3>
              <div className={styles.error}>{generation.error_message}</div>
            </section>
          )}
        </div>

        <div className={styles.footer}>
          <button className="nb-btn" onClick={onClose}>
            Close
          </button>
          <button
            className="nb-btn nb-btn--danger"
            onClick={() => {
              if (confirm("Delete this generation?")) {
                onDelete();
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

