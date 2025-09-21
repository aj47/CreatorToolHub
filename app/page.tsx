export default function Home() {
  return (
    <main className="nb-main">
      <section className="nb-hero">
        <div className="nb-hero-grid">
          <div>
            <h1 className="nb-hero-title">Optimize your videos and thumbnails in one place</h1>
            <p className="nb-hero-sub">Capture frames for thumb designs, and now generate SEO-friendly titles and descriptions straight from your YouTube transcript.</p>
            <div className="nb-hero-ctas">
              <a className="nb-btn nb-btn--accent" href="/thumbnails">Open Thumbnail Creator</a>
              <a className="nb-btn" href="/video-optimizer">Try Video Optimizer</a>
            </div>
          </div>
          <div className="nb-card nb-hero-preview">
            <div className="nb-thumb-demo">
              <span>A demo will go here once i make it :)</span>
            </div>
          </div>
        </div>
      </section>


      {/* Roadmap (timeline) */}
      <section id="roadmap" className="nb-features" aria-labelledby="roadmap-title">
        <div className="nb-card" style={{ gridColumn: "1 / -1" }}>
          <div id="roadmap-title" className="nb-feature-title" style={{ fontSize: 22 }}>Roadmap</div>
          <p className="nb-muted" style={{ marginTop: 4 }}>What’s shipped and what’s next.</p>
          <ol className="nb-timeline" style={{ marginTop: 10 }}>
            <li className="nb-tl-item nb-tl--done">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Use your own frames <span className="nb-badge nb-badge--done">Done</span></div>
                <p>Drag-and-drop images or capture frames from a short video.</p>
              </div>
            </li>
            <li className="nb-tl-item nb-tl--done">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Style via references <span className="nb-badge nb-badge--done">Done</span></div>
                <p>Use a reference image to guide style and layout (subjects come from your frames).</p>
              </div>
            </li>
            <li className="nb-tl-item nb-tl--done">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Multiple variants <span className="nb-badge nb-badge--done">Done</span></div>
                <p>Generate several options in a single run.</p>
              </div>
            </li>
            <li className="nb-tl-item nb-tl--done">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Title & description optimizer <span className="nb-badge nb-badge--done">Done</span></div>
                <p>Drop in a YouTube URL and get an optimized title, description, and transcript recap. <a href="/video-optimizer">Launch Video Optimizer →</a></p>
              </div>
            </li>
            <li className="nb-tl-item">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Iterate with feedback on generated thumbnails <span className="nb-badge">Planned</span></div>
                <p>Provide follow-up prompts to tweak style, layout, and text so you can refine thumbnails without starting over.</p>
              </div>
            </li>
            <li className="nb-tl-item">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Suggest a feature <span className="nb-badge">Your ideas</span></div>
                <p>Have a request? Open an issue and tell us what would help you most. <a href="https://github.com/aj47/CreatorToolHub/issues" target="_blank" rel="noopener noreferrer">Submit on GitHub →</a></p>
              </div>
            </li>
          </ol>
        </div>
      </section>

    </main>
  );
}

