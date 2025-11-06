'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import MeetingRoom from '@/components/MeetingRoom';

const MeetingPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const meetingId = String(params.meetingId || '');

  // 🧩 Step 1: Wait for auth to finish loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white text-lg">
        Checking authentication...
      </div>
    );
  }

  // 🧩 Step 2: Redirect to login if not authenticated
  if (!user) {
    router.push('/login');
    return null;
  }

  // 🧩 Step 3: Guard for missing meetingId
  if (!meetingId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white text-lg">
        Invalid meeting link.
      </div>
    );
  }

  // 🧩 Step 4: Render MeetingRoom with user details
  return (
    <MeetingRoom key={meetingId} user={user} />
  );
};

export default MeetingPage;
