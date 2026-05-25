const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "colptwebhook";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";

// In-memory message store
let conversations = {};

// ─── WEBHOOK VERIFICATION (Meta calls this when you save the webhook) ───
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ─── RECEIVE INCOMING MESSAGES ───
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    body.entry?.forEach((entry) => {
      entry.changes?.forEach((change) => {
        const value = change.value;

        // Incoming message
        if (value.messages) {
          value.messages.forEach((msg) => {
            const from = msg.from;
            const name = value.contacts?.[0]?.profile?.name || from;
            const text =
              msg.type === "text" ? msg.text.body : `[${msg.type} message]`;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000);

            if (!conversations[from]) {
              conversations[from] = { name, messages: [] };
            }
            conversations[from].name = name;
            conversations[from].messages.push({
              id: msg.id,
              direction: "incoming",
              text,
              timestamp,
            });

            console.log(`📩 Message from ${name} (${from}): ${text}`);
          });
        }

        // Message status updates
        if (value.statuses) {
          value.statuses.forEach((status) => {
            console.log(`📬 Message ${status.id} status: ${status.status}`);
          });
        }
      });
    });
  }

  res.sendStatus(200);
});

// ─── GET ALL CONVERSATIONS (for the inbox UI) ───
app.get("/api/conversations", (req, res) => {
  const list = Object.entries(conversations).map(([phone, data]) => ({
    phone,
    name: data.name,
    lastMessage: data.messages[data.messages.length - 1] || null,
    unread: data.messages.filter(
      (m) => m.direction === "incoming" && !m.read
    ).length,
  }));
  list.sort(
    (a, b) =>
      new Date(b.lastMessage?.timestamp || 0) -
      new Date(a.lastMessage?.timestamp || 0)
  );
  res.json(list);
});

// ─── GET MESSAGES FOR A SPECIFIC CONVERSATION ───
app.get("/api/conversations/:phone", (req, res) => {
  const phone = req.params.phone;
  const convo = conversations[phone];
  if (!convo) return res.json({ name: phone, messages: [] });

  // Mark as read
  convo.messages.forEach((m) => (m.read = true));
  res.json(convo);
});

// ─── SEND A MESSAGE ───
app.post("/api/send", async (req, res) => {
  const { to, message } = req.body;

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    return res
      .status(500)
      .json({ error: "WHATSAPP_TOKEN or PHONE_NUMBER_ID not configured" });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = await response.json();

    if (data.messages) {
      // Save to local conversation store
      if (!conversations[to]) {
        conversations[to] = { name: to, messages: [] };
      }
      conversations[to].messages.push({
        id: data.messages[0].id,
        direction: "outgoing",
        text: message,
        timestamp: new Date(),
        read: true,
      });
      res.json({ success: true, id: data.messages[0].id });
    } else {
      res.status(400).json({ error: data.error?.message || "Send failed" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp webhook server running on port ${PORT}`);
  console.log(`🔑 Verify token: ${VERIFY_TOKEN}`);
});
