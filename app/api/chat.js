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

      if (!message?.trim() && !image) {
        return Response.json(
          {
            reply:
              "Please write a message or select an image.",
          },
          { status: 400 }
        );
      }

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

      const model = "gemini-3.8-flash";

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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

      const parts = [];

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
          detectedMimeType =
            image
              .substring(5, image.indexOf(";"))
              .trim() || detectedMimeType;
        }

        parts.push({
          inline_data: {
            mime_type: detectedMimeType,
            data: base64Data,
          },
        });
      }

      parts.push({
        text:
          message?.trim() ||
          "Please analyze this image and describe what you can see.",
      });

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
              parts,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Gemini API error:",
          JSON.stringify(data, null, 2)
        );

        return Response.json(
          {
            reply:
              data.error?.message ||
              `Gemini API request failed with status ${response.status}`,
          },
          { status: response.status }
        );
      }

      const reply =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("")
          .trim() ||
        "No response generated.";

      return Response.json({ reply });
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