type LineFlexMessageInput = {
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  appBaseUrl: string;
  eventType: string;
};

type LineComponent = Record<string, unknown>;

const EVENT_STYLES: Record<string, { accent: string; label: string }> = {
  TASK_SHARED: { accent: "#0A84FF", label: "แชร์ TASK" },
  TASK_UPDATED_MANUAL: { accent: "#0A84FF", label: "อัปเดต TASK" },
  TASK_EDITED: { accent: "#0A84FF", label: "แก้ไข TASK" },
  CHECKLIST_CHECKED: { accent: "#30B566", label: "CHECKLIST" },
  CHECKLIST_UNCHECKED: { accent: "#FF9F0A", label: "CHECKLIST" },
  TASK_COMPLETED: { accent: "#30B566", label: "เสร็จสิ้น" },
  TASK_REOPENED: { accent: "#0A84FF", label: "เปิดใหม่" },
  TASK_ARCHIVED: { accent: "#6B7280", label: "ARCHIVE" },
  TASK_RESTORED: { accent: "#0A84FF", label: "RESTORE" },
  TASK_DUE_SOON: { accent: "#FF9F0A", label: "ใกล้ครบกำหนด" },
  TASK_OVERDUE: { accent: "#E5484D", label: "เกินกำหนด" }
};

function text(value: unknown, fallback = "-") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function progressValue(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : 0;
}

function resolveTaskUrl(taskUrl: unknown, appBaseUrl: string) {
  try {
    const base = new URL(appBaseUrl);
    if (!['http:', 'https:'].includes(base.protocol)) return null;
    const resolved = new URL(text(taskUrl, "/"), base);
    if (!['http:', 'https:'].includes(resolved.protocol) || resolved.origin !== base.origin) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function detailRow(label: string, value: unknown): LineComponent {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#8E8E93", size: "xs", flex: 2 },
      { type: "text", text: truncate(text(value), 120), color: "#1D1D1F", size: "sm", flex: 5, wrap: true }
    ]
  };
}

function progressBar(progress: number, accent: string): LineComponent {
  const fill: LineComponent = progress > 0
    ? {
        type: "box",
        layout: "vertical",
        width: `${progress}%`,
        height: "8px",
        backgroundColor: accent,
        cornerRadius: "4px",
        contents: [{ type: "filler" }]
      }
    : { type: "filler" };

  return {
    type: "box",
    layout: "vertical",
    height: "8px",
    backgroundColor: "#E5E7EB",
    cornerRadius: "4px",
    contents: [fill]
  };
}

export function buildLineFlexMessage({ subject, body, payload, appBaseUrl, eventType }: LineFlexMessageInput) {
  const style = EVENT_STYLES[eventType] ?? { accent: "#0A84FF", label: "การแจ้งเตือน" };
  const progress = progressValue(payload.progress);
  const taskUrl = resolveTaskUrl(payload.task_url, appBaseUrl);
  const bodyContents: LineComponent[] = [
    {
      type: "text",
      text: truncate(text(subject, "การแจ้งเตือน"), 200),
      weight: "bold",
      size: "xl",
      color: "#1D1D1F",
      wrap: true
    },
    {
      type: "text",
      text: truncate(text(payload.task_name, "Task"), 300),
      size: "md",
      color: "#3A3A3C",
      weight: "bold",
      wrap: true,
      margin: "md"
    },
    {
      type: "text",
      text: truncate(text(body, "มีการอัปเดต Task"), 1200),
      size: "sm",
      color: "#636366",
      wrap: true,
      margin: "sm"
    },
    { type: "separator", margin: "lg", color: "#E5E5EA" },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: [
        detailRow("หมวดหมู่", payload.category_name),
        detailRow("ผู้ดำเนินการ", payload.actor_name),
        detailRow("กำหนดส่ง", payload.due_at)
      ]
    },
    {
      type: "box",
      layout: "baseline",
      margin: "lg",
      contents: [
        { type: "text", text: "ความคืบหน้า", size: "sm", color: "#636366", flex: 1 },
        { type: "text", text: `${progress}%`, size: "sm", color: style.accent, weight: "bold", align: "end", flex: 0 }
      ]
    },
    { ...progressBar(progress, style.accent), margin: "sm" }
  ];

  return {
    type: "flex",
    altText: truncate(`${text(subject, "การแจ้งเตือน")} - ${text(payload.task_name, "Task")} (${progress}%)`, 400),
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "horizontal",
        backgroundColor: style.accent,
        paddingAll: "18px",
        contents: [
          { type: "text", text: "PLABIN TASK", color: "#FFFFFF", weight: "bold", size: "sm", flex: 1 },
          { type: "text", text: style.label, color: "#FFFFFF", size: "xs", align: "end", flex: 0 }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: bodyContents
      },
      ...(taskUrl
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              paddingAll: "16px",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: style.accent,
                  height: "sm",
                  action: { type: "uri", label: "เปิด", uri: taskUrl }
                }
              ]
            }
          }
        : {})
    }
  };
}
