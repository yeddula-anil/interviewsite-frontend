'use client';
import React, { useState, useEffect } from "react";
import { Button } from "@/components/common/Button";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/context/AuthProvider";
import axiosInstance from "@/utils/axiosInstance";

const ScheduleMeeting = () => {
  const { user } = useAuth(); // get logged-in recruiter info

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

  // Auto-fill recruiter name & email when user is available
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
    try {
      const res = await axiosInstance.post(
        "meetings/schedule",
        meeting
      );
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
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-gray-50 rounded-lg shadow text-gray-900">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-semibold mb-6 text-gray-900">Schedule a Meeting</h1>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <input
          type="text"
          name="recruiterName"
          value={meeting.recruiterName}
          readOnly
          className="p-3 border rounded bg-gray-200 cursor-not-allowed text-gray-900"
        />
        <input
          type="email"
          name="recruiterEmail"
          value={meeting.recruiterEmail}
          readOnly
          className="p-3 border rounded bg-gray-200 cursor-not-allowed text-gray-900"
        />
        <input
          type="text"
          name="companyName"
          value={meeting.companyName}
          onChange={handleChange}
          placeholder="Company Name"
          required
          className="p-3 border rounded text-gray-900"
        />
        <input
          type="url"
          name="companyLogoUrl"
          value={meeting.companyLogoUrl}
          onChange={handleChange}
          placeholder="Company Logo URL"
          className="p-3 border rounded text-gray-900"
        />
        <input
          type="text"
          name="role"
          value={meeting.role}
          onChange={handleChange}
          placeholder="Role"
          required
          className="p-3 border rounded text-gray-900"
        />
        <input
          type="email"
          name="candidateEmail"
          value={meeting.candidateEmail}
          onChange={handleChange}
          placeholder="Candidate Email"
          required
          className="p-3 border rounded text-gray-900"
        />
        <input
          type="date"
          name="date"
          value={meeting.date}
          onChange={handleChange}
          required
          className="p-3 border rounded text-gray-900"
        />
        <input
          type="time"
          name="time"
          value={meeting.time}
          onChange={handleChange}
          required
          className="p-3 border rounded text-gray-900"
        />
        <Button type="submit" className="w-full mt-2">
          Schedule Meeting
        </Button>
      </form>
    </div>
  );
};

export default ScheduleMeeting;
