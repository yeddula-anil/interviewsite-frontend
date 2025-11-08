'use client';
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthProvider";

const MEETING_INFO = {
  jobTitle: "Frontend Developer",
  team: "Team Alpha",
  interviewer: "Sarah Chen",
  interviewerRole: "Recruiter"
};

const JoinMeetingPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  // support either params.meetingId or params.id depending on route naming
  const initialMeetingId = String(params?.meetingId ?? params?.id ?? "");

  // prefer user.name then fallback to username
  const initialName = user?.name || user?.username || "";

  const rolePrefix = (user?.role || "").toLowerCase() === "recruiter" ? "recruiter" : "candidate";

  const [name, setName] = useState(initialName);
  const [meetingId, setMeetingId] = useState(initialMeetingId);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // 🎥 Local preview only
  useEffect(() => {
    let active = true;

    const getMedia = async () => {
      try {
        // request both audio & video for preview (user gesture not required for preview in many browsers,
        // but will prompt permission if not previously granted)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) {
          // if component unmounted, stop tracks immediately
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // ensure muted (preview) and autoplay playsInline
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("❌ Cannot access camera/mic:", err);
        // disable toggles on failure
        setMicOn(false);
        setCamOn(false);
      }
    };

    getMedia();

    const stopTracks = () => {
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          try { videoRef.current.srcObject = null; } catch (e) {}
        }
      } catch (e) {
        console.warn('stopTracks failed', e);
      }
    };

    const handleUnload = () => stopTracks();
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      active = false;
      stopTracks();
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    try {
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    } catch (e) {
      console.warn('toggleMic failed', e);
    }
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    try {
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    } catch (e) {
      console.warn('toggleCam failed', e);
    }
  };

  // 🚀 Proceed to meeting room
  const handleJoin = async () => {
    if (!name || !meetingId) {
      alert("Please enter your name and meeting ID.");
      return;
    }
    setLoadingJoin(true);

    try {
      // store prejoin for MeetingRoom to consume
      sessionStorage.setItem(
        "prejoin",
        JSON.stringify({ name, meetingId, micOn, camOn, role: rolePrefix })
      );

      // stop preview tracks (we don't want them running while the SDK takes over)
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          try { videoRef.current.srcObject = null; } catch (e) {}
        }
      } catch (e) {
        console.warn('failed to stop preview tracks on join', e);
      }

      // navigate to MeetingRoom — IMPORTANT: route must match your MeetingRoom component route
      // your MeetingRoom code expects param name `meetingId` and route `/meeting/[meetingId]`
      router.push(`/meetingRoom/${initialMeetingId}`);
    } catch (err) {
      console.error("Join error:", err);
      alert("Error starting meeting.");
    } finally {
      setLoadingJoin(false);
    }
  };

  const handleClose = () => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch (e) {}
      }
    } catch (e) {
      console.warn('handleClose cleanup failed', e);
    }
    router.push("/");
  };

  const ControlButton = ({ active, onClick, activeIcon: ActiveIcon, inactiveIcon: InactiveIcon, label }) => {
    const Icon = active ? ActiveIcon : InactiveIcon;
    const colorClass = active ? "text-teal-400 border-teal-400" : "text-red-500 border-red-500";
    return (
      <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${colorClass} bg-transparent hover:bg-gray-700/50 cursor-pointer`}
        aria-pressed={!!active}
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
            <p className="text-gray-400 text-sm">
              {MEETING_INFO.jobTitle} · {MEETING_INFO.team} with {MEETING_INFO.interviewer}
            </p>
          </div>
          <IoMdClose onClick={handleClose} className="w-6 h-6 text-gray-400 cursor-pointer hover:text-white" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-3/4 flex flex-col gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="Enter Meeting ID"
              className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            <div className="relative bg-black aspect-video rounded-lg overflow-hidden border border-gray-700">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md text-white text-sm font-medium">
                {name || "Guest"}
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
                disabled={loadingJoin}
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
            <div className="text-sm text-gray-400 space-y-2">
              <p>Job Title: {MEETING_INFO.jobTitle}</p>
              <p>Team: {MEETING_INFO.team}</p>
              <p>Recruiter: {MEETING_INFO.interviewer}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinMeetingPage;
