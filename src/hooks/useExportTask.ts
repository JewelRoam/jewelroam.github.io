import { useCallback, useRef, useState } from "react";
import type { ExportProgress } from "../lib/article-export";

type ExportTask =
  | { kind: "idle" }
  | { kind: "running"; progress: ExportProgress }
  | { kind: "error"; message: string };

type ExportAction = (onProgress: (progress: ExportProgress) => void) => Promise<void> | void;

export function useExportTask() {
  const [task, setTask] = useState<ExportTask>({ kind: "idle" });
  const taskRef = useRef<ExportTask>({ kind: "idle" });

  const updateTask = (next: ExportTask) => {
    taskRef.current = next;
    setTask(next);
  };

  const run = useCallback(async (action: ExportAction) => {
    if (taskRef.current.kind === "running") return;
    const onProgress = (progress: ExportProgress) => updateTask({ kind: "running", progress });
    updateTask({ kind: "running", progress: { stage: "validating" } });

    try {
      await action(onProgress);
      updateTask({ kind: "idle" });
    } catch (reason) {
      updateTask({
        kind: "error",
        message: reason instanceof Error ? reason.message : "导出失败，请稍后重试",
      });
    }
  }, []);

  const clearError = useCallback(() => {
    if (taskRef.current.kind !== "error") return;
    updateTask({ kind: "idle" });
  }, []);

  return {
    busy: task.kind === "running",
    clearError,
    error: task.kind === "error" ? task.message : "",
    progress: task.kind === "running" ? task.progress : null,
    run,
  };
}
