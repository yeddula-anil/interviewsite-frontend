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

  // Fetch schedules for candidate
  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user?.email) return;
      try {
        const encodedEmail = encodeURIComponent(user.email);
        const res = await axiosInstance.get(`/meetings/candidate/${encodedEmail}`);
        setSchedules(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch schedules");
      }
    };
    fetchSchedules();
  }, [user]);

  // Remove schedule (delete from backend)
  const handleRemove = async (id) => {
    const removedInterview = schedules.find((s) => s.id === id);
    setSchedules(schedules.filter((s) => s.id !== id)); // Optimistic UI update
    setRemoved(removedInterview);

    try {
      await axiosInstance.delete(`/meetings/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove interview from server");
      setSchedules((prev) => [...prev, removedInterview]);
      setRemoved(null);
      return;
    }

    // Auto clear undo after 5 seconds
    setTimeout(() => setRemoved(null), 5000);
  };

  // Undo removal
  const handleUndo = async () => {
    if (!removed) return;
    try {
      await axiosInstance.post(`/meetings`, removed); // Restore backend
      setSchedules((prev) => [...prev, removed]);
      setRemoved(null);
      toast.success("Interview restored successfully!");
    } catch (err) {
      console.error(err);
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

  // Check if meeting can be joined
  const canJoin = (schedule) => {
    try {
      const startDateTime = new Date(`${schedule.date} ${schedule.time}`);
      const now = new Date();
      const tenMinutesBefore = new Date(startDateTime.getTime() - 10 * 60 * 1000);
      const oneHourAfter = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      return now >= tenMinutesBefore && now <= oneHourAfter;
    } catch {
      return false;
    }
  };

  const handleJoin = (schedule) => {
    if (canJoin(schedule)) {
      setSelectedMeeting(schedule);
      router.push(`/candidate/${schedule.meetingLink}/meeting`);
    } else {
      toast.error("You cannot join until 10 minutes before the interview");
    }
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
      console.error(err);
      toast.error("Failed to upload resume");
    }
  };

  const handleViewResume = (url) => {
    window.open(url, "_blank");
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-gray-800">Interview Schedule</h1>
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

      {/* Count */}
      <p className="text-gray-600 mb-4">{filteredSchedules.length} Interviews Scheduled</p>

      {/* Schedule Cards */}
      <div className="space-y-4">
        {filteredSchedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex flex-col md:flex-row items-center justify-between bg-white shadow-md rounded-xl p-4 border border-gray-200 hover:shadow-lg transition"
          >
            {/* Left */}
            <div className="flex items-center gap-4 w-full md:w-1/3 mb-3 md:mb-0">
              <div className="w-14 h-14 flex-shrink-0">
                <img
                  src={schedule.companyLogoUrl || "/default-logo.png"}
                  alt={schedule.companyName || "Company"}
                  className="w-full h-full object-contain rounded-md"
                />
              </div>
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800">{schedule.companyName}</h2>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  <span className="text-sm text-gray-600 font-medium">🕒 {schedule.time}</span>
                  <div className="flex items-center gap-2">
                    {schedule.candidateResumeUrl ? (
                      <button
                        onClick={() => handleViewResume(schedule.candidateResumeUrl)}
                        className="flex items-center gap-1 text-green-600 font-medium hover:text-green-700 transition"
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
              </div>
            </div>

            {/* Middle */}
            <div className="text-center w-full md:w-1/3 mb-3 md:mb-0">
              <p className="text-base font-medium text-gray-700">{schedule.role}</p>
            </div>

            {/* Right */}
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
            Removed interview with <strong>{removed.companyName}</strong>
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
