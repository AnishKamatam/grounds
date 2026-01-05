"use client";

import { ClerkProvider } from "@clerk/clerk-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // Always wrap with ClerkProvider to avoid errors during prerendering
  // Use a placeholder key if not set (will fail at runtime but allows build to succeed)
  const key = publishableKey || "pk_test_placeholder";
  
  // Get base path for production (GitHub Pages)
  // Check at runtime since static export doesn't have NODE_ENV at build time
  const getBasePath = () => {
    if (typeof window === 'undefined') return '';
    return window.location.pathname.startsWith('/grounds') ? '/grounds' : '';
  };
  
  const basePath = getBasePath();
  const afterSignOutUrl = `${basePath}/`;
  
  return (
    <ClerkProvider
      publishableKey={key}
      afterSignOutUrl={afterSignOutUrl}
    >
      {children}
    </ClerkProvider>
  );
}

