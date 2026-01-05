"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export function AuthHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b px-4">
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </header>
  );
}

