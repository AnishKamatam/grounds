import express, { type Request, type Response } from "express";
import cors from "cors";
import type { UIMessage } from "ai";
import { createChatGraph, convertToLangChainMessages, prepareStreamingChain } from "./graph.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(express.json());

app.options("/api/chat", (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(204).end();
});

app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { messages }: { messages: UIMessage[] } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: messages array required" });
    }

    // Filter out empty messages
    const validMessages = messages.filter((msg) => {
      const content = (msg as any).content;
      return content && (typeof content === "string" ? content.trim() : true);
    });

    if (validMessages.length === 0) {
      return res.status(400).json({ error: "No valid messages provided" });
    }

    // Set up streaming headers (matching AI SDK format)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    // Convert UI messages to LangChain format
    const langchainMessages = convertToLangChainMessages(
      validMessages.map((msg) => {
        const content = (msg as any).content;
        return {
          role: msg.role,
          content: typeof content === "string" ? content : JSON.stringify(content),
        };
      })
    );

    console.log(`Processing ${langchainMessages.length} messages`);

    // Prepare the streaming chain using LangGraph orchestration
    const chain = prepareStreamingChain(langchainMessages);

    let fullResponse = "";
    let messageId = `msg_${Date.now()}`;

    // Helper function to write SSE data
    const writeSSE = (data: object) => {
      try {
        const json = JSON.stringify(data);
        res.write(`0:${json}\n`);
      } catch (err) {
        console.error("Error writing SSE:", err);
      }
    };

    // Send initial message start
    writeSSE({
      type: "message-start",
      message: {
        id: messageId,
        role: "assistant",
        content: "",
      },
    });

    try {
      // Stream directly from the model
      const stream = await chain.stream({});
      
      // Process stream chunks
      // LangChain streams AIMessageChunk objects
      for await (const chunk of stream) {
        if (chunk) {
          // Handle both AIMessageChunk and plain objects
          const content = typeof chunk === "string" 
            ? chunk 
            : (chunk as any).content || (chunk as any).text || "";
          
          if (content) {
            const contentStr = String(content);
            fullResponse += contentStr;
            
            // Send text delta
            writeSSE({
              type: "text-delta",
              delta: contentStr,
            });
          }
        }
      }
    } catch (streamError) {
      console.error("Streaming error:", streamError);
      throw streamError;
    }

    // Send message completion
    writeSSE({
      type: "message-delta",
      delta: {
        content: "",
      },
    });

    // Send final message
    writeSSE({
      type: "message",
      message: {
        id: messageId,
        role: "assistant",
        content: fullResponse,
      },
    });

    // Send stop event
    writeSSE({
      type: "message-stop",
    });

    res.end();
  } catch (error) {
    console.error("Error processing chat request:", error);
    const errorStack = error instanceof Error ? error.stack : String(error);
    console.error("Error stack:", errorStack);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      });
    } else {
      const errorMsg = error instanceof Error ? error.message : String(error);
      try {
        res.write(`0:${JSON.stringify({ type: "error", error: errorMsg })}\n`);
        res.end();
      } catch (writeError) {
        console.error("Error writing error response:", writeError);
        res.end();
      }
    }
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    usingLangGraph: true,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify LangGraph setup
app.post("/api/test", async (req: Request, res: Response) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set" });
    }

    const graph = createChatGraph();
    const testMessages = [new (await import("@langchain/core/messages")).HumanMessage("Say hello")];
    
    const result = await graph.invoke({ messages: testMessages });
    
    res.json({ 
      success: true,
      response: result.messages[0]?.content || "No response",
      messageCount: result.messages.length
    });
  } catch (error) {
    console.error("Test error:", error);
    res.status(500).json({ 
      error: "Test failed",
      message: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

