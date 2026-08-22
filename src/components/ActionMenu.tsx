import type { ReactNode } from "react";
import { GlassMenu } from "./GlassMenu";

export type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
};

export function ActionMenu({ label, icon, items }: { label: string; icon?: ReactNode; items: ActionMenuItem[] }) {
  return (
    <GlassMenu label={label} icon={icon ?? label} menuRole="menu">
      {(open, close) => items.map((item) => (
        <button
          type="button"
          key={item.label}
          className="glass-menu__item"
          role="menuitem"
          disabled={item.disabled || !open}
          tabIndex={open ? 0 : -1}
          onClick={() => {
            close();
            void item.onSelect();
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </GlassMenu>
  );
}
