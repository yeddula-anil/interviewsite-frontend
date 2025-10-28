'use client';
import React, { useState, useEffect, useRef } from "react";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { Button } from "@/components/common/Button";
import { usePreJoin } from "@/context/PreJoinContext";
import { useSearchParams } from "next/navigation";

const JoinMeetingPage = () => {
    const { selectedMeeting } = usePreJoin();
    const searchParams = useSearchParams();
    const manual = searchParams.get("manual") === "true";

    // Determine which object to display
    const displayMeeting = manual
        ? { jobTitle: "ABC", team: "ABC", interviewer: "ABC", interviewerRole: "ABC" }
        : selectedMeeting || { jobTitle: "Frontend Developer", team: "Team Alpha", interviewer: "Sarah Chen", interviewerRole: "Recruiter" };

    const [name, setName] = useState(displayMeeting?.name || "");
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [meetingLink, setMeetingLink] = useState(manual ? "" : selectedMeeting?.meetingLink || "");

    const videoRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        const getMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: camOn,
                    audio: micOn,
                });
                streamRef.current = stream;
                stream.getAudioTracks().forEach(track => (track.enabled = micOn));
                stream.getVideoTracks().forEach(track => (track.enabled = camOn));
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error("Cannot access camera/mic", err);
                setMicOn(false);
                setCamOn(false);
            }
        };
        getMedia();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const toggleMic = () => {
        const newMicState = !micOn;
        setMicOn(newMicState);
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => (track.enabled = newMicState));
        }
    };

    const toggleCam = () => {
        const newCamState = !camOn;
        setCamOn(newCamState);
        if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach(track => (track.enabled = newCamState));
        }
    };

    const handleJoin = () => {
        if (!meetingLink) {
            alert("Please enter a meeting link!");
            return;
        }
        const userName = encodeURIComponent(name || "Guest");
        window.open(`${meetingLink}?name=${userName}`, "_blank");
    };

    const ControlButton = ({ active, onClick, activeIcon: ActiveIcon, inactiveIcon: InactiveIcon, label }) => {
        const Icon = active ? ActiveIcon : InactiveIcon;
        const colorClass = active ? 'text-teal-400 border-teal-400' : 'text-red-500 border-red-500';
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
                            {displayMeeting.jobTitle} · {displayMeeting.team} with {displayMeeting.interviewer}
                        </p>
                    </div>
                    <IoMdClose className="w-6 h-6 text-gray-400 cursor-pointer hover:text-white" />
                </div>

                {/* Main Content */}
                <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Video Preview and Controls */}
                    <div className="lg:w-3/4 flex flex-col gap-4">

                        {/* Meeting Link Input */}
                        <input
                            type="text"
                            value={meetingLink}
                            onChange={(e) => setMeetingLink(e.target.value)}
                            placeholder="Enter Meeting Link"
                            className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            disabled={!manual && !!selectedMeeting} 
                        />

                        {/* Name Input */}
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full px-3 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />

                        {/* Video Preview */}
                        <div className="relative bg-black aspect-video rounded-lg overflow-hidden border border-gray-700">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted={!micOn}
                                className="w-full h-full object-cover transform scale-x-[-1]"
                            />
                            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md text-white text-sm font-medium">
                                {name || "Guest"}
                            </div>
                        </div>

                        {/* Mic & Cam Controls */}
                        <div className="flex justify-center items-center space-x-6 mt-4">
                            <ControlButton
                                active={micOn}
                                onClick={toggleMic}
                                activeIcon={FaMicrophone}
                                inactiveIcon={FaMicrophoneSlash}
                                label={`Mic: ${micOn ? 'On' : 'Off'}`}
                            />
                            <ControlButton
                                active={camOn}
                                onClick={toggleCam}
                                activeIcon={FaVideo}
                                inactiveIcon={FaVideoSlash}
                                label={`Cam: ${camOn ? 'On' : 'Off'}`}
                            />
                        </div>

                        {/* Join Button */}
                        <div className="mt-6 flex flex-col items-center">
                            <Button 
                                onClick={handleJoin} 
                                intent="primary" 
                                size="large" 
                                className="w-64 py-3 text-lg bg-green-600 hover:bg-green-700" 
                            >
                                Join Interview Now
                            </Button>
                            <p className="text-xs text-gray-500 mt-2">
                                By clicking join, you agree to the company's privacy policy.
                            </p>
                        </div>
                    </div>

                    {/* Other Participants */}
                    <div className="lg:w-1/4 pt-2">
                        <h3 className="text-lg font-medium mb-3 text-gray-300">Other Participants</h3>
                        <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50">
                            <img
                                src="https://i.pravatar.cc/150?img=1"
                                alt={displayMeeting.interviewer}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                                <p className="font-medium text-sm">{displayMeeting.interviewer}</p>
                                <p className="text-xs text-gray-400">{displayMeeting.interviewerRole}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
    );
};

export default JoinMeetingPage;
export const dynamic = "force-dynamic";

