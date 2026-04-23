const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_WORKSPACE_ID = 'workspace-shlomo-demo';

const DEFAULT_PLATFORM_DATA = {
  workspaces: [
    {
      id: DEFAULT_WORKSPACE_ID,
      name: 'Shlomo Popovitz - Workspace Demo',
      slug: 'shlomo-demo',
      owner_name: 'Shlomo Popovitz',
      owner_phone: '054-246-6340',
      owner_email: 'aknvpupuch@gmail.com',
      status: 'active',
      subscription_tier: 'PRO',
      usage_counter: 227,
      monthly_quota: 500,
      has_telegram: true,
      has_twitter: true,
      has_group_status: true,
      has_wa_channels: true,
      has_scheduling: true,
      has_contact_saver: true,
      golden_hour: '19:30',
      shabbat_blocker: true,
      anti_ban_mode: 'medium',
      created_at: '2026-04-20T08:30:00.000Z'
    },
    {
      id: 'workspace-pending-vip',
      name: 'VIP Pending Workspace',
      slug: 'vip-pending',
      owner_name: 'לקוח חדש',
      owner_phone: '050-123-4567',
      owner_email: 'new-customer@example.com',
      status: 'pending_approval',
      subscription_tier: 'VIP Pending',
      usage_counter: 0,
      monthly_quota: 500,
      has_telegram: false,
      has_twitter: false,
      has_group_status: true,
      has_wa_channels: false,
      has_scheduling: false,
      has_contact_saver: false,
      golden_hour: '18:45',
      shabbat_blocker: true,
      anti_ban_mode: 'slow',
      created_at: '2026-04-23T12:00:00.000Z'
    }
  ],
  users: [
    {
      id: 'user-shlomo-admin',
      workspace_id: DEFAULT_WORKSPACE_ID,
      name: 'Shlomo Popovitz',
      email: 'aknvpupuch@gmail.com',
      phone: '054-246-6340',
      role: 'super_admin',
      status: 'approved',
      auth_provider: 'google',
      created_at: '2026-04-20T08:30:00.000Z'
    },
    {
      id: 'user-vip-pending',
      workspace_id: 'workspace-pending-vip',
      name: 'לקוח חדש',
      email: 'new-customer@example.com',
      phone: '050-123-4567',
      role: 'owner',
      status: 'pending_approval',
      auth_provider: 'credentials',
      created_at: '2026-04-23T12:00:00.000Z'
    }
  ],
  transfers: [
    {
      id: 'transfer-1',
      workspace_id: DEFAULT_WORKSPACE_ID,
      name: 'מבצע ערב',
      trigger_source: 'קבוצת טריגר ראשית',
      channels: ['WhatsApp Groups', 'WhatsApp Group Status', 'Telegram Channel', 'X'],
      order: ['WhatsApp Groups', 'WhatsApp Group Status', 'Telegram Channel', 'X'],
      anti_ban_mode: 'medium',
      shabbat_blocker: true,
      status: 'awaiting_approval',
      view_count: 173,
      click_count: 41,
      created_at: '2026-04-22T18:45:00.000Z'
    },
    {
      id: 'transfer-2',
      workspace_id: DEFAULT_WORKSPACE_ID,
      name: 'עדכון בוקר',
      trigger_source: 'בוט מערכת',
      channels: ['WhatsApp Groups', 'Personal Status'],
      order: ['Personal Status', 'WhatsApp Groups'],
      anti_ban_mode: 'fast',
      shabbat_blocker: false,
      status: 'scheduled',
      view_count: 89,
      click_count: 12,
      created_at: '2026-04-23T07:15:00.000Z'
    }
  ],
  invoices: [
    {
      id: 'invoice-1001',
      workspace_id: DEFAULT_WORKSPACE_ID,
      customer_name: 'Shlomo Popovitz',
      file_name: 'invoice-april.pdf',
      pdf_url: '/public/invoice-april.pdf',
      sent_via_whatsapp: true,
      sent_via_email: true,
      created_at: '2026-04-21T09:15:00.000Z'
    }
  ],
  affiliates: [
    {
      id: 'affiliate-1',
      workspace_id: DEFAULT_WORKSPACE_ID,
      referrer_name: 'Shlomo Popovitz',
      referral_code: 'SHLOMO-PRO',
      referred_count: 4,
      created_at: '2026-04-20T08:30:00.000Z'
    }
  ],
  link_clicks: [
    {
      id: 'click-1',
      workspace_id: DEFAULT_WORKSPACE_ID,
      transfer_id: 'transfer-1',
      group_id: '120363427661233741@g.us',
      short_code: 'aurora-1',
      clicks: 19,
      created_at: '2026-04-22T19:05:00.000Z'
    }
  ]
};

class PlatformStore {
  constructor(dataFilePath = path.join(__dirname, '..', 'data', 'platform-data.json')) {
    this.dataFilePath = dataFilePath;
  }

  async ensureDataFile() {
    await fs.promises.mkdir(path.dirname(this.dataFilePath), { recursive: true });

    try {
      await fs.promises.access(this.dataFilePath, fs.constants.F_OK);
    } catch {
      await this.writeData(DEFAULT_PLATFORM_DATA);
    }
  }

  getDefaultWorkspaceId() {
    return DEFAULT_WORKSPACE_ID;
  }

  async listWorkspaces() {
    const data = await this.readData();
    const users = data.users || [];

    return data.workspaces.map((workspace) => {
      const workspaceUsers = users.filter((user) => user.workspace_id === workspace.id);
      const pendingUsers = workspaceUsers.filter((user) => user.status === 'pending_approval').length;

      return {
        ...workspace,
        user_count: workspaceUsers.length,
        pending_users: pendingUsers
      };
    });
  }

  async getWorkspaceView(workspaceId) {
    const data = await this.readData();
    const workspace = findRequired(data.workspaces, workspaceId, 'Workspace');

    return {
      workspace,
      users: filterByWorkspace(data.users, workspaceId),
      transfers: filterByWorkspace(data.transfers, workspaceId),
      invoices: filterByWorkspace(data.invoices, workspaceId),
      affiliates: filterByWorkspace(data.affiliates, workspaceId),
      link_clicks: filterByWorkspace(data.link_clicks, workspaceId)
    };
  }

  async getDashboardData(workspaceId) {
    const data = await this.readData();
    const workspace = findRequired(data.workspaces, workspaceId, 'Workspace');
    const transfers = filterByWorkspace(data.transfers, workspaceId);
    const invoices = filterByWorkspace(data.invoices, workspaceId);
    const affiliates = filterByWorkspace(data.affiliates, workspaceId);
    const clicks = filterByWorkspace(data.link_clicks, workspaceId);
    const users = filterByWorkspace(data.users, workspaceId);

    return {
      workspace,
      metrics: {
        monthlyUsage: workspace.usage_counter,
        monthlyQuota: workspace.monthly_quota,
        goldenHour: workspace.golden_hour,
        views: transfers.reduce((total, item) => total + Number(item.view_count || 0), 0),
        linkClicks: clicks.reduce((total, item) => total + Number(item.clicks || 0), 0),
        pendingApprovals: users.filter((user) => user.status === 'pending_approval').length
      },
      transfers,
      invoices,
      affiliates,
      featureLocks: [
        {
          key: 'telegram',
          label: 'Telegram Distribution',
          locked: !workspace.has_telegram
        },
        {
          key: 'scheduling',
          label: 'Calendar Scheduling',
          locked: !workspace.has_scheduling
        },
        {
          key: 'contactSaver',
          label: 'Contact Saver Bot',
          locked: !workspace.has_contact_saver
        },
        {
          key: 'waChannels',
          label: 'WhatsApp Channels',
          locked: !workspace.has_wa_channels
        }
      ],
      approvalQueue: users
        .filter((user) => user.status === 'pending_approval')
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          created_at: user.created_at
        })),
      antiBanModes: [
        { id: 'fast', label: 'Fast (3-5s)' },
        { id: 'medium', label: 'Medium (30-60s)' },
        { id: 'slow', label: 'Slow (5-10m)' },
        { id: 'burst', label: 'Burst' }
      ],
      shabbatWindow: 'Jerusalem / Petah Tikva sync',
      upgradeCta: 'פיצ׳ר זה פתוח למנויי PRO בלבד. לשדרוג, צרו קשר עם שלמה פופוביץ ב-054-246-6340'
    };
  }

  async listInvoices(workspaceId) {
    const data = await this.readData();
    return filterByWorkspace(data.invoices, workspaceId);
  }

  async getAnalytics(workspaceId) {
    const data = await this.readData();
    const transfers = filterByWorkspace(data.transfers, workspaceId);
    const clicks = filterByWorkspace(data.link_clicks, workspaceId);

    return {
      blueTickViews: transfers.map((item) => ({
        transferId: item.id,
        name: item.name,
        views: item.view_count
      })),
      linkPerformance: clicks,
      goldenHourRecommendation:
        transfers.sort((left, right) => Number(right.view_count || 0) - Number(left.view_count || 0))[0]?.created_at ||
        null
    };
  }

  async createPendingSignup(input = {}) {
    const data = await this.readData();
    const workspaceId = `workspace-${crypto.randomUUID()}`;
    const userId = `user-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const customerName = cleanString(input.name) || 'לקוח חדש';
    const email = cleanString(input.email) || `signup-${Date.now()}@example.com`;
    const phone = cleanString(input.phone) || '';
    const company = cleanString(input.company) || customerName;

    const workspace = {
      id: workspaceId,
      name: company,
      slug: slugify(company),
      owner_name: customerName,
      owner_phone: phone,
      owner_email: email,
      status: 'pending_approval',
      subscription_tier: 'VIP Pending',
      usage_counter: 0,
      monthly_quota: 500,
      has_telegram: false,
      has_twitter: false,
      has_group_status: true,
      has_wa_channels: false,
      has_scheduling: false,
      has_contact_saver: false,
      golden_hour: '19:00',
      shabbat_blocker: true,
      anti_ban_mode: 'medium',
      affiliate_code: cleanString(input.affiliateCode),
      created_at: timestamp
    };

    const user = {
      id: userId,
      workspace_id: workspaceId,
      name: customerName,
      email,
      phone,
      role: 'owner',
      status: 'pending_approval',
      auth_provider: cleanString(input.authProvider) || 'credentials',
      created_at: timestamp
    };

    data.workspaces.push(workspace);
    data.users.push(user);

    if (workspace.affiliate_code) {
      data.affiliates.push({
        id: `affiliate-${crypto.randomUUID()}`,
        workspace_id: workspaceId,
        referrer_name: workspace.affiliate_code,
        referral_code: workspace.affiliate_code,
        referred_count: 1,
        created_at: timestamp
      });
    }

    await this.writeData(data);

    return {
      workspace,
      user
    };
  }

  async approveUser(userId) {
    const data = await this.readData();
    const user = data.users.find((item) => item.id === String(userId || '').trim());

    if (!user) {
      throw new Error('User was not found for approval.');
    }

    user.status = 'approved';
    const workspace = findRequired(data.workspaces, user.workspace_id, 'Workspace');
    workspace.status = 'active';
    workspace.subscription_tier = workspace.subscription_tier === 'VIP Pending' ? 'Starter' : workspace.subscription_tier;

    await this.writeData(data);

    return {
      user,
      workspace
    };
  }

  async recordLinkClick(input = {}) {
    const data = await this.readData();
    const click = {
      id: `click-${crypto.randomUUID()}`,
      workspace_id: cleanString(input.workspace_id) || DEFAULT_WORKSPACE_ID,
      transfer_id: cleanString(input.transfer_id),
      group_id: cleanString(input.group_id),
      short_code: cleanString(input.short_code),
      clicks: Math.max(1, Number(input.clicks || 1)),
      created_at: new Date().toISOString()
    };

    data.link_clicks.push(click);
    await this.writeData(data);
    return click;
  }

  async readData() {
    await this.ensureDataFile();
    const raw = await fs.promises.readFile(this.dataFilePath, 'utf8');

    try {
      return sanitizeData(JSON.parse(raw));
    } catch {
      await this.writeData(DEFAULT_PLATFORM_DATA);
      return sanitizeData(DEFAULT_PLATFORM_DATA);
    }
  }

  async writeData(nextData) {
    const sanitized = sanitizeData(nextData);
    await fs.promises.writeFile(this.dataFilePath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');
    return sanitized;
  }
}

function sanitizeData(input = {}) {
  return {
    workspaces: ensureArray(input.workspaces),
    users: ensureArray(input.users),
    transfers: ensureArray(input.transfers),
    invoices: ensureArray(input.invoices),
    affiliates: ensureArray(input.affiliates),
    link_clicks: ensureArray(input.link_clicks)
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return String(value || '').trim();
}

function filterByWorkspace(items, workspaceId) {
  return ensureArray(items).filter((item) => item.workspace_id === workspaceId);
}

function findRequired(items, id, label) {
  const record = ensureArray(items).find((item) => item.id === id);

  if (!record) {
    throw new Error(`${label} ${id} was not found.`);
  }

  return record;
}

function slugify(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
    .replace(/^-+|-+$/g, '') || `workspace-${Date.now()}`;
}

module.exports = {
  DEFAULT_PLATFORM_DATA,
  DEFAULT_WORKSPACE_ID,
  PlatformStore
};
