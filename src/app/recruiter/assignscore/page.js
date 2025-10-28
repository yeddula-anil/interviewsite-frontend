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

  // Fetch all completed interviews for the recruiter
  const fetchCompletedInterviews = async () => {
    if (!user?.email) return;

    try {
      const { data } = await axiosInstance.get(
        `/meetings/recruiter/${encodeURIComponent(user.email)}`
      );

      // Filter completed interviews only
      const completed = data.filter((s) => s.completed === true);

      // Sort: recently marked first
      const sorted = completed.sort((a, b) => {
        if (a.markedAt && b.markedAt) {
          return new Date(b.markedAt) - new Date(a.markedAt);
        } else if (a.markedAt) {
          return -1;
        } else if (b.markedAt) {
          return 1;
        } else {
          const aEnd = new Date(`${a.date} ${a.time?.split(' - ')[1]}`);
          const bEnd = new Date(`${b.date} ${b.time?.split(' - ')[1]}`);
          return bEnd - aEnd;
        }
      });

      setSchedules(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch interviews');
    }
  };

  useEffect(() => {
    fetchCompletedInterviews();
  }, [user]);

  // Assign score (0–50)
  const handleAssignScore = async (scheduleId) => {
    const score = parseFloat(scoreInputs[scheduleId]);
    if (isNaN(score) || score < 0 || score > 50) {
      toast.error('Please enter a valid score between 0 and 50');
      return;
    }

    setLoadingScores((prev) => ({ ...prev, [scheduleId]: true }));

    try {
      const response = await axiosInstance.put(`/meetings/${scheduleId}/score`, { score });

      if (response.status === 200) {
        toast.success('Score assigned successfully!');
        setScoreInputs((prev) => ({ ...prev, [scheduleId]: '' }));
        setActiveScoreInput(null);
        await fetchCompletedInterviews();
      } else {
        toast.error('Failed to assign score');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error while assigning score');
    } finally {
      setLoadingScores((prev) => ({ ...prev, [scheduleId]: false }));
    }
  };

  // Open review modal
  const openReviewModal = (scheduleId) => {
    setReviewModal({ open: true, scheduleId });
    setReviewText('');
  };

  // Submit review
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
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit review');
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Completed Interviews</h1>

      {schedules.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">No completed interviews found.</p>
      ) : (
        <div className="space-y-4">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex flex-col md:flex-row items-center justify-between bg-white shadow-md rounded-xl p-4 border border-gray-200 hover:shadow-lg transition"
            >
              {/* Candidate Info */}
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-1/3">
                <div>
                  <p className="font-semibold text-gray-800">
                    {s.candidateName || 'Unnamed Candidate'}
                  </p>
                  <p className="text-sm text-gray-500">{s.candidateEmail}</p>
                </div>
                {s.candidateResumeUrl && (
                  <a
                    href={s.candidateResumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm"
                  >
                    View Resume
                  </a>
                )}
              </div>

              {/* Role & Date */}
              <div className="w-full md:w-1/3 text-center">
                <p className="text-gray-700 font-medium">{s.role}</p>
                <p className="text-gray-500">{`${s.date} | ${s.time}`}</p>

                {s.candidateMarks !== null && (
                  <>
                    <p className="text-green-600 font-semibold mt-1">
                      Score: {s.candidateMarks} / 50
                    </p>
                    {s.markedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Marked on: {new Date(s.markedAt).toLocaleString()}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full md:w-1/3 justify-end mt-2 md:mt-0">
                {s.candidateMarks === null && (
                  <>
                    {activeScoreInput === s.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          placeholder="Marks (0-50)"
                          value={scoreInputs[s.id] || ''}
                          onChange={(e) =>
                            setScoreInputs({ ...scoreInputs, [s.id]: e.target.value })
                          }
                          className="border px-2 py-1 rounded-md w-28 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 placeholder-gray-400"
                        />
                        <Button
                          size="small"
                          intent="primary"
                          disabled={loadingScores[s.id]}
                          onClick={() => handleAssignScore(s.id)}
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
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Write Review</h2>
            <textarea
              className="border w-full p-2 rounded-md h-32 mb-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write your review here..."
            />
            <div className="flex justify-end gap-2">
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
