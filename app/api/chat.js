export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json(
        { reply: "Method not allowed." },
        { status: 405 }
      );
    }

    try {
      const { message, image, mimeType } =
        await request.json();

      // ===============================
      // CHECK MESSAGE / IMAGE
      // ===============================

      if (!message?.trim() && !image) {
        return Response.json(
          {
            reply:
              "Please write a message or select an image.",
          },
          { status: 400 }
        );
      }

      // ===============================
      // GET GEMINI API KEY
      // ===============================

      const apiKey = (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        ""
      )
        .trim()
        .replace(/^["']|["']$/g, "");

      if (!apiKey) {
        return Response.json(
          {
            reply:
              "Server configuration error: Gemini API key is missing.",
          },
          { status: 500 }
        );
      }

      // ===============================
      // GEMINI MODEL
      // ===============================

      const model = "gemini-3.5-flash-lite";

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      // ===============================
      // SYSTEM INSTRUCTION
      // ===============================

      const systemInstruction = `
You are an AI assistant created by Tayyba Maryam.

When introducing yourself or explaining who created you, say:
"I'm an AI assistant created by Tayyba Maryam."

You can communicate in English, Urdu, Roman Urdu, Arabic,
Hindi, Korean, Turkish, Chinese, French and Spanish.

Always reply in the same language used by the user.

Be helpful, friendly, clear and accurate.

For programming questions:
- Explain the solution clearly.
- Put programming code inside Markdown code blocks.
- Always specify the programming language.
- Do not put programming code in normal paragraphs.

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

      // ===============================
      // ADD IMAGE
      // ===============================

      if (image) {
        const commaIndex = image.indexOf(",");

        const base64Data =
          commaIndex >= 0
            ? image.slice(commaIndex + 1)
            : image;

        let detectedMimeType =
          mimeType || "image/jpeg";

        if (
          commaIndex >= 0 &&
          image.startsWith("data:")
        ) {
          const semicolonIndex =
            image.indexOf(";");

          if (semicolonIndex > 5) {
            detectedMimeType =
              image
                .substring(
                  5,
                  semicolonIndex
                )
                .trim() || detectedMimeType;
          }
        }

        parts.push({
          inline_data: {
            mime_type: detectedMimeType,
            data: base64Data,
          },
        });
      }

      // ===============================
      // ADD USER MESSAGE
      // ===============================

      parts.push({
        text:
          message?.trim() ||
          "Please analyze this image and describe what you can see.",
      });

      // ===============================
      // REQUEST BODY
      // ===============================

      const requestBody = {
        system_instruction: {
          parts: [
            {
              text: systemInstruction,
            },
          ],
        },

        generationConfig: {
          thinkingConfig: {
            thinkingLevel: "low",
          },
        },

        contents: [
          {
            role: "user",
            parts,
          },
        ],
      };

      // ===============================
      // GEMINI REQUEST + RETRY
      // ===============================

      let response;
      let data;

      const maxAttempts = 2;

      for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
      ) {
        response = await fetch(url, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },

          body: JSON.stringify(requestBody),
        });

        data = await response.json();

        // Successful response
        if (response.ok) {
          break;
        }

        console.error(
          `Gemini attempt ${attempt} failed:`,
          JSON.stringify(data, null, 2)
        );

        // Retry only temporary errors
        const retryable =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;

        if (
          !retryable ||
          attempt === maxAttempts
        ) {
          break;
        }

        // Wait 1 second before retry
        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }

      // ===============================
      // ERROR HANDLING
      // ===============================

      if (!response.ok) {
        return Response.json(
          {
            reply:
              data?.error?.message ||
              `Gemini API request failed with status ${response.status}`,
          },
          { status: response.status }
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

      // ===============================
      // SEND RESPONSE
      // ===============================

      return Response.json({
        reply,
      });

    } catch (error) {
      console.error(
        "Server error:",
        error
      );

      return Response.json(
        {
          reply:
            "API Error: " +
            (error.message ||
              "Unknown server error"),
        },
        { status: 500 }
      );
    }
  },
};