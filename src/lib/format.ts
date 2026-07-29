export function formatThaiDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

export function relativeThaiTime(value?: string | null) {
  if (!value) return "-";
  const diffMs = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("th-TH", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
    ["second", 1000]
  ];
  const [unit, ms] = units.find(([, unitMs]) => abs >= unitMs) ?? ["second", 1000];
  return rtf.format(Math.round(diffMs / ms), unit);
}

export function initials(nameOrEmail: string) {
  const label = nameOrEmail.trim();
  if (!label) return "?";
  const parts = label.includes("@") ? [label[0]] : label.split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
