import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { del, get, set } from "idb-keyval";
import { storedDraftSchema, type StoredDraft } from "../lib/content-schema";

const DRAFT_KEY = "jewelroam:article-draft";

export type DraftPersistenceState = "loading" | "ready" | "saving" | "saved" | "error";

type DraftPersistenceOptions = {
  editor: Editor | null;
  revision: number;
  createDraft: (updatedAt: string) => StoredDraft;
  applyDraft: (draft: StoredDraft) => void;
};

export function useArticleDraftPersistence({
  editor,
  revision,
  createDraft,
  applyDraft,
}: DraftPersistenceOptions) {
  const [hydrated, setHydrated] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [state, setState] = useState<DraftPersistenceState>("loading");
  const revisionRef = useRef(revision);
  const savedRevision = useRef(0);
  const generationRef = useRef(0);
  const writeChain = useRef(Promise.resolve());
  const mounted = useRef(true);

  revisionRef.current = revision;

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  useEffect(() => {
    if (!editor) return;
    let active = true;
    const generation = generationRef.current;
    setHydrated(false);
    setState("loading");

    void (async () => {
      try {
        const stored = await get<unknown>(DRAFT_KEY);
        const parsed = storedDraftSchema.safeParse(stored);
        if (!active || generation !== generationRef.current) return;

        if (parsed.success) {
          applyDraft(parsed.data);
          setUpdatedAt(parsed.data.updatedAt);
          savedRevision.current = revisionRef.current;
          setState("saved");
        } else {
          setState("ready");
        }
      } catch {
        if (active && generation === generationRef.current) setState("error");
      } finally {
        if (active && generation === generationRef.current) setHydrated(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyDraft, editor]);

  useEffect(() => {
    if (!editor || !hydrated || revision === savedRevision.current) return;
    setState("saving");
    const savingRevision = revision;
    const generation = generationRef.current;

    const timer = window.setTimeout(() => {
      const nextUpdatedAt = new Date().toISOString();
      const draft = createDraft(nextUpdatedAt);

      writeChain.current = writeChain.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== generationRef.current) return;
          await set(DRAFT_KEY, draft);
        })
        .then(() => {
          if (
            !mounted.current
            || generation !== generationRef.current
            || savingRevision !== revisionRef.current
          ) return;
          savedRevision.current = savingRevision;
          setUpdatedAt(nextUpdatedAt);
          setState("saved");
        })
        .catch(() => {
          if (
            mounted.current
            && generation === generationRef.current
            && savingRevision === revisionRef.current
          ) setState("error");
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [createDraft, editor, hydrated, revision]);

  const clearStoredDraft = useCallback(async () => {
    generationRef.current += 1;
    const generation = generationRef.current;
    savedRevision.current = revisionRef.current;

    writeChain.current = writeChain.current
      .catch(() => undefined)
      .then(() => del(DRAFT_KEY));
    await writeChain.current;

    if (mounted.current && generation === generationRef.current) {
      setHydrated(true);
      setUpdatedAt("");
      setState("ready");
    }
  }, []);

  return {
    clearStoredDraft,
    hydrated,
    setUpdatedAt,
    state,
    updatedAt,
  };
}
