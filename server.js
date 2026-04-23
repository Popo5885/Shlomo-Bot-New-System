const path = require('path');
const express = require('express');
const { ConfigStore } = require('./services/config-store');
const { WhatsAppRelayBot } = require('./services/whatsapp-bot');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

const configStore = new ConfigStore(path.join(__dirname, 'config.json'));
const bot = new WhatsAppRelayBot({ configStore });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json(bot.getStatusSnapshot());
});

app.get('/api/groups', async (req, res, next) => {
  try {
    const groups = await bot.getGroups();
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

app.get('/api/contacts', async (req, res, next) => {
  try {
    const contacts = await bot.getContacts();
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

app.get('/api/config', async (req, res, next) => {
  try {
    const config = await configStore.readConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

app.post('/api/config', async (req, res, next) => {
  try {
    const config = await configStore.writeConfig(req.body);
    res.json({
      success: true,
      config
    });
  } catch (error) {
    next(error);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('[Server] Request failed:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Unexpected server error.'
  });
});

async function start() {
  await configStore.ensureConfigFile();

  app.listen(PORT, () => {
    console.log(`[Server] Dashboard running at http://localhost:${PORT}`);
  });

  bot.initialize().catch((error) => {
    console.error('[Server] WhatsApp client failed to initialize:', error);
  });
}

async function shutdown(signal) {
  console.log(`[Server] Received ${signal}. Shutting down...`);
  await bot.shutdown();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

start().catch((error) => {
  console.error('[Server] Startup failed:', error);
  process.exit(1);
});
