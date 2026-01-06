"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AssistantCloud } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { useAuth, UserButton } from "@clerk/clerk-react";
import { useMemo } from "react";

export const Assistant = () => {
  const { getToken, isLoaded } = useAuth();
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const fallbackUrl = "http://localhost:3001";
  const finalApiUrl = apiUrl?.trim() || fallbackUrl;
  const fullApiUrl = finalApiUrl.startsWith('http') 
    ? `${finalApiUrl}/api/chat` 
    : `${fallbackUrl}/api/chat`;
  
  const assistantCloud = useMemo(() => {
    if (!isLoaded || !getToken) return null;
    
    return new AssistantCloud({
      baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL || "https://proj-0lsbf7oe3rkx.assistant-api.com",
      authToken: async () => {
        const token = await getToken({ template: "assistant-ui" });
        if (!token) throw new Error("Failed to get authentication token");
        return token;
      },
    });
  }, [getToken, isLoaded]);
  
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: fullApiUrl }),
    cloud: assistantCloud || undefined,
  });
  
  if (!isLoaded || !assistantCloud) {
    return <div>Loading...</div>;
  }

  const getSignOutUrl = () => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname.startsWith('/grounds') ? '/grounds/' : '/';
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
              <SidebarTrigger />
              <UserButton afterSignOutUrl={getSignOutUrl()} />
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
