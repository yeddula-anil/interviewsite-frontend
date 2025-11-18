'use client';
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthProvider";
import toast from "react-hot-toast";

export default function SignIn() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { email, password } = formData;

    try {
      const res = await login(email, password);

      if (res.success) {
        toast.success("Logged in successfully!");

        if (res.user?.role === "CANDIDATE") router.push("/candidate");
        else if (res.user?.role === "RECRUITER") router.push("/recruiter");
        else router.push("/");
      } else {
        toast.error(res.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background:
          "linear-gradient(180deg, #031719 0%, #041214 60%, #02090A 100%)",
      }}
    >
      <div className="w-full max-w-md bg-[#041e1e] border border-[#0e3a35] shadow-[0_0_35px_#072a2a80] rounded-2xl p-8 backdrop-blur-xl">

        <h2 className="text-3xl font-extrabold text-center text-[#38f2b9] mb-8 tracking-wide">
          Sign In
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Email */}
          <div>
            <label className="text-[#7dd9c8] text-sm mb-1 block">Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
              className="
                w-full px-4 py-3 rounded-xl
                bg-[#031f1f] border border-[#0e3a35]
                text-white placeholder-gray-400
                focus:ring-2 focus:ring-[#38f2b9] outline-none
              "
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-[#7dd9c8] text-sm mb-1 block">Password</label>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
              className="
                w-full px-4 py-3 rounded-xl
                bg-[#031f1f] border border-[#0e3a35]
                text-white placeholder-gray-400
                focus:ring-2 focus:ring-[#38f2b9] outline-none
              "
            />
          </div>

          {/* Sign In Button */}
          <Button
            type="submit"
            className="w-full py-3 text-lg font-semibold rounded-xl bg-[#38f2b9] text-black hover:brightness-110 shadow-[0_0_15px_#38f2b966]"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>

          {/* Signup Redirect */}
          <p className="text-center text-gray-400 text-sm mt-4">
            Don’t have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/auth/signup")}
              className="text-[#38f2b9] hover:underline"
            >
              Sign Up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
