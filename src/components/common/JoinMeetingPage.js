'use client';
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { useAuth } from "@/context/AuthProvider";
import axiosInstance from "@/utils/axiosInstance";

const JoinMeetingPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const meetingId = String(params?.meetingId ?? params?.id ?? "");
  const username = user?.username || "Guest";

  const [meetingInfo, setMeetingInfo] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // === CAMERA + MIC PERMISSIONS ===
  useEffect(() => {
    const requestMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        streamRef.current = stream;
        setMicOn(true);
        setCamOn(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("Permission denied:", err);
      }
    };
    requestMedia();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // === FETCH MEETING DETAILS ===
  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const res = await axiosInstance.get(`/meetings/${meetingId}`);
        setMeetingInfo(res.data);
        
      } catch (e) {
        console.error(e);
      }
    };
    fetchMeeting();
    sessionStorage.setItem("resumeUrl",meetingInfo?.candidateResumeUrl)
  }, [meetingId]);

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

  const handleJoin = async () => {
    setLoadingJoin(true);

    sessionStorage.setItem(
      "prejoin",
      JSON.stringify({
        username,
        meetingId,
        micOn,
        camOn,
      })
    );

    // IMPORTANT: do NOT turn off loading — let route unmount the page
    router.push(`/meetingRoom/${meetingId}`);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#051B21] to-[#0D1114] text-white p-8">

      {/* CARD */}
      <div className="max-w-7xl mx-auto p-8 rounded-3xl 
          bg-white/5 backdrop-blur-xl border border-white/10 
          shadow-[0_0_40px_rgba(0,0,0,0.5)]">

        {/* HEADER (CENTERED TITLE + CLOSE BUTTON RIGHT) */}
        <div className="relative flex justify-center items-center mb-8">

          <h1 className="text-3xl font-semibold bg-gradient-to-r from-[#38f2b9] to-white bg-clip-text text-transparent">
            Join Your Interview
          </h1>

          <IoMdClose
            className="absolute right-0 w-7 h-7 text-gray-300 hover:text-white cursor-pointer"
            onClick={() => router.push("/")}
          />
        </div>

        {/* GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">

          {/* LEFT — MEETING DETAILS */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-[#38f2b9] mb-4">
              Interview Details
            </h2>

            {meetingInfo ? (
              <div className="space-y-3 text-sm text-gray-300">
                <p><strong>Recruiter Email:</strong> {meetingInfo.recruiterEmail}</p>
                <p><strong>Company:</strong> {meetingInfo.companyName}</p>
                <p><strong>Role:</strong> {meetingInfo.role}</p>
                <p><strong>Date:</strong> {meetingInfo.date}</p>
                <p><strong>Time:</strong> {meetingInfo.time}</p>
              </div>
            ) : (
              <p className="italic text-gray-500">Loading…</p>
            )}
          </div>

          {/* CENTER — VIDEO PREVIEW */}
          <div className="lg:col-span-2 flex flex-col items-center">

            <div className="relative bg-black/40 rounded-2xl overflow-hidden 
                border border-white/10 shadow-[0_0_25px_rgba(56,242,185,0.2)]
                w-full aspect-video">

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />

              <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded-md text-xs">
                {username}
              </div>
            </div>

            {/* CONTROLS */}
            <div className="flex gap-5 mt-5">
              <button
                onClick={toggleMic}
                className={`px-5 py-2 rounded-full border flex items-center gap-2 
                ${micOn ? "text-[#38f2b9] border-[#38f2b9] bg-[#38f2b915]" 
                        : "text-red-400 border-red-500 bg-red-500/10"}
                `}
              >
                {micOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
                Mic: {micOn ? "On" : "Off"}
              </button>

              <button
                onClick={toggleCam}
                className={`px-5 py-2 rounded-full border flex items-center gap-2 
                ${camOn ? "text-[#38f2b9] border-[#38f2b9] bg-[#38f2b915]" 
                        : "text-red-400 border-red-500 bg-red-500/10"}
                `}
              >
                {camOn ? <FaVideo /> : <FaVideoSlash />}
                Cam: {camOn ? "On" : "Off"}
              </button>
            </div>

            {/* JOIN BUTTON */}
            <button
              onClick={handleJoin}
              disabled={loadingJoin}
              className="mt-6 w-64 py-3 rounded-xl text-lg font-semibold
              bg-gradient-to-r from-[#38f2b9] to-[#126E7A]
              hover:shadow-[0_0_20px_#38f2b9] transition
              flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loadingJoin ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Joining Interview…
                </>
              ) : (
                "Join Interview Now"
              )}
            </button>

          </div>

          {/* RIGHT — GUIDELINES */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-[#38f2b9] mb-4">
              Important Guidelines
            </h2>

            <ul className="text-sm text-gray-300 space-y-3 leading-relaxed">
              <li>• Do not switch browser tabs — detection enabled.</li>
              <li>• Do not minimize or open other applications.</li>
              <li>• Screen recording or screenshots may be detected.</li>
              <li>• Stay visible on camera at all times.</li>
              <li>• Avoid background noise during the interview.</li>
              <li>• Ensure a stable internet connection.</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};

export default JoinMeetingPage;
