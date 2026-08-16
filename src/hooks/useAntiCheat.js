"use client";
import { useEffect } from "react";
import toast from "react-hot-toast";

export default function useAntiCheat(role, username, sendCheatAlert) {
  const trigger = (event, description) => {
    if (role?.toUpperCase() !== "CANDIDATE") return;
    toast.error(`⚠️ ${description}`);
    if (sendCheatAlert) sendCheatAlert(`${event} - ${description}`);
  };

  // TAB SWITCH + WINDOW BLUR
  useEffect(() => {
    if (role?.toUpperCase() !== "CANDIDATE") return;

    const onBlur = () => trigger("WINDOW_BLUR", "Window focus lost");

    const onVisibility = () => {
      if (document.hidden) {
        console.log("illegal activity detected");
        trigger("TAB_SWITCH", "Tab switch detected");
      }
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [role, sendCheatAlert]);

  // SCREEN RECORDING DETECTION
  useEffect(() => {
    if (role?.toUpperCase() !== "CANDIDATE") return;

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
          console.log("screen recorder detected");
          trigger("SCREEN_RECORDING", "Screen recording detected");
        }

        stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [role, sendCheatAlert]);
}
