import { Router, Request, Response } from 'express';

const router = Router();

const pendingLinks = new Map<string, string>();

// POST /telegram/webhook — receive updates from Telegram bot
router.post('/webhook', async (req: Request, res: Response) => {
  const update = req.body;

  if (update?.message?.text?.startsWith('/start')) {
    const args = update.message.text.split(' ');
    const linkToken = args[1]; // /start <linkToken>

    if (linkToken) {
      // Store pending link: linkToken -> chatId
      const chatId = update.message.chat.id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      pendingLinks.set(linkToken, String(chatId));

      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '\u2705 \u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d! \u0422\u0435\u043f\u0435\u0440\u044c \u0432\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f.',
          }),
        });
      }
    }
  }

  res.json({ ok: true });
});

// GET /telegram/pending/:token — check if link completed
router.get('/pending/:token', async (req: Request, res: Response) => {
  const chatId = pendingLinks.get(req.params.token);
  if (chatId) {
    pendingLinks.delete(req.params.token);
    res.json({ chatId });
  } else {
    res.json({ chatId: null });
  }
});

export { router as telegramRouter };
