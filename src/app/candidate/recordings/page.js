'use client';
import React, { useEffect, useState } from 'react';
import {
  FaUserTie,
  FaUserGraduate,
  FaVideo,
  FaDownload,
  FaTimes,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthProvider';
import axiosInstance from '@/utils/axiosInstance'; // ✅ make sure to import

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [fetchingVideo, setFetchingVideo] = useState(false);
  const [loading, setLoading] = useState(true); // ✅ added loading state
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchRecordings = async () => {
      setLoading(true); // start loading
      try {
        const res = await axiosInstance.get(`/api/completed-meetings/candidate/${user?.email}`);
        setRecordings(res.data);
      } catch (err) {
        toast.error('Error fetching recordings.');
      } finally {
        setLoading(false); // stop loading
      }
    };

    fetchRecordings();
  }, [user?.email]);

  // 🎥 Fetch Recording from backend
  const handleViewRecording = async (recording) => {
    setLoadingId(recording.id);
    setFetchingVideo(true);
    try {
      const res = await fetch(`/api/recordings/${recording.meetingId}`);
      if (!res.ok) throw new Error('Failed to fetch recording from Stream');
      const data = await res.json();

      if (data.recordingUrl) {
        setSelectedRecording({ ...recording, videoUrl: data.recordingUrl });
      } else {
        toast.error('No recording found for this meeting.');
      }
    } catch (err) {
      toast.error('Error loading recording.');
    } finally {
      setFetchingVideo(false);
      setLoadingId(null);
    }
  };

  // 💾 Download Handler
  const handleDownload = (videoUrl, meetingId) => {
    if (!videoUrl) {
      toast.error('Recording not available for download.');
      return;
    }
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `${meetingId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🌀 Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-300 text-lg">
        Loading recordings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white px-4 sm:px-8 py-6">
      <h1 className="text-3xl font-bold mb-10 text-teal-400 flex items-center gap-2 justify-center tracking-wide">
        <FaVideo /> Interview Recordings
      </h1>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
        {recordings.map((rec) => (
          <div
            key={rec.id}
            className="w-[250px] bg-gray-800/70 border border-gray-700 rounded-2xl overflow-hidden 
              shadow-md hover:shadow-xl hover:shadow-teal-500/10 transition-all duration-300 
              backdrop-blur-md transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            {/* Thumbnail */}
            <div className="relative">
              <img
                src={rec.thumbnail}
                alt={rec.meetingId}
                className="w-full h-36 object-cover rounded-t-2xl"
              />
              <div className="absolute bottom-0 w-full bg-black/60 text-[11px] py-1 text-center text-gray-300 font-medium">
                {rec.date}
              </div>
            </div>

            {/* Info */}
            <div className="p-3 space-y-1.5 text-[13px]">
              <p className="text-teal-400 font-semibold text-center truncate">
                {rec.meetingId}
              </p>

              <div className="flex items-center gap-1 text-gray-300 truncate">
                <FaUserGraduate className="text-blue-400 text-xs" />
                <span className="truncate">{rec.candidateEmail}</span>
              </div>

              <div className="flex items-center gap-1 text-gray-300 truncate">
                <FaUserTie className="text-yellow-400 text-xs" />
                <span className="truncate">{rec.recruiterEmail}</span>
              </div>

              <p className="text-gray-400 text-xs truncate">
                <span className="text-gray-300 font-medium">Role:</span>{' '}
                {rec.role}
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-2 mt-3">
                <button
                  onClick={() => handleViewRecording(rec)}
                  disabled={loadingId === rec.id}
                  className={`py-1 rounded-lg text-sm font-medium transition-all ${
                    loadingId === rec.id
                      ? 'bg-gray-700 text-gray-400 cursor-wait'
                      : 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow-md'
                  }`}
                >
                  {loadingId === rec.id ? 'Loading...' : '🎥 View'}
                </button>

                <button
                  onClick={() => toast('Please view the recording first!')}
                  className="py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium 
                  text-white flex items-center justify-center gap-1 hover:shadow-md transition-all"
                >
                  <FaDownload className="text-xs" /> Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {recordings.length === 0 && (
        <p className="text-center text-gray-400 mt-10 text-sm">
          No recordings available yet.
        </p>
      )}

      {/* 🎬 Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-3">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl relative shadow-2xl border border-gray-700">
            <button
              onClick={() => setSelectedRecording(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
            >
              <FaTimes size={18} />
            </button>

            <h2 className="text-lg font-semibold mb-4 text-teal-400 text-center">
              Recording — {selectedRecording.meetingId}
            </h2>

            {fetchingVideo ? (
              <div className="text-center text-gray-400 py-10">
                Fetching video...
              </div>
            ) : (
              <video
                controls
                src={selectedRecording.videoUrl}
                className="w-full rounded-lg border border-gray-700 shadow-md"
              />
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={() =>
                  handleDownload(
                    selectedRecording.videoUrl,
                    selectedRecording.meetingId
                  )
                }
                className="bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg flex items-center gap-2 
                text-sm text-white font-medium shadow-md hover:shadow-lg transition-all"
              >
                <FaDownload /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
