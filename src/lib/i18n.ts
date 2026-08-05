export type Lang = "en" | "he";

type Vars = Record<string, string | number>;

const dict = {
  en: {
    tagline:
      "Pick a folder on your computer. Everything happens right here in your browser — nothing is uploaded anywhere.",
    chooseFolder: "Choose a folder to scan",
    scanning: "Scanning…",
    unsupportedTitle: "Clean My Sh*t",
    unsupportedBody:
      "This tool needs a desktop browser that supports picking a folder directly (Chrome or Edge on Windows, Mac, or Linux). It doesn't work in this browser, or on phones/tablets — that's intentional, since scanning a whole folder only makes sense on a computer.",
    errorPrefix: "Something went wrong:",
    walking: "Looking through your files…",
    hashing: "Checking for duplicates…",
    scannedSummary: "Scanned {root} — {files} files, {size} total.",
    tabDuplicates: "Duplicates",
    tabOld: "Old & untouched",
    tabBig: "Big files",
    tabGames: "Unplayed games",
    tabCache: "Cache & temp",
    tabInstallers: "Old installers",
    tabEmpty: "Empty folders",
    tabDevJunk: "Dev build junk",
    emptyOld: "Nothing untouched for a year or more.",
    emptyBig: "No unusually large files (over 100 MB) found.",
    emptyGames: "No game install folders detected.",
    emptyCache: "No cache or temp junk found.",
    emptyInstallers: "No leftover installers found in Downloads.",
    emptyEmptyFolders: "No empty folders found.",
    emptyDevJunk: "No dev build folders (node_modules, dist, etc.) found.",
    dateLastTouched: "Last touched",
    dateLastPlayed: "Last played (approx.)",
    dateDownloaded: "Downloaded",
    dateLastBuilt: "Last built",
    noDuplicates: "No duplicate files found. 🎉",
    duplicateCopies: "{count} copies · {size} each",
    duplicateUnverified:
      "⚠ not fully verified — very large file, matched by size + start/end only",
    duplicateOldest: "Oldest copy — probably the original",
    duplicateCreated: "Created/modified {date}",
    selectionBar: "{count} selected · {size} to free up",
    deleteSelected: "Delete selected",
    confirmTitle: "Delete {count} item(s)?",
    confirmFreedLine: "This will free up {size}.",
    confirmWarning:
      "⚠ This is permanent. Because the browser is deleting these directly, they will not go to the Recycle Bin — there is no undo.",
    confirmCheckbox: "I understand this can't be undone.",
    confirmCancel: "Cancel",
    confirmDeleteBtn: "Delete permanently",
    confirmDeletingBtn: "Deleting…",
    deleteSummaryDone: "Deleted {count} item(s), freed {size}.",
    deleteSummaryBlocked:
      "{count} item(s) couldn't be deleted: Chrome protects this folder from direct deletion (common for Downloads/Desktop/Documents) — delete those in File Explorer, or scan a subfolder instead.",
    deleteSummaryFailed: "{count} item(s) failed (maybe already moved or in use).",
    langToggle: "עברית",
  },
  he: {
    tagline: "בחר/י תיקייה במחשב שלך. הכול קורה כאן בדפדפן — שום דבר לא מועלה לשום מקום.",
    chooseFolder: "בחר/י תיקייה לסריקה",
    scanning: "סורק…",
    unsupportedTitle: "Clean My Sh*t",
    unsupportedBody:
      "הכלי הזה דורש דפדפן שולחני שתומך בבחירת תיקייה ישירות (כרום או אדג' על Windows, Mac או Linux). הוא לא עובד בדפדפן הזה, או בטלפונים/טאבלטים — וזה בכוונה, כי סריקת תיקייה שלמה הגיונית רק במחשב.",
    errorPrefix: "משהו השתבש:",
    walking: "עובר על הקבצים שלך…",
    hashing: "בודק כפילויות…",
    scannedSummary: "נסרק {root} — {files} קבצים, בסך הכול {size}.",
    tabDuplicates: "כפילויות",
    tabOld: "ישנים ולא נגעו בהם",
    tabBig: "קבצים גדולים",
    tabGames: "משחקים לא פעילים",
    tabCache: "קאש וזמניים",
    tabInstallers: "מתקינים ישנים",
    tabEmpty: "תיקיות ריקות",
    tabDevJunk: "קבצי פיתוח מיותרים",
    emptyOld: "אין כלום שלא נגעו בו במשך שנה או יותר.",
    emptyBig: "לא נמצאו קבצים גדולים במיוחד (מעל 100MB).",
    emptyGames: "לא זוהו תיקיות התקנה של משחקים.",
    emptyCache: "לא נמצא קאש או קבצים זמניים.",
    emptyInstallers: "לא נמצאו מתקינים ישנים בתיקיית ההורדות.",
    emptyEmptyFolders: "לא נמצאו תיקיות ריקות.",
    emptyDevJunk: "לא נמצאו תיקיות בנייה של מפתחים (node_modules, dist וכו').",
    dateLastTouched: "נגעו בו לאחרונה",
    dateLastPlayed: "שוחק לאחרונה (משוער)",
    dateDownloaded: "הורד בתאריך",
    dateLastBuilt: "נבנה לאחרונה",
    noDuplicates: "לא נמצאו קבצים כפולים. 🎉",
    duplicateCopies: "{count} עותקים · {size} כל אחד",
    duplicateUnverified:
      "⚠ לא אומת במלואו — קובץ גדול מאוד, הותאם לפי גודל + התחלה/סוף בלבד",
    duplicateOldest: "העותק הישן ביותר — כנראה המקור",
    duplicateCreated: "נוצר/עודכן ב-{date}",
    selectionBar: "{count} נבחרו · {size} יתפנו",
    deleteSelected: "מחק נבחרים",
    confirmTitle: "למחוק {count} פריט/ים?",
    confirmFreedLine: "פעולה זו תפנה {size}.",
    confirmWarning:
      "⚠ זו פעולה סופית. מכיוון שהדפדפן מוחק את הקבצים ישירות, הם לא יעברו לסל המיחזור — אין דרך לבטל.",
    confirmCheckbox: "אני מבין/ה שלא ניתן לבטל את זה.",
    confirmCancel: "ביטול",
    confirmDeleteBtn: "מחק לצמיתות",
    confirmDeletingBtn: "מוחק…",
    deleteSummaryDone: "נמחקו {count} פריט/ים, התפנו {size}.",
    deleteSummaryBlocked:
      "{count} פריט/ים לא ניתן היה למחוק: כרום מגן על התיקייה הזו ממחיקה ישירה (נפוץ ב-Downloads/Desktop/Documents) — מחק/י אותם בסייר הקבצים, או סרוק/י תת-תיקייה במקום.",
    deleteSummaryFailed: "{count} פריט/ים נכשלו (אולי הוזזו או בשימוש כרגע).",
    langToggle: "English",
  },
} as const;

export type TranslationKey = keyof typeof dict.en;

export function translate(lang: Lang, key: TranslationKey, vars?: Vars): string {
  let str: string = dict[lang][key] ?? dict.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
