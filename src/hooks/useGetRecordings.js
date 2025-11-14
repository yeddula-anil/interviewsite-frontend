
import { useAuth } from "@/context/AuthProvider";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useEffect, useState } from "react";

export const useGetRecordings = () => {
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const client = useStreamVideoClient();
  const { user } =useAuth()

  useEffect(() => {
    const fetchRecordings = async () => {
      if (!client || !user?.id) return;

      setIsLoading(true);
      try {
        // 1️⃣ Fetch all call objects
        const { calls } = await client.queryCalls({
          sort: [{ field: "starts_at", direction: -1 }],
          filter_conditions: {
            starts_at: { $exists: true },
            $or: [
              { created_by_user_id: user.id },
              { members: { $in: [user.id] } },
            ],
          },
        });

        // 2️⃣ Fetch recordings for each call
        const callRecordings = await Promise.all(
          calls.map((call) => call.queryRecordings())
        );

        // 3️⃣ Merge all recordings
        const allRecordings = callRecordings
          .filter((r) => r.recordings?.length > 0)
          .flatMap((r) => r.recordings)
          .map((rec) => ({
            ...rec,
            meetingId: rec.filename.split("_")[0], // extract meeting id
            date: rec.start_time,
          }));

        setRecordings(allRecordings);
      } catch (error) {
        console.error("Error fetching recordings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordings();
  }, [client, user?.id]);

  return { recordings, isLoading };
};
