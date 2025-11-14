"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/common/Button";
import toast from "react-hot-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/context/AuthProvider";
import { FaSpinner } from "react-icons/fa";

const CompletedInterviews = () => {
  const [schedules, setSchedules] = useState([]);
  const [scoreInputs, setScoreInputs] = useState({});
  const [loadingScores, setLoadingScores] = useState({});
  const [activeScoreInput, setActiveScoreInput] = useState(null);
  const [reviewModal, setReviewModal] = useState({ open: false, scheduleId: null });
  const [reviewText, setReviewText] = useState("");
  const { user } = useAuth();

  const [stats, setStats] = useState({
    avgScore: 0,
    total: 0,
    unscored: 0,
  });

  // Fetch completed interviews
  const fetchCompletedInterviews = async () => {
    if (!user?.email) return;

    try {
      const { data } = await axiosInstance.get(
        `/meetings/recruiter/${encodeURIComponent(user.email)}`
      );

      const completed = data.filter((s) => s.completed === true);

      // Sort: unscored first
      const sorted = completed.sort((a, b) => {
        const aHasScore = a.candidateMarks !== null;
        const bHasScore = b.candidateMarks !== null;

        if (!aHasScore && bHasScore) return -1;
        if (aHasScore && !bHasScore) return 1;

        return new Date(b.markedAt || 0) - new Date(a.markedAt || 0);
      });

      // Stats Update
      const scored = completed.filter((s) => s.candidateMarks !== null);
      const avgScore =
        scored.length > 0
          ? (
              scored.reduce((sum, s) => sum + (s.candidateMarks || 0), 0) / scored.length
            ).toFixed(1)
          : 0;

      const unscored = completed.length - scored.length;

      setStats({ avgScore, total: completed.length, unscored });
      setSchedules(sorted);
    } catch (err) {
      toast.error("Failed to fetch completed interviews");
    }
  };

  useEffect(() => {
    fetchCompletedInterviews();
  }, [user]);

  // Assign score
  const handleAssignScore = async (scheduleId) => {
    const score = parseFloat(scoreInputs[scheduleId]);
    if (isNaN(score) || score < 0 || score > 50) {
      toast.error("Enter a valid score between 0 and 50");
      return;
    }

    setLoadingScores((prev) => ({ ...prev, [scheduleId]: true }));

    try {
      await axiosInstance.put(`/meetings/${scheduleId}/score`, { score });
      toast.success("Score assigned successfully!");
      setActiveScoreInput(null);
      fetchCompletedInterviews();
    } catch {
      toast.error("Failed to assign score");
    } finally {
      setLoadingScores((prev) => ({ ...prev, [scheduleId]: false }));
    }
  };

  // Review modal
  const openReviewModal = (scheduleId) => {
    setReviewModal({ open: true, scheduleId });
    setReviewText("");
  };

  const handleSubmitReview = async () => {
    if (!reviewText.trim()) {
      toast.error("Review cannot be empty");
      return;
    }

    setLoadingScores((prev) => ({ ...prev, review: true }));

    try {
      await axiosInstance.put(`/meetings/${reviewModal.scheduleId}/review`, {
        review: reviewText,
      });
      toast.success("Review submitted!");
      setReviewModal({ open: false, scheduleId: null });
      fetchCompletedInterviews();
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setLoadingScores((prev) => ({ ...prev, review: false }));
    }
  };

  return (
    <div
      className="
        min-h-screen w-full px-10 py-10 text-white
        bg-gradient-to-r from-[#126E7A] to-[#051B21]
      "
    >
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-wide">
            <span className="bg-gradient-to-r from-[#38f2b9] to-white bg-clip-text text-transparent">
              Completed Interviews
            </span>
          </h1>
          <p className="text-gray-200/80 mt-1">Review & Score Completed Interviews</p>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          {[ 
            { label: "Average Score", value: stats.avgScore, color: "text-[#3DF29E]" },
            { label: "Total", value: stats.total, color: "text-white" },
            { label: "Unscored", value: stats.unscored, color: "text-red-400" }
          ].map((stat, i) => (
            <div
              key={i}
              className="
                bg-[#0B0F1A]/70 backdrop-blur-xl
                px-5 py-3 rounded-xl border border-[#1b2335]
                shadow-[0_0_12px_#38f2b935] text-center
              "
            >
              <p className="text-gray-300 text-sm">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* LIST */}
      {schedules.length === 0 ? (
        <p className="text-center text-gray-200/70 py-10 text-lg">
          No completed interviews found.
        </p>
      ) : (
        <div className="space-y-5">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="
                w-full p-6 rounded-xl 
                bg-[#0B0F1A]/80 backdrop-blur-xl
                border border-[#1b2335]/70 
                hover:border-[#38f2b9] transition-all 
                hover:shadow-[0_0_20px_#38f2b930]
                flex flex-col md:flex-row justify-between items-center
              "
            >
              {/* LEFT */}
              <div className="w-full md:w-1/3">
                <h2 className="text-lg font-semibold text-white">{s.candidateEmail}</h2>

                {s.candidateResumeUrl ? (
                  <a
                    href={s.candidateResumeUrl}
                    target="_blank"
                    className="text-orange-400 hover:text-white underline text-sm"
                  >
                    View Resume
                  </a>
                ) : (
                  <p className="text-gray-500 italic text-sm">No Resume Uploaded</p>
                )}
              </div>

              {/* MIDDLE */}
              <div className="text-center w-full md:w-1/3">
                <p className="text-xl font-semibold text-white">{s.role}</p>
                <p className="text-gray-400 text-sm mt-1">
                  📅 {s.date} • {s.time}
                </p>

                {s.candidateMarks !== null && (
                  <p
                    className={`mt-2 font-bold ${
                      s.candidateMarks >= 40
                        ? "text-green-400"
                        : s.candidateMarks >= 25
                        ? "text-yellow-300"
                        : "text-red-400"
                    }`}
                  >
                    Score: {s.candidateMarks} / 50
                  </p>
                )}
              </div>

              {/* RIGHT ACTIONS */}
              <div className="flex flex-wrap gap-2 w-full md:w-1/3 justify-end mt-3 md:mt-0">

                {/* Assign Score */}
                {s.candidateMarks === null && (
                  <>
                    {activeScoreInput === s.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          placeholder="0–50"
                          className="
                            border border-[#1b2335] bg-[#0b101a] 
                            text-white px-3 py-1 rounded-md w-20
                            focus:border-[#38f2b9]
                          "
                          value={scoreInputs[s.id] || ""}
                          onChange={(e) =>
                            setScoreInputs({
                              ...scoreInputs,
                              [s.id]: e.target.value,
                            })
                          }
                        />

                        <button
                          onClick={() => handleAssignScore(s.id)}
                          disabled={loadingScores[s.id]}
                          className="
                            px-4 py-1 rounded-md bg-[#38f2b9]
                            text-black font-semibold shadow-md
                            flex items-center justify-center
                          "
                        >
                          {loadingScores[s.id] ? (
                            <FaSpinner className="animate-spin text-black" />
                          ) : (
                            "Save"
                          )}
                        </button>

                        <button
                          className="
                            px-4 py-1 rounded-md bg-[#1f293b]
                            text-white font-semibold
                          "
                          onClick={() => setActiveScoreInput(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="
                          px-4 py-2 rounded-md bg-gradient-to-r
                          from-[#32296C] to-[#180A44]
                          text-white shadow-md
                          border border-[#3f2e8f]/40
                          hover:opacity-90
                        "
                        onClick={() => setActiveScoreInput(s.id)}
                      >
                        Assign Score
                      </button>
                    )}
                  </>
                )}

                {/* Review */}
                <button
                  className="
                    px-4 py-2 rounded-md
                    bg-gradient-to-r from-[#126E7A] to-[#051B21]
                    text-white shadow-md hover:opacity-90
                  "
                  onClick={() => openReviewModal(s.id)}
                >
                  Write Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REVIEW MODAL */}
      {reviewModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0B0F1A] border border-[#38f2b9]/40 backdrop-blur-xl 
          rounded-xl p-6 w-96 shadow-[0_0_25px_#38f2b930] text-white">

            <h2 className="text-xl font-bold mb-3 text-center">Write Review</h2>

            <textarea
              className="
                w-full bg-[#111827] text-white border border-[#1b2335]
                rounded-md p-2 h-32 focus:border-[#38f2b9]
              "
              placeholder="Write your review here..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="
                  px-4 py-2 rounded-md bg-[#1f293b] text-white
                "
                onClick={() => setReviewModal({ open: false, scheduleId: null })}
              >
                Cancel
              </button>

              <button
                onClick={handleSubmitReview}
                className="
                  px-4 py-2 rounded-md bg-[#38f2b9] text-black font-semibold
                  flex items-center justify-center
                "
              >
                {loadingScores.review ? (
                  <FaSpinner className="animate-spin text-black" />
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedInterviews;
