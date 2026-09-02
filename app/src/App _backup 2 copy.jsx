import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

export function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Convert image to Base64
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedImage({
        name: file.name,
        type: file.type,
        data: reader.result,
      });
    };

    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return;

    const currentInput = input;

    const userMessage = {
      sender: "user",
      text: currentInput || "Please analyze this image.",
      image: selectedImage?.data || null,
    };

    setMessages((prev) => [...prev, userMessage]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentInput,
          image: selectedImage?.data || null,
          mimeType: selectedImage?.type || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.reply || data.error || "Server error");
      }

      const botMessage = {
        sender: "bot",
        text: data.reply || "No response generated.",
      };

      setMessages((prev) => [...prev, botMessage]);

      // Clear selected image after sending
      setSelectedImage(null);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: "700px" }}>
      <h3 className="mb-3 text-center">AI Assistant</h3>

      {/* Chat Area */}
      <div
        className="border rounded p-3 mb-3 bg-light"
        style={{
          height: "500px",
          overflowY: "auto",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`d-flex mb-3 ${
              msg.sender === "user"
                ? "justify-content-end"
                : "justify-content-start"
            }`}
          >
            <div
              className={`p-3 rounded ${
                msg.sender === "user"
                  ? "bg-primary text-white"
                  : "bg-white border"
              }`}
              style={{
                maxWidth: "90%",
                overflowX: "auto",
              }}
            >
              {/* User Image */}
              {msg.image && (
                <img
                  src={msg.image}
                  alt="Uploaded"
                  style={{
                    maxWidth: "250px",
                    maxHeight: "250px",
                    borderRadius: "10px",
                    display: "block",
                    marginBottom: "10px",
                  }}
                />
              )}

              {/* AI / User Text */}
              {msg.sender === "bot" ? (
                <ReactMarkdown
                  components={{
                    code({ inline, className, children, ...props }) {
                      return inline ? (
                        <code
                          style={{
                            background: "#eee",
                            padding: "2px 5px",
                            borderRadius: "4px",
                          }}
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <CodeBlock>{children}</CodeBlock>
                      );
                    },

                    p({ children }) {
                      return (
                        <p style={{ marginBottom: "10px" }}>
                          {children}
                        </p>
                      );
                    },

                    h1({ children }) {
                      return <h4>{children}</h4>;
                    },

                    h2({ children }) {
                      return <h5>{children}</h5>;
                    },

                    h3({ children }) {
                      return <h6>{children}</h6>;
                    },
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-muted small">
            Thinking...
          </div>
        )}
      </div>

      {/* Selected Image Preview */}
      {selectedImage && (
        <div className="mb-2 p-2 border rounded bg-white">
          <div className="small text-muted mb-1">
            Selected image:
          </div>

          <div className="d-flex align-items-center gap-2">
            <img
              src={selectedImage.data}
              alt="Preview"
              style={{
                width: "70px",
                height: "70px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />

            <span className="small">
              {selectedImage.name}
            </span>

            <button
              className="btn btn-sm btn-outline-danger ms-auto"
              onClick={() => setSelectedImage(null)}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="input-group">
        {/* Image Button */}
        <label
          className="btn btn-outline-secondary"
          style={{
            cursor: "pointer",
          }}
        >
          📷
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={handleImageChange}
          />
        </label>

        <input
          type="text"
          className="form-control"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
        />

        <button
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}


// Code Block Component
function CodeBlock({ children }) {
  const code = String(children).replace(/\n$/, "");

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      alert("Code copied!");
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <div
      style={{
        background: "#1e1e1e",
        color: "#f5f5f5",
        borderRadius: "8px",
        marginTop: "10px",
        marginBottom: "10px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "5px 8px",
          background: "#333",
        }}
      >
        <button
          onClick={copyCode}
          style={{
            border: "none",
            borderRadius: "5px",
            padding: "4px 9px",
            cursor: "pointer",
          }}
        >
          Copy
        </button>
      </div>

      <pre
        style={{
          margin: 0,
          padding: "15px",
          overflowX: "auto",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default App;