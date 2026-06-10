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

# Local Setup for P2P File Share

# 1. Clone the project
git clone https://github.com/YOUR_USERNAME/P2P-File-Share.git
cd p2p-share

# 2. Start the Backend Server
Run this from the root folder to install dependencies and launch the signaling server
npm install
node server.js
# Terminal should say: Listening on 3000

# 3. Start the Frontend App
Open a second terminal window, move into the UI folder, install packages, and boot up Vite
cd p2p-ui
npm install
npm run dev

# 4. Test it out
Open http://localhost:5173 in a normal browser window
Drag and drop a file to generate a Room ID and QR code
Open an Incognito Window and browse the link generated from QR code.

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