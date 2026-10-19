import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { GlassMenu } from "./GlassMenu";
import { embeddedProjects } from "../lib/embedded-projects";

type NavItem = {
  href: string;
  label: string;
};

const navItems = [
  { href: "/destinations", label: "Destinations" },
  { href: "/journals", label: "Journals" },
  { href: "/capture", label: "Capture" },
  { href: "/jewelroam", label: "JewelRoam" },
  ...Object.values(embeddedProjects).map(({ path, label }) => ({ href: path, label })),
] satisfies NavItem[];

export function GlassNav() {
  return (
    <nav aria-label="页面导航">
      <GlassMenu
        label="打开页面导航"
        closeLabel="关闭页面导航"
        tooltip="页面导航"
        variant="primary"
        menuId="primary-navigation"
        icon={(open) => open
          ? <X size={18} strokeWidth={1.7} aria-hidden="true" />
          : <Menu size={18} strokeWidth={1.7} aria-hidden="true" />}
      >
        {(open, close) => (
          <>
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={close}
                className={({ isActive }) => `glass-menu__item${isActive ? " is-active" : ""}`}
                tabIndex={open ? 0 : -1}
              >
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </GlassMenu>
    </nav>
  );
}
