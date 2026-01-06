"use client";

import { Brain } from "lucide-react";
import Link from "next/link";
import { AuthHeader } from "@/components/auth-header";
import DotGrid from "@/components/dot-grid";

export function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-gray-100 overflow-hidden">
      <DotGrid
        dotSize={2}
        gap={24}
        baseColor="#9CA3AF"
        activeColor="#6B21A8"
        proximity={100}
        className="absolute inset-0"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between bg-transparent px-20">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="size-6 text-black" />
            <span className="text-xl font-semibold">Grounds</span>
          </Link>
          <AuthHeader />
        </header>

        <main className="flex flex-1 items-start justify-center gap-8 px-6 pt-40">
          <div className="max-w-2xl">
            <h1 className="mb-4 text-left text-5xl font-normal tracking-tight sm:text-7xl font-[var(--font-inter)]">
              AI agents for deep understanding
            </h1>
            <p className="text-left text-lg text-muted-foreground sm:text-xl font-[var(--font-inter)]">
              A research-grade platform for building agents that reason over documents, concepts, and sources.
            </p>
          </div>
          <div className="h-96 w-full max-w-2xl rounded-lg bg-gray-300"></div>
        </main>
      </div>
    </div>
  );
}

