import './globals.css';

export const metadata = {
  title: 'Shlomo Popovitz - Business Automation Solutions',
  description: 'Premium omni-channel SaaS platform for WhatsApp, Telegram, X, invoices, analytics and approvals.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="aurora-background" />
        <div className="mx-auto min-h-screen max-w-[1500px] px-5 py-6 md:px-8">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Omni Channel SaaS</p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                Shlomo Popovitz - Business Automation Solutions
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
              <a href="https://wa.me/972542466340" className="glass-button px-4 py-2">
                WhatsApp: 054-246-6340
              </a>
              <a href="mailto:aknvpupuch@gmail.com" className="glass-button px-4 py-2">
                aknvpupuch@gmail.com
              </a>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
