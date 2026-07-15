"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type MapStyleId = "streets" | "satellite" | "no-labels";

interface SettingsState {
  theme: Theme;
  sound: boolean;
  mapStyle: MapStyleId;
  voiceEnabled: boolean;
  setTheme: (theme: Theme) => void;
  setSound: (sound: boolean) => void;
  setMapStyle: (style: MapStyleId) => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      sound: true,
      mapStyle: "streets",
      voiceEnabled: true,
      setTheme: (theme) => set({ theme }),
      setSound: (sound) => set({ sound }),
      setMapStyle: (mapStyle) => set({ mapStyle }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
    }),
    { name: "taxitrainer-settings" },
  ),
);
