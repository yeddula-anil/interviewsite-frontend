'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";

const NAV_ITEMS = [
  { href: "/candidate", label: "Dashboard", icon: "🏠" },
  { href: "/candidate/schedule", label: "Schedule", icon: "📅" },
  { href: "/candidate/recordings", label: "Recordings", icon: "🎞️" },
  { href: "/candidate/scores", label: "Reviews & Scores", icon: "⭐" },
  { href: "/candidate/interviewPrep", label: "Interview Kits", icon: "📘" },
];

const NavLabel = ({ href, label, isActive }) => (
  <Link
    href={href}
    className={`
      block w-full h-14 flex items-center px-4 rounded-xl cursor-pointer
      transition-all duration-300
      ${
        isActive
          ? "bg-[#0f172a] border border-[#38f2b9] text-white"
          : "text-gray-300 hover:text-white hover:bg-[#1e293b]/40"
      }
    `}
  >
    <span className="text-base font-medium">{label}</span>
  </Link>
);

const NavIcon = ({ href, icon, isActive }) => (
  <Link
    href={href}
    className={`
      block w-14 h-14 rounded-xl flex items-center justify-center cursor-pointer
      transition-all duration-300
      ${
        isActive
          ? "text-[#38f2b9] bg-[#0f172a] border border-[#38f2b9]"
          : "text-gray-400 hover:text-white hover:bg-[#1e293b]"
      }
    `}
  >
    <span className="text-2xl leading-none">{icon}</span>
  </Link>
);

export const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const displayName = user?.username || "Candidate";
  const profilePic = user?.profile;

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth/signin");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div
      className="flex h-screen"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* LEFT LABEL COLUMN */}
      <div
        className={`
          ${isOpen ? "w-[220px]" : "w-0"}
          overflow-hidden transition-all duration-300 ease-in-out
          bg-gradient-to-b from-[#05070D] to-[#0A0F1A]
          border-r border-[#1e293b]
          flex flex-col py-6
        `}
      >
        {/* PROFILE ROW */}
        <div className="h-16 flex items-center px-4 mb-4">
          <span className="text-white font-semibold text-lg">
            {displayName}
          </span>
        </div>

        {/* LABEL LIST */}
        <div className="flex flex-col px-2">
          {NAV_ITEMS.map((it) => (
            <div key={it.href} className="h-14 mb-2">
              <NavLabel
                href={it.href}
                label={it.label}
                isActive={pathname === it.href}
              />
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* LOGOUT LABEL */}
        <div className="h-14 px-2">
          <button
            onClick={handleLogout}
            className="
              w-full h-full text-left px-4 rounded-xl cursor-pointer
              text-gray-300 hover:text-white hover:bg-[#1e293b]
            "
          >
            Logout
          </button>
        </div>
      </div>

      {/* GAP */}
      <div className="w-[18px] bg-gradient-to-r from-[#126E7A] to-[#051B21]" />

      {/* RIGHT ICON COLUMN */}
      <div
        className="
          w-[70px]
          bg-gradient-to-b from-[#05070D] to-[#0A0F1A]
          border-l border-[#1e293b]
          flex flex-col items-center py-6
        "
      >
        {/* PROFILE ICON */}
        <div className="h-16 flex items-center">
          <div className="w-14 h-14 rounded-xl bg-[#1e293b] overflow-hidden flex items-center justify-center">
            {profilePic ? (
              <img src={profilePic} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-[#38f2b9]">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* ICON LIST */}
        <div className="flex flex-col items-center mt-4">
          {NAV_ITEMS.map((it) => (
            <div key={it.href} className="h-14 flex items-center mb-2">
              <NavIcon
                href={it.href}
                icon={it.icon}
                isActive={pathname === it.href}
              />
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* LOGOUT ICON */}
        <div className="h-14 flex items-center">
          <button
            onClick={handleLogout}
            className="
              w-14 h-14 rounded-xl cursor-pointer
              flex items-center justify-center
              text-gray-400 hover:text-white hover:bg-[#1e293b]
            "
          >
            🚪
          </button>
        </div>
      </div>
    </div>
  );
};
