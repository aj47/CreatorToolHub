'use client';

import { useEffect, useState } from 'react';

type Generation = {
  id: string;
  created_at: string;
  prompt: string;
  r2_key: string;
};

export default function GenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/generations')
      .then((res) => res.json())
      .then((data) => {
        setGenerations(data.generations || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load generations:', err);
        setLoading(false);
      });
  }, []);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getImageUrl = (r2Key: string) => {
    return `http://localhost:8787/api/files/${encodeURIComponent(r2Key)}`;
  };

  const extractTemplateFromPrompt = (prompt: string): string => {
    if (prompt.includes('educational coding aesthetic')) return 'Code Listicle';
    if (prompt.includes('developer tool aesthetic')) return 'Developer Tool';
    if (prompt.includes('energetic vlog aesthetic')) return 'Vlog';
    if (prompt.includes('podcast aesthetic')) return 'Podcast';
    if (prompt.includes('modern tech aesthetic')) return 'Tech Screen Cast';
    if (prompt.includes('gaming aesthetic')) return 'Vibrant';
    if (prompt.includes('educational aesthetic')) return 'Tutorial';
    if (prompt.includes('music aesthetic')) return 'Music';
    if (prompt.includes('cinematic aesthetic')) return 'Cinematic';
    if (prompt.includes('review aesthetic')) return 'Software Review';
    return 'Unknown';
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Loading generations...</h1>
      </div>
    );
  }

  // Group by generation ID
  const grouped = generations.reduce((acc, gen) => {
    if (!acc[gen.id]) {
      acc[gen.id] = {
        id: gen.id,
        created_at: gen.created_at,
        prompt: gen.prompt,
        images: [],
      };
    }
    acc[gen.id].images.push(gen.r2_key);
    return acc;
  }, {} as Record<string, { id: string; created_at: string; prompt: string; images: string[] }>);

  const groupedArray = Object.values(grouped).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Recent Generations</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Click on a generation ID to copy it. Use these IDs to set template preview images.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {groupedArray.map((gen) => {
          const template = extractTemplateFromPrompt(gen.prompt);
          return (
            <div
              key={gen.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1.5rem',
                backgroundColor: '#fff',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1.2rem' }}>{template}</strong>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                    }}
                  >
                    {new Date(gen.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <code
                    onClick={() => copyId(gen.id)}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                    }}
                    title="Click to copy"
                  >
                    {gen.id}
                  </code>
                  {copiedId === gen.id && (
                    <span style={{ color: 'green', fontSize: '0.875rem' }}>✓ Copied!</span>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '1rem',
                }}
              >
                {gen.images.map((r2Key, idx) => (
                  <div key={r2Key} style={{ position: 'relative' }}>
                    <img
                      src={getImageUrl(r2Key)}
                      alt={`Generation ${gen.id} - variant ${idx}`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: '4px',
                        border: '1px solid #eee',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                      }}
                    >
                      Variant {idx}
                    </div>
                  </div>
                ))}
              </div>

              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', color: '#666', fontSize: '0.875rem' }}>
                  Show prompt
                </summary>
                <p
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {gen.prompt}
                </p>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

