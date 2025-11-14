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

  // Fetch schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user?.email) return;
      try {
        const res = await axiosInstance.get(
          `/meetings/candidate/${encodeURIComponent(user.email)}`
        );
        setSchedules(res.data);
      } catch (err) {
        toast.error("Failed to fetch schedules");
      }
    };
    fetchSchedules();
  }, [user]);

  const handleRemove = async (id) => {
    const removedInterview = schedules.find((s) => s.id === id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
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
      await axiosInstance.put(`/meetings/${scheduleId}/resume`, {
        resumeUrl: uploadUrl,
      });

      toast.success("Resume uploaded successfully!");

      setSchedules((prev) =>
        prev.map((s) =>
          s.id === scheduleId ? { ...s, candidateResumeUrl: uploadUrl } : s
        )
      );
    } catch {
      toast.error("Failed to upload resume");
    }
  };

  const handleViewResume = (url) => {
    window.open(url, "_blank");
  };

  return (
    <div
      className="
      min-h-screen w-full px-10 py-10 text-white
      bg-gradient-to-r from-[#126E7A] to-[#051B21]
      "
    >

      {/* ---------- HEADER ---------- */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-wide">
            <span className="bg-gradient-to-r from-[#38f2b9] to-white bg-clip-text text-transparent">
              Interview Schedule
            </span>
          </h1>
          <p className="text-gray-200/80 mt-1">Manage your interview slots</p>
        </div>

        <div className="flex gap-3">
          {["All", "Today", "Upcoming"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-5 py-2 rounded-md text-sm font-medium transition-all
                ${
                  filter === f
                    ? "bg-[#3DF29E] text-black shadow-[0_0_10px_#3df29e80]"
                    : "bg-[#0d121f]/40 border border-[#1a2234] text-gray-200 hover:bg-[#162032]"
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="text-gray-200/70 mb-4">{filteredSchedules.length} Results</p>

      {/* ---------- LIST ---------- */}
      <div className="space-y-5">
        {filteredSchedules.map((schedule) => (
          <div
            key={schedule.id}
            className="
              w-full p-6 rounded-xl 
              bg-[#0B0F1A]/80 backdrop-blur-xl
              border border-[#1b2335]/70 
              hover:border-[#3615ae] transition-all 
              hover:shadow-[0_0_25px_#38f2b930]
              flex flex-col md:flex-row justify-between items-center
            "
          >
            {/* LEFT */}
            <div className="flex items-center gap-5 w-full md:w-1/3 mb-4 md:mb-0">
              <div className="w-16 h-16 rounded-lg bg-[#111827] border border-[#1f2937] overflow-hidden flex items-center justify-center">
                <img
                  src={schedule.companyLogoUrl || "/default-logo.png"}
                  className="w-full h-full object-contain opacity-90"
                />
              </div>
              <div>
                <h2 className="text-xl text-grey-900 font-semibold">{schedule.companyName}</h2>
                <p className="text-gray-400 text-sm">
                  🕒 {schedule.date} • {schedule.time}
                </p>
              </div>
            </div>

            {/* MIDDLE */}
            <div className="text-center w-full md:w-1/3">
              <p className="text-xl font-600 text-[#eff1e9]">{schedule.role}</p>

              <div className="mt-2">
                {schedule.candidateResumeUrl ? (
                  <button
                    onClick={() => handleViewResume(schedule.candidateResumeUrl)}
                    className="text-orange-400 hover:text-white flex gap-2 justify-center items-center"
                  >
                    <FaEye /> View Resume
                  </button>
                ) : (
                  <label className="cursor-pointer text-blue-200 hover:text-white flex gap-2 justify-center items-center">
                    <FaUpload /> Upload Resume
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

            {/* RIGHT */}
            <div className="flex gap-3 w-full md:w-1/3 justify-end">

              {/* JOIN BUTTON (your gradient) */}
              <button
                onClick={() => handleJoin(schedule)}
                className="
                  px-6 py-2.5 rounded-md font-medium text-white 
                  bg-gradient-to-r from-[#126E7A] to-[#051B21]
                  hover:from-[#221064] hover:to-[#01495a]
                  transition-all shadow-[0_0_10px_#00000060] 
                  border border-[#0d2b33]/50
                "
              >
                Join
              </button>

              {/* REMOVE BUTTON (premium red gradient) */}
              <button
                onClick={() => handleRemove(schedule.id)}
                className="
                  px-6 py-2.5 rounded-md font-medium text-white
                  bg-gradient-to-r from-[#541d1d] to-[#333131]
                  hover:from-[#A82F2F] hover:to-[#320A0A]
                  transition-all shadow-[0_0_10px_#c4383840]
                  border border-[#450d0d]/60
                "
              >
                Remove
              </button>

            </div>
          </div>
        ))}

        {filteredSchedules.length === 0 && (
          <p className="text-center text-gray-200/70 py-20 text-lg">
            No interviews found for this filter.
          </p>
        )}
      </div>

      {/* ---------- UNDO SNACKBAR ---------- */}
      {removed && (
        <div className="
          fixed bottom-6 right-6 px-6 py-3 rounded-lg
          bg-[#0B0F1A]/95 backdrop-blur-xl
          border border-[#38f2b9] 
          shadow-[0_0_25px_#38f2b950]
          flex items-center gap-4
        ">
          <span>
            Removed <strong className="text-[#38f2b9]">{removed.companyName}</strong>
          </span>

          <button
            onClick={handleUndo}
            className="px-4 py-1 bg-[#3DF29E] text-black rounded-md hover:bg-[#29d987]"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};

export default Schedule;
