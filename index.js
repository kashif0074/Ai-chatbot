const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const { Groq } = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (index.html, widget.js, etc.)
app.use(express.static(path.join(__dirname)));

// ─── 1. Groq Client Setup (Multi-Key with Automatic Failover) ──────────────
const groqKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
].filter(Boolean);

if (groqKeys.length === 0) {
    console.error("❌ ERROR: No Groq API keys found in environment variables!");
    process.exit(1);
}

const groqClients = groqKeys.map(key => new Groq({ apiKey: key }));

const EVITALS_SYSTEM_PROMPT = `
You are an expert, friendly female AI healthcare assistant for e-Vitals RPM (evitalsrpm.com).
Your mission is to help doctors, clinics, and healthcare providers understand Remote Patient Monitoring (RPM), connected cellular devices (BP monitors, glucometers, pulse oximeters, weight scales), and Medicare billing CPT codes (99453, 99454, 99457, 99458).
CRITICAL RULES FOR AVATAR SPEECH:
- Answer in 2 short, clear conversational sentences.
- Speak directly, warmly, and professionally like a healthcare specialist.
- NEVER use asterisks (*), markdown formatting, emojis, or bullet points, because the live avatar will speak this aloud to the user.
- Encourage providers to book a meeting or request a demo at evitalsrpm.com.
`;

const CANDIDATE_MODELS = [
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b'
];

// Helper to generate completion trying all keys and candidate models
async function generateGroqReply(userMessage) {
    let lastError = null;
    for (let k = 0; k < groqClients.length; k++) {
        const client = groqClients[k];
        for (const model of CANDIDATE_MODELS) {
            try {
                const completion = await client.chat.completions.create({
                    messages: [
                        { role: "system", content: EVITALS_SYSTEM_PROMPT },
                        { role: "user", content: userMessage }
                    ],
                    model: model,
                    max_tokens: 180,
                    temperature: 0.7
                });
                const reply = completion.choices[0]?.message?.content?.trim();
                if (reply) {
                    return reply;
                }
            } catch (err) {
                lastError = err;
            }
        }
    }
    throw lastError || new Error("All Groq keys and models failed.");
}

// ─── 2. Chat Endpoint (Groq AI) ────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    try {
        const message = req.body?.message?.trim();
        if (!message) {
            return res.status(400).json({ error: "Message is required." });
        }

        const reply = await generateGroqReply(message);
        res.json({ reply });
    } catch (error) {
        console.error("Groq API Error:", error.message);
        res.status(500).json({
            error: "Failed to process chat with Groq",
            fallback: "e-Vitals provides cellular-connected Remote Patient Monitoring devices and automated Medicare billing solutions for clinics. Request a demo today at evitalsrpm.com."
        });
    }
});

// ─── 3. LiveAvatar — Create Session Token (Female Avatar) ───────────────────
app.post('/api/start-live-session', async (req, res) => {
    try {
        const isSandbox = process.env.LIVEAVATAR_IS_SANDBOX !== 'false';

        // Original female avatar: Ann Therapist
        const annAvatarId = process.env.LIVEAVATAR_AVATAR_ID || '513fd1b7-7ef9-466d-9af2-344e51eeb833';
        const annVoiceAgentId = process.env.LIVEAVATAR_VOICE_AGENT_ID || 'ef507a02-6b39-40b5-9ad2-af6a810a1bf3';

        // Sandbox female avatar: June HR (female with lifelike female voice)
        const juneAvatarId = process.env.LIVEAVATAR_SANDBOX_AVATAR_ID || '65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0';
        const juneVoiceAgentId = process.env.LIVEAVATAR_SANDBOX_VOICE_AGENT_ID || '92fa2416-64ec-48b8-84e2-04e2987e3215';

        const avatarId = isSandbox ? juneAvatarId : annAvatarId;
        const voiceAgentId = isSandbox ? juneVoiceAgentId : annVoiceAgentId;

        const payload = {
            mode: 'FULL',
            avatar_id: avatarId,
            is_sandbox: isSandbox,
            voice_agent: { id: voiceAgentId }
        };

        try {
            const tokenRes = await axios.post(
                'https://api.liveavatar.com/v1/sessions/token',
                payload,
                {
                    headers: {
                        'X-API-KEY': process.env.LIVEAVATAR_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return res.json({
                ...tokenRes.data,
                avatar_id: avatarId,
                is_sandbox: isSandbox
            });
        } catch (apiErr) {
            // If Ann is not available in sandbox, fallback to female sandbox avatar June
            if (isSandbox && avatarId !== juneAvatarId) {
                payload.avatar_id = juneAvatarId;
                payload.voice_agent = { id: juneVoiceAgentId };
                const retryRes = await axios.post(
                    'https://api.liveavatar.com/v1/sessions/token',
                    payload,
                    {
                        headers: {
                            'X-API-KEY': process.env.LIVEAVATAR_API_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                return res.json({
                    ...retryRes.data,
                    avatar_id: juneAvatarId,
                    is_sandbox: true
                });
            }
            throw apiErr;
        }
    } catch (error) {
        console.error('LiveAvatar Token Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.message || 'Failed to create LiveAvatar session token' });
    }
});

// ─── 4. LiveAvatar — Start Session (get LiveKit credentials) ────────────────
app.post('/api/start-session-room', async (req, res) => {
    try {
        const { sessionToken } = req.body;

        const startRes = await axios.post(
            'https://api.liveavatar.com/v1/sessions/start',
            {},
            {
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Accept': 'application/json'
                }
            }
        );

        res.json(startRes.data);
    } catch (error) {
        console.error('LiveAvatar Start Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to start LiveAvatar session' });
    }
});

// ─── 5. LiveAvatar — Stop Session ───────────────────────────────────────────
app.post('/api/stop-session', async (req, res) => {
    try {
        const { sessionId } = req.body;

        const stopRes = await axios.post(
            'https://api.liveavatar.com/v1/sessions/stop',
            { session_id: sessionId, reason: 'USER_CLOSED' },
            {
                headers: {
                    'X-API-KEY': process.env.LIVEAVATAR_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(stopRes.data);
    } catch (error) {
        console.error('LiveAvatar Stop Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to stop session' });
    }
});

// ─── Start Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 e-Vitals backend running on http://localhost:${PORT}`);
    console.log(`🔑 Loaded ${groqClients.length} Groq API key(s) with auto-failover`);
    console.log(`👩 Female Avatar configured: LiveAvatar key ${process.env.LIVEAVATAR_API_KEY ? '✅ loaded' : '❌ missing'}`);
});
