'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';

// Nav Item Helper Component
const NavItem = ({ href, icon, label, isOpen, isActive = false }) => (
  <Link
    href={href}
    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-150 ${
      isActive
        ? 'bg-teal-700 text-white'
        : 'text-gray-300 hover:bg-teal-700 hover:text-white'
    }`}
  >
    <span className="text-xl flex-shrink-0">{icon}</span>
    <span
      className={`text-base font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
        isOpen ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'
      }`}
    >
      {label}
    </span>
  </Link>
);

export const RecruiterSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const baseWidth = 'w-20';
  const expandedWidth = 'w-64';
  const widthClass = isOpen ? expandedWidth : baseWidth;

  // ✅ Use username from authProvider
  const displayName = user?.username || 'Recruiter';
  const profilePic = user?.profile; // profile field from backend

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/signin');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div
      className={`flex flex-col ${widthClass} bg-teal-800 text-white p-4 space-y-6 
                  transition-all duration-300 ease-in-out flex-shrink-0 
                  hidden sm:flex z-30 overflow-hidden`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Header/Profile Area */}
      <div className="flex items-center space-x-3 border-b border-teal-700 pb-4 h-12">
        <div
          onClick={() => router.push('/recruiter/my-profile')}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-600 text-white font-semibold text-lg cursor-pointer overflow-hidden"
        >
          {profilePic ? (
            <img
              src={profilePic}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>

        <span
          className={`text-lg font-semibold bg-gradient-to-r from-teal-200 to-white bg-clip-text text-transparent tracking-wide transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0 hidden'
          }`}
        >
          {displayName}
        </span>
      </div>

      {/* Recruiter Navigation Links */}
      <nav className="space-y-2 flex-grow">
        <NavItem
          href="/recruiter"
          icon="🏠"
          label="Dashboard"
          isOpen={isOpen}
          isActive={pathname === '/recruiter'}
        />
        <NavItem
          href="/recruiter/schedule"
          icon="📅"
          label="Schedule"
          isOpen={isOpen}
          isActive={pathname === '/recruiter/schedule'}
        />
        <NavItem
          href="/recruiter/recordings"
          icon="🎞️"
          label="Recordings"
          isOpen={isOpen}
          isActive={pathname === '/recruiter/recordings'}
        />
        <NavItem
          href="/recruiter/assignscore"
          icon="⭐"
          label="Assign Marks"
          isOpen={isOpen}
          isActive={pathname === '/recruiter/assignscore'}
        />
        <NavItem
          href="/recruiter/meeting?manual=true"
          icon="🎥"
          label="Join a Meeting"
          isOpen={isOpen}
          isActive={pathname.startsWith('/recruiter/meeting')}
        />
        <NavItem
          href="/recruiter/scheduleMeeting"
          icon="➕"
          label="Schedule an Interview"
          isOpen={isOpen}
          isActive={pathname === '/recruiter/scheduleMeeting?manual=true'}
        />
      </nav>

      {/* Logout Section */}
      <div className="mt-auto pt-4 border-t border-teal-700">
        <button
          className="flex items-center space-x-3 p-3 rounded-lg text-gray-200 hover:bg-teal-700 w-full text-left"
          onClick={handleLogout}
        >
          <span className="text-xl flex-shrink-0">🚪</span>
          <span
            className={`text-base font-medium whitespace-nowrap transition-all duration-300 ${
              isOpen ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'
            }`}
          >
            Logout
          </span>
        </button>
      </div>
    </div>
  );
};
