"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { AssistantCloud } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { SignedIn, useAuth } from "@clerk/clerk-react";
import { useMemo } from "react";

export const Assistant = () => {
  const { getToken } = useAuth();
  
  // Next.js replaces this at build time - if undefined, use fallback
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const fallbackUrl = "http://localhost:3001";
  const finalApiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : fallbackUrl;
  
  // Ensure we have a full URL (not relative)
  const fullApiUrl = finalApiUrl.startsWith('http') 
    ? `${finalApiUrl}/api/chat` 
    : `${fallbackUrl}/api/chat`;
  
  // Assistant Cloud configuration - use Clerk JWT token directly
  const assistantCloud = useMemo(() => {
    return new AssistantCloud({
      baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL || "https://proj-0lsbf7oe3rkx.assistant-api.com",
      authToken: async () => {
        try {
          // Get JWT token from Clerk with the assistant-ui audience
          const token = await getToken({ template: "assistant-ui" });
          if (!token) {
            console.error("Failed to get Clerk token - user might not be authenticated");
            throw new Error("Failed to get authentication token");
          }
          
          // Debug: Log token info (first 20 chars only for security)
          console.log("Clerk token received:", token.substring(0, 20) + "...");
          
          // Decode JWT to check audience (for debugging)
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log("Token payload:", {
              aud: payload.aud,
              iss: payload.iss,
              exp: payload.exp,
              sub: payload.sub,
            });
          } catch (e) {
            console.warn("Could not decode token:", e);
          }
          
          return token;
        } catch (error) {
          console.error("Error getting Clerk token:", error);
          throw error;
        }
      },
    });
  }, [getToken]);
  
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: fullApiUrl,
    }),
    cloud: assistantCloud,
  });

  return (
    <SignedIn>
      <AssistantRuntimeProvider runtime={runtime}>
        <SidebarProvider>
          <div className="flex h-dvh w-full pr-0.5">
            <ThreadListSidebar />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger />
              </header>
              <div className="flex-1 overflow-hidden">
                <Thread />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </AssistantRuntimeProvider>
    </SignedIn>
  );
};
