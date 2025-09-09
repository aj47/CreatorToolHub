"use client";
import { PricingTable } from "autumn-js/react";

export default function PricingPage() {
  return (
    <main className="nb-main">
      <section className="nb-section">
        <div className="nb-card" style={{ maxWidth: 900, margin: "0 auto" }}>
          <PricingTable />
        </div>
      </section>
    </main>
  );
}

