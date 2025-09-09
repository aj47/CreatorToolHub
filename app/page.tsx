export default function Home() {
  return (
    <main className="nb-main">
      <section className="nb-hero">
        <div className="nb-hero-grid">
          <div>
            <h1 className="nb-hero-title">Create bold, scroll-stopping YouTube thumbnails</h1>
            <p className="nb-hero-sub">Capture frames or import images, apply template-exact prompts, and generate multiple variants with clean, legible layouts.</p>
            <div className="nb-hero-ctas">
              <a className="nb-btn nb-btn--accent" href="/thumbnails">Open Thumbnail Creator</a>
            </div>
          </div>
          <div className="nb-card nb-hero-preview">
            <div className="nb-thumb-demo">
              <span>16:9 demo • heavy borders • red accent</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="nb-features">
        <div className="nb-card">
          <div className="nb-feature-title">Use your own frames</div>
          <p>Drag-and-drop images or capture frames from a short video.</p>
        </div>
        <div className="nb-card">
          <div className="nb-feature-title">Style via references</div>
          <p>Reference images guide style/layout only; subjects come from your frames.</p>
        </div>
        <div className="nb-card">
          <div className="nb-feature-title">Multiple variants</div>
          <p>Generate several options in a single run and download or copy quickly.</p>
        </div>
      </section>
    </main>
  );
}

