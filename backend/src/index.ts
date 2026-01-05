import express from "express";
import cors from "cors";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  try {
    const { messages }: { messages: UIMessage[] } = req.body;

    const result = streamText({
      model: openai.responses("gpt-5-nano"),
      messages: convertToModelMessages(messages),
      providerOptions: {
        openai: {
          reasoningEffort: "low",
          reasoningSummary: "auto",
        },
      },
    });

    const response = result.toUIMessageStreamResponse({
      sendReasoning: true,
    });

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Copy headers from the response
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Stream the response
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
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
      res.end();
    }
  } catch (error) {
    console.error("Error processing chat request:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

