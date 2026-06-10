import { useState, useRef, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';

const sock = io(`http://${window.location.hostname}:3000`);

function App() {
  const [id, setId] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [safe, setSafe] = useState(false);
  const [link, setLink] = useState(null);
  const [prog, setProg] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  
  const drop = useRef(null);
  const pc = useRef(null);
  const dc = useRef(null);
  const buf = useRef([]);
  const exp = useRef('');
  const meta = useRef({ name: 'shared_file', type: 'application/octet-stream', size: 0 });
  const wait = useRef(null);
  
  const raw = useRef(null);
  const off = useRef(0);
  const size = useRef(65536);
  const t0 = useRef(0);
  const timer = useRef(null);
  const rid = useRef('');
  const rcv = useRef(0);

  const gen = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
  };

  const mkHash = async (data) => {
    const arr = await data.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', arr);
    const hex = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hex;
  };

  useEffect(() => {
    const url = window.location.pathname;
    const room = url.includes('/join/') ? url.split('/join/')[1] : null;

    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.current.onicecandidate = (e) => {
      if (e.candidate) sock.emit('ice-candidate', rid.current || room, e.candidate);
    };

    pc.current.onconnectionstatechange = () => {
      const s = pc.current.connectionState;
      if (s === 'disconnected' || s === 'failed' || s === 'closed') {
        setMsg('Tunnel terminated');
      }
    };

    sock.on('peer-left', () => {
      setMsg('Peer disconnected');
      setProg(0);
    });

    if (room) {
      rid.current = room;
      setId(room);
      sock.emit('join', room);
      setMsg('Connecting to secure stream...');
      
      pc.current.ondatachannel = (e) => {
        dc.current = e.channel;
        dc.current.onmessage = onData;
      };
    }

    sock.on('created', () => setMsg('Awaiting remote node connection...'));
    sock.on('joined', () => setMsg('Cryptographic handshake success'));

    sock.on('ready', async () => {
      dc.current = pc.current.createDataChannel('file');
      dc.current.onopen = () => setMsg('P2P Pipeline Active');
      dc.current.onmessage = onData;
      
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      sock.emit('offer', rid.current || room, offer);
    });

    sock.on('offer', async (desc) => {
      await pc.current.setRemoteDescription(desc);
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      sock.emit('answer', rid.current || room, answer);
    });

    sock.on('answer', async (desc) => {
      await pc.current.setRemoteDescription(desc);
    });

    sock.on('ice-candidate', async (data) => {
      await pc.current.addIceCandidate(data);
    });

    return () => sock.removeAllListeners();
  }, []);

  const push = () => {
    if (off.current >= raw.current.byteLength) {
      dc.current.send('DONE');
      setMsg('Stream completely broadcasted');
      setProg(100);
      return;
    }
    
    const chunk = raw.current.slice(off.current, off.current + size.current);
    t0.current = Date.now();
    dc.current.send(chunk);
    
    timer.current = setTimeout(() => {
      setMsg('Optimizing chunk size for lag...');
    }, 3000);
  };

  const onData = async (e) => {
    if (typeof e.data === 'string') {
      if (e.data.startsWith('HASH:')) {
        exp.current = e.data.split(':')[1];
      } else if (e.data.startsWith('META:')) {
        meta.current = JSON.parse(e.data.substring(5));
      } else if (e.data === 'DONE') {
        setProg(100);
        const blob = new Blob(buf.current, { type: meta.current.type });
        const act = await mkHash(blob);

        if (act === exp.current) {
          setSafe(true);
          const txt = `Secure Delivery Verified\nHash: ${act}\nTime: ${new Date().toISOString()}`;
          const rb = new Blob([txt], { type: 'text/plain' });
          const rl = URL.createObjectURL(rb);
          const ra = document.createElement('a');
          ra.href = rl;
          ra.download = 'receipt.txt';
          ra.click();
          URL.revokeObjectURL(rl);
        }

        const fUrl = URL.createObjectURL(blob);
        setLink(fUrl);
        
        const a = document.createElement('a');
        a.href = fUrl;
        a.download = meta.current.name;
        a.click();
        
        buf.current = [];
        rcv.current = 0;
        setMsg('Payload decrypted and saved');
      } else if (e.data === 'ACK') {
        clearTimeout(timer.current);
        setMsg('Streaming binary blocks...');
        const p = Math.min(100, Math.round((off.current / raw.current.byteLength) * 100));
        setProg(p);
        const t1 = Date.now();
        const ping = t1 - t0.current;

        off.current += size.current;

        if (ping > 500) {
          size.current = Math.max(16384, Math.floor(size.current / 2));
        } else if (ping < 100) {
          size.current = Math.min(262144, size.current * 2);
        }

        push();
      }
    } else {
      buf.current.push(e.data);
      rcv.current += e.data.byteLength;
      if (meta.current.size) {
        const p = Math.min(100, Math.round((rcv.current / meta.current.size) * 100));
        setProg(p);
      }
      dc.current.send('ACK');
    }
  };

  const sendFile = async (f) => {
    const hash = await mkHash(f);
    dc.current.send(`HASH:${hash}`);
    dc.current.send(`META:${JSON.stringify({ name: f.name, type: f.type, size: f.size })}`);

    const reader = new FileReader();
    reader.onload = (e) => {
      raw.current = e.target.result;
      off.current = 0;
      size.current = 65536;
      push();
    };
    reader.readAsArrayBuffer(f);
  };

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      setFile(f);
      const room = gen();
      rid.current = room;
      setId(room);
      sock.emit('join', room);
      
      if (wait.current) clearInterval(wait.current);

      wait.current = setInterval(() => {
        if (dc.current && dc.current.readyState === 'open') {
          sendFile(f);
          clearInterval(wait.current);
        }
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden selection:bg-cyan-500/30">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-[140px] pointer-events-none animate-pulse duration-[6000ms]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-tl from-indigo-500/10 to-transparent rounded-full blur-[140px] pointer-events-none animate-pulse duration-[8000ms]"></div>

      <style>{`
        @keyframes custom-downward {
          0%, 100% { transform: translateY(-4px); opacity: 0.4; }
          50% { transform: translateY(6px); opacity: 1; }
        }
        .animate-dropping { animation: custom-downward 1.4s infinite ease-in-out; }
      `}</style>

      <div className="w-full max-w-md flex flex-col items-center text-center mb-8 relative z-10">
        <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono font-black tracking-widest uppercase rounded-full mb-3 shadow-md shadow-cyan-500/5">
          Direct Transfer
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent tracking-tight mb-2 uppercase">
          AeroLink
        </h1>
        <p className="text-xs text-slate-400 font-medium max-w-xs">
          Send files directly to another device without saving them to the cloud. Private, fast, and serverless.
        </p>
      </div>

      <div
        ref={drop}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        className={`w-full max-w-md p-8 border-2 rounded-2xl flex flex-col items-center justify-center bg-slate-900/20 backdrop-blur-2xl transition-all duration-300 min-h-[300px] relative z-10 border-dashed overflow-hidden ${
          dragActive 
            ? 'border-cyan-400 bg-slate-900/70 scale-[1.02] shadow-[0_0_40px_rgba(34,211,238,0.15)]' 
            : file 
              ? 'border-blue-500/40 bg-slate-900/40 shadow-lg shadow-blue-500/5' 
              : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/40 shadow-2xl'
        }`}
      >
        {file ? (
          <div className="w-full flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-400 font-black mb-4 border border-blue-500/30 shadow-xl tracking-wider text-sm transition-transform duration-500 scale-100">
              {file.name.split('.').pop()?.toUpperCase() || 'DATA'}
            </div>
            <p className="text-base font-bold text-slate-200 truncate w-full px-6 text-center mb-1">
              {file.name}
            </p>
            <p className="text-xs font-mono text-slate-500">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center pointer-events-none w-full transition-all duration-300">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 mb-5 text-xl font-bold ${
              dragActive 
                ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-400 scale-90' 
                : 'bg-slate-900/90 border-slate-800 text-slate-400 shadow-xl'
            }`}>
              {dragActive ? (
                <span className="scale-125">📥</span>
              ) : (
                <span className="animate-dropping text-2xl">↓</span>
              )}
            </div>
            <p className={`text-sm font-bold transition-colors duration-200 ${dragActive ? 'text-cyan-400' : 'text-slate-300'}`}>
              {dragActive ? 'Release mouse to open tunnel' : 'Drop a file here to start sharing'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Your files never touch our servers
            </p>
          </div>
        )}

        {msg && (
          <span className="mt-6 px-3 py-1 text-[10px] font-mono font-black uppercase tracking-widest bg-slate-950 border border-slate-800/80 text-cyan-400/90 rounded-md shadow-inner">
            {msg}
          </span>
        )}

        {prog > 0 && (
          <div className="w-full mt-6 flex flex-col items-center px-4">
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden p-[1px] border border-slate-800/60">
              <div 
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 h-full rounded-full transition-all duration-150 ease-out shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
                style={{ width: `${prog}%` }}
              ></div>
            </div>
            <p className="text-[9px] font-mono font-black text-slate-400 mt-2 tracking-[0.2em] uppercase">
              {prog}% transferred
            </p>
          </div>
        )}

        {safe && (
          <div className="mt-5 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-bold tracking-wide flex items-center gap-2 shadow-inner">
            <span>✓ Cryptographic Integrity Verified</span>
          </div>
        )}

        {link && (
          <a 
            href={link} 
            download={meta.current.name} 
            className="mt-6 w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white text-xs font-black tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] text-center"
          >
            Save Transferred File
          </a>
        )}
      </div>

      {id && !window.location.pathname.includes('/join/') && (
        <div className="w-full max-w-md mt-6 bg-slate-900/10 border border-slate-900/60 p-6 rounded-2xl flex flex-col items-center shadow-2xl backdrop-blur-2xl relative z-10">
          <p className="text-[9px] font-mono font-black text-slate-500 tracking-widest uppercase mb-2">
            Dynamic Gateway ID
          </p>
          <h2 className="text-3xl font-black text-slate-100 tracking-widest mb-1 font-mono">
            {id}
          </h2>
          <p className="text-[11px] text-slate-400 mb-5 font-medium">
            Scan to handshake from remote receiver device
          </p>
          <div className="p-4 bg-white rounded-xl shadow-2xl border border-slate-200 transition-transform duration-300 hover:scale-[1.01]">
            <QRCodeCanvas 
              value={`${window.location.origin}/join/${id}`} 
              size={170} 
              level={"H"}
              fgColor="#020617"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;