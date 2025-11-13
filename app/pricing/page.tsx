import { PricingTableClient } from "@/components/PricingTableClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
	    <main className="mx-auto max-w-6xl px-4 py-10">
	      <section className="space-y-6">
	        <div className="text-center">
	          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
	            Choose the plan that matches your upload schedule
	          </h1>
	          <p className="mt-2 text-sm text-slate-600 md:text-base">
	            Pick the right credit bundle for how often you publish, and scale up as your channel grows.
	          </p>
	        </div>

	        <Card className="border-slate-200 bg-white">
	          <CardContent className="pt-6">
	            <PricingTableClient />
	          </CardContent>
	        </Card>
	      </section>

	      <section className="mt-12 space-y-4">
	        <div className="text-center">
	          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Pricing FAQ</h2>
	          <p className="mt-1 text-sm text-slate-600">
	            Answers to common questions about how billing and credits work.
	          </p>
	        </div>

	        <Card className="border-slate-200 bg-white">
	          <CardHeader className="pb-3">
	            <CardTitle className="text-base">Frequently asked questions</CardTitle>
	            <CardDescription>
	              If you&apos;re unsure which plan is right for you, these quick answers can help.
	            </CardDescription>
	          </CardHeader>
	          <CardContent className="pt-0">
	            <div className="space-y-3">
	              {pricingFaqItems.map((item) => (
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
	                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
	                </details>
	              ))}
	            </div>
	          </CardContent>
	        </Card>
	      </section>

	      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
	    </main>
	  );
	}
