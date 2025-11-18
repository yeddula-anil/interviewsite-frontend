'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import {uploadToCloudinary} from "@/utils/uploadToCloudinary";
import { useAuth } from "@/context/AuthProvider";
import toast from "react-hot-toast";

/**
 * Dashboard component
 * - Keeps your UI exactly as before but fixes behaviors:
 *   - per-meeting loading states
 *   - upload opens file picker and uploads selected file to Cloudinary + backend
 *   - Join navigates to /meeting/{meetingId}
 *   - View feedback opens modal, button placed bottom-right
 *   - Rating badge top-right; feedback truncated in card
 *   - Average score out of 50
 */

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  // per-meeting loading states
  const [joinLoadingMap, setJoinLoadingMap] = useState({});
  const [uploadLoadingMap, setUploadLoadingMap] = useState({});
  const [viewLoadingMap, setViewLoadingMap] = useState({});
  const [watchLoadingMap, setWatchLoadingMap] = useState({});

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  const candidateEmail = user?.email;

  /* ====================== FETCH MEETINGS ====================== */
  useEffect(() => {
    if (!candidateEmail) return;

    const loadMeetings = async () => {
      try {
        setLoadingMeetings(true);
        const res = await axiosInstance.get(`/meetings/candidate/${candidateEmail}`);
        setMeetings(res.data || []);
      } catch (err) {
        console.error("Error fetching meetings:", err);
        toast.error("Failed to fetch meetings");
      } finally {
        setLoadingMeetings(false);
      }
    };

    loadMeetings();
  }, [candidateEmail]);

  /* ====================== FILTER MEETINGS ====================== */
  const now = new Date();

  const upcomingMeetings = meetings.filter(m => {
    try {
      return new Date(`${m.date} ${m.time}`) > now;
    } catch {
      return false;
    }
  });

  const resumeMissing = meetings.filter(m => !m.candidateResumeUrl);

  const recentCompleted = meetings
    .filter(m => m.completed && m.candidateMarks !== null && m.candidateMarks !== undefined)
    .sort((a, b) => {
      const sa = a.markedAt ? new Date(a.markedAt) : new Date(0);
      const sb = b.markedAt ? new Date(b.markedAt) : new Date(0);
      return sb - sa;
    })
    .slice(0, 5);

  const todayMeetings = meetings.filter(m => {
    try {
      const meetingDate = new Date(m.date).toDateString();
      return meetingDate === now.toDateString();
    } catch {
      return false;
    }
  });

  const interviewsAttended = meetings.filter(m => m.completed).length;

  // Average score: sum of candidateMarks / count (marks are out of 50)
  const avgScore =
    recentCompleted.length > 0
      ? (
          recentCompleted.reduce((sum, m) => sum + (Number(m.candidateMarks) || 0), 0)
          / recentCompleted.length
        ).toFixed(1)
      : "0";

  /* ====================== HELPERS ====================== */

  const setMapFlag = (setter, id, value) => {
    setter(prev => ({ ...prev, [id]: value }));
  };

  // Join meeting: navigate to /meeting/{meetingId}
  const handleJoin = (meetingId) => {
    setMapFlag(setJoinLoadingMap, meetingId, true);
    // simulate a short delay for spinner UX; in real app you might call an API first
    setTimeout(() => {
      setMapFlag(setJoinLoadingMap, meetingId, false);
      toast.success("Joining meeting...");
      router.push(`/meeting/${meetingId}`);
    }, 600);
  };

  // Trigger file input click (open file picker)
  const triggerFileInput = (meetingId) => {
    const input = document.getElementById(`resume-input-${meetingId}`);
    if (input) input.click();
  };

  // Upload resume handler: runs when user selects file
  const handleUploadResume = async (e, meetingId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setMapFlag(setUploadLoadingMap, meetingId, true);
      // upload to Cloudinary (your helper)
      const uploadUrl = await uploadToCloudinary(file);
      if (!uploadUrl) throw new Error("Upload failed");

      // call backend to update meeting's resume url
      await axiosInstance.put(`/meetings/${meetingId}/resume`, {
        candidateResumeUrl: uploadUrl,
      });

      toast.success("Resume uploaded successfully!");

      // update local meetings state
      setMeetings(prev =>
        prev.map(m => (m.id === meetingId ? { ...m, candidateResumeUrl: uploadUrl } : m))
      );
    } catch (err) {
      console.error("Resume upload failed:", err);
      toast.error("Failed to upload resume");
    } finally {
      setMapFlag(setUploadLoadingMap, meetingId, false);
      // clear the input value so selecting same file again will trigger change
      if (e.target) e.target.value = "";
    }
  };

  // View feedback (open modal). Add short loading to show spinner on that meeting's button.
  const handleViewFeedback = (meeting) => {
    setMapFlag(setViewLoadingMap, meeting.id, true);
    setTimeout(() => {
      setMapFlag(setViewLoadingMap, meeting.id, false);
      setModalData(meeting);
      setModalOpen(true);
    }, 400);
  };

  // Watch recording (example handler)
  const handleWatchRecording = (meetingId) => {
    setMapFlag(setWatchLoadingMap, meetingId, true);
    setTimeout(() => {
      setMapFlag(setWatchLoadingMap, meetingId, false);
      toast.success("Opening recording...");
      // if you have a recording url, navigate or open it. For now simulate.
    }, 800);
  };

  /* ====================== RENDER ====================== */
  return (
    <div
      className="w-full h-screen bg-[#031719] text-white px-10 py-6 flex flex-col gap-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #031719 0%, #041214 60%, #02090A 100%)" }}
    >
      <h1 className="text-3xl font-extrabold tracking-wide bg-gradient-to-r from-[#38f2b9] to-[#47ffd7] text-transparent bg-clip-text">
        Dashboard
      </h1>

      {/* ================= TOP STATS ================= */}
      <div className="grid grid-cols-4 gap-6 h-28">
        <StatCard label="Today's Interviews" value={todayMeetings.length} />
        <StatCard label="Pending Reviews" value={recentCompleted.length} />
        <StatCard label="Average Score" value={`${avgScore} / 50`} />
        <StatCard label="Interviews Attended" value={interviewsAttended} />
      </div>

      {/* =================== MAIN GRID =================== */}
      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        {/* LEFT SIDE */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Upcoming Interviews */}
          <Panel title="Upcoming Interviews">
            {loadingMeetings ? (
              <LoadingMini />
            ) : upcomingMeetings.length === 0 ? (
              <EmptyText text="No upcoming interviews." />
            ) : (
              upcomingMeetings.map((m) => (
                <InterviewRow
                  key={m.id}
                  meeting={m}
                  name={m.recruiterName}
                  role={m.role}
                  time={`${m.date} • ${m.time}`}
                  companyLogo={m.companyLogoUrl}
                  joinLoading={!!joinLoadingMap[m.id]}
                  onJoin={() => handleJoin(m.id)}
                />
              ))
            )}
          </Panel>

          {/* Resume Required */}
          <Panel title="Resume Required">
            {resumeMissing.length === 0 ? (
              <EmptyText text="All resumes uploaded." />
            ) : (
              resumeMissing.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold">{m.companyName}</p>
                    <p className="text-sm text-gray-400">{m.role}</p>
                    <p className="text-xs text-red-300 mt-1">Please upload your resume.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* hidden file input per meeting */}
                    <input
                      id={`resume-input-${m.id}`}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleUploadResume(e, m.id)}
                    />

                    <button
                      onClick={() => triggerFileInput(m.id)}
                      disabled={!!uploadLoadingMap[m.id]}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition ${uploadLoadingMap[m.id] ? "bg-[#0c3a36] text-gray-300 cursor-wait" : "bg-[#38f2b9] text-black hover:brightness-110"}`}
                    >
                      {uploadLoadingMap[m.id] ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>

        {/* RIGHT PANEL: RECENT ACTIVITY */}
        <Panel title="Recent Activity & Feedback">
          {loadingMeetings ? (
            <LoadingMini />
          ) : recentCompleted.length === 0 ? (
            <EmptyText text="No recent activity found." />
          ) : (
            recentCompleted.map((m) => (
              <RecentActivityCard
                key={m.id}
                data={m}
                viewLoading={!!viewLoadingMap[m.id]}
                onView={() => handleViewFeedback(m)}
                onWatch={() => handleWatchRecording(m.id)}
                watchLoading={!!watchLoadingMap[m.id]}
              />
            ))
          )}
        </Panel>
      </div>

      {/* FEEDBACK MODAL */}
      {modalOpen && modalData && (
        <FeedbackModal
          data={modalData}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ========================================================= */
/* ====================== SUBCOMPONENTS ===================== */
/* ========================================================= */

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl px-6 py-4 bg-[#041e1e] border border-[#0e3a35] shadow-[0_0_20px_#072a2a60] flex flex-col justify-center items-center">
      <p className="text-gray-300 text-sm">{label}</p>
      <h2 className="text-3xl font-bold text-[#38f2b9]">{value}</h2>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl bg-[#041e1e] border border-[#0e3a35] shadow-[0_0_25px_#072a2a70] p-6 overflow-auto">
      <h2 className="text-xl font-semibold text-[#38f2b9] mb-4">{title}</h2>
      {children}
    </div>
  );
}

function InterviewRow({ meeting, name, role, time, companyLogo, joinLoading, onJoin }) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg border border-[#38f2b9] bg-[#0a2e2b] flex items-center justify-center overflow-hidden">
          <img src={companyLogo} className="w-full h-full object-cover" alt={meeting?.companyName || "logo"} />
        </div>

        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-gray-400">{role}</p>
          <p className="text-xs text-gray-500">{time}</p>
        </div>
      </div>

      <button
        onClick={onJoin}
        disabled={joinLoading}
        className={`px-4 py-2 rounded-md text-sm font-semibold transition ${joinLoading ? "bg-[#0c3a36] text-gray-300 cursor-wait" : "bg-[#38f2b9] text-black hover:brightness-110"}`}
      >
        {joinLoading ? "Joining..." : "Join"}
      </button>
    </div>
  );
}

function ResumeRow({ data, loading, onClick }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-semibold">{data.companyName}</p>
        <p className="text-sm text-gray-400">{data.role}</p>
        <p className="text-xs text-red-300 mt-1">Please upload your resume.</p>
      </div>

      <button
        onClick={onClick}
        disabled={loading}
        className={`px-4 py-2 rounded-md text-sm font-semibold transition ${loading ? "bg-[#0c3a36] text-gray-300 cursor-wait" : "bg-[#38f2b9] text-black hover:brightness-110"}`}
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}

function RecentActivityCard({ data, viewLoading, onView, onWatch, watchLoading }) {
  // truncate feedback to one line with ellipsis in card
  return (
    <div className="relative mb-6 p-3 rounded-xl bg-[#072525] border border-[#0e3a35]">
      {/* Rating top-right */}
      <div className="absolute top-2 right-2 px-3 py-1 rounded-full bg-[#38f2b933] border border-[#38f2b9] text-[#38f2b9] text-sm font-bold">
        ⭐ {data.candidateMarks}
      </div>

      {/* Company name + role */}
      <p className="text-gray-400 text-sm">{data.companyName}</p>
      <p className="font-semibold">{data.recruiterName}</p>
      <p className="text-sm text-gray-400">{data.role}</p>

      {/* Feedback (single-line truncated) */}
      <p className="text-xs text-gray-300 mt-2 italic overflow-hidden whitespace-nowrap text-ellipsis" title={data.candidateComments || ""}>
        {data.candidateComments || "No comments"}
      </p>

      {/* Buttons bottom-right */}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onWatch}
          disabled={watchLoading}
          className={`px-3 py-1 rounded-md text-sm font-semibold transition ${watchLoading ? "bg-[#0c3a36] text-gray-300 cursor-wait" : "bg-[#1c4747] text-[#38f2b9] border border-[#38f2b9] hover:bg-[#215b5b]"}`}
        >
          {watchLoading ? "Loading..." : "Watch"}
        </button>

        <button
          onClick={onView}
          disabled={viewLoading}
          className={`px-3 py-1 rounded-md text-sm font-semibold transition ${viewLoading ? "bg-[#0c3a36] text-gray-300 cursor-wait" : "bg-[#38f2b9] text-black hover:brightness-110"}`}
        >
          {viewLoading ? "Loading..." : "View Feedback"}
        </button>
      </div>
    </div>
  );
}

function FeedbackModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-[#041e1e] border border-[#0e3a35] shadow-[0_0_30px_#072a2a70] rounded-xl p-6 w-[420px]">
        <h2 className="text-xl text-[#38f2b9] font-semibold mb-3">Feedback Summary</h2>

        <p className="text-gray-300 text-sm mb-1">
          ⭐ <span className="font-bold text-[#38f2b9]">{data.candidateMarks} / 50</span>
        </p>

        <p className="text-gray-300 text-sm mb-1">Company:</p>
        <p className="text-gray-400 text-sm mb-2">{data.companyName}</p>

        <p className="text-gray-300 text-sm mb-1">📝 Feedback:</p>
        <p className="text-gray-400 text-sm italic mb-4">{data.candidateComments || "No comments"}</p>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-[#38f2b9] text-black hover:brightness-110">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyText({ text }) {
  return <p className="text-gray-400 text-sm">{text}</p>;
}

function LoadingMini() {
  return (
    <div className="flex justify-center py-4">
      <div className="w-6 h-6 border-4 border-[#38f2b9] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
