import React from "react";
import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";

export default function LogoiAudio({ logos }: { logos: string }) {
  const elevenlabs = new ElevenLabsClient({
    apiKey: "46583fe510ac5eeb0b5802ab2c77001ecde3f248e395eba8da3070dfea7b91eb",
  });

  const readLogos = async (logos: string) => {
    console.log("clicked");
    const audioStream = await elevenlabs.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
      text: logos,
      modelId: "eleven_v3",
      outputFormat: "mp3_44100_128",
    });

    // 1. Convert stream to a Blob
    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const blob = new Blob(chunks as any, { type: "audio/mpeg" });

    // 2. Play via Browser Audio API
    const url = URL.createObjectURL(blob);
    const player = new Audio(url);
    await player.play();
  };

  return (
    <div className="logoi-audio" onClick={() => readLogos(logos)}>
      <img src="/public/icon.svg" />
    </div>
  );
}
