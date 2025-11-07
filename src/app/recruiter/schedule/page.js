'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import toast from 'react-hot-toast';
import axiosInstance from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'next/navigation';
import { usePreJoin } from '@/context/PreJoinContext';


const RecruiterSchedule = () => {
  const router=useRouter()
  const [schedules, setSchedules] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedDate, setSelectedDate] = useState('');
  const [loadingIds, setLoadingIds] = useState([]); // for Mark Completed
  const [updating, setUpdating] = useState(false);
  const {setSelectedMeeting}=usePreJoin() // for Update Timing

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const { user } = useAuth();

  useEffect(() => {
    const fetchMeetings = async () => {
      if (!user?.email) return;
      try {
        const res = await axiosInstance.get(`/meetings/recruiter/${encodeURIComponent(user.email)}`);
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

  const canJoin = (schedule) => {
    // const scheduleTime = new Date(`${schedule.date} ${schedule.time}`);
    // const tenMinBefore = new Date(scheduleTime.getTime() - 10 * 60 * 1000);
    // const tenMinAfter = new Date(scheduleTime.getTime() + 10 * 60 * 1000);
    // return now >= tenMinBefore && now <= tenMinAfter;
    return true;
  };

  const handleJoin = (schedule) => {
    // if (!canJoin(schedule)) {
    //   toast.error('You can only join 10 minutes before or after the start time');
    //   return;
    // }
    toast.success(`Joining meeting for ${schedule.candidateEmail}`);
    setSelectedMeeting(schedule.id)
    router.push(`/meeting/${schedule.id}`)
  };

  const handleMarkCompleted = async (schedule) => {
    setLoadingIds((prev) => [...prev, schedule.id]); // show loading immediately
    setSchedules((prev) => prev.filter((s) => s.id !== schedule.id)); // optimistic remove

    try {
      await axiosInstance.put(`/meetings/${schedule.id}/complete`, { completed: true });
      toast.success('Marked as completed!');
    } catch {
      setSchedules((prev) => [...prev, schedule]); // rollback
      toast.error('Failed to mark as completed');
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== schedule.id));
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Interview Schedule</h1>
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {['All', 'Today', 'Upcoming'].map((f) => (
            <Button
              key={f}
              intent={filter === f ? 'primary' : 'secondary'}
              size="small"
              onClick={() => {
                setFilter(f);
                setSelectedDate('');
              }}
            >
              {f}
            </Button>
          ))}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-2 border-gray-400 px-3 py-2 rounded-md" // thicker border
          />
        </div>
      </div>

      {filteredSchedules.length === 0 && (
        <p className="text-center text-gray-500 mt-10">No pending interviews found.</p>
      )}

      <div className="space-y-4">
        {filteredSchedules.map((s) => (
          <div
            key={s.id}
            className="flex flex-col md:flex-row items-center justify-between bg-white shadow-md rounded-xl p-4 border border-gray-200 hover:shadow-lg transition"
          >
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-1/3">
              <p className="text-sm font-medium text-gray-800">{s.candidateEmail}</p>
              <a
                href={s.resume}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-sm font-medium"
              >
                View Resume
              </a>
            </div>

            <div className="w-full md:w-1/3 text-center">
              <p className="text-gray-800 font-semibold">{s.role}</p>
              <p className="text-gray-600">{`${s.date} | ${s.time}`}</p>
            </div>

            <div className="flex gap-2 w-full md:w-1/3 justify-end mt-2 md:mt-0 flex-wrap">
              <Button
                intent={canJoin(s) ? 'primary' : 'secondary'}
                size="small"
                onClick={() => handleJoin(s)}
                disabled={!canJoin(s)}
              >
                Join
              </Button>

              <Button intent="accent" size="small" onClick={() => openUpdateModal(s)} loading={updating && selectedSchedule?.id === s.id}>
                Update Timing
              </Button>

              <Button
                intent="success"
                size="small"
                onClick={() => handleMarkCompleted(s)}
                loading={loadingIds.includes(s.id)}
              >
                Mark Completed
              </Button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && selectedSchedule && (
        <Modal onClose={() => setModalOpen(false)} title="Update Interview Timing">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full border-2 border-gray-400 px-3 py-2 rounded-md"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full border-2 border-gray-400 px-3 py-2 rounded-md"
              />
            </div>
            <Button size="medium" intent="primary" onClick={handleUpdateTiming} loading={updating}>
              Update
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default RecruiterSchedule;
