"use client";

import { ClerkProvider } from "@clerk/clerk-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    console.warn("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
    >
      {children}
    </ClerkProvider>
  );
}

