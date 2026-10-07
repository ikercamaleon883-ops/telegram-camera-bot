import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const sessions = new Map();

if (!BOT_TOKEN) {
  console.error("Falta BOT_TOKEN");
  process.exit(1);
}

if (!PUBLIC_URL) {
  console.error("Falta PUBLIC_URL");
  process.exit(1);
}

app.use(express.json({ limit: "8mb" }));

function newSession(chatId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    chatId,
    expires: Date.now() + 30 * 60 * 1000,
    used: false
  });
  return token;
}

function getSession(token) {
  const s = sessions.get(token);
  if (!s || s.used || Date.now() > s.expires) return null;
  return s;
}

app.get("/", (req, res) => {
  res.send("Telegram camera bot is running.");
});

app.get("/capture/:token", (req, res) => {
  if (!getSession(req.params.token)) {
    return res.status(404).send("Enlace caducado.");
  }

  res.sendFile(process.cwd() + "/capture.html");
});

app.post("/api/photo/:token", async (req, res) => {
  const session = getSession(req.params.token);

  if (!session) {
    return res.status(404).json({ ok: false });
  }

  const image = req.body?.image;

  if (typeof image !== "string") {
    return res.status(400).json({ ok: false });
  }

  const match = image.match(
    /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/
  );

  if (!match) {
    return res.status(400).json({ ok: false });
  }

  try {
    const buffer = Buffer.from(match[2], "base64");
    const type = match[1];

    const form = new FormData();
    form.append("chat_id", String(session.chatId));
    form.append(
      "photo",
      new Blob([buffer], { type }),
      "foto.jpg"
    );

    form.append(
      "caption",
      "Foto enviada después de autorizar la cámara y pulsar Tomar foto."
    );

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: form
      }
    );

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.description);
    }

    session.used = true;
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

let offset = 0;

async function telegramPoll() {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=25&offset=${offset}`
    );

    const data = await response.json();

    for (const update of data.result || []) {
      offset = update.update_id + 1;

      const message = update.message;
      if (!message?.chat?.id) continue;

      if ((message.text || "").startsWith("/start")) {
        const token = newSession(message.chat.id);
        const link =
          PUBLIC_URL.replace(/\/$/, "") + "/capture/" + token;

        await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: message.chat.id,
              text:
                "Abre este enlace. La cámara solo se utilizará después de que la persona acepte el permiso del navegador y pulse «Tomar foto»:\n\n" +
                link
            })
          }
        );
      }
    }
  } catch (error) {
    console.error("Telegram:", error.message);
  }

  setTimeout(telegramPoll, 1000);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor iniciado en puerto " + PORT);
  telegramPoll();
});
