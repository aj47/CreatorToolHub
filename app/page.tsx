import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const homepageUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://creatortoolhub.com";
const homepageDescription =
	"Creator Tool Hub is the AI workspace for YouTube creators to generate thumbnails, titles, descriptions, and timestamps that rank.";
const homepageOgImage = `${homepageUrl}/favicon.png`;

export const metadata: Metadata = {
	title: "YouTube Thumbnail, Title & Timestamp Generator",
	description: homepageDescription,
	keywords: [
		"YouTube thumbnail generator",
		"YouTube title generator",
		"YouTube timestamp generator",
		"YouTube description generator",
		"AI YouTube tools",
		"YouTube SEO optimization",
	],
	alternates: {
		canonical: homepageUrl,
	},
	openGraph: {
		type: "website",
		url: homepageUrl,
		title: "YouTube Thumbnail, Title & Timestamp Generator",
		description: homepageDescription,
		siteName: "Creator Tool Hub",
		images: [
			{
				url: homepageOgImage,
				width: 512,
				height: 512,
				alt: "Creator Tool Hub AI tools preview",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "YouTube Thumbnail, Title & Timestamp Generator",
		description: homepageDescription,
		images: [homepageOgImage],
	},
};

export default function Home() {
	return (
		<main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10">
			{/* Hero */}
			<section className="grid items-center gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
				<div className="space-y-6">
					<p className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
						AI workspace for YouTube creators
					</p>
					<div className="space-y-3">
						<h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
							Generate YouTube thumbnails, titles & timestamps in minutes
						</h1>
						<p className="text-sm leading-relaxed text-slate-600">
							Creator Tool Hub helps YouTube creators ship eye-catching thumbnails, keyword-rich titles, and
							automatic timestamps that make every upload easier to discover.
						</p>
					</div>
					<ul className="space-y-2 text-sm text-slate-700">
						<li>AI-powered YouTube thumbnail generator tuned for higher CTR.</li>
						<li>YouTube title & description generator with keyword suggestions.</li>
						<li>Automatic YouTube timestamp generator built from your transcript.</li>
					</ul>
					<div className="flex flex-wrap items-center gap-3">
						<a
							href="/thumbnails"
							className={buttonVariants({ size: "lg" })}
						>
							Launch Thumbnail Generator
						</a>
						<a
							href="/video-seo"
							className={buttonVariants({ variant: "outline", size: "lg" })}
						>
							Generate titles & timestamps
						</a>
					</div>
					<div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
						<span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
							Workflow
						</span>
						<span>1. Input → 2. Configure → 3. Generate</span>
					</div>
				</div>
				<Card className="overflow-hidden border-slate-200 bg-slate-950 text-slate-50">
					<div className="aspect-video w-full overflow-hidden bg-slate-900">
						<iframe
							className="h-full w-full border-0"
							src="https://www.youtube.com/embed/0flgKnOcLWQ"
							title="Creator Tool Hub demo"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					</div>
					<CardContent className="flex items-center justify-between gap-4 pt-4">
						<div>
							<div className="text-xs font-semibold uppercase tracking-wide text-slate-200">See it in action</div>
							<p className="mt-1 text-xs text-slate-400">
								Walkthrough of thumbnails, titles & timestamps workflow inside Creator Tool Hub.
							</p>
						</div>
					</CardContent>
				</Card>
			</section>

			{/* Tool cards */}
			<section aria-label="Creator workflow tools" className="space-y-4">
				<div className="space-y-2">
					<h2 className="text-lg font-semibold tracking-tight text-slate-900">Creator workflow tools</h2>
					<p className="text-sm text-slate-600">
						Three focused tools designed to cover the full YouTube upload workflow.
					</p>
				</div>
				<div className="grid gap-4 md:grid-cols-3">
					<Card className="flex flex-col border-slate-200">
						<CardHeader className="pb-4">
							<CardTitle className="text-base">YouTube Thumbnail Generator</CardTitle>
							<CardDescription>
								Produce scroll-stopping thumbnail designs in just a few clicks.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0 text-sm text-slate-600">
							<ul className="space-y-2">
								<li>Capture frames from your upload or import existing artwork.</li>
								<li>Apply high-performing layouts, fonts, and styles tailored to YouTube.</li>
								<li>Export 1280×720-ready images that stay within YouTube&apos;s guidelines.</li>
							</ul>
							<a
								href="/thumbnails"
								className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-700"
							>
								<span>Create AI thumbnails</span>
								<span aria-hidden="true" className="ml-1">
									→
								</span>
							</a>
						</CardContent>
					</Card>

					<Card className="flex flex-col border-slate-200">
						<CardHeader className="pb-4">
							<CardTitle className="text-base">YouTube Title &amp; Description Generator</CardTitle>
							<CardDescription>
								Turn transcripts into keyword-rich titles, descriptions, and hashtags.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0 text-sm text-slate-600">
							<ul className="space-y-2">
								<li>Generate multiple SEO-optimized YouTube titles under 60 characters.</li>
								<li>Write descriptions that weave in your target queries naturally.</li>
								<li>Copy titles, descriptions, and hashtags with a single click.</li>
							</ul>
							<a
								href="/video-seo"
								className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-700"
							>
								<span>Write titles &amp; descriptions</span>
								<span aria-hidden="true" className="ml-1">
									→
								</span>
							</a>
						</CardContent>
					</Card>

					<Card className="flex flex-col border-slate-200">
						<CardHeader className="pb-4">
							<CardTitle className="text-base">YouTube Timestamp Generator</CardTitle>
							<CardDescription>
								Automatically create accurate chapter markers that boost watch time.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0 text-sm text-slate-600">
							<ul className="space-y-2">
								<li>Paste any public YouTube link and we fetch the transcript instantly.</li>
								<li>Convert offsets into MM:SS chapter labels that summarize each segment.</li>
								<li>Publish timestamps directly inside your YouTube description.</li>
							</ul>
							<a
								href="/video-seo#results"
								className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-700"
							>
								<span>Generate timestamps</span>
								<span aria-hidden="true" className="ml-1">
									→
								</span>
							</a>
						</CardContent>
					</Card>
				</div>
			</section>

			{/* Roadmap */}
			<section id="roadmap" aria-labelledby="roadmap-title">
				<Card className="border-slate-200">
					<CardHeader className="space-y-2">
						<CardTitle id="roadmap-title" className="text-base md:text-lg">
							Ship faster today &amp; see what&apos;s next
						</CardTitle>
						<CardDescription>
							We ship updates weekly so you stay ahead of YouTube&apos;s algorithm.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-4">
						<ol className="space-y-4">
							<li className="flex gap-3">
								<div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
								<div className="space-y-1">
									<div className="text-sm font-medium text-slate-900">
										AI thumbnail generator
										<span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
											Done
										</span>
									</div>
									<p className="text-sm text-slate-600">
										Upload frames or images, iterate on styles, and export ready-to-upload thumbnails.
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
								<div className="space-y-1">
									<div className="text-sm font-medium text-slate-900">
										Video SEO suite
										<span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
											Done
										</span>
									</div>
									<p className="text-sm text-slate-600">
										Generate YouTube titles, descriptions, hashtags, and timestamps from any transcript.
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
								<div className="space-y-1">
									<div className="text-sm font-medium text-slate-900">
										Thumbnail refinements
										<span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
											Done
										</span>
									</div>
									<p className="text-sm text-slate-600">
										Iterate with feedback prompts to dial in text, subjects, and styling without starting over.
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<div className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
								<div className="space-y-1">
									<div className="text-sm font-medium text-slate-900">
										Bulk channel optimizations
										<span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
											Coming soon
										</span>
									</div>
									<p className="text-sm text-slate-600">
										Batch-generate metadata, timestamps, and thumbnails across multiple uploads at once.
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<div className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
								<div className="space-y-1">
									<div className="text-sm font-medium text-slate-900">
										Suggest a feature
										<span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
											Your ideas
										</span>
									</div>
									<p className="text-sm text-slate-600">
										Tell us what would help you most.{' '}
										<a
											href="https://github.com/aj47/CreatorToolHub/issues"
											target="_blank"
											rel="noopener noreferrer"
											className="font-medium text-red-600 hover:text-red-700"
										>
											Submit on GitHub →
										</a>
									</p>
								</div>
							</li>
						</ol>
					</CardContent>
				</Card>
			</section>

			{/* FAQ */}
			<section id="faq" aria-labelledby="faq-title">
				<Card className="border-slate-200">
					<CardHeader className="pb-4">
						<CardTitle id="faq-title" className="text-base md:text-lg">
							FAQ: Creator Tool Hub for YouTube SEO
						</CardTitle>
						<CardDescription>
							Answers to common questions about how the tools work together.
						</CardDescription>
					</CardHeader>
					<CardContent className="divide-y divide-slate-100 p-0">
						<details className="group px-6 py-4">
							<summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-slate-900">
								<span>How does the YouTube timestamp generator work?</span>
								<span className="ml-4 text-xs text-slate-500 group-open:hidden">Show</span>
								<span className="ml-4 hidden text-xs text-slate-500 group-open:inline">Hide</span>
							</summary>
							<p className="mt-2 text-sm text-slate-600">
								We fetch the public transcript for your video, map each line to its offset, and return polished
								MM:SS chapter markers you can paste into your description.
							</p>
						</details>
						<details className="group px-6 py-4">
							<summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-slate-900">
								<span>Can I customize the AI thumbnail generator?</span>
								<span className="ml-4 text-xs text-slate-500 group-open:hidden">Show</span>
								<span className="ml-4 hidden text-xs text-slate-500 group-open:inline">Hide</span>
							</summary>
							<p className="mt-2 text-sm text-slate-600">
								Yes. Upload your own frames, reference images, color palettes, and prompts to fine-tune every
								thumbnail variation.
							</p>
						</details>
						<details className="group px-6 py-4">
							<summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-slate-900">
								<span>Do the generated titles follow YouTube best practices?</span>
								<span className="ml-4 text-xs text-slate-500 group-open:hidden">Show</span>
								<span className="ml-4 hidden text-xs text-slate-500 group-open:inline">Hide</span>
							</summary>
							<p className="mt-2 text-sm text-slate-600">
								Absolutely. We keep titles under 60 characters, include high-intent keywords, and surface multiple
								options so you can A/B test.
							</p>
						</details>
						<details className="group px-6 py-4">
							<summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-slate-900">
								<span>What does it cost to use the YouTube SEO tools?</span>
								<span className="ml-4 text-xs text-slate-500 group-open:hidden">Show</span>
								<span className="ml-4 hidden text-xs text-slate-500 group-open:inline">Hide</span>
							</summary>
							<p className="mt-2 text-sm text-slate-600">
								You can explore the workspace for free, then add affordable credits only when you need new
								thumbnail or metadata generations.
							</p>
						</details>
					</CardContent>
				</Card>
			</section>

			{/* Final CTA */}
			<section aria-labelledby="cta-title">
				<Card className="border-slate-200">
					<CardHeader className="space-y-3 text-center">
						<CardTitle id="cta-title" className="text-xl">
							Ready to rank for more YouTube searches?
						</CardTitle>
						<CardDescription className="mx-auto max-w-2xl text-sm text-slate-600">
							Sign in to Creator Tool Hub and turn your transcript into thumbnails, titles, descriptions, and
							timestamps that convert.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center justify-center gap-3 pt-0">
						<a
							href="/video-seo"
							className={buttonVariants({ size: "lg" })}
						>
							Start generating titles &amp; timestamps
						</a>
						<a
							href="/thumbnails"
							className={buttonVariants({ variant: "outline", size: "lg" })}
						>
							Design thumbnails now
						</a>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
