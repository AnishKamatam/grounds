import express, { type Request, type Response } from "express";
import cors from "cors";
import type { UIMessage } from "ai";
import { createChatGraph, convertToLangChainMessages } from "./graph.js";

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
    // UIMessage has a structure like { role: string, content: string | Array<...> }
    const langchainMessages = convertToLangChainMessages(
      messages.map((msg) => {
        const content = (msg as any).content;
        return {
          role: msg.role,
          content: typeof content === "string" ? content : JSON.stringify(content),
        };
      })
    );

    // Create the graph
    const graph = createChatGraph();

    // Stream events from LangGraph
    const stream = await graph.streamEvents(
      { messages: langchainMessages },
      { version: "v2" }
    );

    let fullResponse = "";
    let messageId = `msg_${Date.now()}`;

    // Helper function to write SSE data
    const writeSSE = (data: object) => {
      const json = JSON.stringify(data);
      res.write(`0:${json}\n`);
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

    // Process stream events
    for await (const event of stream) {
      // Look for LLM token stream events
      if (event.event === "on_chat_model_stream") {
        const chunk = event.data?.chunk;
        if (chunk?.content) {
          const content = String(chunk.content);
          fullResponse += content;
          
          // Send text delta - properly escape the content
          writeSSE({
            type: "text-delta",
            delta: content,
          });
        }
      }
      
      // Handle model end event
      if (event.event === "on_chat_model_end") {
        // The stream will naturally end
      }
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
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error)
      });
    } else {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.write(`0:${JSON.stringify({ type: "error", error: errorMsg })}\n`);
      res.end();
    }
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    usingLangGraph: true,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

