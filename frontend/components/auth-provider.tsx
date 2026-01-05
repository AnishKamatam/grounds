"use client";

import { ClerkProvider } from "@clerk/clerk-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // Always wrap with ClerkProvider to avoid errors during prerendering
  // Use a placeholder key if not set (will fail at runtime but allows build to succeed)
  const key = publishableKey || "pk_test_placeholder";
  
  return (
    <ClerkProvider
      publishableKey={key}
    >
      {children}
    </ClerkProvider>
  );
}

