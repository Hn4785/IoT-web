const vietnamDateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatVietnamDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const parts = Object.fromEntries(
    vietnamDateTime
      .formatToParts(date)
      .map(({ type, value: part }) => [type, part]),
  );

  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}
