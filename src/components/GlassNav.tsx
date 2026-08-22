import { NavLink } from "react-router-dom";
import { GlassMenu } from "./GlassMenu";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const navItems = [
  { href: "/destinations", label: "Destinations" },
  { href: "/journals", label: "Journals" },
  { href: "/capture", label: "Capture" },
  { href: "/jewelroam", label: "JewelRoam" },
  {
    href: "https://jewelroam.github.io/ZaiChang/",
    label: "ZaiChang",
    external: true,
  },
] satisfies NavItem[];

export function GlassNav() {
  return (
    <nav aria-label="Primary navigation">
      <GlassMenu
        label="Open navigation"
        closeLabel="Close navigation"
        variant="primary"
        menuId="primary-navigation"
        icon={
          <span className="glass-menu__icon" aria-hidden="true">
            <span />
            <span />
          </span>
        }
      >
        {(open, close) => (
          <>
            {navItems.map((item) =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="glass-menu__item"
                  tabIndex={open ? 0 : -1}
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={close}
                  className={({ isActive }) => `glass-menu__item${isActive ? " is-active" : ""}`}
                  tabIndex={open ? 0 : -1}
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </>
        )}
      </GlassMenu>
    </nav>
  );
}
