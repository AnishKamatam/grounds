"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";

export const Assistant = () => {
  // Next.js replaces this at build time - if undefined, use fallback
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const fallbackUrl = "http://localhost:3001";
  const finalApiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : fallbackUrl;
  
  // Ensure we have a full URL (not relative)
  const fullApiUrl = finalApiUrl.startsWith('http') 
    ? `${finalApiUrl}/api/chat` 
    : `${fallbackUrl}/api/chat`;
  
  // Debug log - check browser console to see what URL is being used
  if (typeof window !== 'undefined') {
    console.log('API URL being used:', fullApiUrl);
    console.log('NEXT_PUBLIC_API_URL env var:', apiUrl || 'NOT SET');
  }
  
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: fullApiUrl,
    }),
  });

  return (
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
  );
};
