import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [listening, setListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("ai_dark_mode") === "true";
  });

  const [chats, setChats] = useState(() => {
    try {
      const savedChats = localStorage.getItem("ai_chats");
      return savedChats ? JSON.parse(savedChats) : [];
    } catch {
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState(null);

  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceTextRef = useRef("");
  const abortControllerRef = useRef(null);


  /* =========================
     SAVE SETTINGS & HISTORY
  ========================= */

  useEffect(() => {
    localStorage.setItem("ai_chats", JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem("ai_dark_mode", darkMode);

    document.body.style.background = darkMode
      ? "#171522"
      : "#f7f5fb";
  }, [darkMode]);

  /* =========================
     IMAGE SELECT
  ========================= */

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedImage({
        name: file.name,
        data: reader.result,
      });
    };

    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =========================
     VOICE INPUT
  ========================= */

  const startVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
    };
     recognition.onresult = (event) => {
  const transcript =
    event.results[0][0].transcript.trim();

  if (transcript) {
    setInput(transcript);
    voiceTextRef.current = transcript;
  }
};
     

      setInput(transcript);
      voiceTextRef.current = transcript;
    };

    recognition.onerror = (event) => {
      console.error(
        "Voice error:",
        event.error
      );

      setListening(false);

      if (event.error === "not-allowed") {
        alert(
          "Microphone permission denied. Please allow microphone access."
        );
      }
    };

    recognition.onend = () => {
      setListening(false);
      const voiceText = voiceTextRef.current.trim();

      if (voiceText && !loading) {
        voiceTextRef.current = "";
        sendMessage(voiceText);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
      setListening(false);
    }
  };

  /* =========================
     COPY RESPONSE
  ========================= */

  const copyResponse = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  };

  /* =========================
     SAVE CHAT
  ========================= */

  const saveChat = (
    chatId,
    updatedMessages,
    title
  ) => {
    setChats((previousChats) => {
      const existingChat =
        previousChats.find(
          (chat) => chat.id === chatId
        );

      if (existingChat) {
        return previousChats.map(
          (chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages:
                    updatedMessages,
                }
              : chat
        );
      }

      return [
        ...previousChats,
        {
          id: chatId,
          title:
            title?.length > 35
              ? title.substring(0, 35) + "..."
              : title || "New chat",
          messages: updatedMessages,
          createdAt:
            new Date().toISOString(),
        },
      ];
    });
  };

  /* =========================
     SEND MESSAGE
  ========================= */

  const sendMessage = async (voiceText = null) => {
    if (loading) return;

    if (
      !input.trim() &&
      !selectedImage
    ) {
      return;
    }

    const text = 
    voiceText !== null ? voiceText.trim():
    input.trim();

    const imageToSend =
      selectedImage?.data || null;

    const userMessage = {
      sender: "user",
      text: text || "Image",
      image: imageToSend,
    };

    let chatId = activeChatId;

    if (!chatId) {
      chatId = Date.now().toString();
      setActiveChatId(chatId);
    }

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);

    saveChat(
      chatId,
      updatedMessages,
      text || "Image chat"
    );

    setInput("");
    setLoading(true);
    removeImage();

    abortControllerRef.current =
      new AbortController();

    try {
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: text,
            image: imageToSend,
          }),

          signal:
            abortControllerRef.current
              .signal,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.reply ||
            data.error ||
            "Server error"
        );
      }

      const botMessage = {
        sender: "bot",
        text:
          data.reply ||
          "No response generated.",
      };

      const finalMessages = [
        ...updatedMessages,
        botMessage,
      ];

      setMessages(finalMessages);

      saveChat(
        chatId,
        finalMessages,
        text || "Image chat"
      );
      } catch (error) {
      console.error(error);

      const errorMessage = {
        sender: "bot",
        text:
          error.name === "AbortError"
            ? "Generation stopped."
            : "Sorry, I couldn't connect to the server.\n\n" +
              error.message,
      };

      const finalMessages = [
        ...updatedMessages,
        errorMessage,
      ];

      setMessages(finalMessages);

      saveChat(
        chatId,
        finalMessages,
        text || "Image chat"
      );
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  /* =========================
     REGENERATE
  ========================= */

  const regenerate = async (index) => {
    if (loading) return;

    const botMessage = messages[index];

    if (
      !botMessage ||
      botMessage.sender !== "bot"
    ) {
      return;
    }

    const userIndex = index - 1;

    if (
      userIndex < 0 ||
      !messages[userIndex] ||
      messages[userIndex].sender !== "user"
    ) {
      return;
    }

    const userMessage = messages[userIndex];

    const messagesWithoutBot = messages.filter(
      (_, messageIndex) => messageIndex !== index
    );

    setMessages(messagesWithoutBot);

    if (activeChatId) {
      saveChat(
        activeChatId,
        messagesWithoutBot,
        userMessage.text
      );
    }

    setLoading(true);

    abortControllerRef.current =
      new AbortController();

    try {
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            message:
              userMessage.text === "Image"
                ? ""
                : userMessage.text,

            image:
              userMessage.image || null,
          }),

          signal:
            abortControllerRef.current.signal,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.reply ||
            data.error ||
            "Server error"
        );
      }

      const newBotMessage = {
        sender: "bot",
        text:
          data.reply ||
          "No response generated.",
      };

      const finalMessages = [
        ...messagesWithoutBot,
        newBotMessage,
      ];

      setMessages(finalMessages);

      if (activeChatId) {
        saveChat(
          activeChatId,
          finalMessages,
          userMessage.text
        );
      }
    } catch (error) {
      const errorMessage = {
        sender: "bot",
        text:
          error.name === "AbortError"
            ? "Generation stopped."
            : "Error: " + error.message,
      };

      const finalMessages = [
        ...messagesWithoutBot,
        errorMessage,
      ];

      setMessages(finalMessages);

      if (activeChatId) {
        saveChat(
          activeChatId,
          finalMessages,
          userMessage.text
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  /* =========================
     STOP GENERATION
  ========================= */

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  /* =========================
     NEW CHAT
  ========================= */

  const newChat = () => {
    if (loading) {
      stopGeneration();
    }

    setMessages([]);
    setInput("");
    setActiveChatId(null);
    setSidebarOpen(false);
    setSettingsOpen(false);

    removeImage();
  };

  /* =========================
     OPEN CHAT
  ========================= */

  const openChat = (chat) => {
    if (loading) {
      stopGeneration();
    }

    setActiveChatId(chat.id);
    setMessages(chat.messages || []);
    setInput("");
    setSidebarOpen(false);

    removeImage();
  };

  /* =========================
     DELETE ONE CHAT
  ========================= */

  const deleteChat = (event, chatId) => {
    event.stopPropagation();

    setChats((previousChats) =>
      previousChats.filter(
        (chat) => chat.id !== chatId
      )
    );

    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  /* =========================
     CLEAR ALL HISTORY
  ========================= */

  const clearAllHistory = () => {
    if (chats.length === 0) {
      alert(
        "There is no chat history to clear."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete all chat history?"
    );

    if (!confirmed) return;

    setChats([]);
    setMessages([]);
    setActiveChatId(null);

    localStorage.removeItem("ai_chats");
  };

  /* =========================
     KEYBOARD
  ========================= */

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  /* =========================
     MARKDOWN
  ========================= */

  const MarkdownContent = ({ text }) => {
    return (
      <ReactMarkdown
        components={{
          code({
            inline,
            className,
            children,
            ...props
          }) {
            const codeText =
              String(children).replace(
                /\n$/,
                ""
              );

            const language =
              className?.replace(
                "language-",
                ""
              ) || "code";

            if (!inline) {
              return (
                <div className="code-block">

                  <div className="code-header">

                    <span>
                      {language}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        copyResponse(
                          codeText,
                          "code-" + codeText
                        )
                      }
                    >
                      📋 Copy
                    </button>

                  </div>

                  <pre>
                    <code {...props}>
                      {children}
                    </code>
                  </pre>

                </div>
              );
            }

            return (
              <code
                className={className}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    );
  };

  /* =========================
     MAIN UI START
  ========================= */

  return (
    <div
      className="chat-layout"
      style={{
        background: darkMode
          ? "#1d1a29"
          : "#ffffff",
      }}
    >

      {/* =========================
          SIDEBAR
      ========================= */}

      <aside
        className={`sidebar ${
          sidebarOpen
            ? "sidebar-open"
            : ""
        }`}
        style={{
          background: darkMode
            ? "#211e2d"
            : "#faf8ff",
        }}
      >

        <div className="sidebar-top">

          <button
            className="sidebar-close"
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            ×
          </button>

          <div className="sidebar-brand">

            <div className="sidebar-logo">
              ✦
            </div>

            <span>
              AI Assistant
            </span>

          </div>

          <button
            className="new-chat-button"
            type="button"
            onClick={newChat}
          >
            <span>＋</span>
            <span>New chat</span>
          </button>

        </div>

        {/* CHAT HISTORY */}

        <div className="chat-history">

          <div className="history-title">
            Today
          </div>

          {chats.length > 0 ? (
            chats
              .slice()
              .reverse()
              .map((chat) => (

                <div
                  key={chat.id}
                  className={`history-wrapper ${
                    activeChatId === chat.id
                      ? "active"
                      : ""
                  }`}
                >

                  <button
                    className={`history-item ${
                      activeChatId === chat.id
                        ? "active"
                        : ""
                    }`}
                    type="button"
                    onClick={() =>
                      openChat(chat)
                    }
                  >

                    <span>💬</span>

                    <span className="history-text">
                      {chat.title ||
                        "New chat"}
                    </span>

                  </button>

                  <button
                    className="delete-chat-button"
                    type="button"
                    title="Delete chat"
                    onClick={(event) =>
                      deleteChat(
                        event,
                        chat.id
                      )
                    }
                  >
                    ×
                  </button>

                </div>

              ))
          ) : (

            <div className="empty-history">
              No previous chats
            </div>

          )}

        </div>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <button
            className="sidebar-item"
            type="button"
            onClick={() =>
              setSettingsOpen(true)
            }
          >
            ⚙️
            <span>
              Settings
            </span>
          </button>

          <div className="creator-box">

            <div className="creator-avatar">
              T
            </div>

            <div>

              <div className="creator-name">
                Tayyba Maryam
              </div>

              <div className="creator-label">
                Creator
              </div>

            </div>

          </div>

        </div>

      </aside>
      {/* =========================
          MAIN CHAT
      ========================= */}

      <div className="chat-main">

        <header className="chat-header">

          <div className="brand">

            <div className="brand-circle">
              ✦
            </div>

            <span>
              AI Assistant
            </span>

          </div>

          <button
            className="header-button"
            type="button"
            title="Open sidebar"
            onClick={() =>
              setSidebarOpen(true)
            }
          >
            ☰
          </button>

        </header>

        {/* =========================
            CHAT AREA
        ========================= */}

        <main className="chat-area">

          {messages.length === 0 && (

            <div className="welcome">

              <div className="welcome-circle">
                ✦
              </div>

              <h1>
                Hello! 👋
              </h1>

              <p>
                How can I help you today?
              </p>

            </div>

          )}

          {messages.map(
            (msg, index) => (

              <div
                key={index}
                className={
                  msg.sender === "user"
                    ? "message-row user-row"
                    : "message-row bot-row"
                }
              >

                <div
                  className={
                    msg.sender === "user"
                      ? "message user-message"
                      : "message bot-message"
                  }
                >

                  {msg.image && (

                    <img
                      src={msg.image}
                      alt="Uploaded"
                      style={{
                        maxWidth: "280px",
                        width: "100%",
                        borderRadius: "14px",
                        display: "block",
                        marginBottom:
                          msg.text
                            ? "10px"
                            : "0",
                      }}
                    />

                  )}

                  <div className="message-content">

                    <MarkdownContent
                      text={msg.text}
                    />

                  </div>

                  {msg.sender === "bot" && (

                    <div className="message-actions">

                      <button
                        type="button"
                        onClick={() =>
                          copyResponse(
                            msg.text,
                            index
                          )
                        }
                      >
                        {copiedIndex === index
                          ? "✓ Copied"
                          : "📋 Copy"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          regenerate(index)
                        }
                        disabled={loading}
                      >
                        🔄 Regenerate
                      </button>

                    </div>

                  )}

                </div>

              </div>

            )
          )}

          {loading && (

            <div className="message-row bot-row">

              <div className="message bot-message">

                <div className="typing">
                  Thinking...
                </div>

                <button
                  className="stop-button"
                  type="button"
                  onClick={stopGeneration}
                >
                  ⏹️ Stop
                </button>

              </div>

            </div>

          )}

        </main>

        {/* =========================
            IMAGE PREVIEW
        ========================= */}

        {selectedImage && (

          <div
            style={{
              padding: "8px 20px",
              background: darkMode
                ? "#211e2d"
                : "#faf8ff",
              borderTop:
                "1px solid #eee9fa",
            }}
          >

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "7px 10px",
                background: darkMode
                  ? "#2a2638"
                  : "#ffffff",
                border:
                  "1px solid #e5def7",
                borderRadius: "12px",
              }}
            >

              <img
                src={selectedImage.data}
                alt="Preview"
                style={{
                  width: "45px",
                  height: "45px",
                  objectFit: "cover",
                  borderRadius: "8px",
                }}
              />

              <span
                style={{
                  maxWidth: "160px",
                  overflow: "hidden",
                  textOverflow:
                    "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "13px",
                }}
              >
                {selectedImage.name}
              </span>

              <button
                type="button"
                onClick={removeImage}
                style={{
                  border: "none",
                  background:
                    "transparent",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>

            </div>

          </div>

        )}

        {/* =========================
            INPUT AREA
        ========================= */}

        <div className="input-area">

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{
              display: "none",
            }}
          />

          <button
            className="icon-button"
            type="button"
            title="Add image"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            📎
          </button>

          <input
            type="text"
            placeholder={
              listening
                ? "Listening..."
                : "Type a message..."
            }
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
          />

          <button
            className={`voice-button ${
              listening
                ? "voice-active"
                : ""
            }`}
            type="button"
            title={
              listening
                ? "Stop listening"
                : "Voice input"
            }
            onClick={startVoice}
          >
            {listening
              ? "🔴"
              : "🎙️"}
          </button>

          <button
            className="send-button"
            onClick={sendMessage}
            disabled={
              loading ||
              (!input.trim() &&
                !selectedImage)
            }
            type="button"
            title="Send"
          >
            ➤
          </button>

        </div>

        <div className="footer-text">
          AI Assistant • Created by
          Tayyba Maryam
        </div>

      </div>

      {/* =========================
          SETTINGS PANEL
      ========================= */}

      {settingsOpen && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background:
              "rgba(20, 15, 35, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() =>
            setSettingsOpen(false)
          }
        >

          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: darkMode
                ? "#242130"
                : "#ffffff",
              color: darkMode
                ? "#ffffff"
                : "#302b43",
              borderRadius: "22px",
              padding: "22px",
              boxShadow:
                "0 25px 70px rgba(0,0,0,0.25)",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* SETTINGS HEADER */}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                marginBottom: "22px",
              }}
            >

              <div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: "21px",
                  }}
                >
                  ⚙️ Settings
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    fontSize: "12px",
                    opacity: 0.6,
                  }}
                >
                  Customize your AI Assistant
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSettingsOpen(false)
                }
                style={{
                  width: "35px",
                  height: "35px",
                  border: "none",
                  borderRadius: "50%",
                  background: darkMode
                    ? "#342f42"
                    : "#f3effb",
                  color: darkMode
                    ? "#ffffff"
                    : "#66518c",
                  fontSize: "22px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>

            </div>

            {/* APPEARANCE */}

            <div
              style={{
                padding: "15px",
                borderRadius: "15px",
                background: darkMode
                  ? "#2c2839"
                  : "#faf8ff",
                marginBottom: "12px",
              }}
            >

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                }}
              >

                <div>

                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                    }}
                  >
                    Appearance
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      opacity: 0.6,
                      marginTop: "3px",
                    }}
                  >
                    {darkMode
                      ? "Dark mode"
                      : "Light mode"}
                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDarkMode(
                      (value) => !value
                    )
                  }
                  style={{
                    border: "none",
                    borderRadius: "20px",
                    padding:
                      "8px 13px",
                    background:
                      darkMode
                        ? "#7257b5"
                        : "#e5dcf8",
                    color:
                      darkMode
                        ? "#ffffff"
                        : "#60488c",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {darkMode
                    ? "🌙 Dark"
                    : "☀️ Light"}
                </button>

              </div>

            </div>

            {/* CHAT HISTORY */}

            <div
              style={{
                padding: "15px",
                borderRadius: "15px",
                background: darkMode
                  ? "#2c2839"
                  : "#faf8ff",
                marginBottom: "12px",
              }}
            >

              <div
                style={{
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                💬 Chat History
              </div>

              <div
                style={{
                  fontSize: "12px",
                  opacity: 0.6,
                  marginTop: "4px",
                  marginBottom: "12px",
                }}
              >
                {chats.length} saved chat
                {chats.length === 1
                  ? ""
                  : "s"}
              </div>

              <button
                type="button"
                onClick={clearAllHistory}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "none",
                  borderRadius: "10px",
                  background: darkMode
                    ? "#3a3044"
                    : "#eee7f8",
                  color: darkMode
                    ? "#e5d6ff"
                    : "#76508f",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                🗑️ Clear all history
              </button>

            </div>

            {/* ABOUT */}

            <div
              style={{
                padding: "15px",
                borderRadius: "15px",
                background: darkMode
                  ? "#2c2839"
                  : "#faf8ff",
              }}
            >

              <div
                style={{
                  fontWeight: 600,
                  fontSize: "14px",
                  marginBottom: "5px",
                }}
              >
                ✨ About
              </div>

              <div
                style={{
                  fontSize: "12px",
                  opacity: 0.65,
                  lineHeight: 1.5,
                }}
              >
                AI Assistant
                <br />
                Created by Tayyba Maryam
              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;