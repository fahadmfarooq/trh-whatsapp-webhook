# The Recovery House — WhatsApp Webhook Server

A free self-hosted WhatsApp Cloud API inbox for receiving and sending messages.

## Deploy to Render (Free)

1. Push this folder to a GitHub repository
2. Go to render.com → New → Web Service
3. Connect your GitHub repo
4. Set these Environment Variables in Render dashboard:
   - `VERIFY_TOKEN` = colptwebhook
   - `WHATSAPP_TOKEN` = (your WhatsApp API token from Meta)
   - `PHONE_NUMBER_ID` = (your Phone Number ID from Meta)
5. Deploy — Render gives you a URL like `https://trh-whatsapp-webhook.onrender.com`

## Configure Meta Webhook

In developers.facebook.com → Your App → WhatsApp → Configuration:
- Callback URL: `https://your-render-url.onrender.com/webhook`
- Verify Token: `colptwebhook`
- Subscribe to: `messages`

## Access Your Inbox

Visit `https://your-render-url.onrender.com` in any browser.
