'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useState } from 'react';
import toast from 'react-hot-toast';
import NeonButton from '@/components/NeonButton';

import {
  FaCalendarAlt,
  FaChartPie,
  FaClipboardCheck,
  FaLaptopCode,
  FaShieldAlt,
  FaBell,
  FaUsers,
  FaVideo,
} from 'react-icons/fa';

export default function Home() {
  const router = useRouter();
  const { authenticated, user, loading, logout, checkAuth } = useAuth();
  const [profileFetched, setProfileFetched] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);

  // (DON'T CHANGE LOGIC)
  const handleGetStarted = async () => {
    setBtnLoading(true);

    if (!authenticated) {
      router.push('/auth/signup');
      return;
    }

    if (!profileFetched) {
      await checkAuth();
      setProfileFetched(true);
    }

    if (user?.role === 'CANDIDATE') router.push('/candidate');
    else if (user?.role === 'RECRUITER') router.push('/recruiter');
    else router.push('/');

    setBtnLoading(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      router.push('/auth/signin');
    } catch (err) {
      console.error('Logout failed:', err);
      toast.error('Logout failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <main
      className="min-h-screen text-white"
      style={{ background: "linear-gradient(180deg, #031719 0%, #041214 60%, #02090A 100%)" }}
    >
      {/* NAVBAR */}
      <nav className="w-full flex justify-between items-center px-10 py-6 border-b border-[#0f2e2e] bg-black/20 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-wide bg-gradient-to-r from-[#38f2b9] to-[#47ffd7] text-transparent bg-clip-text">
          IntervueX
        </h1>

        <div className="flex gap-4">
          {!authenticated ? (
            <>
              <button
                className="text-gray-300 hover:text-[#38f2b9] transition"
                onClick={() => router.push('/auth/signin')}
              >
                Login
              </button>

              <button
                className="px-5 py-2 rounded-md bg-[#38f2b9] text-black font-semibold shadow-[0_0_10px_#38f2b9] hover:scale-105 transition"
                onClick={() => router.push('/auth/signup')}
              >
                Sign Up
              </button>
            </>
          ) : (
            <button
              className="px-5 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition"
              onClick={handleLogout}
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-10 py-20 grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
        
        {/* LEFT TEXT */}
        <div className="space-y-6">
          <h1 className="text-5xl font-extrabold leading-tight">
            <span className="text-[#38f2b9]">A Powerful Interview</span>
            <br />Platform for Modern Hiring
          </h1>

          <p className="text-gray-300 text-lg">
            Manage interviews seamlessly — scheduling, real-time coding, 
            anti-cheat detection, scoring, recording, and analytics — 
            all inside one intelligent platform.
          </p>

          {/* BUTTONS */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => router.push('/candidate/scores')}
              className="px-6 py-3 rounded-lg bg-[#0a2e2b] border border-[#0f4a44] text-[#a5fff2] hover:bg-[#0c3e38] transition"
            >
              View My Performance
            </button>

            <button
              onClick={() => router.push('/candidate/recordings')}
              className="px-6 py-3 rounded-lg bg-[#38f2b9] text-black font-semibold hover:brightness-110 transition"
            >
              Watch Recordings
            </button>
          </div>
        </div>

        {/* RIGHT IMAGE */}
        <div className="flex justify-center">
          <div className="w-[80%] h-80 rounded-2xl bg-gradient-to-br from-[#0b3a38] to-[#051a1a] border border-[#1c4747] shadow-[0_0_30px_#0ff3bd30] overflow-hidden">
            <img
              src="/previewimg1.png"
              alt="Interview Dashboard Preview"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

      </section>

      {/* FEATURES GRID */}
      <section className="max-w-7xl mx-auto px-10 py-16">
        <h2 className="text-3xl font-bold mb-10">Platform Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          
          <Feature icon={<FaCalendarAlt />} title="Schedule Meetings" desc="Create interview slots with clean UI & reminders." />
          <Feature icon={<FaChartPie />} title="Dashboard Analytics" desc="Track attempts, scores, and performance trends." />
          <Feature icon={<FaClipboardCheck />} title="Assign Score" desc="Evaluate candidates using structured scoring." />
          <Feature icon={<FaLaptopCode />} title="Live Code + Chat Suite" desc="Built-in Monaco editor, chat & real-time video." />
          <Feature icon={<FaShieldAlt />} title="Anti-Cheat Detection" desc="Detect tab-switching, background screens, etc." />
          <Feature icon={<FaBell />} title="Auto Schedule Reminders" desc="Daily reminders for upcoming interviews." />
          <Feature icon={<FaUsers />} title="Post Experiences" desc="Candidates can share interview experiences." />
          <Feature icon={<FaVideo />} title="Record Interviews" desc="Full session recording & download support." />

        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center bg-gradient-to-b from-transparent to-[#001010]">
        <h2 className="text-3xl font-semibold mb-6 text-[#38f2b9]">
          Interview Smarter — Not Harder
        </h2>

        {/* GET STARTED BUTTON CENTERED */}
        <div className="flex justify-center">
          <button
            onClick={handleGetStarted}
            disabled={btnLoading}
            className={`
              px-8 py-3 rounded-xl font-semibold text-lg flex items-center justify-center gap-3
              shadow-[0_0_20px_#38f2b9] transition
              ${btnLoading ? "bg-[#38f2b970] cursor-not-allowed" : "bg-[#38f2b9] text-black hover:scale-105"}
            `}
          >
            {btnLoading ? (
              <div className="w-5 h-5 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Get Started"
            )}
          </button>
        </div>

      </section>
    </main>
  );
}

/* ---------------- FEATURE CARD COMPONENT ---------------- */

function Feature({ icon, title, desc }) {
  return (
    <div className="p-6 rounded-xl bg-[#041e1e] border border-[#0e3a35] hover:border-[#38f2b9] hover:shadow-[0_0_25px_#38f2b950] transition">
      <div className="text-[#38f2b9] text-3xl mb-4">{icon}</div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-gray-300 text-sm">{desc}</p>
    </div>
  );
}
