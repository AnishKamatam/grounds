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
    // Log the incoming request for debugging
    console.log("Received request body:", JSON.stringify(req.body, null, 2));
    
    const { messages }: { messages: UIMessage[] } = req.body;

    if (!messages) {
      console.error("No messages field in request body");
      return res.status(400).json({ error: "Invalid request: messages array required", received: Object.keys(req.body) });
    }

    if (!Array.isArray(messages)) {
      console.error("Messages is not an array:", typeof messages);
      return res.status(400).json({ error: "Invalid request: messages must be an array", received: typeof messages });
    }

    console.log(`Received ${messages.length} messages`);

    // Filter out empty messages - be more lenient with content checking
    // Assistant UI uses "parts" array format
    const validMessages = messages.filter((msg, index) => {
      if (!msg || typeof msg !== "object") {
        console.warn(`Message at index ${index} is invalid:`, msg);
        return false;
      }
      
      const role = (msg as any).role || msg.role;
      const parts = (msg as any).parts;
      const content = (msg as any).content;
      
      // Must have a role
      if (!role) {
        console.warn(`Message at index ${index} has no role:`, msg);
        return false;
      }
      
      // Check for parts array (Assistant UI format)
      if (parts && Array.isArray(parts) && parts.length > 0) {
        // Check if any part has text content
        const hasText = parts.some((part: any) => {
          if (part?.type === "text" && part.text && part.text.trim()) {
            return true;
          }
          if (typeof part === "string" && part.trim()) {
            return true;
          }
          return false;
        });
        if (hasText) {
          return true;
        }
      }
      
      // Check for direct content field
      if (content !== undefined && content !== null) {
        if (typeof content === "string" && content.trim()) {
          return true;
        }
        if (Array.isArray(content) && content.length > 0) {
          return true;
        }
      }
      
      // If no content found, reject the message
      console.warn(`Message at index ${index} has no valid content:`, { role, hasParts: !!parts, hasContent: !!content });
      return false;
    });

    console.log(`Filtered to ${validMessages.length} valid messages`);

    if (validMessages.length === 0) {
      console.error("No valid messages after filtering");
      return res.status(400).json({ 
        error: "No valid messages provided",
        totalMessages: messages.length,
        messageDetails: messages.map((m, i) => ({
          index: i,
          role: (m as any).role,
          hasContent: !!(m as any).content,
          contentType: typeof (m as any).content
        }))
      });
    }

    // Set up response headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    // Convert UI messages to LangChain format
    // Assistant UI sends messages with a "parts" array format
    const langchainMessages = convertToLangChainMessages(
      validMessages.map((msg) => {
        const role = (msg as any).role || msg.role;
        const parts = (msg as any).parts;
        const content = (msg as any).content;
        
        // Handle different content formats
        let contentStr: string;
        
        // Check for parts array first (Assistant UI format)
        if (parts && Array.isArray(parts)) {
          contentStr = parts
            .map((part: any) => {
              if (part?.type === "text" && part.text) {
                return part.text;
              }
              if (typeof part === "string") {
                return part;
              }
              if (part?.text) {
                return part.text;
              }
              return "";
            })
            .filter((s: string) => s) // Remove empty strings
            .join("");
        } else if (content !== undefined && content !== null) {
          // Handle direct content field
          if (typeof content === "string") {
            contentStr = content;
          } else if (Array.isArray(content)) {
            contentStr = content
              .map((c: any) => {
                if (typeof c === "string") return c;
                if (c?.type === "text" && c.text) return c.text;
                if (c?.text) return c.text;
                return JSON.stringify(c);
              })
              .filter((s: string) => s)
              .join("");
          } else {
            contentStr = JSON.stringify(content);
          }
        } else {
          contentStr = ""; // Allow empty content for system messages or placeholders
        }
        
        return {
          role: role,
          content: contentStr,
        };
      })
    );

    console.log(`Processing ${langchainMessages.length} messages`);

    // Prepare the chain using LangGraph orchestration
    const chain = prepareStreamingChain(langchainMessages);

    let messageId = `msg_${Date.now()}`;
    let fullResponse = "";

    // Helper function to write SSE data
    // SSE format requires: "data: <json>\n\n" or "0:<json>\n\n"
    const writeSSE = (data: object) => {
      try {
        const json = JSON.stringify(data);
        // Use double newline for proper SSE format
        const sseLine = `0:${json}\n\n`;
        console.log(`Sending SSE: ${sseLine.substring(0, 200)}...`);
        res.write(sseLine);
        // Ensure data is flushed
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
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
      // Get the full response instead of streaming
      console.log("Invoking chain to get full response...");
      const response = await chain.invoke({});
      
      console.log("Response received:", response ? "yes" : "no");
      
      // Extract content from the response
      if (response) {
        if (typeof response === "string") {
          fullResponse = response;
        } else if ((response as any).content !== undefined) {
          const content = (response as any).content;
          if (typeof content === "string") {
            fullResponse = content;
          } else if (Array.isArray(content)) {
            fullResponse = content
              .map((c: any) => {
                if (typeof c === "string") return c;
                if (c?.type === "text" && c.text) return c.text;
                return "";
              })
              .filter((s: string) => s)
              .join("");
          } else {
            fullResponse = String(content);
          }
        } else if ((response as any).text !== undefined) {
          fullResponse = String((response as any).text);
        } else {
          fullResponse = JSON.stringify(response);
        }
      }
      
      console.log(`Full response length: ${fullResponse.length}`);
      
      if (!fullResponse) {
        console.warn("Empty response received");
        fullResponse = "I apologize, but I didn't receive a response from the model.";
      }
      
      // Send the complete message as a single text delta
      // Assistant UI expects the delta to be the text content
      console.log(`Sending text-delta with ${fullResponse.length} characters`);
      console.log(`First 100 chars: ${fullResponse.substring(0, 100)}`);
      
      // Send the text delta - this is what Assistant UI reads
      writeSSE({
        type: "text-delta",
        delta: fullResponse,
      });
      
      console.log("Text delta sent successfully");
      
    } catch (invokeError) {
      console.error("Error invoking chain:", invokeError);
      const errorStack = invokeError instanceof Error ? invokeError.stack : String(invokeError);
      console.error("Invoke error stack:", errorStack);
      throw invokeError;
    }

    // Send message completion
    console.log("Sending message-delta");
    writeSSE({
      type: "message-delta",
      delta: {
        content: "",
      },
    });

    // Send final message
    console.log("Sending final message");
    writeSSE({
      type: "message",
      message: {
        id: messageId,
        role: "assistant",
        content: fullResponse,
      },
    });

    // Send stop event
    console.log("Sending message-stop");
    writeSSE({
      type: "message-stop",
    });

    console.log("Closing response");
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

