// This section isn't a feature of the app - it's a personal dedication, kept
// in Hebrew regardless of the app's own language setting since it's Eden's
// story, not a UI string meant to be translated.
export default function MemorialPanel() {
  return (
    <div dir="rtl" className="mt-4 rounded-lg border border-rose-900/40 bg-neutral-900/50 p-4 sm:p-6">
      <h2 className="text-center text-xl font-bold text-rose-300">לזכרה של עדן</h2>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 text-justify text-lg leading-7 text-neutral-300">
          <p>
            עדן הירש הייתה אישה מרשימה ומצחיקה, מלאת חיים ואהבה. עדן גדלה והתחנכה ברמת גן, וגרה תקופה קצרה בנתניה. עדן
            תמיד אהבה ליצור – היא עיצבה תכשיטים והתעניינה בחרוזים, באפוקסי, בציור, פיסול וקרמיקה. היא הייתה מכינה
            מתנות רבות להרבה מהאנשים שאהבה.
          </p>
          <p>
            בצבא, עדן שירתה בתור מש&quot;קית ת&quot;ש אשר הייתה אחראית על דירות של חיילות בודדים מטעם האגודה למען החייל,
            ועסקה בתמיכה בחיילים בודדים. עדן למדה עבודה סוציאלית באוניברסיטת תל אביב ובחרה במקצוע שהיה נטוע
            עמוק בערכים שלה – חמלה, רצון לקדם אוכלוסיות מוחלשות והאמונה באנשים לבנות מחדש את חייהם. גם עדן בעצמה גדלה
            בבית לא פשוט ועברה גירושים קשים של הוריה, באופן שחינך אותה להיות עצמאית ופעלתנית, ולא לקבל את נסיבות חייה
            כפי שהם. כך היא עבדה עם ילדים במועדוניות רווחה, במסגרות עם קשישים, חולים, פוסט-טראומטים והלומי קרב. מקום
            עבודתה האחרון היה מחלקת הרווחה בגבעתיים, שם תמכה באמהות חד הוריות, הומלסים ומשפחות קשות יום.
          </p>
        </div>
        <div className="flex shrink-0 flex-row gap-3 sm:w-44 sm:flex-col">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eden/photo1.jpg" alt="" className="w-1/2 rounded-lg object-cover sm:w-full" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eden/photo2.jpg" alt="" className="w-1/2 rounded-lg object-cover sm:w-full" />
        </div>
      </div>

      <p className="text-justify text-lg leading-7 text-neutral-300">
        עדן חלתה בסרטן קיבה גרורתי בשנת 2024, ונפטרה לאור סיבוכים מהמחלה באפריל 2026, כשהיא בת 28 וחצי. גם בתוך
        ההתמודדות עם המחלה, עדן התעקשה להרים את הראש, לארח משפחה וחברים, לעשות ספורט, להתחתן, להקים עסק לתכשיטים
        ולעשות מכירות רבות, להיות פעילה, אישה אוהבת ומכילה ולא לוותר.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 text-justify text-lg leading-7 text-neutral-300">
          <p>
            אני (ארנון) זכיתי לאהוב אותה, להיות בעלה ולשמוח על הזמן הטוב שבילינו יחד. התחתנו באפריל 2025, ואני מצרף
            תמונה של שנינו. עדן תמיד תלווה אותי, והאפליקציה הזו מוקדשת לזכרה.
          </p>
        </div>
        <div className="shrink-0 sm:w-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eden/photo3.jpg" alt="" className="w-32 rounded-lg object-cover sm:w-full" />
        </div>
      </div>

      <p className="text-center text-lg font-medium text-rose-200">יהי זכרה ברוך, נמשיך ללכת בדרכה.</p>
    </div>
  );
}
