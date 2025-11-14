"use client";

import React, { useState } from "react";
import { useGetRecordings } from "@/hooks/useGetRecordings";
import { FaVideo, FaTimes, FaDownload } from "react-icons/fa";
import { toast } from "react-hot-toast";

export default function RecordingsPage() {
  const { recordings, isLoading } = useGetRecordings();
  const [selectedRecording, setSelectedRecording] = useState(null);

  if (isLoading) {
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

      {/* Recordings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
        {recordings.map((rec, idx) => (
          <div
            key={idx}
            className="w-[250px] bg-gray-800/70 border border-gray-700 rounded-2xl overflow-hidden
            shadow-md hover:shadow-xl hover:shadow-teal-500/10 transition-all duration-300
            backdrop-blur-md transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <div className="relative">
              <img
                src="https://placehold.co/600x400?text=Recording"
                className="w-full h-36 object-cover rounded-t-2xl"
              />
              <div className="absolute bottom-0 w-full bg-black/60 text-[11px] py-1 text-center text-gray-300">
                {new Date(rec.start_time).toLocaleDateString()}
              </div>
            </div>

            <div className="p-3 space-y-1.5 text-[13px]">
              <p className="text-teal-400 font-semibold text-center truncate">
                {rec.filename}
              </p>

              <p className="text-gray-400 text-xs truncate">
                <span className="text-gray-300 font-medium">Meeting ID:</span>{" "}
                {rec.meetingId}
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-2 mt-3">
                <button
                  onClick={() => setSelectedRecording(rec)}
                  className="py-1 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow-md"
                >
                  🎥 View
                </button>

                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = rec.url;
                    a.download = rec.filename;
                    a.click();
                  }}
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

      {/* Modal */}
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
              Recording — {selectedRecording.filename}
            </h2>

            <video
              controls
              src={selectedRecording.url}
              className="w-full rounded-lg border border-gray-700 shadow-md"
            />

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = selectedRecording.url;
                  a.download = selectedRecording.filename;
                  a.click();
                }}
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
