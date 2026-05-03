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
  app.use(express.json());

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
      throw new Error('GEMINI_API_KEY is missing in server environment.');
    }
    return key;
  };

  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  // API Routes
  app.post("/api/optimize", limiter, async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (!response.text) {
        throw new Error("The AI returned an empty response.");
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
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
