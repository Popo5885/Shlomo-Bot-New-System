'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MagneticButton } from './magnetic-button';

export function AdminClient() {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    const payload = await fetchJson('/api/admin/workspaces');
    setWorkspaces(payload.workspaces || []);

    if (!selectedWorkspace && payload.workspaces?.length) {
      await inspectWorkspace(payload.workspaces[0].id);
    }
  }

  async function inspectWorkspace(workspaceId) {
    const payload = await fetchJson(`/api/admin/workspaces/${workspaceId}`);
    setSelectedWorkspace(payload.workspace);
  }

  async function approveUser(userId) {
    const payload = await fetchJson('/api/admin/approve-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });

    setMessage(`המשתמש ${payload.approval.user.name} אושר בהצלחה.`);
    await loadWorkspaces();
    await inspectWorkspace(payload.approval.workspace.id);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <aside className="glass-panel p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-white/55">Super Admin</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Admin Mode</h1>
        <p className="mt-4 text-sm leading-7 text-white/68">
          שלמה יכול לעבור בין לקוחות, לזהות חשבונות בהמתנה, להפעיל פיצ׳רים ולבצע בדיקה של כל workspace בלחיצה אחת.
        </p>

        <div className="mt-6 space-y-3">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => inspectWorkspace(workspace.id)}
              className={`w-full rounded-3xl px-4 py-4 text-right transition ${
                selectedWorkspace?.workspace?.id === workspace.id ? 'bg-white text-slate-950' : 'bg-white/7 text-white/85'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{workspace.name}</span>
                <span className="text-xs uppercase tracking-[0.3em]">{workspace.status}</span>
              </div>
              <p className="mt-2 text-xs opacity-70">
                {workspace.subscription_tier} | Users {workspace.user_count} | Pending {workspace.pending_users}
              </p>
            </button>
          ))}
        </div>

        <Link href="/dashboard" className="mt-6 inline-flex text-sm text-cyan-200">
          חזרה ללוח ההפצה
        </Link>
      </aside>

      <section className="glass-panel p-6">
        {selectedWorkspace ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/55">Workspace Inspection</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedWorkspace.workspace.name}</h2>
              </div>
              <span className={`status-pill ${selectedWorkspace.workspace.status === 'active' ? 'status-live' : 'status-idle'}`}>
                {selectedWorkspace.workspace.status}
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <AdminMetric label="Transfers" value={String(selectedWorkspace.transfers.length)} />
              <AdminMetric label="Invoices" value={String(selectedWorkspace.invoices.length)} />
              <AdminMetric label="Users" value={String(selectedWorkspace.users.length)} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-white">Pending Users</h3>
                {selectedWorkspace.users.filter((user) => user.status === 'pending_approval').length ? (
                  selectedWorkspace.users
                    .filter((user) => user.status === 'pending_approval')
                    .map((user) => (
                      <div key={user.id} className="rounded-3xl bg-white/7 p-4">
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="mt-1 text-sm text-white/52">{user.email}</p>
                        <MagneticButton
                          onClick={() => approveUser(user.id)}
                          className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                        >
                          אשר והפעל
                        </MagneticButton>
                      </div>
                    ))
                ) : (
                  <div className="rounded-3xl bg-white/7 p-4 text-sm text-white/60">אין משתמשים ממתינים.</div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-white">Feature Toggles</h3>
                {[
                  ['Telegram', selectedWorkspace.workspace.has_telegram],
                  ['Twitter', selectedWorkspace.workspace.has_twitter],
                  ['Group Status', selectedWorkspace.workspace.has_group_status],
                  ['WA Channels', selectedWorkspace.workspace.has_wa_channels],
                  ['Scheduling', selectedWorkspace.workspace.has_scheduling]
                ].map(([label, enabled]) => (
                  <div key={label} className="flex items-center justify-between rounded-3xl bg-white/7 px-4 py-4 text-white">
                    <span>{label}</span>
                    <span>{enabled ? 'Enabled' : 'Locked'}</span>
                  </div>
                ))}
              </div>
            </div>

            {message ? (
              <div className="mt-6 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                {message}
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-sm text-white/70">בחר workspace כדי לצפות בפרטי החשבון.</div>
        )}
      </section>
    </div>
  );
}

function AdminMetric({ label, value }) {
  return (
    <div className="rounded-3xl bg-white/7 p-5">
      <p className="text-xs uppercase tracking-[0.35em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
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
