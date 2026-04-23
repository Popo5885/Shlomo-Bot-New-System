import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="space-y-8">
      <section className="glass-panel p-10 md:p-14">
        <div className="grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/60">
              Multi-Tenant Automation
            </span>
            <h2 className="max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">
              פלטפורמה יוקרתית לניהול הפצה חכמה ב-WhatsApp, Telegram, X, קשרי לקוחות וחשבוניות.
            </h2>
            <p className="max-w-3xl text-base leading-8 text-white/72">
              המערכת משלבת Group Status דרך Baileys, תורי Anti-Ban, Golden Hour AI, מודול אישורים, Paywall ידני,
              ניהול חשבוניות, Contact Saver, אדמין־על ושליטה מלאה בעברית RTL.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950">
                פתח Dashboard
              </Link>
              <Link href="/auth/signin" className="glass-button px-6 py-3 text-sm text-white/85">
                כניסה והרשמה
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['WhatsApp Engine', 'Baileys + Group Status + WA Channels + Personal Status'],
              ['Approval Flow', 'Buttons for Approve / Schedule / Edit / Cancel'],
              ['Analytics', 'Blue ticks, Golden Hour AI and shlomo.link tracking'],
              ['Admin Mode', 'Workspace impersonation, VIP approval and feature toggles']
            ].map(([title, description]) => (
              <div key={title} className="glass-item rounded-[30px] p-5">
                <p className="text-lg font-medium text-white">{title}</p>
                <p className="mt-3 text-sm leading-7 text-white/62">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['תנאי שימוש', '/legal/terms'],
          ['מדיניות פרטיות', '/legal/privacy'],
          ['הצהרת נגישות', '/legal/accessibility']
        ].map(([label, href]) => (
          <Link key={href} href={href} className="glass-panel p-6 text-white transition hover:bg-white/10">
            <p className="text-lg font-medium">{label}</p>
            <p className="mt-2 text-sm text-white/58">מסמכי הציות מוצגים בעברית מלאה ובהתאמה לשירות SaaS רב-דיירים.</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
