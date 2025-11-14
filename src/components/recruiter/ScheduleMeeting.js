"use client";

import React, { useState, useEffect } from "react";
import axiosInstance from "@/utils/axiosInstance";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/context/AuthProvider";
import { FaSpinner } from "react-icons/fa";

const ScheduleMeeting = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);

  const [meeting, setMeeting] = useState({
    recruiterName: "",
    recruiterEmail: "",
    companyName: "",
    companyLogoUrl: "",
    role: "",
    date: "",
    time: "",
    candidateEmail: "",
  });

  useEffect(() => {
    if (user) {
      setMeeting((prev) => ({
        ...prev,
        recruiterName: user.username || "",
        recruiterEmail: user.email || "",
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    setMeeting({ ...meeting, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axiosInstance.post("meetings/schedule", meeting);

      if (res.status === 200 || res.status === 201) {
        toast.success("Meeting scheduled successfully!");

        setMeeting((prev) => ({
          ...prev,
          companyName: "",
          companyLogoUrl: "",
          role: "",
          date: "",
          time: "",
          candidateEmail: "",
        }));
      } else {
        toast.error("Failed to schedule meeting");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error scheduling meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        min-h-screen w-full px-10 py-12 text-white
        bg-gradient-to-r from-[#126E7A] to-[#051B21]
        flex justify-center
      "
    >
      <Toaster position="top-right" />

      <div
        className="
          w-full max-w-lg p-6 rounded-2xl  
          bg-[#0B0F1A]/70 backdrop-blur-xl
          border border-[#1b2335]/70 
          shadow-[0_0_25px_#38f2b930]
        "
      >
        <h1 className="text-3xl font-bold tracking-wide text-center mb-6">
          <span className="bg-gradient-to-r from-[#38f2b9] to-white bg-clip-text text-transparent">
            Schedule Interview
          </span>
        </h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          
          {/* RECRUITER NAME */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Recruiter Name</label>
            <input
              type="text"
              name="recruiterName"
              value={meeting.recruiterName}
              readOnly
              className="
                p-3 rounded-md 
                bg-[#D1FFF4]/90 text-black font-semibold
                border border-[#38f2b9] 
                cursor-not-allowed shadow-sm
              "
            />
          </div>

          {/* RECRUITER EMAIL */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Recruiter Email</label>
            <input
              type="email"
              name="recruiterEmail"
              value={meeting.recruiterEmail}
              readOnly
              className="
                p-3 rounded-md 
                bg-[#D1FFF4]/90 text-black font-semibold
                border border-[#38f2b9]
                cursor-not-allowed shadow-sm
              "
            />
          </div>

          {/* COMPANY NAME */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={meeting.companyName}
              onChange={handleChange}
              required
              className="
                p-3 rounded-md bg-white text-black
                border border-[#1b2335] focus:border-[#38f2b9]
              "
            />
          </div>

          {/* LOGO URL */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Company Logo URL</label>
            <input
              type="url"
              name="companyLogoUrl"
              value={meeting.companyLogoUrl}
              onChange={handleChange}
              className="
                p-3 rounded-md bg-white text-black
                border border-[#1b2335] focus:border-[#38f2b9]
              "
            />
          </div>

          {/* ROLE */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Role</label>
            <input
              type="text"
              name="role"
              value={meeting.role}
              onChange={handleChange}
              required
              className="
                p-3 rounded-md bg-white text-black
                border border-[#1b2335] focus:border-[#38f2b9]
              "
            />
          </div>

          {/* CANDIDATE EMAIL */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Candidate Email</label>
            <input
              type="email"
              name="candidateEmail"
              value={meeting.candidateEmail}
              onChange={handleChange}
              required
              className="
                p-3 rounded-md bg-white text-black
                border border-[#1b2335] focus:border-[#38f2b9]
              "
            />
          </div>

          {/* DATE */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Date</label>
            <input
              type="date"
              name="date"
              value={meeting.date}
              onChange={handleChange}
              required
              className="
                p-3 rounded-md bg-white text-black
                border border-[#1b2335] focus:border-[#38f2b9]
              "
            />
          </div>

          {/* TIME */}
          <div className="flex flex-col">
            <label className="text-gray-200 mb-1 text-sm">Time</label>
            <input
              type="time"
              name="time"
              value={meeting.time}
              onChange={handleChange}
              required
              className="
                p-3 rounded-md bg-white text-black
                border border-[#1b2335] focus:border-[#38f2b9]
              "
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            disabled={loading}
            className="
              mt-3 py-3 rounded-md font-semibold text-white 
              bg-gradient-to-r from-[#126E7A] to-[#051B21]
              hover:from-[#1b8c96] hover:to-[#0a2e36]
              border border-[#0d2b33]/50
              transition-all shadow-[0_0_12px_#00000060]
              flex items-center justify-center
            "
          >
            {loading ? (
              <FaSpinner className="animate-spin text-white" />
            ) : (
              "Schedule Meeting"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ScheduleMeeting;
