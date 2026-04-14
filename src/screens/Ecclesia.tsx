import React, { useState, useRef, useMemo } from "react";
import { usePebbleStore } from "../store";
import { quotes } from "../data/quotes";
import { LOTD } from "../components/LOTD";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export const Ecclesia = () => {
  const { streak, activityDates } = usePebbleStore();

  const weekDays = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const monOffset = (today.getDay() + 6) % 7; // 0=Mon … 6=Sun
    return DAY_LABELS.map((lbl, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - monOffset + i);
      const dateStr = d.toISOString().slice(0, 10);
      let state = "";
      if (dateStr === todayStr) state = activityDates.includes(dateStr) ? "done" : "today";
      else if (dateStr < todayStr && activityDates.includes(dateStr)) state = "done";
      return { lbl, state };
    });
  }, [activityDates]);

  const quote = quotes[Math.floor(Date.now() / 3_600_000) % quotes.length];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, height: "100%" }}>
      {/* Header */}
      <div className="ecclesia-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="screen-title">Ecclesia</div>
          <div className="screen-sub">The Path of Demosthenes</div>
        </div>
        <div className="streak-pill">🔥 {streak}</div>
      </div>

      <LOTD />

      {/* Weekly streak card */}
      <div className="card hero-card" style={{ padding: "16px 18px", flexShrink: 0 }}>
        <div className="week-row" style={{ marginBottom: 0 }}>
          {weekDays.map((d, i) => (
            <div className="week-day" key={i}>
              <div className="wlbl">{d.lbl}</div>
              <div className={`wdot${d.state === "done" ? " done" : d.state === "today" ? " today" : ""}`}>
                {d.state === "done" ? "✓" : d.state === "today" ? "•" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quote card */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          background: "var(--glass)",
          border: "1px solid var(--glass-border)",
          borderLeft: "3px solid var(--gold-dim)",
          borderRadius: 14,
          padding: "8px 20px 16px 22px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 17,
            fontStyle: "italic",
            fontWeight: 500,
            color: "var(--text)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          "{quote.text}"
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--gold-dim)",
            marginTop: 0,
            textTransform: "uppercase",
          }}
        >
          — {quote.author}
        </div>
      </div>
    </div>
  );
};
