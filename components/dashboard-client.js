'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MagneticButton } from './magnetic-button';

const DEFAULT_CONFIG = {
  TRIGGER_GROUP_ID: '',
  AUTHORIZED_NUMBERS: [],
  TARGET_GROUP_IDS: [],
  POST_TO_STATUS: false
};

const WIZARD_TABS = [
  { id: 'goals', label: 'Goals' },
  { id: 'trigger', label: 'Trigger' },
  { id: 'authorized', label: 'Authorized' },
  { id: 'settings', label: 'Settings' }
];

export function DashboardClient() {
  const [activeTab, setActiveTab] = useState('goals');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [workspaceData, setWorkspaceData] = useState(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [targetOrder, setTargetOrder] = useState([
    'WhatsApp Groups',
    'WhatsApp Group Status',
    'WhatsApp Channels',
    'Telegram',
    'X'
  ]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard(nextWorkspaceId) {
    setIsLoading(true);

    try {
      const [dashboardResponse, groupsResponse, contactsResponse, configResponse] = await Promise.all([
        fetchJson(`/api/platform/dashboard${nextWorkspaceId ? `?workspace_id=${encodeURIComponent(nextWorkspaceId)}` : ''}`),
        fetchJson('/api/groups'),
        fetchJson('/api/contacts'),
        fetchJson('/api/config')
      ]);

      setWorkspaceId(dashboardResponse.workspaceId);
      setWorkspaceData(dashboardResponse);
      setGroups(groupsResponse);
      setContacts(contactsResponse);
      setConfig({
        ...DEFAULT_CONFIG,
        ...configResponse,
        AUTHORIZED_NUMBERS: configResponse.AUTHORIZED_NUMBERS || [],
        TARGET_GROUP_IDS: configResponse.TARGET_GROUP_IDS || []
      });
    } catch (error) {
      setMessage(error.message || 'טעינת המערכת נכשלה.');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveConfig() {
    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'שמירת ההגדרות נכשלה.');
      }

      setConfig(payload.config);
      setMessage('ההגדרות נשמרו בהצלחה.');
      await loadDashboard(workspaceId);
    } catch (error) {
      setMessage(error.message || 'שמירת ההגדרות נכשלה.');
    } finally {
      setIsSaving(false);
    }
  }

  const dashboard = workspaceData?.dashboard;
  const metrics = dashboard?.metrics;
  const workspace = dashboard?.workspace;
  const upgradeCta = dashboard?.upgradeCta;

  const directoryState = useMemo(
    () => ({
      groups: groups.length,
      contacts: contacts.length,
      isReady: Boolean(workspaceData?.botStatus?.isReady)
    }),
    [groups, contacts, workspaceData]
  );

  if (isLoading) {
    return (
      <div className="glass-panel p-10 text-center text-sm text-white/80">
        טוען את מערכת האוטומציה של שלמה פופוביץ...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="glass-panel overflow-hidden p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/75">
                Shlomo Popovitz - Business Automation Solutions
              </span>
              <div>
                <h1 className="text-3xl font-semibold leading-tight text-white md:text-5xl">
                  פלטפורמת SaaS רב-ערוצית להפצה, אישורים, ניתוחים ואוטומציה עסקית.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 md:text-base">
                  המערכת מחברת בין קבוצת טריגר ב-WhatsApp, סטטוס אישי וקבוצתי, Telegram, X, ניהול לקוחות,
                  תשלומים והרשאות VIP עם חוויית Premium בעברית מלאה.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/auth/signin" className="glass-button px-5 py-3 text-sm text-white/88">
                התחברות
              </Link>
              <MagneticButton
                onClick={saveConfig}
                disabled={isSaving}
                className="magnetic-primary rounded-full px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {isSaving ? 'שומר...' : 'שמור Rule'}
              </MagneticButton>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <MetricCard label="Usage Meter" value={`${metrics?.monthlyUsage || 0}/${metrics?.monthlyQuota || 0}`} />
            <MetricCard label="AI Golden Hour" value={metrics?.goldenHour || '--:--'} />
            <MetricCard label="Blue Ticks" value={String(metrics?.views || 0)} />
            <MetricCard label="Link Clicks" value={String(metrics?.linkClicks || 0)} />
          </div>
        </div>

        <aside className="glass-panel p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/55">Bot State</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מרכז שליטה בזמן אמת</h2>
            </div>
            <span className={`status-pill ${workspaceData?.botStatus?.isReady ? 'status-live' : 'status-idle'}`}>
              {workspaceData?.botStatus?.connectionStatus || 'Disconnected'}
            </span>
          </div>

          <dl className="mt-7 space-y-4 text-sm text-white/75">
            <StatusRow label="WhatsApp State" value={workspaceData?.botStatus?.rawWhatsappState || '-'} />
            <StatusRow label="Session Mode" value={workspaceData?.botStatus?.sessionMode || '-'} />
            <StatusRow label="Directory" value={`${directoryState.groups} groups / ${directoryState.contacts} contacts`} />
            <StatusRow label="Workspace" value={workspace?.name || '-'} />
            <StatusRow label="Subscription" value={workspace?.subscription_tier || '-'} />
            <StatusRow label="Last Error" value={workspaceData?.botStatus?.lastError || 'ללא'} />
          </dl>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="glass-panel p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/55">Transfer Rule Wizard</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">4-Tab Wizard</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {WIZARD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeTab === tab.id ? 'bg-white text-slate-950' : 'bg-white/8 text-white/78'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            {activeTab === 'goals' && (
              <div className="space-y-6">
                <SectionTitle
                  title="Targets"
                  description="גרור לשינוי סדר השליחה בין WhatsApp, סטטוס קבוצתי, ערוצים, Telegram ו-X."
                />
                <div className="grid gap-3">
                  {targetOrder.map((item, index) => (
                    <div
                      key={item}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', String(index));
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const originIndex = Number(event.dataTransfer.getData('text/plain'));
                        if (Number.isNaN(originIndex) || originIndex === index) {
                          return;
                        }

                        const nextOrder = [...targetOrder];
                        const [moved] = nextOrder.splice(originIndex, 1);
                        nextOrder.splice(index, 0, moved);
                        setTargetOrder(nextOrder);
                      }}
                      className="glass-item flex items-center justify-between gap-4 rounded-3xl px-5 py-4"
                    >
                      <div>
                        <p className="font-medium text-white">{item}</p>
                        <p className="text-sm text-white/58">Drag & Drop distribution priority</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/35">0{index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'trigger' && (
              <div className="space-y-6">
                <SectionTitle
                  title="Trigger"
                  description="בחירת מקור ההאזנה והיעדים שישמשו להפצה ב-WhatsApp ובסטטוס קבוצתי."
                />
                <label className="space-y-3">
                  <span className="text-sm text-white/70">Source Group</span>
                  <select
                    value={config.TRIGGER_GROUP_ID}
                    onChange={(event) => setConfig((current) => ({ ...current, TRIGGER_GROUP_ID: event.target.value }))}
                    className="input-shell"
                  >
                    <option value="">בחר קבוצת טריגר</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-3">
                  <span className="text-sm text-white/70">Target Groups</span>
                  <div className="grid gap-3 md:grid-cols-2">
                    {groups.map((group) => {
                      const checked = config.TARGET_GROUP_IDS.includes(group.id);

                      return (
                        <label key={group.id} className="glass-item flex gap-3 rounded-3xl px-4 py-4 text-white/85">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setConfig((current) => ({
                                ...current,
                                TARGET_GROUP_IDS: checked
                                  ? current.TARGET_GROUP_IDS.filter((item) => item !== group.id)
                                  : [...current.TARGET_GROUP_IDS, group.id]
                              }));
                            }}
                            className="mt-1 h-4 w-4 accent-cyan-300"
                          />
                          <span>
                            <span className="block font-medium">{group.name}</span>
                            <span className="text-xs text-white/45">{group.id}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'authorized' && (
              <div className="space-y-6">
                <SectionTitle
                  title="Authorized Senders"
                  description="Primary Admin, Free Sender ו-Global Deleter דרך רשימת אנשי הקשר הזמינים ב-Baileys."
                />
                <div className="grid gap-3 md:grid-cols-2">
                  {contacts.map((contact) => {
                    const checked = config.AUTHORIZED_NUMBERS.includes(contact.id);

                    return (
                      <label key={contact.id} className="glass-item flex gap-3 rounded-3xl px-4 py-4 text-white/85">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setConfig((current) => ({
                              ...current,
                              AUTHORIZED_NUMBERS: checked
                                ? current.AUTHORIZED_NUMBERS.filter((item) => item !== contact.id)
                                : [...current.AUTHORIZED_NUMBERS, contact.id]
                            }));
                          }}
                          className="mt-1 h-4 w-4 accent-cyan-300"
                        />
                        <span>
                          <span className="block font-medium">{contact.name}</span>
                          <span className="text-xs text-white/45">{contact.id}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="glass-item rounded-3xl p-5">
                  <h3 className="text-lg font-medium text-white">Approval Queue</h3>
                  <div className="mt-4 space-y-3">
                    {dashboard?.approvalQueue?.length ? (
                      dashboard.approvalQueue.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white/6 px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{item.name}</p>
                            <p className="text-sm text-white/45">{item.email}</p>
                          </div>
                          <Link href="/admin" className="text-sm text-cyan-200">
                            Admin Mode
                          </Link>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white/55">אין כרגע משתמשים שממתינים לאישור.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <SectionTitle
                  title="Settings"
                  description="Anti-Ban jitter, Shabbat Keeper, Group Status, clean send ו-PRO feature locks."
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="glass-item rounded-3xl p-5">
                    <span className="block text-sm text-white/60">Anti-Ban Mode</span>
                    <select className="input-shell mt-3" defaultValue={workspace?.anti_ban_mode || 'medium'}>
                      {dashboard?.antiBanModes?.map((mode) => (
                        <option key={mode.id} value={mode.id}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="glass-item rounded-3xl p-5">
                    <span className="block text-sm text-white/60">Group Status</span>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <span className="text-white">Post to Group Status ring</span>
                      <input
                        type="checkbox"
                        checked={config.POST_TO_STATUS}
                        onChange={(event) => setConfig((current) => ({ ...current, POST_TO_STATUS: event.target.checked }))}
                        className="h-5 w-5 accent-cyan-300"
                      />
                    </div>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FeatureLockCard
                    title="Shabbat Keeper"
                    description={`סנכרון עצירת תורים לפי ${dashboard?.shabbatWindow || 'Jerusalem / Petah Tikva'}.`}
                    enabled={Boolean(workspace?.shabbat_blocker)}
                    upgradeCta={upgradeCta}
                  />
                  <FeatureLockCard
                    title="Clean Send"
                    description="זיהוי תווי # והפחתת preview לפני שליחה."
                    enabled
                    upgradeCta={upgradeCta}
                  />
                  {dashboard?.featureLocks?.map((item) => (
                    <FeatureLockCard
                      key={item.key}
                      title={item.label}
                      description="פיצ'ר רב-ערוצי ברמת PRO."
                      enabled={!item.locked}
                      upgradeCta={upgradeCta}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {message ? (
            <div className="mt-6 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
              {message}
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="glass-panel p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-white/55">Affiliate</p>
            <h3 className="mt-2 text-xl font-semibold text-white">חבר מביא חבר</h3>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              {dashboard?.affiliates?.map((affiliate) => (
                <div key={affiliate.id} className="rounded-2xl bg-white/6 px-4 py-4">
                  <p className="font-medium text-white">{affiliate.referral_code}</p>
                  <p>מצטרפים: {affiliate.referred_count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-white/55">Invoices</p>
            <h3 className="mt-2 text-xl font-semibold text-white">ניהול חשבוניות</h3>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              {dashboard?.invoices?.map((invoice) => (
                <div key={invoice.id} className="rounded-2xl bg-white/6 px-4 py-4">
                  <p className="font-medium text-white">{invoice.file_name}</p>
                  <p>{invoice.customer_name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-white/55">Admin Mode</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Super Admin</h3>
            <p className="mt-3 text-sm leading-7 text-white/70">
              שלמה יכול לפתוח כל חשבון לקוח, לאשר הרשמות, לבצע Impersonation ולעקוב אחרי שימוש, חשבוניות ולידים.
            </p>
            <Link href="/admin" className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
              פתח Admin Mode
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="glass-item rounded-[30px] p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-white/45">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4 last:border-b-0 last:pb-0">
      <dt className="text-white/42">{label}</dt>
      <dd className="max-w-[12rem] text-left text-white">{value}</dd>
    </div>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-white/58">{description}</p>
    </div>
  );
}

function FeatureLockCard({ title, description, enabled, upgradeCta }) {
  return (
    <div className={`rounded-3xl border border-white/10 p-5 ${enabled ? 'bg-white/8' : 'bg-white/5 backdrop-blur-2xl'}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-lg font-medium text-white">{title}</h4>
        <span className="text-white/65">{enabled ? 'Active' : '🔒 Locked'}</span>
      </div>
      <p className={`mt-3 text-sm leading-7 ${enabled ? 'text-white/62' : 'blur-[0.6px] text-white/45'}`}>{description}</p>
      {!enabled ? (
        <a
          href="https://wa.me/972542466340?text=%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%A9%D7%93%D7%A8%D7%92%20%D7%9C-PRO"
          className="mt-4 inline-flex text-sm text-cyan-200"
        >
          {upgradeCta}
        </a>
      ) : null}
    </div>
  );
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}
