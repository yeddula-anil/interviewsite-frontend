"use client";
import { useEffect } from "react";
import toast from "react-hot-toast";

export default function useAntiCheat(role, username, sendCheatAlert) {
  
  if (role.toUpperCase() !== "CANDIDATE") return;    // ONLY CANDIDATE

  const trigger = (event, description) => {
    toast.error(`⚠️ ${description}`);
    sendCheatAlert(`${event} - ${description}`);
  };

  // TAB SWITCH + WINDOW BLUR
  useEffect(() => {
    const onBlur = () => trigger("WINDOW_BLUR", "Window focus lost");

    const onVisibility = () => {
      if (document.hidden) {
        console.log("illegal acticity detected")
        trigger("TAB_SWITCH", "Tab switch detected");
      }
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // SCREEN RECORDING DETECTION
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const stream = await navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .catch(() => null);

        if (!stream) return;

        const isCaptured = stream.getVideoTracks().some((t) =>
          t.label.toLowerCase().includes("screen")
        );

        if (isCaptured) {
          console.log("screen recorder detected")
          trigger("SCREEN_RECORDING", "Screen recording detected");

        }

        stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, []);
}
