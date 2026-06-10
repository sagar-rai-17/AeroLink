# AeroLink - Direct P2P File Sharing

AeroLink lets you send files straight from one browser to another without uploading them to any cloud servers or databases. It uses WebSockets just to introduce the two devices, and WebRTC data channels to do the heavy lifting of streaming the actual file. Your data stays completely private, fast, and serverless.

---

## 🛠️ How it Works

* **Direct Streaming:** Files skip the cloud entirely, streaming chunk-by-chunk straight to the receiver using WebRTC.
* **Smart Speed Adjustment:** Actively monitors network speed. If the connection drops or lags, it shrinks data blocks to prevent crashes; when the speed is good, it scales them up to finish the transfer faster.
* **Corruption Check:** Uses the browser's built-in Web Crypto API to hash the file (SHA-256) before and after sending. If the hashes match, you know the file arrived perfectly.
* **Live Progress Bars:** Both the sender and receiver screens update simultaneously with matching transfer percentages.
* **Clean Disconnects:** Instantly resets the UI and clears memory buffers if a user suddenly closes their tab mid-transfer.

---

## 💻 Tech Stack

* **Frontend:** React.js, Tailwind CSS, Vite
* **Signaling Backend:** Node.js, Express, Socket.io
* **Core Protocols:** WebRTC (Data Channels, STUN)

---

## 📂 Folder Structure

```text
p2p-share/
├── server.js             # Backend signaling server
├── package.json          # Backend dependencies
└── p2p-ui/               # React frontend app
    ├── src/
    │   ├── App.jsx       # Core app logic and layout
    │   ├── index.css     # Tailwind styles
    │   └── main.jsx      # React loader
    ├── tailwind.config.js
    └── package.json

---

## ⚙️ Local Setup

### 1. Clone the project
```bash
git clone [https://github.com/YOUR_USERNAME/P2P-File-Share.git](https://github.com/YOUR_USERNAME/P2P-File-Share.git)
cd p2p-share
### 2. Start the Backend Server
```bash
npm install
node server.js
### 3. Start the Frontend App
```bash
cd p2p-ui
npm install
npm run dev
### 4. Test it out
