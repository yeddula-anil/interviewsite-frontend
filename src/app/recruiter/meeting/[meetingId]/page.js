import React, { Suspense } from "react";
import JoinMeetingPage from '@/components/common/JoinMeetingPage';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading meeting...</div>}>
      <JoinMeetingPage />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
