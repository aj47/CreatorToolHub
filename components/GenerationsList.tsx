"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { CloudGeneration } from "@/lib/storage/client";
import GenerationDetail from "./GenerationDetail";
import styles from "./GenerationsList.module.css";

// Trigger rebuild to ensure correct environment variables are used
// NODE_ENV=production should read from .env.production

interface GenerationsListProps {
	onRefresh?: () => void;
}

export default function GenerationsList({ onRefresh }: GenerationsListProps) {
	const [generations, setGenerations] = useState<CloudGeneration[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedGeneration, setSelectedGeneration] =
		useState<CloudGeneration | null>(null);
	const [limit] = useState(20);

	const fetchGenerations = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const url = `/api/user/generations?limit=${limit}`;

			const response = await fetch(url, {
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch generations: ${response.statusText}`);
			}

			const data = await response.json();
			setGenerations(data);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load generations",
			);
			setGenerations([]);
		} finally {
			setIsLoading(false);
		}
	}, [limit]);

	useEffect(() => {
		fetchGenerations();
	}, [fetchGenerations]);

	const handleDelete = async (generationId: string) => {
		if (!confirm("Are you sure you want to delete this generation?")) return;

		try {
			const url = `/api/user/generations/${generationId}`;

			const response = await fetch(url, {
				method: "DELETE",
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error("Failed to delete generation");
			}

			setGenerations((prev) => prev.filter((g) => g.id !== generationId));
			setSelectedGeneration(null);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to delete generation",
			);
		}
	};

	const handleRefresh = () => {
		fetchGenerations();
		onRefresh?.();
	};

	if (isLoading) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>Loading generations...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={styles.container}>
				<div className={styles.error}>
					<p>{error}</p>
					<Button onClick={handleRefresh} variant="secondary" size="sm">
						Retry
					</Button>
				</div>
			</div>
		);
	}

	if (generations.length === 0) {
		return (
			<div className={styles.container}>
				<div className={styles.empty}>
					<p>
						No generations yet. Start by creating a thumbnail or SEO
						content!
					</p>
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<Link
							href="/thumbnails"
							className={buttonVariants({ variant: "default", size: "sm" })}
						>
							Create thumbnail
						</Link>
						<Link
							href="/video-seo"
							className={buttonVariants({ variant: "outline", size: "sm" })}
						>
							Generate SEO content
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2 className="text-sm font-semibold tracking-tight text-slate-900">
					Generation history
				</h2>
				<Button onClick={handleRefresh} variant="secondary" size="sm">
					Refresh
				</Button>
			</div>

			<div className={styles.grid}>
				{generations.map((generation) => (
					<div
						key={generation.id}
						className={styles.card}
						onClick={() => setSelectedGeneration(generation)}
					>
						{generation.preview_url && (
							<div className={styles.preview}>
								<img src={generation.preview_url} alt="Generation preview" />
							</div>
						)}
						<div className={styles.content}>
							<div className={styles.meta}>
								<span
									className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[`status-${generation.status}`]}`}
								>
									{generation.status}
								</span>
								<span className="text-xs text-muted-foreground">
									{new Date(generation.created_at).toLocaleDateString()}
								</span>
							</div>
							<p className={styles.prompt}>{generation.prompt}</p>
							<div className={styles.stats}>
								<span>{generation.outputs?.length || 0} outputs</span>
								{generation.template_id && <span>• Template</span>}
							</div>
						</div>
					</div>
				))}
			</div>

			{selectedGeneration && (
				<GenerationDetail
					generation={selectedGeneration}
					onClose={() => setSelectedGeneration(null)}
					onDelete={() => {
						handleDelete(selectedGeneration.id);
					}}
				/>
			)}
		</div>
	);
}
