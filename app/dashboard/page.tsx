"use client";

import { useMemo, useState } from "react";
import { useCustomer } from "autumn-js/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import GenerationsList from "@/components/GenerationsList";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

type DashboardTab = "generations" | "account";

function DashboardContent() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const [activeTab, setActiveTab] = useState<DashboardTab>("generations");

  // Always call hooks unconditionally, even in development
  const { customer, isLoading, error, openBillingPortal, refetch } = useCustomer({
    errorOnNotFound: !isDevelopment,
    expand: ["invoices", "entities"],
  });

  const credits = useMemo(() => {
    if (isDevelopment) return 999;

    const c = customer as any;
    if (!c) {
      return 0;
    }

    // Handle flat/minimal balance structure first
    if (typeof c.balance === "number" && !c.features) {
      return c.balance;
    }

    // Handle nested features structure (expected by autumn-js)
    if (c.features) {
      const f = c.features[FEATURE_ID];
      if (typeof f?.balance === "number") {
        return f.balance;
      }
      if (typeof f?.included_usage === "number" && typeof f?.usage === "number") {
        const calculated = Math.max(0, (f.included_usage ?? 0) - (f.usage ?? 0));
        return calculated;
      }
    }

    return 0;
  }, [customer, isDevelopment]);

  const tabButtonClasses = (tab: DashboardTab) =>
    `inline-flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium ${
      activeTab === tab
        ? "border-red-600 text-slate-900"
        : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900"
    }`;

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Dashboard{isDevelopment ? " (Development)" : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isDevelopment
            ? "Billing is disabled in development. Credits are mocked so you can test the UI."
            : "Review your thumbnail generations and manage billing, products, and credits."}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        <span className="uppercase tracking-wide">Credits</span>
        <span className="font-semibold text-slate-900">{credits}</span>
      </span>
    </div>
  );

  const tabs = (
    <div className="mt-4 flex gap-2 border-b border-slate-200">
      <button
        type="button"
        onClick={() => setActiveTab("generations")}
        className={tabButtonClasses("generations")}
      >
        Generations
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("account")}
        className={tabButtonClasses("account")}
      >
        Account
      </button>
    </div>
  );

  const generationsCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent generations</CardTitle>
        <CardDescription>
          {isDevelopment
            ? "Review thumbnail generations created in development."
            : "View and re-download your recent thumbnail generations."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {isDevelopment ? (
          <GenerationsList />
        ) : (
          <GenerationsList onRefresh={() => refetch()} />
        )}
      </CardContent>
    </Card>
  );

  const accountCard = isDevelopment ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your account (mocked)</CardTitle>
        <CardDescription>
          Credits and billing are mocked locally so you can experiment without charges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p>Credits: {credits} (mock)</p>
        <p>Autumn billing is disabled in development mode.</p>
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your account</CardTitle>
        <CardDescription>
          Check your current credits, manage billing, and inspect active products.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <p className="text-sm text-slate-500">Loading...</p>}
        {error && (
          <p className="text-sm text-red-600">
            {error.message}
          </p>
        )}
        {customer && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Signed in as
                </div>
                <div className="text-sm text-slate-900">
                  {customer.name || customer.email || customer.id}
                </div>
              </div>

              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Thumbnail credits</CardTitle>
                  <CardDescription>
                    Credits are consumed when you generate new thumbnails.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-slate-900">{credits}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      credits remaining
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="/pricing"
                      className={buttonVariants({ size: "sm" })}
                    >
                      Upgrade / Buy credits
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const res = await openBillingPortal({});
                        if (res?.data?.url) window.location.href = res.data.url;
                      }}
                    >
                      Billing portal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => refetch()}
                    >
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await fetch("/api/auth/signout", { method: "POST" });
                        } finally {
                          window.location.replace("/");
                        }
                      }}
                      title="Sign out"
                    >
                      Sign out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Products</CardTitle>
                <CardDescription>Your active subscriptions and products.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {customer.products?.length ? (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {customer.products.map((p: any) => (
                      <li key={p.id} className="flex items-center justify-between py-2">
                        <span>{p.name || p.id}</span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {p.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No active products.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="space-y-6">
        {header}
        {tabs}
        <div className="pt-4 space-y-4">
          {activeTab === "generations" ? generationsCard : accountCard}
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
