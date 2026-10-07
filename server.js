import express from "express";
import multer from "multer";
import crypto from "crypto";
import dotenv from "dotenv";
import FormData from "form-data";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const botToken = process.env.BOT_TOKEN;
const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const sessionMinutes = Number(process.env.SESSION_MINUTES || 30);

if (!botToken) {
  console.error("Falta BOT_TOKEN en .env");
  process.exit(1);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

// token de sesión -> { chatId, expiresAt }
const sessions = new Map();

app.use(express.static("public"));
app.use(express.json());

function createSession(chatId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    chatId: String(chatId),
    expiresAt: Date.now() + sessionMinutes * 60 * 1000
  });
  return token;
}

function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return s;
}

async function telegram(method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    { method: "POST", body }
  );
  return response.json();
}

async function sendMessage(chatId, text) {
  const body = new URLSearchParams({
    chat_id: String(chatId),
    text
  });
  return telegram("sendMessage", body);
}

async function sendPhoto(chatId, buffer, filename = "foto.jpg") {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", buffer, {
    filename,
    contentType: "image/jpeg"
  });

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    {
      method: "POST",
      headers: form.getHeaders(),
      body: form
    }
  );
  return response.json();
}

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg?.chat?.id) return;

  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (text === "/start" || text.startsWith("/start ")) {
    const token = createSession(chatId);
    const url = `${publicUrl || `http://localhost:${port}`}/capture/${token}`;

    await sendMessage(
      chatId,
      "Pulsa el siguiente enlace para abrir la página de cámara. " +
      "La página mostrará claramente una solicitud de permiso y solo podrá " +
      "capturar una foto si la persona la acepta y pulsa el botón correspondiente:\\n\\n" +
      url
    );
  }
}

async function poll() {
  let offset = 0;

  while (true) {
    try {
      const url =
        `https://api.telegram.org/bot${botToken}/getUpdates` +
        `?timeout=25&offset=${offset}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.ok) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      }
    } catch (err) {
      console.error("Error de polling:", err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

app.get("/capture/:token", (req, res) => {
  const session = getSession(req.params.token);
  if (!session) {
    return res.status(404).send("Enlace caducado o no válido.");
  }

  res.sendFile(new URL("./capture.html", import.meta.url).pathname);

app.post("/api/photo/:token", upload.single("photo"), async (req, res) => {
  const session = getSession(req.params.token);

  if (!session) {
    return res.status(404).json({ ok: false, error: "Enlace caducado o no válido." });
  }

  if (!req.file) {
    return res.status(400).json({ ok: false, error: "No se recibió ninguna foto." });
  }

  try {
    const result = await sendPhoto(
      session.chatId,
      req.file.buffer,
      "camera-photo.jpg"
    );

    if (!result.ok) {
      console.error(result);
      return res.status(502).json({ ok: false, error: "Telegram rechazó la foto." });
    }

    // Un enlace solo permite una captura.
    sessions.delete(req.params.token);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "No se pudo enviar la foto." });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  if (!publicUrl) {
    console.warn("AVISO: configura PUBLIC_URL con tu URL HTTPS pública.");
  }
});

poll();
