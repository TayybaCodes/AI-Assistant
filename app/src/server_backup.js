import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
dotenv.config({
  path: path.join(__dirname, ".env"),
});

const app = express();
const PORT = 5000;

app.use(cors());

// Images ke Base64 data ke liye 10MB limit
app.use(express.json({ limit: "10mb" }));

// Get API Key
const apiKey = (
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  ""
)
  .trim()
  .replace(/^["']|["']$/g, "");

if (!apiKey) {
  console.error("❌ Missing GEMINI_API_KEY in app/.env");
  process.exit(1);
}


// ===============================
// AI CHAT
// ===============================

app.post("/api/chat", async (req, res) => {
  try {
    const { message, image, mimeType } = req.body;

    // Text aur image dono mein se kam az kam ek hona chahiye
    if (!message?.trim() && !image) {
      return res.status(400).json({
        reply: "Please write a message or select an image.",
      });
    }


    // Gemini API URL
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";


    // ===============================
    // SYSTEM INSTRUCTION
    // ===============================

    const systemInstruction = `
You are an AI assistant created by Tayyba Maryam.

You can communicate in:
English, Urdu, Roman Urdu, Arabic, Hindi,
Korean, Turkish, Chinese, French and Spanish.

Always reply in the same language used by the user.

Be helpful, friendly, clear and accurate.

For programming questions:
- Explain the solution clearly.
- Put all programming code inside Markdown code blocks.
- Always specify the programming language after the three backticks.
- Example:

\`\`\`java
public class Example {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
\`\`\`

Do not put programming code in a normal paragraph.

For study questions:
- Explain concepts simply.
- Use headings and bullet points when useful.
- Give examples when helpful.

If the user sends an image:
- Carefully analyze the image.
- Answer the user's question about the image.
- If the image contains text or code, read it carefully.
- Do not claim to see something that is not visible.

Do not make up information when you are unsure.
`.trim();


    // ===============================
    // CREATE CONTENT PARTS
    // ===============================

    const parts = [];


    // Add image if provided
    if (image) {

      // Base64 mein se "data:image/...;base64," remove karo
      const base64Data = image.includes(",")
        ? image.split(",")[1]
        : image;

      parts.push({
        inline_data: {
          mime_type: mimeType || "image/jpeg",
          data: base64Data,
        },
      });
    }


    // Add user's question
    if (message?.trim()) {
      parts.push({
        text: message.trim(),
      });
    } else {
      parts.push({
        text: "Please analyze this image and describe what you can see.",
      });
    }


    // ===============================
    // SEND TO GEMINI
    // ===============================

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },

      body: JSON.stringify({

        system_instruction: {
          parts: [
            {
              text: systemInstruction,
            },
          ],
        },

        contents: [
          {
            role: "user",
            parts: parts,
          },
        ],

      }),
    });


    const data = await response.json();


    // ===============================
    // ERROR HANDLING
    // ===============================

    if (!response.ok) {

      console.error(
        "❌ Gemini API response:",
        JSON.stringify(data, null, 2)
      );

      throw new Error(
        data.error?.message ||
        `Gemini API request failed with status ${response.status}`
      );
    }


    // ===============================
    // GET AI RESPONSE
    // ===============================

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() ||
      "No response generated.";


    return res.json({
      reply,
    });


  } catch (err) {

    console.error("❌ Gemini API Error:", err.message);

    return res.status(500).json({
      reply: `API Error: ${err.message}`,
    });

  }
});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

  console.log(
    `✅ Server running on http://localhost:${PORT}`
  );

  console.log(
    `🔑 Gemini key loaded: ${
      apiKey ? "YES" : "NO"
    }`
  );

});