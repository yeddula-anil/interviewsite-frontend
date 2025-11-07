'use client';
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { Button } from "@/components/common/Button";
import { StreamVideoClient } from '@stream-io/video-react-sdk';
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

  const rolePrefix = user?.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE";
  const initialMeetingId = String(params?.meetingId || "");

  const [name, setName] = useState(user?.username || "");
  const [meetingId, setMeetingId] = useState(initialMeetingId);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [checkingParticipants, setCheckingParticipants] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const tempClientRef = useRef(null);

  // 🎥 Local preview
  useEffect(() => {
    let active = true;
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("❌ Cannot access camera/mic:", err);
        setMicOn(false);
        setCamOn(false);
      }
    };
    getMedia();

    const stopTracks = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
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
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };

  // 👥 Peek current participants
  const checkParticipants = async () => {
    if (!meetingId) return;
    setCheckingParticipants(true);
    let tempClient;
    try {
      const res = await fetch("/api/stream/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: `${rolePrefix}-${name || "Guest"}` }),
      });
      const { token } = await res.json();

      tempClient = new StreamVideoClient({
        apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
        user: { id: `${rolePrefix}-${name || "Guest"}`, name: name || "Guest" },
        token,
      });
      tempClientRef.current = tempClient;

      const call = tempClient.call("default", meetingId);
      await call.join({ create: true });

      const members = await call.queryMembers({});
      setParticipants(members.members.map((m) => m.user.id));

      await call.leave();
    } catch (err) {
      console.error("Error checking participants:", err);
    } finally {
      setCheckingParticipants(false);
      try {
        await tempClient?.disconnectUser();
      } catch {}
      tempClientRef.current = null;
    }
  };

  // 🚀 Join Meeting
  const handleJoin = async () => {
    if (!name || !meetingId) {
      alert("Please enter your name and meeting ID.");
      return;
    }
    setLoadingJoin(true);

    try {
      // ✅ Check participant limit before joining
      const res = await fetch("/api/stream/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: `${rolePrefix}-${name}` }),
      });
      const { token } = await res.json();

      const tempClient = new StreamVideoClient({
        apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
        user: { id: `${rolePrefix}-${name}`, name },
        token,
      });
      const call = tempClient.call("default", meetingId);
      await call.join({ create: true });

      const members = await call.queryMembers({});
      if (members.members.length >= 2) {
        alert("This interview room is already full.");
        await call.leave();
        await tempClient.disconnectUser();
        return;
      }

      // ✅ Store prejoin info for MeetingRoom
      sessionStorage.setItem(
        "prejoin",
        JSON.stringify({ name, meetingId, micOn, camOn })
      );

      await call.leave();
      await tempClient.disconnectUser();

      router.push(`/meetingRoom/${meetingId}`);
    } catch (err) {
      console.error("Join error:", err);
      alert("Unable to join meeting. Please try again.");
    } finally {
      setLoadingJoin(false);
    }
  };

  const handleClose = () => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    } catch {}
    router.push("/");
  };

  // 🧹 Cleanup if navigating away mid-check
  useEffect(() => {
    const cleanup = async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        await tempClientRef.current?.disconnectUser();
      } catch {}
    };
    window.addEventListener("pagehide", cleanup);
    window.addEventListener("beforeunload", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("pagehide", cleanup);
      window.removeEventListener("beforeunload", cleanup);
    };
  }, []);

  const ControlButton = ({ active, onClick, activeIcon: ActiveIcon, inactiveIcon: InactiveIcon, label }) => {
    const Icon = active ? ActiveIcon : InactiveIcon;
    const colorClass = active ? "text-teal-400 border-teal-400" : "text-red-500 border-red-500";
    return (
      <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${colorClass} bg-transparent hover:bg-gray-700/50`}
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
            <button
              onClick={checkParticipants}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md text-sm w-fit"
              disabled={checkingParticipants}
            >
              {checkingParticipants ? "Checking..." : "Check Participants"}
            </button>

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

          {/* Participants */}
          <div className="lg:w-1/4 pt-2">
            <h3 className="text-lg font-medium mb-3 text-gray-300">Other Participants</h3>
            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm">No one has joined yet.</p>
            ) : (
              participants.map((p) => (
                <div key={p} className="flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50 mb-2">
                  <img
                    src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${p}`}
                    alt={p}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium text-sm">{p}</p>
                    <p className="text-xs text-gray-400">Participant</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinMeetingPage;
