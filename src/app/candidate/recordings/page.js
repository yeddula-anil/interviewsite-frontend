'use client';
import React, { useEffect, useState } from 'react';
import { FaUserTie, FaUserGraduate, FaVideo } from 'react-icons/fa';

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState([]);

  useEffect(() => {
    // 🧪 Dummy data (no video URLs)
    setRecordings([
      {
        id: 1,
        meetingId: 'INT-2025-001',
        candidateEmail: 'john.candidate@example.com',
        recruiterEmail: 'recruiter.hr@company.com',
        role: 'Candidate',
        thumbnail: 'https://placehold.co/320x180?text=Interview+1',
        date: '2025-11-11 10:30 AM',
      },
      {
        id: 2,
        meetingId: 'INT-2025-002',
        candidateEmail: 'sarah.candidate@example.com',
        recruiterEmail: 'recruiter.tech@company.com',
        role: 'Recruiter',
        thumbnail: 'https://placehold.co/320x180?text=Interview+2',
        date: '2025-11-11 2:00 PM',
      },
      {
        id: 3,
        meetingId: 'INT-2025-003',
        candidateEmail: 'mike.candidate@example.com',
        recruiterEmail: 'recruiter@hrdept.com',
        role: 'Candidate',
        thumbnail: 'https://placehold.co/320x180?text=Interview+3',
        date: '2025-11-10 5:15 PM',
      },
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8 text-teal-400 flex items-center gap-2">
        <FaVideo /> Interview Recordings
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {recordings.map((rec) => (
          <div
            key={rec.id}
            className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:shadow-lg hover:shadow-teal-500/10 transition"
          >
            {/* Thumbnail */}
            <div className="relative">
              <img
                src={rec.thumbnail}
                alt={rec.meetingId}
                className="w-full h-48 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-sm px-3 py-1 text-center">
                {rec.date}
              </div>
            </div>

            {/* Info Section */}
            <div className="p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-teal-300 font-semibold">
                <FaVideo /> {rec.meetingId}
              </div>
              <div className="flex items-center gap-2">
                <FaUserGraduate className="text-blue-400" />
                <span className="text-gray-300">Candidate:</span>
                <span>{rec.candidateEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaUserTie className="text-yellow-400" />
                <span className="text-gray-300">Recruiter:</span>
                <span>{rec.recruiterEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-300">Role:</span>
                <span className="font-medium">{rec.role}</span>
              </div>

              <button
                disabled
                className="w-full mt-3 py-2 rounded-md bg-gray-700 text-gray-400 cursor-not-allowed"
              >
                🎥 Recording Not Available
              </button>
            </div>
          </div>
        ))}
      </div>

      {recordings.length === 0 && (
        <p className="text-center text-gray-400 mt-10">No recordings available yet.</p>
      )}
    </div>
  );
}
