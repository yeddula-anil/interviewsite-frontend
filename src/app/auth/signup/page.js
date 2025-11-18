'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { Button } from '@/components/common/Button';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);

  const roles = ['CANDIDATE', 'RECRUITER'];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { success, user } = await signup(
        formData.username,
        formData.email,
        formData.password,
        formData.role
      );

      if (success) {
        toast.success('Signup successful!');

        switch (user.role) {
          case 'CANDIDATE':
            router.push('/candidate/');
            break;
          case 'RECRUITER':
            router.push('/recruiter');
            break;
          default:
            router.push('/');
        }
      } else {
        toast.error("Error while signing up");
      }
    } catch (err) {
      console.error(err);
      toast.error('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(180deg, #031719 0%, #041214 60%, #02090A 100%)",
      }}
    >
      <div
        className="
        w-full max-w-md p-8 rounded-2xl
        bg-[#041e1e]/60 backdrop-blur-xl
        border border-[#0e3a35]
        shadow-[0_0_40px_#0ff3bd30]
      "
      >
        <h2
          className="
          text-4xl font-extrabold text-center mb-8 
          bg-gradient-to-r from-[#38f2b9] to-[#47ffd7] text-transparent bg-clip-text
        "
        >
          Create Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* USERNAME */}
          <div>
            <label className="text-sm font-semibold text-[#38f2b9] mb-2 block">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="
                w-full px-3 py-2 rounded-lg bg-[#031c1c]
                text-white border border-[#0e3a35]
                focus:outline-none focus:ring-2 focus:ring-[#38f2b9]
              "
              placeholder="Enter your username"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="text-sm font-semibold text-[#38f2b9] mb-2 block">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="
                w-full px-3 py-2 rounded-lg bg-[#031c1c]
                text-white border border-[#0e3a35]
                focus:outline-none focus:ring-2 focus:ring-[#38f2b9]
              "
              placeholder="Enter your email"
            />
          </div>

          {/* ROLE */}
          <div>
            <label className="text-sm font-semibold text-[#38f2b9] mb-2 block">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="
                w-full px-3 py-2 rounded-lg bg-[#031c1c] text-white
                border border-[#0e3a35]
                focus:outline-none focus:ring-2 focus:ring-[#38f2b9]
              "
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="text-sm font-semibold text-[#38f2b9] mb-2 block">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="
                w-full px-3 py-2 rounded-lg bg-[#031c1c]
                text-white border border-[#0e3a35]
                focus:outline-none focus:ring-2 focus:ring-[#38f2b9]
              "
              placeholder="Enter your password"
            />
          </div>

          {/* SUBMIT BUTTON — UPDATED: REMOVED GLASS EFFECT */}
          <Button
            type="submit"
            disabled={loading}
            className="
              w-full py-2 rounded-lg font-semibold text-black
              bg-gradient-to-r from-[#38f2b9] to-[#47ffd7]
              shadow-[0_0_20px_#38f2b9]
              hover:scale-[1.03] transition
            "
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Sign Up'
            )}
          </Button>
        </form>

        <p className="text-sm text-center mt-6 text-gray-300">
          Already have an account?{' '}
          <span
            onClick={() => router.push('/auth/signin')}
            className="text-[#38f2b9] cursor-pointer hover:underline font-medium"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}
