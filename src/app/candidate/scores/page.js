'use client';
import React, { useState, useEffect } from "react";
import { Button } from "@/components/common/Button";
import { FaStar } from "react-icons/fa";

const CompletedInterviews = () => {
  const [completed, setCompleted] = useState([]);

  useEffect(() => {
    const dummyData = [
      {
        id: "1",
        companyName: "TechNova Ltd",
        companyLogoUrl:
          "https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo_TV_2015.png",
        role: "Backend Developer",
        candidateMarks: 45,
        candidateComments:
          "Strong Java skills and solid understanding of Spring Boot and Microservices.",
        date: "2025-10-25",
        time: "11:00 AM",
      },
      {
        id: "2",
        companyName: "CodeWorks Pvt Ltd",
        companyLogoUrl:
          "https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png",
        role: "Frontend Engineer",
        candidateMarks: 50,
        candidateComments:
          "Excellent React knowledge, smooth communication, and great problem-solving ability.",
        date: "2025-10-23",
        time: "2:30 PM",
      },
      {
        id: "3",
        companyName: "InnoTech Systems",
        companyLogoUrl:
          "https://upload.wikimedia.org/wikipedia/commons/a/af/Google_2015_logo.svg",
        role: "Full Stack Developer",
        candidateMarks: null, // score not yet assigned
        candidateComments:
          "Good overall performance, but awaiting evaluation from panel.",
        date: "2025-10-22",
        time: "4:00 PM",
      },
      {
        id: "4",
        companyName: "CloudVerse Solutions",
        companyLogoUrl:
          "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg",
        role: "DevOps Engineer",
        candidateMarks: 38,
        candidateComments:
          "Solid grasp of CI/CD pipelines, needs minor improvement in Kubernetes.",
        date: "2025-10-26",
        time: "9:30 AM",
      },
      {
        id: "5",
        companyName: "DataLabs Analytics",
        companyLogoUrl:
          "https://upload.wikimedia.org/wikipedia/commons/e/e0/IBM_logo.svg",
        role: "Data Engineer",
        candidateMarks: null, // score not yet assigned
        candidateComments: "Pending feedback from technical interviewer.",
        date: "2025-10-21",
        time: "3:00 PM",
      },
    ];

    // Sort by most recent date first
    const sortedData = dummyData.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    setCompleted(sortedData);
  }, []);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Completed Interviews
      </h1>

      {completed.length === 0 ? (
        <p className="text-gray-500 text-center">
          No completed interviews yet.
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {completed.map((interview) => (
            <div
              key={interview.id}
              className="bg-white rounded-2xl shadow-md p-5 border border-gray-200 hover:shadow-lg transition"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={interview.companyLogoUrl || "/default-logo.png"}
                  alt={interview.companyName}
                  className="w-16 h-16 object-contain rounded-md bg-gray-100 p-1"
                />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    {interview.companyName}
                  </h2>
                  <p className="text-sm text-gray-600">{interview.role}</p>
                </div>
              </div>

              {/* Details */}
              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-gray-600 text-sm mb-1">
                    <strong>Date:</strong> {interview.date}
                  </p>
                  <p className="text-gray-600 text-sm">
                    <strong>Time:</strong> {interview.time}
                  </p>
                </div>

                {interview.candidateMarks !== null ? (
                  <div className="flex items-center bg-yellow-100 px-3 py-1 rounded-full">
                    <FaStar className="text-yellow-500 mr-1" />
                    <span className="font-semibold text-gray-800">
                      {interview.candidateMarks}/50
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center bg-gray-200 px-3 py-1 rounded-full">
                    <span className="text-sm text-gray-600 italic">
                      Not yet graded
                    </span>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="mt-4">
                <p className="text-gray-700 text-sm leading-relaxed">
                  <strong>Review:</strong> {interview.candidateComments}
                </p>
              </div>

              {/* Optional View Button */}
              <div className="mt-5 flex justify-end">
                <Button intent="primary" size="small">
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompletedInterviews;
