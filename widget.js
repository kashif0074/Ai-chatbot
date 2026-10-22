(function () {
    const BACKEND_URL = "http://localhost:5000";

    // ─── Inject Dependencies ────────────────────────────────────────────────
    const tailwindScript = document.createElement('script');
    tailwindScript.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(tailwindScript);

    const livekitScript = document.createElement('script');
    livekitScript.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.js';
    document.head.appendChild(livekitScript);

    const style = document.createElement('style');
    style.textContent = `
        @keyframes evitalsPulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 119, 182, 0.55); }
            70% { box-shadow: 0 0 0 12px rgba(0, 119, 182, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 119, 182, 0); }
        }
        .evitals-pulse { animation: evitalsPulse 2.2s infinite; }
        #evitals-widget-root video { width:100%; height:100%; object-fit:cover; border-radius: 1rem; }
        #evitals-chat-log::-webkit-scrollbar { width: 4px; }
        #evitals-chat-log::-webkit-scrollbar-thumb { background: #d9e5ee; border-radius: 4px; }

        @keyframes evitalsWave {
            0%, 100% { height: 4px; }
            50% { height: 16px; }
        }
        .evitals-wave-bar {
            width: 3px;
            background-color: #a9d8ef;
            border-radius: 9999px;
            display: inline-block;
            animation: evitalsWave 0.8s ease-in-out infinite;
        }
        .evitals-wave-bar:nth-child(2) { animation-delay: 0.15s; }
        .evitals-wave-bar:nth-child(3) { animation-delay: 0.3s; }

        .evitals-panel {
            transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                        visibility 0.28s;
        }
        .evitals-closed {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
            visibility: hidden;
            pointer-events: none;
        }
        .evitals-open {
            opacity: 1;
            transform: translateY(0) scale(1);
            visibility: visible;
            pointer-events: auto;
        }
    `;
    document.head.appendChild(style);

    livekitScript.onload = () => init();

    function init() {
        let isOpen = false;
        let room = null;
        let sessionId = null;
        let micEnabled = false;
        let speakerEnabled = true;

        // ─── Build Widget UI ────────────────────────────────────────────────
        const container = document.createElement('div');
        container.id = 'evitals-widget-root';
        container.innerHTML = `
        <!-- Floating Chatbot Panel (Popup) -->
        <div id="evitals-chatbot-panel"
             class="evitals-panel evitals-closed fixed bottom-24 right-5 sm:right-6 w-[94vw] sm:w-[410px] max-h-[88vh] bg-white text-[#0c1326] rounded-3xl shadow-[0_20px_60px_rgba(3,4,94,0.18)] border border-[#d9e5ee] flex flex-col z-[9999999] font-sans overflow-hidden">

            <!-- Header Bar (eVitals Navy & Blue Gradient) -->
            <div class="px-5 py-3.5 bg-gradient-to-r from-[#03045e] to-[#0077b6] text-white flex justify-between items-center select-none shadow-sm">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                        +
                    </div>
                    <div>
                        <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
                            e-Vitals Assistant
                            <span class="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-[#a9d8ef]/25 text-[#a9d8ef] font-semibold border border-white/20">RPM</span>
                        </h3>
                        <p class="text-[10px] text-[#a9d8ef]">Remote Patient Monitoring Specialist</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="evitals-start-btn" class="bg-white/20 hover:bg-white/30 text-white border border-white/30 text-[11px] px-3 py-1 rounded-xl font-medium transition shadow-sm evitals-pulse">
                        ▶ Start Avatar
                    </button>
                    <button id="evitals-close-header-btn" class="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition" title="Close Chat">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Avatar Video Box -->
            <div id="evitals-screen-box" class="relative w-full h-60 bg-gradient-to-b from-[#03045e] to-[#0c1326] flex items-center justify-center overflow-hidden cursor-pointer select-none">
                <div id="evitals-placeholder" class="flex flex-col items-center justify-center gap-2.5 p-5 text-center">
                    <div class="w-14 h-14 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white shadow-inner">
                        <svg class="w-7 h-7 text-[#a9d8ef]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z"/>
                        </svg>
                    </div>
                    <p class="text-xs font-semibold text-white">Female AI Speaking Avatar</p>
                    <p class="text-[11px] text-[#a9d8ef] mt-0.5">Click "Start Avatar" to connect live stream</p>
                </div>
                <div id="evitals-video-container" class="absolute inset-0 hidden bg-black"></div>
                <div id="evitals-status" class="absolute top-3 left-3 bg-[#03045e]/85 backdrop-blur text-[11px] text-[#a9d8ef] px-2.5 py-1 rounded-full border border-white/20 hidden">
                    Avatar Ready
                </div>
                <div id="evitals-speaking" class="absolute bottom-3 bg-[#03045e]/90 backdrop-blur text-white text-xs px-3.5 py-1.5 rounded-full border border-[#0077b6] hidden items-center gap-2 shadow-lg">
                    <div class="flex items-center gap-0.5 h-3">
                        <span class="evitals-wave-bar"></span>
                        <span class="evitals-wave-bar"></span>
                        <span class="evitals-wave-bar"></span>
                    </div>
                    <span class="text-[11px] font-medium">Avatar Speaking…</span>
                </div>
                <div id="evitals-unmute" class="absolute inset-x-0 bottom-3 mx-auto w-max bg-[#03045e]/95 backdrop-blur border border-[#a9d8ef]/50 text-white text-xs px-3 py-1 rounded-full hidden items-center gap-1.5 shadow">
                    🔊 Click here to enable audio
                </div>
            </div>

            <!-- Book a Meeting Button (evitalsrpm.com Blue) -->
            <div class="px-4 pt-3.5">
                <a href="https://www.evitalsrpm.com" target="_blank"
                   class="block w-full bg-gradient-to-r from-[#0077b6] to-[#0096c7] hover:from-[#023e8a] hover:to-[#0077b6] text-white py-2.5 rounded-xl text-center text-xs font-bold tracking-wide shadow-md transition active:scale-[0.99]">
                    📅 Book a Meeting
                </a>
            </div>

            <!-- Controls (Mic & Speaker) -->
            <div class="px-6 py-2.5 flex justify-center items-center gap-8">
                <button id="evitals-mic-btn" class="flex flex-col items-center gap-1 cursor-pointer">
                    <div id="evitals-mic-circle" class="w-10 h-10 rounded-full bg-[#f1f7fc] border border-[#d9e5ee] flex items-center justify-center transition shadow-sm">
                        <span id="evitals-mic-icon" class="text-[#c8102e] text-xs">🎙️✕</span>
                    </div>
                    <span id="evitals-mic-label" class="text-[11px] text-[#6b7487] font-medium">Mic</span>
                </button>
                <button id="evitals-speaker-btn" class="flex flex-col items-center gap-1 cursor-pointer">
                    <div id="evitals-speaker-circle" class="w-10 h-10 rounded-full bg-[#f1f7fc] border border-[#d9e5ee] flex items-center justify-center transition shadow-sm">
                        <span id="evitals-speaker-icon" class="text-[#0077b6] text-sm">🔊</span>
                    </div>
                    <span id="evitals-speaker-label" class="text-[11px] text-[#6b7487] font-medium">Speaker</span>
                </button>
            </div>

            <!-- Chat Log -->
            <div id="evitals-chat-log" class="mx-3.5 p-3 h-28 overflow-y-auto bg-[#f8fbfe] rounded-xl border border-[#d9e5ee] text-xs space-y-2">
                <div class="text-[#6b7487] italic text-[11px]">Ask me "What is eVitals?" or about RPM Medicare billing...</div>
            </div>

            <!-- Input Bar -->
            <div class="p-3 bg-white border-t border-[#d9e5ee] flex gap-2 items-center">
                <input id="evitals-input" type="text" placeholder="Ask a question (e.g. What is eVitals?)"
                       class="flex-1 bg-[#f1f7fc] border border-[#d9e5ee] rounded-xl px-3.5 py-2 text-xs text-[#0c1326] placeholder-[#6b7487] focus:outline-none focus:border-[#0077b6] focus:bg-white focus:ring-2 focus:ring-[#a9d8ef]/50 transition">
                <button id="evitals-send-btn" class="bg-gradient-to-tr from-[#03045e] to-[#0077b6] hover:from-[#023e8a] hover:to-[#0096c7] p-2 rounded-xl transition text-white shadow-md">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/>
                    </svg>
                </button>
            </div>

            <!-- Footer -->
            <div class="px-4 py-1.5 bg-[#f1f7fc] flex justify-between items-center text-[10px] text-[#6b7487] border-t border-[#d9e5ee]">
                <span>Powered by Groq & LiveAvatar</span>
                <button id="evitals-stop-btn" class="text-[#c8102e] hover:underline font-medium hidden">End Session</button>
            </div>
        </div>

        <!-- Floating Chatbot Action Button (Bottom-Right FAB) -->
        <div class="fixed bottom-6 right-6 z-[99999999] flex items-center gap-3">
            <button id="evitals-fab-btn"
                    class="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#03045e] to-[#0077b6] hover:from-[#023e8a] hover:to-[#0096c7] text-white shadow-[0_12px_30px_rgba(3,4,94,0.3)] flex items-center justify-center transition-all duration-300 active:scale-95 focus:outline-none evitals-pulse"
                    title="Open e-Vitals Assistant">
                <div id="evitals-fab-chat-icon">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                </div>
                <div id="evitals-fab-close-icon" class="hidden">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </div>
                <span class="absolute top-1 right-1 w-3.5 h-3.5 bg-[#a9d8ef] border-2 border-[#03045e] rounded-full"></span>
            </button>
        </div>

        <div id="evitals-audio-holder"></div>`;
        document.body.appendChild(container);

        // ─── DOM References ─────────────────────────────────────────────────
        const chatbotPanel = document.getElementById('evitals-chatbot-panel');
        const fabBtn       = document.getElementById('evitals-fab-btn');
        const chatIcon     = document.getElementById('evitals-fab-chat-icon');
        const closeIcon    = document.getElementById('evitals-fab-close-icon');
        const closeHeaderBtn = document.getElementById('evitals-close-header-btn');

        const startBtn = document.getElementById('evitals-start-btn');
        const stopBtn = document.getElementById('evitals-stop-btn');
        const sendBtn = document.getElementById('evitals-send-btn');
        const inputEl = document.getElementById('evitals-input');
        const chatLog = document.getElementById('evitals-chat-log');
        const statusEl = document.getElementById('evitals-status');
        const speakingEl = document.getElementById('evitals-speaking');
        const unmuteEl = document.getElementById('evitals-unmute');
        const placeholder = document.getElementById('evitals-placeholder');
        const videoContainer = document.getElementById('evitals-video-container');
        const screenBox = document.getElementById('evitals-screen-box');
        const audioHolder = document.getElementById('evitals-audio-holder');

        const micBtn = document.getElementById('evitals-mic-btn');
        const micIcon = document.getElementById('evitals-mic-icon');
        const micCircle = document.getElementById('evitals-mic-circle');
        const micLabel = document.getElementById('evitals-mic-label');

        const speakerBtn = document.getElementById('evitals-speaker-btn');
        const speakerIcon = document.getElementById('evitals-speaker-icon');
        const speakerLabel = document.getElementById('evitals-speaker-label');

        // ─── Toggle Panel Open/Close ────────────────────────────────────────
        function toggleWidget() {
            isOpen = !isOpen;
            if (isOpen) {
                chatbotPanel.classList.remove('evitals-closed');
                chatbotPanel.classList.add('evitals-open');
                chatIcon.classList.add('hidden');
                closeIcon.classList.remove('hidden');
                fabBtn.classList.remove('evitals-pulse');
                inputEl.focus();
            } else {
                chatbotPanel.classList.remove('evitals-open');
                chatbotPanel.classList.add('evitals-closed');
                chatIcon.classList.remove('hidden');
                closeIcon.classList.add('hidden');
                fabBtn.classList.add('evitals-pulse');
            }
        }
        fabBtn.addEventListener('click', toggleWidget);
        closeHeaderBtn.addEventListener('click', toggleWidget);

        function addMessage(sender, text, isUser = false) {
            const div = document.createElement('div');
            if (isUser) {
                div.className = 'text-right';
                div.innerHTML = `<div class="inline-block bg-[#0077b6] text-white px-3.5 py-2 rounded-2xl rounded-br-sm shadow-sm max-w-[85%] text-left">
                    <span class="text-[10px] opacity-75 block font-semibold mb-0.5">${escapeHtml(sender)}</span>
                    ${escapeHtml(text)}
                </div>`;
            } else {
                div.className = 'text-left';
                div.innerHTML = `<div class="inline-block bg-white text-[#0c1326] border border-[#d9e5ee] px-3.5 py-2 rounded-2xl rounded-bl-sm shadow-sm max-w-[85%]">
                    <span class="text-[10px] text-[#0077b6] block font-bold mb-0.5">${escapeHtml(sender)}</span>
                    ${escapeHtml(text)}
                </div>`;
            }
            chatLog.appendChild(div);
            chatLog.scrollTop = chatLog.scrollHeight;
        }

        function escapeHtml(str) {
            return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));
        }

        function setSpeaking(isSpeaking) {
            if (isSpeaking) {
                speakingEl.classList.remove('hidden');
                speakingEl.classList.add('flex');
            } else {
                speakingEl.classList.add('hidden');
                speakingEl.classList.remove('flex');
            }
        }

        function unmuteAll() {
            unmuteEl.classList.add('hidden');
            const audios = document.querySelectorAll('#evitals-widget-root audio, #evitals-widget-root video');
            audios.forEach(a => { a.muted = !speakerEnabled; a.play().catch(() => {}); });
        }
        unmuteEl.addEventListener('click', unmuteAll);
        screenBox.addEventListener('click', unmuteAll);

        async function speakViaAvatar(text) {
            if (!room || room.state !== 'connected') return;
            try {
                const eventPayload = {
                    event_id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('evt_' + Date.now()),
                    event_type: 'avatar.speak_text',
                    text: text
                };
                const encoder = new TextEncoder();
                await room.localParticipant.publishData(encoder.encode(JSON.stringify(eventPayload)), {
                    reliable: true,
                    topic: 'agent-control'
                });
                setSpeaking(true);
            } catch (err) {
                console.error('Avatar speak error:', err);
            }
        }

        // ─── Start Session (Female Avatar) ──────────────────────────────────
        startBtn.addEventListener('click', async () => {
            startBtn.disabled = true;
            startBtn.textContent = 'Connecting…';
            statusEl.classList.remove('hidden');
            statusEl.textContent = 'Initializing…';

            try {
                const tokRes = await fetch(`${BACKEND_URL}/api/start-live-session`, { method: 'POST' });
                const tokData = await tokRes.json();
                if (!tokData.data?.session_token) throw new Error(tokData.error || 'Token error');

                sessionId = tokData.data.session_id;

                const roomRes = await fetch(`${BACKEND_URL}/api/start-session-room`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: tokData.data.session_token })
                });
                const roomData = await roomRes.json();
                if (!roomData.data?.livekit_url) throw new Error(roomData.error || 'Room error');

                const LK = window.LivekitClient;
                room = new LK.Room({ adaptiveStream: true, dynacast: true });

                room.on(LK.RoomEvent.TrackSubscribed, (track) => {
                    if (track.kind === 'video') {
                        const v = track.attach();
                        v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover';
                        v.playsInline = true; v.autoplay = true;
                        videoContainer.innerHTML = '';
                        videoContainer.appendChild(v);
                        videoContainer.classList.remove('hidden');
                        placeholder.classList.add('hidden');
                    }
                    if (track.kind === 'audio') {
                        audioHolder.innerHTML = '';
                        const a = track.attach();
                        a.autoplay = true; a.playsInline = true;
                        a.muted = !speakerEnabled;
                        audioHolder.appendChild(a);
                        a.play().catch(() => unmuteEl.classList.remove('hidden'));
                    }
                });

                room.on(LK.RoomEvent.TrackUnsubscribed, track => track.detach());

                room.on(LK.RoomEvent.DataReceived, (payload) => {
                    try {
                        const ev = JSON.parse(new TextDecoder().decode(payload));
                        const type = ev.event_type || ev.type;
                        if (type === 'avatar.speak_started') setSpeaking(true);
                        if (type === 'avatar.speak_ended') setSpeaking(false);
                        if (type === 'user.transcription' && (ev.text || ev.payload?.text)) {
                            addMessage('You (Voice)', ev.text || ev.payload.text, true);
                        }
                    } catch (e) {}
                });

                room.on(LK.RoomEvent.Disconnected, resetUI);

                await room.connect(roomData.data.livekit_url, roomData.data.livekit_client_token);

                startBtn.textContent = '🟢 Connected';
                startBtn.classList.remove('evitals-pulse', 'bg-white/20', 'hover:bg-white/30');
                startBtn.classList.add('bg-[#a9d8ef]/30', 'text-white');
                stopBtn.classList.remove('hidden');
                statusEl.textContent = 'Avatar Ready';
                addMessage('e-Vitals', 'Female avatar connected! Ask any question to hear her speak.', false);
                unmuteAll();
            } catch (err) {
                console.error(err);
                addMessage('System', 'Connection error: ' + err.message, false);
                startBtn.disabled = false;
                startBtn.textContent = '▶ Start Avatar';
                statusEl.classList.add('hidden');
            }
        });

        // ─── Send Message ───────────────────────────────────────────────────
        async function handleSend() {
            const text = inputEl.value.trim();
            if (!text) return;
            inputEl.value = '';
            addMessage('You', text, true);

            try {
                const res = await fetch(`${BACKEND_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });
                const data = await res.json();
                const reply = data.reply || data.fallback || "e-Vitals provides Remote Patient Monitoring solutions for clinics.";
                addMessage('e-Vitals', reply, false);
                await speakViaAvatar(reply);
            } catch (err) {
                console.error(err);
                addMessage('System', 'Error fetching AI response.', false);
            }
        }

        sendBtn.addEventListener('click', handleSend);
        inputEl.addEventListener('keypress', e => { if (e.key === 'Enter') handleSend(); });

        // ─── Mic Toggle ─────────────────────────────────────────────────────
        micBtn.addEventListener('click', async () => {
            if (!room || room.state !== 'connected') {
                addMessage('System', 'Click "Start Avatar" first.', false);
                return;
            }
            micEnabled = !micEnabled;
            try {
                await room.localParticipant.setMicrophoneEnabled(micEnabled);
                micIcon.textContent = micEnabled ? '🎙️' : '🎙️✕';
                micIcon.className = micEnabled ? 'text-[#0077b6] text-sm' : 'text-[#c8102e] text-sm';
                micCircle.className = micEnabled ? 'w-10 h-10 rounded-full bg-[#e1f0f9] border border-[#0077b6] flex items-center justify-center transition' : 'w-10 h-10 rounded-full bg-[#f1f7fc] border border-[#d9e5ee] flex items-center justify-center transition shadow-sm';
                micLabel.textContent = micEnabled ? 'Mic On' : 'Mic Off';
            } catch (e) {
                console.error(e);
                addMessage('System', 'Mic permission denied.', false);
                micEnabled = false;
            }
        });

        // ─── Speaker Toggle ─────────────────────────────────────────────────
        speakerBtn.addEventListener('click', () => {
            speakerEnabled = !speakerEnabled;
            const audios = document.querySelectorAll('#evitals-widget-root audio, #evitals-widget-root video');
            audios.forEach(a => a.muted = !speakerEnabled);

            speakerIcon.textContent = speakerEnabled ? '🔊' : '🔇';
            speakerIcon.className = speakerEnabled ? 'text-[#0077b6] text-sm' : 'text-[#c8102e] text-sm';
            speakerLabel.textContent = speakerEnabled ? 'Speaker' : 'Muted';
            if (!speakerEnabled) setSpeaking(false);
        });

        // ─── Stop Session ───────────────────────────────────────────────────
        stopBtn.addEventListener('click', async () => {
            if (room) { room.disconnect(); room = null; }
            if (sessionId) {
                fetch(`${BACKEND_URL}/api/stop-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId })
                }).catch(() => {});
                sessionId = null;
            }
            resetUI();
            addMessage('System', 'Avatar session ended.', false);
        });

        function resetUI() {
            startBtn.disabled = false;
            startBtn.textContent = '▶ Start Avatar';
            startBtn.classList.remove('bg-[#a9d8ef]/30', 'text-white');
            startBtn.classList.add('bg-white/20', 'hover:bg-white/30', 'evitals-pulse');
            stopBtn.classList.add('hidden');
            statusEl.classList.add('hidden');
            speakingEl.classList.add('hidden');
            unmuteEl.classList.add('hidden');
            videoContainer.classList.add('hidden');
            videoContainer.innerHTML = '';
            audioHolder.innerHTML = '';
            placeholder.classList.remove('hidden');
            micEnabled = false;
            micIcon.textContent = '🎙️✕';
            micIcon.className = 'text-[#c8102e] text-sm';
            micCircle.className = 'w-10 h-10 rounded-full bg-[#f1f7fc] border border-[#d9e5ee] flex items-center justify-center transition shadow-sm';
            micLabel.textContent = 'Mic';
            setSpeaking(false);
        }
    }
})();
