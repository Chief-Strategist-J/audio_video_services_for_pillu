const logEl = document.getElementById("log");
function log(msg) {
  console.log(msg);
  logEl.textContent += msg + "\n";
}
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("room");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
let pc = null;
let ws = null;
function iceServers() {
  return [{ urls: ["stun:stun.l.google.com:19302"] }];
}
async function start() {
  const room = roomInput.value.trim() || "demo";
  ws = new WebSocket(`ws://${location.host}/ws?room=${encodeURIComponent(room)}`);
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (!pc) return;
    if (msg.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    } else if (msg.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: "answer", sdp: answer }));
    } else if (msg.type === "candidate") {
      await pc.addIceCandidate(msg.candidate);
    }
  };
  pc = new RTCPeerConnection({ iceServers: iceServers() });
  pc.onicecandidate = (e) => {
    if (e.candidate && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "candidate", candidate: e.candidate }));
    }
  };
  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  localVideo.srcObject = stream;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "offer", sdp: offer }));
  };
}
joinBtn.addEventListener("click", () => {
  if (!pc) start();
});
