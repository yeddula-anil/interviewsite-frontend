'use client';
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthProvider";
import axiosInstance from "@/utils/axiosInstance";

const JoinMeetingPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const meetingIdParam = String(params?.meetingId ?? params?.id ?? "");
  const [meetingId, setMeetingId] = useState(meetingIdParam);

  const username = user?.username || "Guest";
  const role = (user?.role || "").toLowerCase();
  const [meetingInfo, setMeetingInfo] = useState(null);

  // ✅ Initially both off (wait for user permission)
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ✅ Explicit permission request for mic & camera
  useEffect(() => {
    let active = true;

    const requestMedia = async () => {
      try {
        // ask for both audio and video permission
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        // ✅ Set states to true only when permissions are granted successfully
        setMicOn(true);
        setCamOn(true);

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("❌ Camera/mic permission denied or unavailable:", err);
        // Keep both off if permission denied
        setMicOn(false);
        setCamOn(false);
      }
    };

    requestMedia();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // ✅ Fetch meeting details from backend
  useEffect(() => {
    const fetchMeetingInfo = async () => {
      try {
        if (!meetingId) return;
        const res = await axiosInstance.get(`/meetings/${meetingId}`);
        setMeetingInfo(res.data);
      } catch (err) {
        console.error("⚠️ Failed to fetch meeting details:", err);
      }
    };
    fetchMeetingInfo();
  }, [meetingId]);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach(track => (track.enabled = next));
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    streamRef.current?.getVideoTracks().forEach(track => (track.enabled = next));
  };

  const handleJoin = async () => {
    if (!meetingId) {
      alert("Please enter the meeting ID.");
      return;
    }
    setLoadingJoin(true);

    try {
      // store mic/cam + username in sessionStorage
      sessionStorage.setItem("prejoin", JSON.stringify({
        username,
        meetingId,
        micOn,
        camOn,
        role
      }));

      // stop preview tracks
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;

      // navigate to MeetingRoom
      router.push(`/meetingRoom/${meetingId}`);
    } catch (err) {
      console.error("Join error:", err);
      alert("Error joining the meeting.");
    } finally {
      setLoadingJoin(false);
    }
  };

  const handleClose = () => {
    try {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (e) {}
    router.push("/");
  };

  const ControlButton = ({ active, onClick, activeIcon: ActiveIcon, inactiveIcon: InactiveIcon, label }) => {
    const Icon = active ? ActiveIcon : InactiveIcon;
    const colorClass = active ? "text-teal-400 border-teal-400" : "text-red-500 border-red-500";
    return (
      <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${colorClass} hover:bg-gray-700/50`}
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-gray-800 rounded-xl shadow-2xl p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-2xl font-semibold">Join Your Interview</h1>
            {meetingInfo ? (
              <p className="text-gray-400 text-sm">
                Interview for <span className="font-semibold">{meetingInfo.role}</span> at{" "}
                <span className="font-semibold">{meetingInfo.companyName}</span>
              </p>
            ) : (
              <p className="text-gray-500 text-sm italic">Loading meeting details...</p>
            )}
          </div>
          <IoMdClose onClick={handleClose} className="w-6 h-6 text-gray-400 cursor-pointer hover:text-white" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-3/4 flex flex-col gap-4">
            <div className="relative bg-black aspect-video rounded-lg overflow-hidden border border-gray-700">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md text-white text-sm font-medium">
                {username}
              </div>
            </div>

            <div className="flex justify-center items-center space-x-6 mt-4">
              <ControlButton
                active={micOn}
                onClick={toggleMic}
                activeIcon={FaMicrophone}
                inactiveIcon={FaMicrophoneSlash}
                label={`Mic: ${micOn ? "On" : "Off"}`}
              />
              <ControlButton
                active={camOn}
                onClick={toggleCam}
                activeIcon={FaVideo}
                inactiveIcon={FaVideoSlash}
                label={`Cam: ${camOn ? "On" : "Off"}`}
              />
            </div>

            <div className="mt-6 flex flex-col items-center">
              <Button
                onClick={handleJoin}
                intent="primary"
                size="large"
                disabled={loadingJoin || !meetingInfo}
                className="w-64 py-3 text-lg bg-green-600 hover:bg-green-700"
              >
                {loadingJoin ? "Connecting..." : "Join Interview Now"}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                By clicking join, you agree to the company's privacy policy.
              </p>
            </div>
          </div>

          {/* Info Section */}
          <div className="lg:w-1/4 pt-2">
            <h3 className="text-lg font-medium mb-3 text-gray-300">Interview Details</h3>
            {meetingInfo ? (
              <div className="text-sm text-gray-400 space-y-2">
                <p><strong>Recruiter Email:</strong> {meetingInfo.recruiterEmail}</p>
                <p><strong>Company:</strong> {meetingInfo.companyName}</p>
                <p><strong>Role:</strong> {meetingInfo.role}</p>
                <p><strong>Date:</strong> {meetingInfo.date}</p>
                <p><strong>Time:</strong> {meetingInfo.time}</p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">Fetching details...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinMeetingPage;
