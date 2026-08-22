import { NavLink } from "react-router-dom";
import { GlassMenu } from "./GlassMenu";

const navItems = [
  ["/destinations", "Destinations"],
  ["/journals", "Journals"],
  ["/editor", "Capture"],
  ["/jewelroam", "JewelRoam"],
] as const;

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
            {navItems.map(([href, label]) => (
              <NavLink
                key={href}
                to={href}
                onClick={close}
                className={({ isActive }) => `glass-menu__item${isActive ? " is-active" : ""}`}
                tabIndex={open ? 0 : -1}
              >
                {label}
              </NavLink>
            ))}
          </>
        )}
      </GlassMenu>
    </nav>
  );
}
