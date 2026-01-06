"use client";

import { ClerkProvider } from "@clerk/clerk-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder";
  
  const getBasePath = () => {
    if (typeof window === 'undefined') return '';
    return window.location.pathname.startsWith('/grounds') ? '/grounds' : '';
  };
  
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl={`${getBasePath()}/`}
    >
      {children}
    </ClerkProvider>
  );
}

