import { notFound } from 'next/navigation';

const legalPages = {
  terms: {
    title: 'תנאי שימוש',
    body: [
      'הפלטפורמה מספקת תשתית טכנולוגית בלבד להפצה וניהול אוטומציה.',
      'האחריות המלאה לעמידה בחוק הספאם, קבלת הסכמות, עמידה ברגולציה ושמירה על זכויות הנמענים חלה על הלקוח בלבד.',
      'שלמה פופוביץ - פתרונות אוטומציה לעסקים אינו מהווה ייעוץ משפטי ואינו נושא באחריות על תוכן ההודעות או חוקיותן.',
      'המערכת רשאית להגביל פיצ׳רים, להקפיא תורים או להשבית משתמשים במקרה של הפרת תנאי שימוש או סיכון מערכתי.'
    ]
  },
  privacy: {
    title: 'מדיניות פרטיות',
    body: [
      'המערכת אוספת מידע תפעולי לצורך התחברות, אימות, תיעוד שימוש, אנליטיקה, תמיכה ושיפור השירות.',
      'נתוני לקוחות, קבוצות, אנשי קשר וסטטוסים נשמרים בהפרדה לפי workspace_id ומיועדים לשימוש הלקוח בלבד.',
      'המערכת עשויה להשתמש בספקי צד שלישי כגון Google, WhatsApp, Telegram, Redis, PostgreSQL ו-email infrastructure.',
      'בקשות לעיון, תיקון או מחיקה יטופלו דרך פרטי הקשר הרשמיים: 054-246-6340 | aknvpupuch@gmail.com.'
    ]
  },
  accessibility: {
    title: 'הצהרת נגישות',
    body: [
      'הממשק נבנה עם תמיכה ב-RTL, היררכיה טיפוגרפית ברורה, ניגודיות גבוהה, ניווט מקלדת ורכיבים תגובתיים.',
      'אם נתקלתם בפער נגישות, ניתן לפנות ישירות לשלמה פופוביץ ב-WhatsApp 054-246-6340 או במייל aknvpupuch@gmail.com.',
      'אנחנו מחויבים לשיפור מתמיד של הנגישות ולהתאמת המערכת למגוון צרכים ומכשירים.'
    ]
  }
};

export default async function LegalPage({ params }) {
  const page = legalPages[params.slug];

  if (!page) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl">
      <section className="glass-panel p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.35em] text-white/55">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">{page.title}</h1>
        <div className="mt-6 space-y-4 text-base leading-8 text-white/72">
          {page.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </main>
  );
}
