// This section isn't a feature of the app - it's a personal dedication, kept
// in Hebrew regardless of the app's own language setting since it's Eden's
// story, not a UI string meant to be translated.
//
// All three photos float as a single stacked column, and every paragraph
// after it flows in plain, uninterrupted document order (no per-paragraph
// float groups, no clear between them). Splitting the photos into separate
// floats paired with specific paragraphs kept reproducing the same bug:
// each clear-left made its block wait for the previous float to fully end
// before starting, and a paragraph shorter than its paired photo turned
// that wait into a dead gap. With one float and continuous flow, a
// paragraph wraps around whatever photo height remains and resumes full
// width once past it - there's no clear point left for a gap to hide behind.
//
// The closing line is the one deliberate exception: it's meant to land at
// the same height as the bottom of the last (wedding) photo, so it does
// clear the float on purpose rather than flowing immediately after the
// paragraph before it.
const MEMORIAL_FONT =
  '"Segoe UI Semilight", "Segoe UI", Arial, sans-serif';

export default function MemorialPanel() {
  return (
    <div
      dir="rtl"
      style={{ fontFamily: MEMORIAL_FONT }}
      className="mt-4 rounded-lg border border-rose-900/40 bg-neutral-900/50 p-4 sm:p-6"
    >
      <h2 className="text-center text-xl font-bold text-rose-300">לזכרה של עדן</h2>

      <div className="mt-6">
        <div className="float-left mr-4 mb-3 w-40 space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eden/photo1.jpg" alt="" className="w-full rounded-lg object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eden/photo2.jpg" alt="" className="w-full rounded-lg object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eden/photo3.jpg" alt="" className="w-full rounded-lg object-cover" />
        </div>
        <p className="text-justify text-lg leading-7 text-neutral-300">
          עדן הירש הייתה אישה מרשימה ומצחיקה, מלאת חיים ואהבה. עדן גדלה והתחנכה ברמת גן, וגרה תקופה קצרה בנתניה. עדן
          תמיד אהבה ליצור – היא עיצבה תכשיטים והתעניינה בחרוזים, באפוקסי, בציור, פיסול וקרמיקה. היא הייתה מכינה מתנות
          רבות להרבה מהאנשים שאהבה.
        </p>
        <p className="text-justify text-lg leading-7 text-neutral-300">
          בצבא, עדן שירתה בתור מש&quot;קית ת&quot;ש אשר הייתה אחראית על דירות של חיילות בודדים מטעם האגודה למען החייל,
          ועסקה בתמיכה בחיילים בודדים. עדן למדה עבודה סוציאלית באוניברסיטת תל אביב ובחרה במקצוע שהיה נטוע עמוק בערכים
          שלה – חמלה, רצון לקדם אוכלוסיות מוחלשות והאמונה באנשים לבנות מחדש את חייהם. גם עדן בעצמה גדלה בבית לא פשוט
          ועברה גירושים קשים של הוריה, באופן שחינך אותה להיות עצמאית ופעלתנית, ולא לקבל את נסיבות חייה כפי שהם. כך היא
          עבדה עם ילדים במועדוניות רווחה, במסגרות עם קשישים, חולים, פוסט-טראומטים והלומי קרב. מקום עבודתה האחרון היה
          מחלקת הרווחה בגבעתיים, שם תמכה באמהות חד הוריות, הומלסים ומשפחות קשות יום.
        </p>
        <p className="text-justify text-lg leading-7 text-neutral-300">
          עדן חלתה בסרטן קיבה גרורתי בשנת 2024, ונפטרה לאור סיבוכים מהמחלה באפריל 2026, כשהיא בת 28 וחצי. גם בתוך
          ההתמודדות עם המחלה, עדן התעקשה להרים את הראש, לארח משפחה וחברים, לעשות ספורט, להתחתן, להקים עסק לתכשיטים
          ולעשות מכירות רבות, להיות פעילה, אישה אוהבת ומכילה ולא לוותר.
        </p>
        <p className="text-justify text-lg leading-7 text-neutral-300">
          אני (ארנון) זכיתי לאהוב אותה, להיות בעלה ולשמוח על הזמן הטוב שבילינו יחד. התחתנו באפריל 2025, ואני מצרף
          תמונה של שנינו. עדן תמיד תלווה אותי, והאפליקציה הזו מוקדשת לזכרה.
        </p>
        <p className="clear-left text-center text-lg font-medium text-rose-200">
          יהי זכרה ברוך, נמשיך ללכת בדרכה.
        </p>
      </div>
    </div>
  );
}
