# FITTLY: AI-Powered Digital Tailoring Studio & Web-Grounded Biometric Sizing Assistant

[![SoftwareX Submission](https://img.shields.io/badge/SoftwareX-Submission%20v1.2.0-blue.svg)](https://github.com/shaffiqkhan/FITTLY-1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

---

## 🌐 Public Live Interactive Web Demonstration

A publicly accessible, interactive live deployment of FITTLY is hosted on Google Cloud Run:

👉 **Live Demo Web App:** [https://ais-pre-h55d2b7ium6bzdnoe47cpo-587725839219.asia-southeast1.run.app](https://ais-pre-h55d2b7ium6bzdnoe47cpo-587725839219.asia-southeast1.run.app)

*Reviewers can interact directly with the live system without any local compilation or API key configuration, as all AI calls are securely routed via the server-side proxy.*

---

## 🎥 Video Demonstration & Walkthrough

A complete demonstration video walkthrough illustrating the end-to-end functionality of FITTLY is available for review:

- **Interactive Walkthrough Video:** Available in the repository under `/docs/demo-walkthrough.mp4` and online via the [Release Artifacts](https://github.com/shaffiqkhan/FITTLY-1/releases/tag/v1.2.0).
- **Core capabilities demonstrated:**
  1. **Measure Tab:** Front and side pose photo upload/capture, multi-modal keypoint extraction (18 front keypoints, 9 side keypoints), and automatic body circumference/length measurement calculation.
  2. **Tailor Tab:** Real-time 2D interactive vector canvas with mouse/touch drag-and-drop nodes, Euclidean distance ratio scaling, and live garment dimension recalculation (shirt length, sleeve length, shoulder width, trouser length, waist).
  3. **Custom Designs & Profile:** Saving customized specs into offline local storage, instant unit switching (cm/in), and exporting verified size chart sheets.
  4. **Smart Shop Tab:** Live URL ingestion of retail apparel items, AI-powered size chart scraping via URL Context grounding, and weighted multi-dimensional size recommendation with confidence scoring.

---

## 🏛️ System Architecture

FITTLY uses a full-stack, decoupled architecture:

- **Frontend (Client):** React 19 SPA, Tailwind CSS v4, Lucide Icons, Framer Motion (`motion/react`) for smooth physics and spring animations.
- **Server-Side API Proxy (Node.js / Express):** Express backend (`server.ts`) hosting secure endpoints under `/api/gemini/*` with `User-Agent: aistudio-build`. In development mode, Vite middleware is mounted for rapid HMR; in production, Express serves optimized static assets.
- **AI Core:** Google GenAI TypeScript SDK (`@google/genai` v2.x) targeting `gemini-3.8-flash` with structured JSON schema outputs and `urlContext` web search grounding.

```
[ Browser / Mobile Client ] 
        │ (JSON / Base64 Payload via /api/gemini/*)
        ▼
[ Node.js + Express API Proxy ] ─── (process.env.GEMINI_API_KEY)
        │
        ▼
[ Google Gemini AI Engine ] ─── (Keypoint Detection + Biometrics + URL Sizing Grounding)
```

---

## 🚀 Quick Start & Local Reproduction

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** (comes with Node.js)
- A **Google Gemini API Key** (obtainable from [Google AI Studio](https://aistudio.google.com/))

### 1. Clone the Repository
```bash
git clone https://github.com/shaffiqkhan/FITTLY-1.git
cd FITTLY-1
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and set your `GEMINI_API_KEY`:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build & Run for Production
```bash
npm run build
npm start
```

---

## 🧪 Verification & Automated Checks

To verify code integrity, types, and build status:

```bash
# Type check without emitting
npm run lint

# Production bundle build
npm run build
```

---

## 📑 SoftwareX Reviewer Response Summary (Reviewer 4 Comment 3)

| Reviewer Comment | Author Action & Resolution |
| :--- | :--- |
| **Publicly accessible repository** | Created and made public at [https://github.com/shaffiqkhan/FITTLY-1](https://github.com/shaffiqkhan/FITTLY-1) under MIT License. |
| **Interactive demo website** | Deployed at [https://ais-pre-h55d2b7ium6bzdnoe47cpo-587725839219.asia-southeast1.run.app](https://ais-pre-h55d2b7ium6bzdnoe47cpo-587725839219.asia-southeast1.run.app). Fully functional with server-side AI proxying. |
| **Demonstration video** | Provided in repository `/docs/` and linked in documentation and SoftwareX paper appendix. |

---

## 📜 License
This software is licensed under the [MIT License](LICENSE).
