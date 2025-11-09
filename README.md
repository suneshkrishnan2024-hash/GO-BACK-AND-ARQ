# Go-Back-N ARQ — Visual Teaching Simulator

**Developed by:** Sunesh Krishnan N (24BCE1925)  
**Co-Developer:** Aravind G (24BCE1293)  
**Guided by:** Dr. Swaminathan Annadurai  
**Institution:** VIT Chennai  

---

## Overview

The Go-Back-N ARQ Visual Teaching Simulator is a web-based application created to demonstrate the operation of the Go-Back-N Automatic Repeat Request (ARQ) protocol.  
It visually represents how data frames and acknowledgments flow through a network, including events such as timeouts, retransmissions, and frame losses.  

The goal of this project is to help students and educators understand the inner mechanics of sliding-window communication protocols through interactive visualization rather than static diagrams.

---

## Features

- Real-time animation of frame transmission and acknowledgment flow  
- Adjustable parameters:
  - Number of frames
  - Window size (N)
  - Timeout interval
  - Frame and acknowledgment loss or delay configuration  
- Simulation of random or specific packet loss modes  
- Event log showing every step of the communication process  
- Automatic statistics generation, including efficiency and total transmissions  
- Report export in plain-text format  
- Glass-style user interface with responsive layout

---

## Technology Stack

| Component | Technology |
|------------|-------------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Design Style | Glassmorphism |
| Deployment | Netlify (continuous deployment from GitHub) |
| Version Control | Git and GitHub |

---

## Live Demo

Access the live simulation here:  
https://gobacknarq.netlify.app/

Each commit pushed to the main branch automatically triggers a new build on Netlify.

---

## Project Structure

