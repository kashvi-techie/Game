"use client";

import dynamic from "next/dynamic";

const RaceScene = dynamic(() => import("./RaceScene"), {
  ssr: false,
  loading: () => <div className="viewport-loading" aria-label="Loading race circuit" />,
});

export default function RaceViewport(props: {
  introActive: boolean;
  introRunId: number;
  motionEnabled: boolean;
  onIntroComplete: () => void;
}) {
  return <RaceScene {...props} />;
}