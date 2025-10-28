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

  // ✅ Fetch experiences
  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const res = await axiosInstance.get("/experiences");
        const normalized = res.data.map((exp) => ({
          ...exp,
          id: exp.id || exp._id, // ensure consistent key
        }));
        setExperiences(normalized);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load experiences");
      }
    };
    fetchExperiences();
  }, []);

  // ✅ Toggle like
  const toggleLike = async (id) => {
    if (!user) {
      toast.error("Please log in to like posts");
      return;
    }

    const userId = user.userId;

    // Optimistic update
    setExperiences((prev) =>
      prev.map((exp) => {
        if (exp.id === id) {
          const hasLiked = exp.likedBy?.includes(userId);
          return {
            ...exp,
            likedBy: hasLiked
              ? exp.likedBy.filter((uid) => uid !== userId)
              : [...(exp.likedBy || []), userId],
          };
        }
        return exp;
      })
    );

    try {
      const res = await axiosInstance.put(`/experiences/${id}/like`, { userId });
      setExperiences((prev) =>
        prev.map((exp) => (exp.id === id ? res.data : exp))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update like");
    }
  };

  // ✅ Post new experience
  const handlePost = async () => {
    if (
      !newExperience.company.trim() ||
      !newExperience.role.trim() ||
      !newExperience.description.trim()
    ) {
      toast.error("Please fill all fields!");
      return;
    }

    setPosting(true);

    const experienceData = {
      authorId: user?.userId,
      authorName: user?.username || "Anonymous",
      authorAvatar: user?.profilePicUrl || null,
      company: newExperience.company,
      role: newExperience.role,
      description: newExperience.description,
    };

    try {
      const res = await axiosInstance.post("/experiences", experienceData);
      setExperiences((prev) => [res.data, ...prev]);
      setNewExperience({ company: "", role: "", description: "" });
      setShowModal(false);
      toast.success("Experience added successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to post experience");
    } finally {
      setPosting(false);
    }
  };

  // ✅ Filters
  const filtered = experiences.filter(
    (exp) =>
      exp.company?.toLowerCase().includes(companyFilter.toLowerCase()) &&
      exp.role?.toLowerCase().includes(roleFilter.toLowerCase())
  );

  const toggleReadMore = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown Date";
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex justify-center py-12 px-4">
      <Toaster />
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Interview Experiences
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white p-3 rounded-full shadow hover:bg-blue-700 transition"
            title="Add Experience"
          >
            <AiOutlinePlus size={22} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="relative flex-1 min-w-[250px]">
            <AiOutlineSearch
              className="absolute top-3 left-3 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="🔍 Search by company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-800 placeholder-gray-500"
            />
          </div>
          <div className="relative flex-1 min-w-[250px]">
            <AiOutlineSearch
              className="absolute top-3 left-3 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="💼 Search by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-800 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Experiences List */}
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center mt-10">
              No experiences found.
            </p>
          ) : (
            filtered.map((exp) => {
              const isLiked = exp.likedBy?.some(
                (uid) => uid === user?.userId
              );

              return (
                <div
                  key={exp.id}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition"
                >
                  {/* Author */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-gray-300 flex items-center justify-center bg-gray-100">
                      {exp.authorAvatar ? (
                        <Image
                          src={exp.authorAvatar}
                          alt={exp.authorName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <AiOutlineUser size={28} className="text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">
                        {exp.authorName}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {formatDate(exp.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Experience Content */}
                  <p className="text-gray-900 text-base mb-2">
                    <strong>{exp.company}</strong> — {exp.role}
                  </p>

                  <p className="text-gray-700 leading-relaxed text-[15px] whitespace-pre-line">
                    {expanded[exp.id] || exp.description.length <= 400
                      ? exp.description
                      : exp.description.slice(0, 400) + "..."}

                    {exp.description.length > 400 && (
                      <span
                        onClick={() => toggleReadMore(exp.id)}
                        className="text-blue-600 cursor-pointer ml-1 hover:underline font-medium"
                      >
                        {expanded[exp.id] ? "Read less" : "Read more"}
                      </span>
                    )}
                  </p>

                  {/* Like Button with Animation */}
                  <div className="flex justify-end mt-4">
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      animate={{ scale: isLiked ? 1.2 : 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      onClick={() => toggleLike(exp.id)}
                      className="flex items-center gap-1 text-gray-600 transition-colors"
                    >
                      <AnimatePresence mode="wait">
                        {isLiked ? (
                          <motion.div
                            key="liked"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <AiFillHeart
                              size={22}
                              className="text-red-500"
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="unliked"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <AiOutlineHeart
                              size={22}
                              className="text-gray-500"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span className="text-sm text-gray-700">
                        {exp.likedBy?.length || 0}
                      </span>
                    </motion.button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal for New Experience */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg relative">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Share Your Experience
              </h2>
              <input
                type="text"
                placeholder="Company Name"
                value={newExperience.company}
                onChange={(e) =>
                  setNewExperience({ ...newExperience, company: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Role (e.g. Software Engineer)"
                value={newExperience.role}
                onChange={(e) =>
                  setNewExperience({ ...newExperience, role: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Describe your interview experience..."
                rows="5"
                value={newExperience.description}
                onChange={(e) =>
                  setNewExperience({
                    ...newExperience,
                    description: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-400 text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={posting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
