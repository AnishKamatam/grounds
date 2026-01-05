import express from "express";
import cors from "cors";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(express.json());

// Handle OPTIONS preflight requests
app.options("/api/chat", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(204).end();
});

app.post("/api/chat", async (req, res) => {
  try {
    console.log("Received chat request");
    const { messages }: { messages: UIMessage[] } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: messages array required" });
    }

    console.log("Processing messages:", messages.length);

    const result = streamText({
      model: openai.responses("gpt-5-nano"),
      messages: convertToModelMessages(messages),
      providerOptions: {
        openai: {
          reasoningEffort: "low",
          // reasoningSummary: "auto", // Requires organization verification
        },
      },
    });

    const response = result.toUIMessageStreamResponse({
      sendReasoning: true,
    });

    // Set status code
    res.status(response.status);

    // Copy headers from the response first (this sets Content-Type correctly)
    response.headers.forEach((value, key) => {
      // Don't override CORS headers
      if (key.toLowerCase() !== 'access-control-allow-origin') {
        res.setHeader(key, value);
      }
    });

    // Set CORS headers (after copying response headers to ensure they're not overridden)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream the response
    if (response.body) {
      console.log("Starting to stream response");
      const reader = response.body.getReader();
      let chunkCount = 0;
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`Streaming complete. Sent ${chunkCount} chunks`);
              res.end();
              break;
            }
            chunkCount++;
            if (chunkCount <= 3) {
              console.log(`Sending chunk ${chunkCount}, size: ${value.length} bytes`);
            }
            res.write(value);
          }
        } catch (error) {
          console.error("Streaming error:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: "Streaming error" });
          } else {
            res.end();
          }
        }
      };
      await pump();
    } else {
      console.error("Response body is null");
      res.status(500).json({ error: "No response body" });
    }
  } catch (error) {
    console.error("Error processing chat request:", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.get("/test", (req, res) => {
  res.json({ 
    message: "Backend is working",
    apiUrl: process.env.OPENAI_API_KEY ? "OpenAI key is set" : "OpenAI key is NOT set"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

