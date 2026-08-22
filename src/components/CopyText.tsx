import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type CopyTextProps = {
  value: string;
  children?: ReactNode;
  label?: string;
};

async function copyValue(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

export function CopyText({ value, children = value, label = value }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyValue(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className="copy-text"
      onClick={() => void handleCopy()}
      aria-label={`复制${label}`}
      title={copied ? "已复制" : `复制${label}`}
    >
      {children}
      <span className="copy-text__icon" aria-hidden="true">
        {copied ? <Check size={12} strokeWidth={1.8} /> : <Copy size={12} strokeWidth={1.8} />}
      </span>
    </button>
  );
}
