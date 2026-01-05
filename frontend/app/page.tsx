"use client";

import { Assistant } from "./assistant";
import { LandingPage } from "@/components/landing-page";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

export default function Home() {
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Assistant />
      </SignedIn>
    </>
  );
}
