const canvas = document.getElementById("clockCanvas");
const ctx = canvas.getContext("2d");

function drawClock() {
    const now = new Date();
    let hours = now.getHours().toString().padStart(2, "0");
    let minutes = now.getMinutes().toString().padStart(2, "0");
    let seconds = now.getSeconds().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}:${seconds}`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let bgColor = "#fff0f5";
    const theme = document.body.className;
    if (theme === "theme-purple") bgColor = "#f9f0ff";
    else if (theme === "theme-rainbow") bgColor = "rgba(255,255,255,0.2)";

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "36px Comic Sans MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "pink";
    ctx.shadowBlur = 10;

    if (theme === "theme-pink") ctx.fillStyle = "#ff69b4";
    else if (theme === "theme-purple") ctx.fillStyle = "#8a2be2";
    else if (theme === "theme-rainbow") ctx.fillStyle = "#ffffff";

    ctx.fillText(timeString, canvas.width / 2, canvas.height / 2);
}

setInterval(drawClock, 1000);
drawClock();

const pinkBtn = document.getElementById("pink");
const purpleBtn = document.getElementById("purple");
const rainbowBtn = document.getElementById("rainbow");

if (pinkBtn) pinkBtn.onclick = () => { document.body.className = "theme-pink"; drawClock(); };
if (purpleBtn) purpleBtn.onclick = () => { document.body.className = "theme-purple"; drawClock(); };
if (rainbowBtn) rainbowBtn.onclick = () => { document.body.className = "theme-rainbow"; drawClock(); };

const audioEnableBtn = document.getElementById("audioEnableBtn");
const tickToggle = document.getElementById("tickToggle");
const volumeRange = document.getElementById("volumeRange");
const volumeLabel = document.getElementById("volumeLabel");

const alarmTimeInput = document.getElementById("alarmTime");
const setAlarmBtn = document.getElementById("setAlarmBtn");
const clearAlarmBtn = document.getElementById("clearAlarmBtn");
const testAlarmBtn = document.getElementById("testAlarmBtn");
const alarmStatus = document.getElementById("alarmStatus");

let audioCtx = null;
let masterGain = null;
let audioEnabled = false;

let lastSecond = null;

let alarmHHMM = null;
let alarmTriggeredTodayKey = null;
let alarmRinging = false;
let alarmOsc = null;
let alarmInterval = null;

function ensureAudio() {
    if (audioEnabled) return true;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
        if (alarmStatus) alarmStatus.textContent = "Web Audio API not supported.";
        return false;
    }

    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = (Number(volumeRange?.value || 35) / 100);
    masterGain.connect(audioCtx.destination);

    audioEnabled = true;
    if (audioEnableBtn) {
        audioEnableBtn.textContent = "Audio Enabled";
        audioEnableBtn.disabled = true;
    }
    return true;
}

function setVolume(v) {
    if (volumeLabel) volumeLabel.textContent = `${v}%`;
    if (masterGain) masterGain.gain.value = v / 100;
}

if (volumeRange) {
    setVolume(Number(volumeRange.value));
    volumeRange.addEventListener("input", (e) => setVolume(Number(e.target.value)));
}

if (audioEnableBtn) {
    audioEnableBtn.addEventListener("click", async () => {
        if (!ensureAudio()) return;
        if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
    });
}

function playBeep({ freq = 1200, duration = 0.03, type = "square" } = {}) {
    if (!audioEnabled || !audioCtx || !masterGain) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.02);
}

function startAlarmRing() {
    if (!audioEnabled || alarmRinging) return;

    alarmRinging = true;
    if (alarmStatus) alarmStatus.textContent = `ALARM! (${alarmHHMM}) Click Clear to stop.`;

    alarmOsc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    alarmOsc.type = "square";
    alarmOsc.frequency.value = 660;

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.03);

    alarmOsc.connect(gain);
    gain.connect(masterGain);

    alarmOsc.start();

    let up = true;
    alarmInterval = setInterval(() => {
        if (!audioCtx || !alarmOsc) return;
        alarmOsc.frequency.setValueAtTime(up ? 880 : 660, audioCtx.currentTime);
        up = !up;
    }, 350);
}

function stopAlarmRing() {
    alarmRinging = false;

    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }

    if (alarmOsc) {
        try { alarmOsc.stop(); } catch {}
        try { alarmOsc.disconnect(); } catch {}
        alarmOsc = null;
    }

    if (alarmStatus) {
        alarmStatus.textContent = alarmHHMM ? `Alarm set for ${alarmHHMM}.` : "No alarm set.";
    }
}

if (setAlarmBtn) {
    setAlarmBtn.addEventListener("click", async () => {
        if (!ensureAudio()) return;
        if (audioCtx.state === "suspended") await audioCtx.resume();

        const val = alarmTimeInput?.value;
        if (!val) {
            if (alarmStatus) alarmStatus.textContent = "Pick a time first (HH:MM).";
            return;
        }

        alarmHHMM = val;
        alarmTriggeredTodayKey = null;
        if (alarmStatus) alarmStatus.textContent = `Alarm set for ${alarmHHMM}.`;
    });
}

if (clearAlarmBtn) {
    clearAlarmBtn.addEventListener("click", () => {
        alarmHHMM = null;
        alarmTriggeredTodayKey = null;
        stopAlarmRing();
    });
}

if (testAlarmBtn) {
    testAlarmBtn.addEventListener("click", async () => {
        if (!ensureAudio()) return;
        if (audioCtx.state === "suspended") await audioCtx.resume();
        alarmHHMM = alarmTimeInput?.value || alarmHHMM || "00:00";
        startAlarmRing();
    });
}

function pad(n) {
    return n < 10 ? "0" + n : "" + n;
}

function audioTickAndAlarmCheck() {
    const now = new Date();
    const sec = now.getSeconds();

    if (lastSecond === null) lastSecond = sec;

    if (sec !== lastSecond) {
        lastSecond = sec;

        if (audioEnabled && tickToggle && tickToggle.checked) {
            playBeep({ freq: 1200, duration: 0.03, type: "square" });
        }

        if (audioEnabled && alarmHHMM) {
            const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const triggerKey = `${todayKey} ${alarmHHMM}`;

            if (hhmm === alarmHHMM && alarmTriggeredTodayKey !== triggerKey) {
                alarmTriggeredTodayKey = triggerKey;
                startAlarmRing();
            }
        }
    }
}

setInterval(audioTickAndAlarmCheck, 200);


const videoPlayer = document.getElementById("videoPlayer");
const videoPlayBtn = document.getElementById("videoPlayBtn");
const videoPauseBtn = document.getElementById("videoPauseBtn");
const videoMuteBtn = document.getElementById("videoMuteBtn");
const videoSeek = document.getElementById("videoSeek");
const videoSpeed = document.getElementById("videoSpeed");
const videoVolume = document.getElementById("videoVolume");
const videoFsBtn = document.getElementById("videoFsBtn");
const videoPipBtn = document.getElementById("videoPipBtn");
const videoFile = document.getElementById("videoFile");
const videoStatus = document.getElementById("videoStatus");

if (videoPlayBtn && videoPlayer) {
    videoPlayBtn.addEventListener("click", async () => {
        try {
            await videoPlayer.play();
            if (videoStatus) videoStatus.textContent = "Playing.";
        } catch {
            if (videoStatus) videoStatus.textContent = "Play blocked. Click again.";
        }
    });
}

if (videoPauseBtn && videoPlayer) {
    videoPauseBtn.addEventListener("click", () => {
        videoPlayer.pause();
        if (videoStatus) videoStatus.textContent = "Paused.";
    });
}

if (videoMuteBtn && videoPlayer) {
    videoMuteBtn.addEventListener("click", () => {
        videoPlayer.muted = !videoPlayer.muted;
        videoMuteBtn.textContent = videoPlayer.muted ? "Unmute" : "Mute";
        if (videoStatus) videoStatus.textContent = videoPlayer.muted ? "Muted." : "Unmuted.";
    });
}

if (videoSpeed && videoPlayer) {
    videoSpeed.addEventListener("change", (e) => {
        videoPlayer.playbackRate = Number(e.target.value);
        if (videoStatus) videoStatus.textContent = `Speed: ${videoPlayer.playbackRate}x`;
    });
}

if (videoVolume && videoPlayer) {
    videoVolume.addEventListener("input", (e) => {
        videoPlayer.volume = Number(e.target.value) / 100;
        if (videoStatus) videoStatus.textContent = `Volume: ${Math.round(videoPlayer.volume * 100)}%`;
    });
}

if (videoPlayer) {
    videoPlayer.addEventListener("loadedmetadata", () => {
        if (videoStatus) videoStatus.textContent = "Video loaded.";
    });

    videoPlayer.addEventListener("timeupdate", () => {
        if (!videoPlayer.duration || isNaN(videoPlayer.duration)) return;
        const progress = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        if (videoSeek) videoSeek.value = String(progress);
    });
}

if (videoSeek && videoPlayer) {
    videoSeek.addEventListener("input", () => {
        if (!videoPlayer.duration || isNaN(videoPlayer.duration)) return;
        const pct = Number(videoSeek.value) / 100;
        videoPlayer.currentTime = pct * videoPlayer.duration;
    });
}

if (videoFsBtn && videoPlayer) {
    videoFsBtn.addEventListener("click", async () => {
        try {
            if (!document.fullscreenElement) {
                await videoPlayer.requestFullscreen();
                if (videoStatus) videoStatus.textContent = "Fullscreen on.";
            } else {
                await document.exitFullscreen();
                if (videoStatus) videoStatus.textContent = "Fullscreen off.";
            }
        } catch {
            if (videoStatus) videoStatus.textContent = "Fullscreen not available.";
        }
    });
}

if (videoPipBtn && videoPlayer) {
    videoPipBtn.addEventListener("click", async () => {
        try {
            if (!document.pictureInPictureElement) {
                await videoPlayer.requestPictureInPicture();
                if (videoStatus) videoStatus.textContent = "PiP on.";
            } else {
                await document.exitPictureInPicture();
                if (videoStatus) videoStatus.textContent = "PiP off.";
            }
        } catch {
            if (videoStatus) videoStatus.textContent = "PiP not available.";
        }
    });
}

if (videoFile && videoPlayer) {
    videoFile.addEventListener("change", () => {
        const file = videoFile.files && videoFile.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        videoPlayer.load();
        if (videoStatus) videoStatus.textContent = `Loaded: ${file.name}`;
    });
}
