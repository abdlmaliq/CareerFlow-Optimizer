import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Root level middleware
  app.use(cors());
  // Increase limit to 10MB to handle large resumes and JDs
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Rate limiting: 35 requests per 24 hours per IP (approx 5 full optimizations)
  const limiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 35,
    message: { error: "Daily limit reached. You can only perform 5 optimizations every 24 hours." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Gemini Setup
  const getApiKey = () => {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key || key === 'undefined' || key === 'null') {
      throw new Error('GEMINI_API_KEY is missing in server environment. Please configure it in your Netlify/Github/Cloud variables.');
    }
    return key;
  };

  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({ apiKey: getApiKey() });
  } catch (err) {
    console.error("Gemini Initialization Failed:", err);
  }

  // API Routes
  app.post("/api/optimize", limiter, async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!ai) {
      return res.status(500).json({ error: "AI Engine not initialized. Check API Key." });
    }

    try {
      // Use gemini-flash-latest as per skill guidance
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
      });

      if (!response.text) {
        throw new Error("The AI returned an empty response candidate.");
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      // Clean up error message for the client
      let cleanMessage = error.message || "Failed to generate content";
      if (cleanMessage.includes("API key")) {
        cleanMessage = "Invalid API Key in server configuration.";
      }
      res.status(500).json({ error: cleanMessage });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
