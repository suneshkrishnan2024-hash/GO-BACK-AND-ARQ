/* Go-Back-N ARQ — Cosmic Space Edition 🌌 */

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top left, #01030a, #030d20 45%, #000 100%);
  color: #e8f0ff;
  overflow-x: hidden;
  font-family: "Segoe UI", "Roboto", sans-serif;
}

/* panels */
.glass, header, section {
  background: rgba(15, 25, 50, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Header */
header {
  padding: 24px;
  margin: 24px auto;
  max-width: 1100px;
}

header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 10px rgba(0, 153, 255, 0.8);
}

header p {
  margin: 6px 0 16px;
  color: #9ab1d8;
}

/* Controls */
.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.controls label {
  display: flex;
  flex-direction: column;
  font-size: 14px;
  color: #cfdaf0;
}

.controls input,
.controls select {
  margin-top: 4px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

input[type="range"] {
  accent-color: #2a6bff;
}

/* Buttons */
button {
  background: linear-gradient(90deg, #0055ff, #00aaff);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 12px rgba(0, 174, 255, 0.4);
}

/* Simulation Area */
#simArea {
  position: relative;
  overflow-y: auto;
  height: 750px;
  background: rgba(5, 10, 25, 0.6);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.6);
}

#laneLabels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #89a9ff;
  font-weight: 700;
  margin-bottom: 8px;
  padding: 0 12px;
}
#laneLabels .tag {
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Packets */
.pkt {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: white;
  font-size: 13px;
  font-weight: 700;
  position: absolute;
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.9);
  transition: transform 0.2s ease, opacity 0.3s ease;
}

/* traveling pulse + glow */
.pkt.travel {
  animation: pulse 1s ease-in-out infinite alternate, trail 1s ease-in-out infinite alternate;
}
@keyframes pulse {
  from { transform: scale(1.05); }
  to { transform: scale(1.2); }
}
@keyframes trail {
  from {
    box-shadow: 0 0 20px rgba(0, 174, 255, 0.9),
                10px 0 30px rgba(0, 174, 255, 0.2);
  }
  to {
    box-shadow: 0 0 30px rgba(0, 174, 255, 1),
                14px 0 40px rgba(0, 174, 255, 0.3);
  }
}

/* packet types */
.pkt[type="frame"] { background: #0066ff; box-shadow: 0 0 18px rgba(0, 102, 255, 0.9); }
.pkt[type="ack"]   { background: #00c997; box-shadow: 0 0 18px rgba(0, 201, 151, 0.9); }
.pkt[type="lost"]  { background: #ff4040; box-shadow: 0 0 18px rgba(255, 64, 64, 0.8); }

/* Event log */
#events {
  background: rgba(10, 15, 30, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 10px;
  height: 180px;
  overflow-y: auto;
  font-family: Consolas, monospace;
  font-size: 13px;
  color: #b5c2e0;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.6);
}

/* Scrollbar */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
}

/* Footer */
footer {
  text-align: center;
  margin: 30px auto;
  color: #9bb0d7;
  font-size: 14px;
  opacity: 0.8;
}
