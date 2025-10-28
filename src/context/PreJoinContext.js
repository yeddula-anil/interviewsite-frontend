// context/PreJoinContext.js
'use client'
import { createContext, useContext, useState } from 'react';

const PreJoinContext = createContext();

export const PreJoinProvider = ({ children }) => {
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  return (
    <PreJoinContext.Provider value={{ micEnabled, setMicEnabled, camEnabled, setCamEnabled,selectedMeeting, setSelectedMeeting }}>
      {children}
    </PreJoinContext.Provider>
  );
};

export const usePreJoin = () => useContext(PreJoinContext);
