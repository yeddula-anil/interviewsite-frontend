'use client';
import React, { useState, useEffect } from "react";
import {
  AiOutlinePlus,
  AiOutlineHeart,
  AiFillHeart,
  AiOutlineSearch,
  AiOutlineUser,
} from "react-icons/ai";
import Image from "next/image";
import toast, { Toaster } from "react-hot-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/context/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";

const InterviewExperiences = () => {
  const [experiences, setExperiences] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newExperience, setNewExperience] = useState({
    company: "",
    role: "",
    description: "",
  });
  const [posting, setPosting] = useState(false);
  const { user } = useAuth();
  const [expanded, setExpanded] = useState({});

  // Fetch experiences
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axiosInstance.get("/experiences");
        const normalized = res.data.map((exp) => ({
          ...exp,
          id: exp.id || exp._id,
        }));
        setExperiences(normalized);
      } catch {
        toast.error("Failed to load experiences");
      }
    };
    load();
  }, []);

  // Toggle Like
  const toggleLike = async (id) => {
    if (!user) return toast.error("Please log in first");

    const userId = user.userId;

    setExperiences((prev) =>
      prev.map((exp) =>
        exp.id === id
          ? {
              ...exp,
              likedBy: exp.likedBy?.includes(userId)
                ? exp.likedBy.filter((u) => u !== userId)
                : [...(exp.likedBy || []), userId],
            }
          : exp
      )
    );

    try {
      const res = await axiosInstance.put(`/experiences/${id}/like`, { userId });
      setExperiences((prev) => prev.map((exp) => (exp.id === id ? res.data : exp)));
    } catch {
      toast.error("Failed to update like");
    }
  };

  // Post new experience
  const handlePost = async () => {
    if (!newExperience.company || !newExperience.role || !newExperience.description) {
      return toast.error("All fields required!");
    }

    setPosting(true);

    const payload = {
      authorId: user?.userId,
      authorName: user?.username || "Anonymous",
      authorAvatar: user?.profilePicUrl || null,
      ...newExperience,
    };

    try {
      const res = await axiosInstance.post("/experiences", payload);
      setExperiences((prev) => [res.data, ...prev]);
      setNewExperience({ company: "", role: "", description: "" });
      setShowModal(false);
      toast.success("Experience shared!");
    } catch {
      toast.error("Failed to post");
    }

    setPosting(false);
  };

  const filtered = experiences.filter(
    (exp) =>
      exp.company?.toLowerCase().includes(companyFilter.toLowerCase()) &&
      exp.role?.toLowerCase().includes(roleFilter.toLowerCase())
  );

  const toggleReadMore = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div
      className="
        min-h-screen w-full flex justify-center py-12 px-4
        bg-gradient-to-br from-[#0B0F13] via-[#1A1F25] to-[#0B0F13]
        text-white
      "
    >
      <Toaster />
      <div className="w-full max-w-3xl">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-10">
          <h1
            className="
              text-4xl font-bold tracking-wide
              bg-gradient-to-r from-[#3DF29E] to-[#38A3F2]
              bg-clip-text text-transparent
            "
          >
            Interview Experiences
          </h1>

          <button
            onClick={() => setShowModal(true)}
            className="
              p-3 rounded-full shadow-lg
              bg-gradient-to-br from-[#38A3F2] to-[#3DF29E]
              hover:shadow-[0_0_20px_#38f2b9] transition
            "
          >
            <AiOutlinePlus size={22} className="text-black" />
          </button>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-4 mb-10">
          <div className="relative flex-1 min-w-[250px]">
            <AiOutlineSearch className="absolute top-3 left-3 text-gray-400" size={20} />
            <input
              type="text"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              placeholder="🔍 Search company"
              className="
                w-full pl-10 pr-4 py-2 rounded-xl
                bg-[#1B1F27] text-gray-200 border border-[#2A2F38]
                placeholder-gray-500 focus:ring-2 focus:ring-[#38f2b9]
              "
            />
          </div>

          <div className="relative flex-1 min-w-[250px]">
            <AiOutlineSearch className="absolute top-3 left-3 text-gray-400" size={20} />
            <input
              type="text"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              placeholder="💼 Search role"
              className="
                w-full pl-10 pr-4 py-2 rounded-xl
                bg-[#1B1F27] text-gray-200 border border-[#2A2F38]
                placeholder-gray-500 focus:ring-2 focus:ring-[#38f2b9]
              "
            />
          </div>
        </div>

        {/* EXPERIENCES LIST */}
        <div className="space-y-8">
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-center">No experiences found.</p>
          ) : (
            filtered.map((exp) => {
              const isLiked = exp.likedBy?.includes(user?.userId);

              return (
                <div
                  key={exp.id}
                  className="
                    p-6 rounded-2xl
                    bg-gradient-to-br from-[#0F151A] to-[#1A242A]
                    border border-[#233039]
                    shadow-[0_8px_20px_rgba(0,0,0,0.4)]
                    hover:shadow-[0_0_25px_rgba(56,242,185,0.25)]
                    transition
                  "
                >
                  {/* AUTHOR */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="
                        w-12 h-12 rounded-full overflow-hidden
                        bg-[#232B33] border border-[#3A4A56]
                        flex items-center justify-center
                      "
                    >
                      {exp.authorAvatar ? (
                        <Image
                          src={exp.authorAvatar}
                          alt={exp.authorName}
                          width={48}
                          height={48}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <AiOutlineUser size={26} className="text-gray-400" />
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-white">{exp.authorName}</h3>
                      <p className="text-sm text-gray-400">{formatDate(exp.createdAt)}</p>
                    </div>
                  </div>

                  {/* TITLE */}
                  <p className="text-lg text-[#38f2b9] font-semibold">
                    {exp.company} — <span className="text-white">{exp.role}</span>
                  </p>

                  {/* DESCRIPTION */}
                  <p className="text-gray-300 mt-3 leading-relaxed">
                    {expanded[exp.id] || exp.description.length <= 350
                      ? exp.description
                      : exp.description.slice(0, 350) + "..."}

                    {exp.description.length > 350 && (
                      <span
                        className="text-[#38f2b9] ml-2 cursor-pointer hover:underline"
                        onClick={() => toggleReadMore(exp.id)}
                      >
                        {expanded[exp.id] ? "Read less" : "Read more"}
                      </span>
                    )}
                  </p>

                  {/* LIKE BUTTON */}
                  <div className="flex justify-end mt-4">
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      animate={{ scale: isLiked ? 1.15 : 1 }}
                      onClick={() => toggleLike(exp.id)}
                      className="flex items-center gap-1 text-gray-300"
                    >
                      <AnimatePresence mode="wait">
                        {isLiked ? (
                          <motion.div
                            key="liked"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                          >
                            <AiFillHeart className="text-red-500" size={22} />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="unliked"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                          >
                            <AiOutlineHeart size={22} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span>{exp.likedBy?.length || 0}</span>
                    </motion.button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
            <div
              className="
                bg-[#10161B] border border-[#2A363F]
                p-6 rounded-xl shadow-xl w-full max-w-lg
              "
            >
              <h2 className="text-xl font-bold text-white mb-4">
                Share Your Interview Experience
              </h2>

              <input
                type="text"
                placeholder="Company Name"
                value={newExperience.company}
                onChange={(e) =>
                  setNewExperience({ ...newExperience, company: e.target.value })
                }
                className="
                  w-full bg-[#1A1F25] text-white rounded-lg
                  px-4 py-2 mb-3 border border-[#2A333D]
                  focus:ring-2 focus:ring-[#38f2b9]
                "
              />
              <input
                type="text"
                placeholder="Role"
                value={newExperience.role}
                onChange={(e) =>
                  setNewExperience({ ...newExperience, role: e.target.value })
                }
                className="
                  w-full bg-[#1A1F25] text-white rounded-lg
                  px-4 py-2 mb-3 border border-[#2A333D]
                  focus:ring-2 focus:ring-[#38f2b9]
                "
              />
              <textarea
                rows="5"
                placeholder="Describe your experience..."
                value={newExperience.description}
                onChange={(e) =>
                  setNewExperience({
                    ...newExperience,
                    description: e.target.value,
                  })
                }
                className="
                  w-full bg-[#1A1F25] text-white rounded-lg 
                  px-4 py-2 mb-5 border border-[#2A333D]
                  focus:ring-2 focus:ring-[#38f2b9]
                "
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="
                    px-4 py-2 rounded-lg
                    border border-gray-500 text-gray-300
                    hover:bg-gray-700/40
                  "
                >
                  Cancel
                </button>

                <button
                  onClick={handlePost}
                  disabled={posting}
                  className="
                    px-4 py-2 rounded-lg 
                    bg-gradient-to-r from-[#3DF29E] to-[#38A3F2]
                    text-black font-semibold
                    hover:shadow-[0_0_20px_#38f2b9]
                    disabled:opacity-50
                  "
                >
                  {posting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default InterviewExperiences;
