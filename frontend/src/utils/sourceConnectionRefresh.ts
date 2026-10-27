import type { SourceConnectionStatus } from "../services/dataSourceService.ts";

export async function refreshSourceConnections(
  ids: string[],
  check: (id: string) => Promise<SourceConnectionStatus>,
  publish: (id: string, result: SourceConnectionStatus | null) => void,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (isCurrent() && next < ids.length) {
      const id = ids[next++]!;
      let result: SourceConnectionStatus | null = null;
      try { result = await check(id); } catch { /* Not verified; never treat an old success as live. */ }
      if (isCurrent()) publish(id, result);
    }
  };
  await Promise.all([worker(), worker()]);
}
