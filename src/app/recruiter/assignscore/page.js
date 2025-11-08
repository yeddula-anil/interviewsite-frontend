'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import toast from 'react-hot-toast';
import axiosInstance from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthProvider';

const CompletedInterviews = () => {
  const [schedules, setSchedules] = useState([]);
  const [scoreInputs, setScoreInputs] = useState({});
  const [loadingScores, setLoadingScores] = useState({});
  const [activeScoreInput, setActiveScoreInput] = useState(null);
  const [reviewModal, setReviewModal] = useState({ open: false, scheduleId: null });
  const [reviewText, setReviewText] = useState('');
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

      // Sort: unscored first, then recently completed
      const sorted = completed.sort((a, b) => {
        const aHasScore = a.candidateMarks !== null && a.candidateMarks !== undefined;
        const bHasScore = b.candidateMarks !== null && b.candidateMarks !== undefined;
        if (!aHasScore && bHasScore) return -1;
        if (aHasScore && !bHasScore) return 1;
        const aMarked = a.markedAt ? new Date(a.markedAt) : 0;
        const bMarked = b.markedAt ? new Date(b.markedAt) : 0;
        return bMarked - aMarked;
      });

      // Update stats
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
      toast.error('Failed to fetch completed interviews');
    }
  };

  useEffect(() => {
    fetchCompletedInterviews();
  }, [user]);

  // Assign score
  const handleAssignScore = async (scheduleId) => {
    const score = parseFloat(scoreInputs[scheduleId]);
    if (isNaN(score) || score < 0 || score > 50) {
      toast.error('Enter a valid score between 0 and 50');
      return;
    }

    setLoadingScores((prev) => ({ ...prev, [scheduleId]: true }));

    try {
      await axiosInstance.put(`/meetings/${scheduleId}/score`, { score });
      toast.success('Score assigned successfully!');
      setActiveScoreInput(null);
      fetchCompletedInterviews();
    } catch {
      toast.error('Failed to assign score');
    } finally {
      setLoadingScores((prev) => ({ ...prev, [scheduleId]: false }));
    }
  };

  // Review modal
  const openReviewModal = (scheduleId) => {
    setReviewModal({ open: true, scheduleId });
    setReviewText('');
  };

  const handleSubmitReview = async () => {
    if (!reviewText.trim()) {
      toast.error('Review cannot be empty');
      return;
    }
    try {
      await axiosInstance.put(`/meetings/${reviewModal.scheduleId}/review`, {
        review: reviewText,
      });
      toast.success('Review submitted!');
      setReviewModal({ open: false, scheduleId: null });
      fetchCompletedInterviews();
    } catch {
      toast.error('Failed to submit review');
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* ==== Header ==== */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Completed Interviews</h1>

        {/* Summary Cards */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-white border rounded-lg shadow-sm p-4 text-center w-36">
            <p className="text-sm text-gray-500">Average Score</p>
            <p className="text-2xl font-bold text-blue-600">{stats.avgScore}</p>
          </div>
          <div className="bg-white border rounded-lg shadow-sm p-4 text-center w-36">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white border rounded-lg shadow-sm p-4 text-center w-36">
            <p className="text-sm text-gray-500">Unscored</p>
            <p className="text-2xl font-bold text-red-500">{stats.unscored}</p>
          </div>
        </div>
      </div>

      {/* ==== Body ==== */}
      {schedules.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">
          No completed interviews found.
        </p>
      ) : (
        <div className="grid gap-4">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="bg-white p-5 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all flex flex-col md:flex-row justify-between items-center"
            >
              {/* Left Section */}
              <div className="flex flex-col gap-2 w-full md:w-1/3">
                <p className="font-medium text-gray-900">{s.candidateEmail}</p>
                {s.candidateResumeUrl && s.candidateResumeUrl.trim() !== '' ? (
                  <a
                    href={s.candidateResumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm font-medium"
                  >
                    View Resume
                  </a>
                ) : (
                  <span className="text-gray-500 text-sm italic">
                    No resume uploaded
                  </span>
                )}
              </div>

              {/* Middle Section */}
              <div className="text-center w-full md:w-1/3">
                <p className="font-semibold text-gray-800">{s.role}</p>
                <p className="text-gray-500">{`${s.date} | ${s.time}`}</p>
                {s.candidateMarks !== null && (
                  <p
                    className={`mt-1 font-semibold ${
                      s.candidateMarks >= 40
                        ? 'text-green-600'
                        : s.candidateMarks >= 25
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    }`}
                  >
                    Score: {s.candidateMarks} / 50
                  </p>
                )}
              </div>

              {/* Right Section */}
              <div className="flex flex-wrap justify-end gap-2 w-full md:w-1/3 mt-2 md:mt-0">
                {s.candidateMarks === null && (
                  <>
                    {activeScoreInput === s.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          placeholder="0–50"
                          className="border border-gray-400 rounded-md px-2 py-1 w-20 focus:ring-2 focus:ring-blue-500 text-gray-800"
                          value={scoreInputs[s.id] || ''}
                          onChange={(e) =>
                            setScoreInputs({ ...scoreInputs, [s.id]: e.target.value })
                          }
                        />
                        <Button
                          size="small"
                          intent="primary"
                          onClick={() => handleAssignScore(s.id)}
                          loading={loadingScores[s.id]}
                        >
                          {loadingScores[s.id] ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="small"
                          intent="secondary"
                          onClick={() => setActiveScoreInput(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="small"
                        intent="primary"
                        onClick={() => setActiveScoreInput(s.id)}
                      >
                        Assign Score
                      </Button>
                    )}
                  </>
                )}
                <Button
                  size="small"
                  intent="secondary"
                  onClick={() => openReviewModal(s.id)}
                >
                  Write Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Write Review</h2>
            <textarea
              className="w-full border border-gray-400 rounded-md p-2 h-32 text-gray-800 focus:ring-2 focus:ring-blue-500"
              placeholder="Write your review here..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button
                size="small"
                intent="secondary"
                onClick={() => setReviewModal({ open: false, scheduleId: null })}
              >
                Cancel
              </Button>
              <Button size="small" intent="primary" onClick={handleSubmitReview}>
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedInterviews;
