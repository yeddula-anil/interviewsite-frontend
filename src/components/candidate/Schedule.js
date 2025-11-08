'use client';
import React, { useState, useEffect } from "react";
import { Button } from "@/components/common/Button";
import { usePreJoin } from "@/context/PreJoinContext";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import toast from "react-hot-toast";
import { FaUpload, FaEye } from "react-icons/fa";
import { useAuth } from "@/context/AuthProvider";
import { uploadToCloudinary } from "@/utils/uploadToCloudinary";

const Schedule = () => {
  const router = useRouter();
  const { setSelectedMeeting } = usePreJoin();
  const [schedules, setSchedules] = useState([]);
  const [removed, setRemoved] = useState(null);
  const [filter, setFilter] = useState("All");
  const { user } = useAuth();

  // Fetch candidate schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user?.email) return;
      try {
        const res = await axiosInstance.get(`/meetings/candidate/${encodeURIComponent(user.email)}`);
        setSchedules(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch schedules");
      }
    };
    fetchSchedules();
  }, [user]);

  // Remove schedule
  const handleRemove = async (id) => {
    const removedInterview = schedules.find((s) => s.id === id);
    setSchedules(schedules.filter((s) => s.id !== id));
    setRemoved(removedInterview);

    try {
      await axiosInstance.delete(`/meetings/${id}`);
    } catch (err) {
      toast.error("Failed to remove interview");
      setSchedules((prev) => [...prev, removedInterview]);
      setRemoved(null);
    }

    setTimeout(() => setRemoved(null), 5000);
  };

  const handleUndo = async () => {
    if (!removed) return;
    try {
      await axiosInstance.post(`/meetings`, removed);
      setSchedules((prev) => [...prev, removed]);
      setRemoved(null);
      toast.success("Interview restored successfully!");
    } catch {
      toast.error("Failed to restore interview");
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const filteredSchedules =
    filter === "Today"
      ? schedules.filter((s) => s.date === today)
      : filter === "Upcoming"
      ? schedules.filter((s) => s.date > today)
      : schedules;

  const handleJoin = (schedule) => {
    setSelectedMeeting(schedule);
    router.push(`/meeting/${schedule.id}`);
  };

  const handleUploadResume = async (e, scheduleId) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const uploadUrl = await uploadToCloudinary(file);
      await axiosInstance.put(`/meetings/${scheduleId}/resume`, { resumeUrl: uploadUrl });
      toast.success("Resume uploaded successfully!");
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === scheduleId ? { ...s, candidateResumeUrl: uploadUrl } : s
        )
      );
    } catch (err) {
      toast.error("Failed to upload resume");
    }
  };

  const handleViewResume = (url) => {
    window.open(url, "_blank");
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Interview Schedule</h1>
        <div className="flex gap-3 flex-wrap">
          {["All", "Today", "Upcoming"].map((f) => (
            <Button
              key={f}
              intent={filter === f ? "primary" : "secondary"}
              size="small"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-gray-600 mb-4">
        {filteredSchedules.length} Interviews Scheduled
      </p>

      {/* Schedule Cards */}
      <div className="space-y-4">
        {filteredSchedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex flex-col md:flex-row items-center justify-between bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all p-5"
          >
            {/* Left Section */}
            <div className="flex items-center gap-5 w-full md:w-1/3 mb-3 md:mb-0">
              <div className="w-20 h-20 flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
                <img
                  src={schedule.companyLogoUrl || "/default-logo.png"}
                  alt={schedule.companyName || "Company"}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {schedule.companyName}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  🕒 {schedule.date} | {schedule.time}
                </p>
              </div>
            </div>

            {/* Middle Section */}
            <div className="text-center w-full md:w-1/3 mb-3 md:mb-0">
              <p className="text-base font-medium text-gray-800">{schedule.role}</p>
              <div className="flex items-center justify-center gap-4 mt-2">
                {schedule.candidateResumeUrl ? (
                  <button
                    onClick={() => handleViewResume(schedule.candidateResumeUrl)}
                    className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium transition"
                  >
                    <FaEye size={16} />
                    <span>View Resume</span>
                  </button>
                ) : (
                  <label className="flex items-center gap-1 text-blue-600 cursor-pointer font-medium hover:text-blue-700 transition">
                    <FaUpload size={16} />
                    <span>Upload Resume</span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => handleUploadResume(e, schedule.id)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Right Section */}
            <div className="flex gap-3 justify-end w-full md:w-1/3">
              <Button intent="primary" size="small" onClick={() => handleJoin(schedule)}>
                Join
              </Button>
              <Button intent="secondary" size="small" onClick={() => handleRemove(schedule.id)}>
                Remove
              </Button>
            </div>
          </div>
        ))}

        {filteredSchedules.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            No interviews found for this filter.
          </p>
        )}
      </div>

      {/* Undo Snackbar */}
      {removed && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-slideIn">
          <span>
            Removed interview with{" "}
            <strong className="text-blue-400">{removed.companyName}</strong>
          </span>
          <Button intent="accent" size="small" onClick={handleUndo}>
            Undo
          </Button>
        </div>
      )}
    </div>
  );
};

export default Schedule;
