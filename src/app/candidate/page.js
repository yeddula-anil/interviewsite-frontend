'use client'
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/common/Button";


export default function Dashboard() {
 
  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 text-sm">Today's Interviews</p>
            <h2 className="text-3xl font-bold text-gray-800 mt-2">2</h2>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 text-sm">Pending Reviews</p>
            <h2 className="text-3xl font-bold text-gray-800 mt-2">8</h2>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 text-sm">Avg. Time-to-Hire</p>
            <h2 className="text-3xl font-bold text-gray-800 mt-2">24 Days</h2>
          </CardContent>
        </Card>
      </div>

      {/* Content Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Interviews */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Upcoming Interviews
              </h2>
            </div>
            <div className="divide-y">
              <div className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">Jane Doe</p>
                  <p className="text-sm text-gray-600">Software Engineer</p>
                  <p className="text-sm text-gray-500">Tomorrow, 2:00 PM</p>
                </div>
                <div className="space-x-3">
                  <Button size="large" intent="primary">Join</Button>
                  <Button size="large" intent="secondary">Cancel</Button>
                </div>
              </div>
              <div className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">John Smith</p>
                  <p className="text-sm text-gray-600">UX Designer</p>
                  <p className="text-sm text-gray-500">Friday, 10:30 PM</p>
                </div>
                <div className="space-x-3">
                  <Button size="large" intent="primary">Join</Button>
                  <Button size="large" intent="secondary">Cancel</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity & Feedback */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Recent Activity & Feedback
              </h2>
            </div>
            <div className="divide-y">
              <div className="py-4">
                <p className="text-sm text-gray-600">Reviewed</p>
                <p className="text-sm text-gray-800">Candidate: Sarah Lee</p>
                <p className="text-sm text-gray-800">Role: Data Scientist</p>
                <p className="text-sm text-gray-600">Score: 4.5 / 5.0</p>
                <Button size="large" intent="secondary" className="mt-3">
                  View Feedback
                </Button>
              </div>
              <div className="py-4">
                <p className="text-sm text-gray-800">Interview with Mark Chen</p>
                <p className="text-sm text-gray-600">DevOps Engineer</p>
                <Button
                  size="large"
                  intent="accent"
                  className="mt-3"
                >
                  Watch Recording
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
