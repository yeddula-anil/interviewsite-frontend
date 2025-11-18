"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/context/AuthProvider";

/* ===== keep the same spinner component ===== */
function LoadingMini() {
  return (
    <div className="flex justify-center py-4">
      <div className="w-6 h-6 border-4 border-[#38f2b9] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  // Existing feedback modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  // NEW: Score modal
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [scoreValue, setScoreValue] = useState("");
  const [scoreMeeting, setScoreMeeting] = useState(null);

  // NEW: Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewMeeting, setReviewMeeting] = useState(null);

  // loading for buttons
  const [actionLoadingMap, setActionLoadingMap] = useState({});

  const setMapFlag = (setter, id, value) => {
    setter((prev) => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    if (!user?.email) return;

    const load = async () => {
      setLoadingMeetings(true);
      try {
        const res = await axiosInstance.get(`/meetings/recruiter/${user.email}`);
        setMeetings(res.data || []);
      } catch (err) {
        toast.error("Failed to fetch meetings");
      } finally {
        setLoadingMeetings(false);
      }
    };

    load();
  }, [user?.email]);

  const parseMeetingDate = (m) => {
    try {
      if (m.date && m.time) {
        const d = new Date(`${m.date} ${m.time}`);
        if (!isNaN(d)) return d;
      }
      if (m.date) {
        const d2 = new Date(m.date);
        if (!isNaN(d2)) return d2;
      }
    } catch {}
    return new Date(0);
  };

  const now = new Date();

  const upcomingMeetings = meetings.filter((m) => parseMeetingDate(m) > now);
  const completedMeetings = meetings.filter((m) => !!m.completed);

  const interviewsConducted = completedMeetings.length;

  const pendingScoring = completedMeetings.filter(
    (m) => m.candidateMarks == null
  );

  const recentlyScored = completedMeetings
    .filter((m) => m.candidateMarks != null)
    .sort((a, b) => (new Date(b.markedAt || 0)) - (new Date(a.markedAt || 0)))
    .slice(0, 6);

  const scoredForAvg = completedMeetings.filter(
    (m) => m.candidateMarks != null
  );

  const avgScore =
    scoredForAvg.length > 0
      ? (
          scoredForAvg.reduce((sum, m) => sum + Number(m.candidateMarks || 0), 0) /
          scoredForAvg.length
        ).toFixed(1)
      : "0";

  const todayMeetings = meetings.filter(
    (m) => parseMeetingDate(m).toDateString() === now.toDateString()
  );

  /* ============== scoring handlers ============== */
  const openScoreModal = (meeting) => {
    setScoreMeeting(meeting);
    setScoreValue("");
    setScoreModalOpen(true);
  };

  const submitScore = async () => {
    if (!scoreValue || scoreValue < 1 || scoreValue > 50) {
      toast.error("Score must be 1 to 50");
      return;
    }

    try {
      await axiosInstance.put(`/meetings/${scoreMeeting.id}/score`, {
        candidateMarks: Number(scoreValue),
      });

      toast.success("Score submitted!");

      setMeetings((prev) =>
        prev.map((m) =>
          m.id === scoreMeeting.id
            ? { ...m, candidateMarks: Number(scoreValue) }
            : m
        )
      );

      setScoreModalOpen(false);
    } catch (err) {
      toast.error("Score update failed");
    }
  };

  /* ============== review handlers ============== */
  const openReviewModal = (meeting) => {
    setReviewMeeting(meeting);
    setReviewText("");
    setReviewModalOpen(true);
  };

  const submitReview = async () => {
    if (!reviewText.trim()) {
      toast.error("Review is empty");
      return;
    }

    try {
      await axiosInstance.put(`/meetings/${reviewMeeting.id}/review`, {
        candidateComments: reviewText,
      });

      toast.success("Review submitted!");

      setMeetings((prev) =>
        prev.map((m) =>
          m.id === reviewMeeting.id
            ? { ...m, candidateComments: reviewText }
            : m
        )
      );

      setReviewModalOpen(false);
    } catch (err) {
      toast.error("Review update failed");
    }
  };

  const openFeedback = (m) => {
    setModalData(m);
    setModalOpen(true);
  };

  const closeFeedback = () => {
    setModalOpen(false);
    setModalData(null);
  };

  /* ========================= UI ========================= */
  return (
    <div
      className="min-h-screen text-white px-8 py-6"
      style={{
        background:
          "linear-gradient(180deg, #031719 0%, #041214 60%, #02090A 100%)",
      }}
    >
      <h1 className="text-3xl font-extrabold tracking-wide mb-6">
        <span className="bg-gradient-to-r from-[#38f2b9] to-[#47ffd7] text-transparent bg-clip-text">
          Dashboard
        </span>
      </h1>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatBox label="Interviews Conducted" value={interviewsConducted} loading={loadingMeetings} />
        <StatBox label="Today's Meetings" value={todayMeetings.length} loading={loadingMeetings} />
        <StatBox label="Pending Scoring" value={pendingScoring.length} loading={loadingMeetings} />
        <StatBox label="Avg. Score Given" value={`${avgScore} / 50`} loading={loadingMeetings} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT PANEL (WITH SCROLLBAR) */}
        <div className="rounded-xl bg-[#041e1e] border border-[#0e3a35] 
            shadow-[0_0_25px_#072a2a70] p-6 overflow-y-auto max-h-[600px] custom-scroll">
          
          <h2 className="text-xl font-semibold text-[#38f2b9] mb-4">
            Upcoming & Pending Scoring
          </h2>

          {/* UPCOMING */}
          {loadingMeetings ? (
            <LoadingMini />
          ) : upcomingMeetings.length === 0 ? (
            <p className="text-gray-400">No upcoming interviews.</p>
          ) : (
            upcomingMeetings.map((it) => (
              <div key={it.id} className="py-4 flex justify-between items-center border-b border-[#0e3a35]">
                <div>
                  <p className="font-semibold">{it.candidateEmail}</p>
                  <p className="text-sm text-gray-400">{it.role}</p>
                  <p className="text-xs text-gray-500">{it.date} • {it.time}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button className="px-5 py-2 rounded-md text-sm font-semibold bg-[#38f2b9] text-black">
                    Start
                  </button>

                  <button className="px-4 py-2 rounded-md text-sm font-semibold bg-[#0a2e2b] text-[#bcded2] border border-[#0e3a35]">
                    Reschedule
                  </button>
                </div>
              </div>
            ))
          )}

          {/* PENDING SCORING */}
          <h3 className="text-lg text-[#38f2b9] mt-6 mb-3">
            Pending Scoring
          </h3>

          {loadingMeetings ? (
            <LoadingMini />
          ) : pendingScoring.length === 0 ? (
            <p className="text-gray-400">No pending scoring.</p>
          ) : (
            pendingScoring.map((it) => (
              <div key={it.id} className="py-4 flex justify-between items-center border-b border-[#0e3a35]">
                <div>
                  <p className="font-semibold text-yellow-300">{it.candidateEmail}</p>
                  <p className="text-sm text-gray-400">{it.role}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    className="px-4 py-2 rounded-md text-sm font-semibold bg-[#1c7b69] text-white"
                    onClick={() => openScoreModal(it)}
                  >
                    Score Now
                  </button>

                  <button
                    className="px-4 py-2 rounded-md text-sm font-semibold bg-[#0a2e2b] text-[#bcded2] border border-[#0e3a35]"
                    onClick={() => openReviewModal(it)}
                  >
                    Write Review
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT PANEL (WITH SCROLLBAR) */}
        <div className="rounded-xl bg-[#041e1e] border border-[#0e3a35] 
            shadow-[0_0_25px_#072a2a70] p-6 overflow-y-auto max-h-[600px] custom-scroll">
          
          <h2 className="text-xl font-semibold text-[#38f2b9] mb-4">
            Recently Scored & Feedback
          </h2>

          {loadingMeetings ? (
            <LoadingMini />
          ) : recentlyScored.length === 0 ? (
            <p className="text-gray-400">No recent scored interviews.</p>
          ) : (
            recentlyScored.map((r) => (
              <div key={r.id} className="relative p-4 bg-[#072525] rounded-xl border border-[#083231] mb-4">
                <div className="absolute top-2 right-2 px-3 py-1 rounded-full bg-[#38f2b933] border border-[#38f2b9] text-[#38f2b9]">
                  ★ {r.candidateMarks} / 50
                </div>

                <p className="font-semibold">{r.candidateEmail}</p>
                <p className="text-sm text-gray-400">{r.role}</p>
                <p className="text-xs text-gray-300 mt-2 italic truncate">
                  {r.candidateComments}
                </p>

                <div className="flex justify-end mt-3">
                  <button
                    className="px-4 py-2 rounded-md bg-[#38f2b9] text-black"
                    onClick={() => openFeedback(r)}
                  >
                    View Feedback
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* EXISTING FEEDBACK MODAL */}
      {modalOpen && modalData && (
        <FeedbackModal data={modalData} onClose={closeFeedback} />
      )}

      {/* SCORE MODAL */}
      {scoreModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#041e1e] border border-[#0e3a35] rounded-xl p-6 w-[380px]">
            <h2 className="text-xl text-[#38f2b9] mb-4 font-bold">Enter Score (1–50)</h2>

            <input
              type="number"
              min="1"
              max="50"
              value={scoreValue}
              onChange={(e) => setScoreValue(e.target.value)}
              className="w-full bg-[#072525] border border-[#083231] rounded-lg px-4 py-2 text-white"
            />

            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 rounded-md bg-gray-700 text-white" 
                onClick={() => setScoreModalOpen(false)}>
                Cancel
              </button>

              <button className="px-4 py-2 rounded-md bg-[#38f2b9] text-black" 
                onClick={submitScore}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {reviewModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#041e1e] border border-[#0e3a35] rounded-xl p-6 w-[420px]">
            <h2 className="text-xl text-[#38f2b9] mb-4 font-bold">Write Review</h2>

            <textarea
              rows={5}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full bg-[#072525] border border-[#083231] rounded-lg px-4 py-2 text-white"
              placeholder="Enter your feedback..."
            />

            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 rounded-md bg-gray-700 text-white"
                onClick={() => setReviewModalOpen(false)}>
                Cancel
              </button>

              <button className="px-4 py-2 rounded-md bg-[#38f2b9] text-black"
                onClick={submitReview}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* FEEDBACK MODAL */
function FeedbackModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#041e1e] border border-[#0e3a35] rounded-xl p-6 w-[440px]">
        <h3 className="text-xl font-semibold text-[#38f2b9] mb-2">Feedback Summary</h3>

        <p className="text-gray-300 mb-2">
          <strong className="text-[#38f2b9]">Score:</strong> {data.candidateMarks} / 50
        </p>

        <p className="text-gray-300 mb-4">
          <strong>Candidate:</strong> {data.candidateEmail}
        </p>

        <p className="text-gray-400 italic">
          {data.candidateComments || "No comments provided."}
        </p>

        <div className="flex justify-end mt-6">
          <button className="px-4 py-2 rounded-md bg-[#38f2b9] text-black" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* STAT BOX */
function StatBox({ label, value, loading }) {
  return (
    <div className="rounded-xl px-6 py-6 bg-[#041e1e] border border-[#083231] shadow-[0_0_20px_#072a2a60]">
      <p className="text-sm text-gray-300">{label}</p>

      {loading ? (
        <div className="mt-3">
          <div className="w-8 h-8 border-4 border-[#38f2b9] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <h2 className="text-3xl font-bold text-[#38f2b9] mt-2">{value}</h2>
      )}
    </div>
  );
}
