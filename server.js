const path = require('path');
const express = require('express');
const next = require('next');
const { ConfigStore } = require('./services/config-store');
const { PlatformStore } = require('./services/platform-store');
const { WhatsAppRelayBot } = require('./services/whatsapp-bot');
const { sendAdminSignupAlert, sendApprovalEmail, sendWelcomeEmail } = require('./lib/mailer');

const PORT = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== 'production' && process.env.npm_lifecycle_event !== 'start';
const nextApp = next({
  dev,
  dir: __dirname
});
const handle = nextApp.getRequestHandler();
const app = express();

const configStore = new ConfigStore(path.join(__dirname, 'config.json'));
const platformStore = new PlatformStore(path.join(__dirname, 'data', 'platform-data.json'));
const bot = new WhatsAppRelayBot({ configStore });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json(bot.getStatusSnapshot());
});

app.get('/api/groups', async (req, res, nextMiddleware) => {
  try {
    const groups = await bot.getGroups();
    res.json(groups);
  } catch (error) {
    nextMiddleware(error);
  }
});

app.get('/api/contacts', async (req, res, nextMiddleware) => {
  try {
    const contacts = await bot.getContacts();
    res.json(contacts);
  } catch (error) {
    nextMiddleware(error);
  }
});

app.get('/api/config', async (req, res, nextMiddleware) => {
  try {
    const config = await configStore.readConfig();
    res.json(config);
  } catch (error) {
    nextMiddleware(error);
  }
});

app.post('/api/config', async (req, res, nextMiddleware) => {
  try {
    const config = await configStore.writeConfig(req.body);
    res.json({
      success: true,
      config
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.get('/api/platform/dashboard', async (req, res, nextMiddleware) => {
  try {
    const workspaceId = String(req.query.workspace_id || '').trim() || platformStore.getDefaultWorkspaceId();
    const [config, groups, contacts] = await Promise.all([
      configStore.readConfig(),
      bot.getGroups(),
      bot.getContacts()
    ]);

    res.json({
      success: true,
      workspaceId,
      botStatus: bot.getStatusSnapshot(),
      config,
      directory: {
        groups,
        contacts
      },
      dashboard: await platformStore.getDashboardData(workspaceId)
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.get('/api/admin/workspaces', async (req, res, nextMiddleware) => {
  try {
    const workspaces = await platformStore.listWorkspaces();
    res.json({
      success: true,
      workspaces
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.get('/api/admin/workspaces/:workspaceId', async (req, res, nextMiddleware) => {
  try {
    const workspaceView = await platformStore.getWorkspaceView(req.params.workspaceId);
    res.json({
      success: true,
      workspace: workspaceView
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.post('/api/admin/approve-user', async (req, res, nextMiddleware) => {
  try {
    const approval = await platformStore.approveUser(req.body.userId);
    await sendApprovalEmail(approval.user);

    res.json({
      success: true,
      approval
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.post('/api/onboarding', async (req, res, nextMiddleware) => {
  try {
    const signup = await platformStore.createPendingSignup(req.body);
    await Promise.allSettled([
      sendWelcomeEmail(signup.user),
      sendAdminSignupAlert(signup.user, signup.workspace)
    ]);

    res.json({
      success: true,
      signup
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.get('/api/invoices', async (req, res, nextMiddleware) => {
  try {
    const workspaceId = String(req.query.workspace_id || '').trim() || platformStore.getDefaultWorkspaceId();
    const invoices = await platformStore.listInvoices(workspaceId);
    res.json({
      success: true,
      invoices
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.get('/api/analytics', async (req, res, nextMiddleware) => {
  try {
    const workspaceId = String(req.query.workspace_id || '').trim() || platformStore.getDefaultWorkspaceId();
    const analytics = await platformStore.getAnalytics(workspaceId);
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.post('/api/link-clicks', async (req, res, nextMiddleware) => {
  try {
    const click = await platformStore.recordLinkClick(req.body);
    res.json({
      success: true,
      click
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

app.all('*', (req, res) => handle(req, res));

app.use((error, req, res, nextMiddleware) => {
  console.error('[Server] Request failed:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Unexpected server error.'
  });
});

async function start() {
  await Promise.all([
    configStore.ensureConfigFile(),
    platformStore.ensureDataFile(),
    nextApp.prepare()
  ]);

  app.listen(PORT, () => {
    console.log(`[Server] Shlomo Popovitz platform running at http://localhost:${PORT}`);
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
