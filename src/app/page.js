'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function Home() {
  const router = useRouter();
  const { authenticated, user, loading, logout, checkAuth } = useAuth();
  const [profileFetched, setProfileFetched] = useState(false);

  const handleGetStarted = async () => {
    if (!authenticated) {
      // No token → go to signup
      router.push('/auth/signup');
    } else {
      // Fetch latest profile just in case
      if (!profileFetched) {
        await checkAuth();
        setProfileFetched(true);
      }

      if (user?.role === 'CANDIDATE') router.push('/candidate');
      else if (user?.role === 'RECRUITER') router.push('/recruiter');
      else router.push('/');
    }
  };

  const handleLogout = async () => {
    try {
      await logout(); // clears authenticated & user
      toast.success('Logged out successfully');
      router.push('/auth/signin');
    } catch (err) {
      console.error('Logout failed:', err);
      toast.error('Logout failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center">
      {/* Top Login/Signup / Logout */}
      <div className="w-full flex justify-end gap-4 px-8 py-4">
        {!authenticated ? (
          <>
            <button
              className="text-gray-700 font-medium"
              onClick={() => router.push('/auth/signin')}
            >
              Login
            </button>
            <button
              className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700"
              onClick={() => router.push('/auth/signup')}
            >
              Sign Up
            </button>
          </>
        ) : (
          <button
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            onClick={handleLogout}
          >
            Logout
          </button>
        )}
      </div>

      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center max-w-6xl px-8 py-12 gap-10">
        <div className="w-full md:w-1/2">
          <div className="bg-gray-300 w-full h-72 rounded-xl flex items-center justify-center text-gray-600">
            Dummy Image
          </div>
        </div>

        <div className="w-full md:w-1/2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-snug">
            The Easiest Way to Assess Technical Talent, Live
          </h1>
          <p className="text-gray-600 mt-4">
            Seamless video conference meets real-time collaborative coding,
            whiteboarding, and structured scoring. Stop guessing. Start
            hiring.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              className="bg-teal-600 text-white px-6 py-3 rounded-md hover:bg-teal-700"
              onClick={handleGetStarted}
            >
              Start Free Trial / See Demo
            </button>
            <input
              type="text"
              placeholder="Candidate? Enter Interview Link/Code"
              className="border border-gray-300 rounded-md px-3 py-2 w-64"
            />
            <button className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900">
              GO
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl px-8 py-12">
        {[
          { title: 'Real-Time Code Execution', desc: 'Test candidates’ code correctness.' },
          { title: 'Structured Interview Scorecards', desc: 'Eliminate bias and improve consistency.' },
          { title: 'Seamless ATS Integration', desc: 'Connect your existing applicant tracking system.' },
          { title: 'Asynchronous Screening', desc: 'Scale your top-of-funnel screening.' },
        ].map((item, index) => (
          <div
            key={index}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
          >
            <div className="bg-gray-200 w-12 h-12 rounded-md mb-4"></div>
            <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
            <p className="text-gray-600 text-sm">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Testimonial Section */}
      <section className="bg-white w-full max-w-4xl mx-auto text-center rounded-lg p-8 shadow">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-300 rounded-full mb-3"></div>
          <p className="italic text-gray-700 mb-2">
            “This platform cut our time-to-hire by 30%.”
          </p>
          <span className="text-gray-500 text-sm">
            Jane Doe, Tech Lead at InnovateX
          </span>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-16">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Ready to transform your tech hiring process?
        </h2>
        <button
          className="bg-teal-600 text-white px-8 py-3 rounded-md text-lg hover:bg-teal-700"
          onClick={handleGetStarted}
        >
          Get Started Today
        </button>
      </section>
    </main>
  );
}
