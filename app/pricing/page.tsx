import { PricingTableClient } from "@/components/PricingTableClient";

const pricingFaqItems: { question: string; answer: string }[] = [
  {
    question: "How do Creator Tool Hub credits work?",
    answer:
      "Credits power every AI workflow across thumbnails, titles, descriptions, and timestamps. Each plan includes a monthly allowance, and you can top up with add-on packs whenever you need more output.",
  },
  {
    question: "What does each plan include?",
    answer:
      "All plans unlock the Creator Tool Hub workspace, including the thumbnail generator, video SEO assistant, and upcoming production tools. Higher tiers add more monthly credits and additional seats for collaborators.",
  },
  {
    question: "Can I change plans or cancel anytime?",
    answer:
      "Yes. Upgrade, downgrade, or cancel directly from the pricing table. Billing updates take effect immediately and remaining credits follow you to the new plan.",
  },
  {
    question: "Do you support custom or enterprise agreements?",
    answer:
      "Teams with higher volumes can contact us for tailored credit bundles, invoicing, and dedicated support. Reach out through the pricing table to start the conversation.",
  },
];

const faqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: pricingFaqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

export default function PricingPage() {
  return (
    <main className="nb-main">

      <section className="nb-section">
        <div className="nb-card" style={{ maxWidth: 980, margin: "0 auto" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 16, textAlign: "center" }}>
            Choose the plan that matches your upload schedule
          </h2>
          <PricingTableClient />
        </div>
      </section>

      <section className="nb-section">
        <div className="nb-card" style={{ maxWidth: 980, margin: "0 auto" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 12, textAlign: "center" }}>Pricing FAQ</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {pricingFaqItems.map((item) => (
              <details
                key={item.question}
                style={{
                  border: "2px solid var(--nb-border)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  background: "var(--nb-card)",
                  boxShadow: "4px 4px 0 var(--nb-border)",
                }}
              >
                <summary style={{ fontWeight: 700, fontSize: 16, cursor: "pointer" }}>{item.question}</summary>
                <p style={{ marginTop: 8, lineHeight: 1.5 }}>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
    </main>
  );
}

