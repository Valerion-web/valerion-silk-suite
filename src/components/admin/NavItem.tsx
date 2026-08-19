import React from "react";
import { NavLink } from "react-router-dom";

type NavItemProps = {
  to: string;
  label: string;
  Icon?: React.ComponentType<any>;
};

export default function NavItem({ to, label, Icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-4 px-4 py-3 rounded-full transition-colors duration-250 ${
          isActive ? "bg-[#0f1720] text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-[#D4AF37]">
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </div>
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </NavLink>
  );
}
