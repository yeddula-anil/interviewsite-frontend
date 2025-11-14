'use client';
import React, { useState, useEffect } from "react";
import { FaStar, FaTimes } from "react-icons/fa";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/context/AuthProvider";
import toast from "react-hot-toast";

const CompletedInterviews = () => {
  const { user } = useAuth();
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedInterview, setSelectedInterview] = useState(null);

  useEffect(() => {
    if (!user?.email) return;

    const fetchCompletedMeetings = async () => {
      try {
        const res = await axiosInstance.get(`/meetings/candidate/${user.email}`);

        const completedMeetings = res.data.filter(
          (m) => m.completed === true
        );

        const sorted = completedMeetings.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );

        setCompleted(sorted);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load completed interviews");
      } finally {
        setLoading(false);
      }
    };

    fetchCompletedMeetings();
  }, [user?.email]);

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        Loading completed interviews...
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen w-full px-10 py-10 text-white 
        bg-gradient-to-br from-[#000000] to-[#3A3A3A]
      "
    >
      {/* ---------- HEADER ---------- */}
      <h1 className="text-4xl font-bold tracking-wide mb-2 
                     bg-gradient-to-r from-[#38f2b9] to-white bg-clip-text text-transparent">
        Completed Interviews
      </h1>
      <p className="text-gray-300 mb-10 font-light">
        Review your past performance and feedback.
      </p>

      {/* ---------- INTERVIEW CARDS ---------- */}
      <div className="grid md:grid-cols-2 gap-8">
        {completed.map((interview) => (
          <div
            key={interview.id}
            className="
              relative
              rounded-2xl p-6 
              bg-gradient-to-br from-[#126E7A] to-[#051B21]
              border border-[#1b474d]
              shadow-[0_0_25px_rgba(0,0,0,0.35)]
              hover:shadow-[0_0_35px_rgba(18,110,122,0.55)]
              transition-all backdrop-blur-lg
            "
          >

            {/* ---------- SCORE BADGE ---------- */}
            <div className="absolute top-4 right-4">
              {interview.candidateMarks !== null ? (
                <div
                  className="
                    flex items-center px-3 py-1 rounded-full 
                    bg-[#38f2b9]/25 border border-[#38f2b9]/40
                  "
                >
                  <FaStar className="text-[#EAF92F] mr-1" />
                  <span className="font-semibold text-white">
                    {interview.candidateMarks}/50
                  </span>
                </div>
              ) : (
                <div
                  className="
                    px-3 py-1 rounded-full bg-white/10 
                    border border-white/20
                  "
                >
                  <span className="text-sm text-gray-200 italic">
                    Not yet graded
                  </span>
                </div>
              )}
            </div>

            {/* ---------- COMPANY LOGO + NAME ---------- */}
            <div className="flex items-center gap-4 mb-4">
              <div
                className="
                  w-20 h-20 rounded-2xl
                  bg-gradient-to-br from-[#0A1E24] to-[#0F3A40]
                  p-3 border border-[#38f2b9]/40
                  shadow-[0_0_18px_rgba(56,242,185,0.25)]
                  flex items-center justify-center
                "
              >
                <img
                  src={interview.companyLogoUrl}
                  alt={interview.companyName}
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-white">
                  {interview.companyName}
                </h2>
                <p className="text-sm text-[#38f2b9] tracking-wide">
                  {interview.role}
                </p>
              </div>
            </div>

            {/* ---------- DATE & TIME ---------- */}
            <div className="mt-3">
              <p className="text-gray-200 text-sm mb-1">
                <strong>Date:</strong> {interview.date}
              </p>
              <p className="text-gray-200 text-sm">
                <strong>Time:</strong> {interview.time}
              </p>
            </div>

            {/* ---------- COMMENTS ---------- */}
            <div className="mt-5">
              <p className="text-gray-100 text-sm leading-relaxed">
                <strong className="text-white">Review:</strong>{" "}
                {interview.candidateComments || "No comments yet"}
              </p>
            </div>

            {/* ---------- BUTTON ---------- */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedInterview(interview)}
                className="
                  px-5 py-2 rounded-lg font-medium 
                  text-black bg-[#e8efed]
                  hover:bg-[#08eca4] 
                  shadow-[0_0_10px_#38f2b970]
                  transition
                "
              >
                View Details
              </button>
            </div>

          </div>
        ))}
      </div>

      {completed.length === 0 && (
        <p className="text-center mt-8 text-gray-300 text-lg">
          No completed interviews found.
        </p>
      )}

      {/* ---------- MODAL ---------- */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 px-4">
          <div className="bg-[#0A0F1A] border border-[#1b474d] w-full max-w-xl rounded-2xl p-6 shadow-xl relative">

            {/* Close Button */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
              onClick={() => setSelectedInterview(null)}
            >
              <FaTimes size={20} />
            </button>

            {/* Title */}
            <h2 className="text-2xl font-semibold text-[#38f2b9] mb-4 text-center">
              Interview Details
            </h2>

<div
  className="
    w-20 h-20 rounded-2xl
    bg-gradient-to-br from-[#0A1E24] to-[#0F3A40]
    border border-[#38f2b9]/40
    shadow-[0_0_18px_rgba(56,242,185,0.25)]
    overflow-hidden
    flex items-center justify-center
  "
>
  <img
    src={selectedInterview.companyLogoUrl}
    alt={selectedInterview.companyName}
    className="w-full h-full object-cover scale-[1.4]"
  />
</div>



            {/* Company + Role */}
            <h3 className="text-xl text-white text-center font-bold">
              {selectedInterview.companyName}
            </h3>
            <p className="text-center text-[#38f2b9] mb-4">
              {selectedInterview.role}
            </p>

            {/* Date & Time */}
            <p className="text-gray-300 text-sm mb-1">
              <strong>Date:</strong> {selectedInterview.date}
            </p>
            <p className="text-gray-300 text-sm mb-4">
              <strong>Time:</strong> {selectedInterview.time}
            </p>

            {/* Score */}
            <p className="text-gray-300 text-sm mb-4">
              <strong>Score:</strong>{" "}
              {selectedInterview.candidateMarks !== null
                ? `${selectedInterview.candidateMarks} / 50`
                : "Not yet graded"}
            </p>

            {/* Comments */}
            <p className="text-gray-200 leading-relaxed text-sm mb-3">
              <strong>Review:</strong>{" "}
              {selectedInterview.candidateComments || "No comments yet"}
            </p>

            {/* Footer */}
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setSelectedInterview(null)}
                className="px-5 py-2 bg-[#38f2b9] text-black font-medium rounded-lg hover:bg-[#1ed8a4]"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedInterviews;
