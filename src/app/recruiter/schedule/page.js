'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import toast from 'react-hot-toast';
import axiosInstance from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'next/navigation';
import { usePreJoin } from '@/context/PreJoinContext';
import { FaSpinner } from "react-icons/fa";

const RecruiterSchedule = () => {
  const router = useRouter();
  const [schedules, setSchedules] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedDate, setSelectedDate] = useState('');
  const [loadingIds, setLoadingIds] = useState([]);     // For Mark Completed
  const [joinLoadingIds, setJoinLoadingIds] = useState([]); // NEW: For Join
  const [updating, setUpdating] = useState(false);
  const { setSelectedMeeting } = usePreJoin();

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const { user } = useAuth();

  useEffect(() => {
    const fetchMeetings = async () => {
      if (!user?.email) return;
      try {
        const res = await axiosInstance.get(
          `/meetings/recruiter/${encodeURIComponent(user.email)}`
        );
        setSchedules(res.data.filter((s) => !s.completed));
      } catch (err) {
        toast.error('Failed to fetch meetings');
      }
    };
    fetchMeetings();
  }, [user]);

  const filteredSchedules = schedules.filter((s) => {
    const scheduleTime = new Date(`${s.date} ${s.time}`);
    if (filter === 'Today') return s.date === today;
    if (filter === 'Upcoming') return scheduleTime > now;
    if (selectedDate) return s.date === selectedDate;
    return true;
  });

  const openUpdateModal = (schedule) => {
    setSelectedSchedule(schedule);
    setNewDate(schedule.date);
    setNewTime(schedule.time);
    setModalOpen(true);
  };

  const handleUpdateTiming = async () => {
    if (!newDate || !newTime) {
      toast.error('Please select both date and time');
      return;
    }

    try {
      setUpdating(true);
      await axiosInstance.put(`/meetings/${selectedSchedule.id}/update-timing`, {
        date: newDate,
        time: newTime,
      });

      setSchedules((prev) =>
        prev.map((s) =>
          s.id === selectedSchedule.id ? { ...s, date: newDate, time: newTime } : s
        )
      );
      toast.success('Interview timing updated!');
      setModalOpen(false);
    } catch {
      toast.error('Failed to update meeting');
    } finally {
      setUpdating(false);
    }
  };

  const handleJoin = async (schedule) => {
    setJoinLoadingIds((prev) => [...prev, schedule.id]);

    setTimeout(() => {
      setSelectedMeeting(schedule.id);
      router.push(`/meeting/${schedule.id}`);
    }, 700);
  };

  const handleMarkCompleted = async (schedule) => {
    setLoadingIds((prev) => [...prev, schedule.id]);
    setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));

    try {
      await axiosInstance.put(`/meetings/${schedule.id}/complete`, { completed: true });
      toast.success('Marked as completed!');
    } catch {
      setSchedules((prev) => [...prev, schedule]);
      toast.error('Failed to mark as completed');
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== schedule.id));
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
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-wide">
            <span className="bg-gradient-to-r from-[#38f2b9] to-white bg-clip-text text-transparent">
              Interview Schedule
            </span>
          </h1>
          <p className="text-gray-200/80 mt-1">Manage all scheduled interviews</p>
        </div>

        {/* FILTER BUTTONS */}
        <div className="flex gap-3">
          {["All", "Today", "Upcoming"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setSelectedDate('');
              }}
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

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setFilter("All");
            }}
            className="
              border border-[#1b2335] bg-[#0b101a]/60 text-gray-200 px-3 py-2 rounded-md
              focus:outline-none focus:border-[#38f2b9]
            "
          />
        </div>
      </div>

      {/* COUNT */}
      <p className="text-gray-200/70 mb-4">
        {filteredSchedules.length} Results
      </p>

      {/* LIST */}
      <div className="space-y-5">
        {filteredSchedules.map((s) => (
          <div
            key={s.id}
            className="
              w-full p-6 rounded-xl 
              bg-[#0B0F1A]/80 backdrop-blur-xl
              border border-[#1b2335]/70 
              hover:border-[#38f2b9] transition-all 
              hover:shadow-[0_0_25px_#38f2b930]
              flex flex-col md:flex-row justify-between items-center
            "
          >
            {/* LEFT */}
            <div className="flex flex-col md:flex-row gap-5 w-full md:w-1/3 mb-4 md:mb-0">
              <div>
                <h2 className="text-lg font-semibold">{s.candidateEmail}</h2>
                <p className="text-gray-400 text-sm">
                  📅 {s.date} • {s.time}
                </p>
              </div>
            </div>

            {/* MIDDLE — ROLE + RESUME */}
            <div className="text-center w-full md:w-1/3 flex flex-col items-center">
              <p className="text-xl font-semibold text-white mb-2">
                {s.role}
              </p>

              {s.candidateResumeUrl ? (
                <a
                  href={s.candidateResumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-white underline"
                >
                  View Resume
                </a>
              ) : (
                <p className="text-gray-500 italic">No Resume Uploaded</p>
              )}
            </div>

            {/* RIGHT BUTTONS */}
            <div className="flex gap-3 w-full md:w-1/3 justify-end">

              {/* JOIN */}
              <button
                onClick={() => handleJoin(s)}
                disabled={joinLoadingIds.includes(s.id)}
                className="
                  px-6 py-2.5 rounded-md font-medium text-white 
                  bg-gradient-to-r from-[#126E7A] to-[#051B21]
                  hover:from-[#1b8c96] hover:to-[#0a2e36]
                  transition-all shadow-[0_0_10px_#00000060]
                  flex items-center justify-center
                "
              >
                {joinLoadingIds.includes(s.id) ? (
                  <FaSpinner className="animate-spin text-white" />
                ) : (
                  "Join"
                )}
              </button>

              {/* UPDATE TIMING */}
              <button
                onClick={() => openUpdateModal(s)}
                disabled={updating && selectedSchedule?.id === s.id}
                className="
                  px-6 py-2.5 rounded-md font-medium text-white 
                  bg-gradient-to-r from-[#32296C] to-[#180A44]
                  hover:from-[#4F3FB0] hover:to-[#240C66]
                  transition-all border border-[#3f2e8f]/40
                  flex items-center justify-center
                "
              >
                {updating && selectedSchedule?.id === s.id ? (
                  <FaSpinner className="animate-spin text-white" />
                ) : (
                  "Update Timing"
                )}
              </button>

              {/* MARK COMPLETED */}
              <button
                onClick={() => handleMarkCompleted(s)}
                disabled={loadingIds.includes(s.id)}
                className="
                  px-6 py-2.5 rounded-md font-medium text-white 
                  bg-gradient-to-r from-[#114D28] to-[#0A2A12]
                  hover:from-[#1D7A3F] hover:to-[#0A401A]
                  border border-[#165c33]/60 transition-all
                  flex items-center justify-center
                "
              >
                {loadingIds.includes(s.id) ? (
                  <FaSpinner className="animate-spin text-white" />
                ) : (
                  "Mark Completed"
                )}
              </button>

            </div>
          </div>
        ))}

        {filteredSchedules.length === 0 && (
          <p className="text-center text-gray-200/70 py-20 text-lg">
            No interviews found.
          </p>
        )}
      </div>

      {/* UPDATE TIMING MODAL */}
      {modalOpen && selectedSchedule && (
        <Modal onClose={() => setModalOpen(false)} title="Update Interview Timing">
          <div className="flex flex-col gap-4">

            {/* DATE FIELD */}
            <div>
              <label className="block text-gray-300 mb-1">Select New Date</label>

              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="
                  w-full px-4 py-2.5 rounded-lg 
                  bg-[#1a2234] text-white 
                  border border-[#374151]
                  shadow-inner
                  focus:outline-none 
                  focus:border-[#38f2b9]
                  transition-all
                "
              />
            </div>

            {/* TIME FIELD */}
            <div>
              <label className="block text-gray-300 mb-1">Select New Time</label>

              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="
                  w-full px-4 py-2.5 rounded-lg 
                  bg-[#1a2234] text-white 
                  border border-[#374151]
                  shadow-inner
                  focus:outline-none 
                  focus:border-[#38f2b9]
                  transition-all
                "
              />
            </div>

            {/* UPDATE BUTTON */}
            <button
              onClick={handleUpdateTiming}
              disabled={updating}
              className="
                px-6 py-2.5 rounded-md font-medium text-white 
                bg-gradient-to-r from-[#126E7A] to-[#051B21]
                hover:from-[#1b8c96] hover:to-[#0a2e36]
                transition-all flex items-center justify-center
              "
            >
              {updating ? (
                <FaSpinner className="animate-spin text-white text-xl" />
              ) : (
                "Update Timing"
              )}
            </button>
          </div>
        </Modal>


      )}
    </div>
  );
};

export default RecruiterSchedule;
