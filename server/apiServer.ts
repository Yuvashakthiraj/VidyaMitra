/**
 * VidyaMitra API Server - Vite Plugin
 * All API keys stay server-side. Frontend calls /api/* endpoints.
 * Rate limiting enforced for free-tier APIs.
 */

import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { loadEnv } from 'vite';
import { getDb, hashPassword, verifyPassword, generateId } from './db';

// ==================== TYPES ====================
interface ApiKeys {
    GEMINI_API_KEY: string;
    GEMINI_IMAGE_API_KEY: string;
    YOUTUBE_API_KEY: string;
    PEXELS_API_KEY: string;
    NEWS_API_KEY: string;
    EXCHANGE_RATE_API_KEY: string;
    OPENAI_API_KEY: string;
    JUDGE0_API_KEY: string;
    JUDGE0_API_HOST: string;
    JUDGE0_BASE_URL: string;
    GROQ_API_KEY: string;
}

// ==================== RATE LIMITING ====================
interface RateBucket {
    timestamps: number[];
    maxPerMinute: number;
    maxPerDay: number;
    dayStart: number;
    dayCount: number;
}

const rateBuckets: Record<string, RateBucket> = {};

function getRateBucket(name: string, maxPerMinute: number, maxPerDay: number): RateBucket {
    if (!rateBuckets[name]) {
        rateBuckets[name] = {
            timestamps: [],
            maxPerMinute,
            maxPerDay,
            dayStart: new Date().setHours(0, 0, 0, 0),
            dayCount: 0,
        };
    }
    return rateBuckets[name];
}

function checkAndRecordRate(bucketName: string, maxPerMinute: number, maxPerDay: number): { ok: boolean; error?: string } {
    const bucket = getRateBucket(bucketName, maxPerMinute, maxPerDay);
    const now = Date.now();

    // Reset daily if new day
    const todayStart = new Date().setHours(0, 0, 0, 0);
    if (todayStart !== bucket.dayStart) {
        bucket.dayCount = 0;
        bucket.dayStart = todayStart;
    }

    // Clean minute window
    bucket.timestamps = bucket.timestamps.filter(t => t > now - 60000);

    if (bucket.timestamps.length >= bucket.maxPerMinute) {
        return { ok: false, error: `Rate limit: max ${bucket.maxPerMinute} requests/min for ${bucketName}. Wait a moment.` };
    }
    if (bucket.dayCount >= bucket.maxPerDay) {
        return { ok: false, error: `Daily limit reached for ${bucketName} (${bucket.maxPerDay}/day).` };
    }

    bucket.timestamps.push(now);
    bucket.dayCount++;
    return { ok: true };
}

// Gemini rate limiter: 10 RPM for free tier safety
async function geminiRateWait() {
    const bucket = getRateBucket('gemini', 10, 1400);
    const now = Date.now();
    bucket.timestamps = bucket.timestamps.filter(t => t > now - 60000);
    if (bucket.timestamps.length >= 10) {
        const oldest = bucket.timestamps[0];
        const waitMs = oldest + 60000 - now + 500;
        console.log(`⏳ Gemini rate limit: waiting ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
    }
}

// ==================== HELPERS ====================
function parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
            if (body.length > 2 * 1024 * 1024) reject(new Error('Body too large'));
        });
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

function sendJson(res: ServerResponse, status: number, data: any) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
}

function getUrlPath(req: IncomingMessage): string {
    return (req.url || '').split('?')[0];
}

function getQueryParams(req: IncomingMessage): URLSearchParams {
    const url = req.url || '';
    const qIndex = url.indexOf('?');
    return new URLSearchParams(qIndex >= 0 ? url.slice(qIndex + 1) : '');
}

// Simple JWT-like token (session token stored in memory for simplicity)
const sessions: Map<string, { userId: string; email: string; isAdmin: boolean; name: string }> = new Map();

function createSession(userId: string, email: string, isAdmin: boolean, name: string): string {
    const token = generateId() + '-' + generateId();
    sessions.set(token, { userId, email, isAdmin, name });
    return token;
}

function getSession(req: IncomingMessage) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    return sessions.get(token) || null;
}

// ==================== EXTERNAL API CALLS ====================

async function callGemini(apiKey: string, prompt: string, options: { temperature?: number; maxTokens?: number } = {}): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
        await geminiRateWait();
        const rate = checkAndRecordRate('gemini', 10, 1400);
        if (!rate.ok) return { success: false, error: rate.error };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: options.temperature ?? 0.7,
                        maxOutputTokens: options.maxTokens ?? 2048,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', response.status, errText);
            if (response.status === 429) return { success: false, error: 'Gemini rate limit exceeded. Please wait.' };
            return { success: false, error: `Gemini API error: ${response.status}` };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return { success: false, error: 'Empty response from Gemini' };
        return { success: true, text };
    } catch (err: any) {
        return { success: false, error: err.message || 'Gemini call failed' };
    }
}

async function callGeminiImage(apiKey: string, prompt: string): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
    try {
        await geminiRateWait();
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini Image API error:', response.status, errText);
            return { success: false, error: `Gemini API error: ${response.status}` };
        }

        const data = await response.json();
        // The API might return text or image inlineData. If it returns an image, it's typically in parts[0].inlineData.data
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: any) => p.inlineData);
        if (imagePart && imagePart.inlineData.data) {
            return { success: true, imageBase64: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` };
        }

        // Some models drop text response containing image markdown
        const textPart = parts.find((p: any) => p.text);
        if (textPart) {
            console.warn('Gemini 2.5 Flash Image returned text instead of image blob', textPart.text);
            return { success: false, error: 'Model returned text instead of image' };
        }

        return { success: false, error: 'No image found in response' };
    } catch (err: any) {
        return { success: false, error: err.message || 'Gemini Image call failed' };
    }
}

// ==================== GROQ API (Mermaid Roadmap) ====================
async function callGroq(apiKey: string, prompt: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
        const rate = checkAndRecordRate('groq', 5, 60);
        if (!rate.ok) return { success: false, error: rate.error };

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a career roadmap expert. Generate ONLY valid Mermaid.js flowchart code with subgraph groupings. No explanations, no markdown backticks, just the raw Mermaid code starting with graph TD. Use subgraph blocks for phases. Never use colons in labels.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.1,
                max_tokens: 4096,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Groq API error:', response.status, errText);
            return { success: false, error: `Groq API error: ${response.status}` };
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content?.trim() || '';

        // Clean up: strip markdown code fences if present
        content = content.replace(/```mermaid\s*/gi, '').replace(/```\s*/g, '').trim();
        // Ensure it starts with graph TD
        const graphIdx = content.indexOf('graph TD');
        if (graphIdx > 0) content = content.substring(graphIdx);
        if (!content.startsWith('graph TD')) {
            return { success: false, error: 'Invalid Mermaid code generated' };
        }

        // Sanitize: remove colons inside square-bracket labels (common LLM mistake)
        content = content.replace(/\[([^\]]*):([^\]]*)\]/g, (_, a, b) => `[${a} - ${b}]`);

        return { success: true, content };
    } catch (err: any) {
        console.error('Groq call failed:', err);
        return { success: false, error: err.message || 'Groq call failed' };
    }
}

async function fetchYouTubeVideos(apiKey: string, query: string, maxResults = 3): Promise<any[]> {
    try {
        const rate = checkAndRecordRate('youtube', 5, 90);
        if (!rate.ok) {
            console.warn('YouTube rate limit:', rate.error);
            return getFallbackYouTubeVideos(query);
        }

        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error('YouTube API error:', res.status);
            return getFallbackYouTubeVideos(query);
        }
        const data = await res.json();
        return (data.items || []).map((item: any) => ({
            id: item.id?.videoId,
            title: item.snippet?.title,
            description: item.snippet?.description,
            thumbnail: item.snippet?.thumbnails?.medium?.url,
            channelTitle: item.snippet?.channelTitle,
            url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        }));
    } catch (err) {
        console.error('YouTube fetch error:', err);
        return getFallbackYouTubeVideos(query);
    }
}

function getFallbackYouTubeVideos(query: string): any[] {
    return [
        { id: 'fallback1', title: `Learn ${query} - Full Course`, description: `Complete tutorial on ${query}`, thumbnail: '', channelTitle: 'VidyaMitra', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' tutorial')}` },
        { id: 'fallback2', title: `${query} for Beginners`, description: `Beginner guide to ${query}`, thumbnail: '', channelTitle: 'VidyaMitra', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' beginners')}` },
    ];
}

async function fetchPexelsImages(apiKey: string, query: string, perPage = 3): Promise<any[]> {
    try {
        const rate = checkAndRecordRate('pexels', 5, 180);
        if (!rate.ok) return getFallbackPexelsImages(query);

        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
        const res = await fetch(url, { headers: { Authorization: apiKey } });
        if (!res.ok) return getFallbackPexelsImages(query);
        const data = await res.json();
        return (data.photos || []).map((photo: any) => ({
            id: photo.id,
            url: photo.src?.medium || photo.src?.original,
            alt: photo.alt || query,
            photographer: photo.photographer,
        }));
    } catch {
        return getFallbackPexelsImages(query);
    }
}

function getFallbackPexelsImages(query: string): any[] {
    return [
        { id: 'fb1', url: `https://via.placeholder.com/400x300?text=${encodeURIComponent(query)}`, alt: query, photographer: 'VidyaMitra' },
    ];
}

async function fetchNews(apiKey: string, query: string): Promise<any[]> {
    try {
        const rate = checkAndRecordRate('news', 3, 90);
        if (!rate.ok) return getFallbackNews(query);

        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&sortBy=publishedAt&language=en&apiKey=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return getFallbackNews(query);
        const data = await res.json();
        return (data.articles || []).slice(0, 5).map((a: any) => ({
            title: a.title,
            description: a.description,
            url: a.url,
            source: a.source?.name,
            publishedAt: a.publishedAt,
            image: a.urlToImage,
        }));
    } catch {
        return getFallbackNews(query);
    }
}

function getFallbackNews(query: string): any[] {
    return [
        { title: `Latest trends in ${query}`, description: `Stay updated with ${query} industry news`, url: `https://news.google.com/search?q=${encodeURIComponent(query)}`, source: 'Google News', publishedAt: new Date().toISOString(), image: null },
    ];
}

async function fetchExchangeRate(apiKey: string): Promise<any> {
    try {
        const rate = checkAndRecordRate('exchange', 2, 50);
        if (!rate.ok) return getFallbackExchangeRates();

        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
        const res = await fetch(url);
        if (!res.ok) return getFallbackExchangeRates();
        const data = await res.json();
        return {
            base: data.base_code || 'USD',
            rates: {
                INR: data.conversion_rates?.INR || 83.5,
                EUR: data.conversion_rates?.EUR || 0.92,
                GBP: data.conversion_rates?.GBP || 0.79,
                JPY: data.conversion_rates?.JPY || 149.5,
            },
            lastUpdated: data.time_last_update_utc || new Date().toISOString(),
        };
    } catch {
        return getFallbackExchangeRates();
    }
}

function getFallbackExchangeRates() {
    return { base: 'USD', rates: { INR: 83.5, EUR: 0.92, GBP: 0.79, JPY: 149.5 }, lastUpdated: new Date().toISOString() };
}

// ==================== VITE PLUGIN ====================
export function vidyaMitraApiPlugin(): Plugin {
    let keys: ApiKeys = {} as ApiKeys;

    return {
        name: 'vidyamitra-api',

        configResolved(config) {
            const env = loadEnv(config.mode, config.root, '');
            keys = {
                GEMINI_API_KEY: env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '',
                GEMINI_IMAGE_API_KEY: env.GEMINI_IMAGE_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '',
                YOUTUBE_API_KEY: env.YOUTUBE_API_KEY || '',
                PEXELS_API_KEY: env.PEXELS_API_KEY || '',
                NEWS_API_KEY: env.NEWS_API_KEY || '',
                EXCHANGE_RATE_API_KEY: env.EXCHANGE_RATE_API_KEY || '',
                OPENAI_API_KEY: env.OPENAI_API_KEY || '',
                JUDGE0_API_KEY: env.VITE_JUDGE0_API_KEY || '',
                JUDGE0_API_HOST: env.VITE_JUDGE0_API_HOST || 'judge029.p.rapidapi.com',
                JUDGE0_BASE_URL: env.VITE_JUDGE0_BASE_URL || 'https://judge029.p.rapidapi.com',
                GROQ_API_KEY: env.GROQ_API_KEY || '',
            };

            // Initialize DB
            getDb();

            console.log('✅ VidyaMitra API server initialized');
            console.log('  Gemini:', keys.GEMINI_API_KEY ? '✅' : '❌');
            console.log('  YouTube:', keys.YOUTUBE_API_KEY ? '✅' : '❌');
            console.log('  Pexels:', keys.PEXELS_API_KEY ? '✅' : '❌');
            console.log('  News:', keys.NEWS_API_KEY ? '✅' : '❌');
            console.log('  Exchange:', keys.EXCHANGE_RATE_API_KEY ? '✅' : '❌');
            console.log('  Groq:', keys.GROQ_API_KEY ? '✅' : '❌');
        },

        configureServer(server: ViteDevServer) {
            // CORS preflight
            server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
                if (req.url?.startsWith('/api/') && req.method === 'OPTIONS') {
                    res.writeHead(204, {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    });
                    res.end();
                    return;
                }
                next();
            });

            // ==================== AUTH ROUTES ====================
            server.middlewares.use('/api/auth/login', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                try {
                    const { email, password } = await parseBody(req);
                    if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });

                    const db = getDb();
                    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
                    if (!user) return sendJson(res, 401, { error: 'Invalid email or password' });

                    if (!verifyPassword(password, user.password_hash)) {
                        return sendJson(res, 401, { error: 'Invalid email or password' });
                    }

                    const token = createSession(user.id, user.email, !!user.is_admin, user.name || '');
                    sendJson(res, 200, {
                        token,
                        user: { id: user.id, email: user.email, name: user.name, isAdmin: !!user.is_admin },
                    });
                } catch (err: any) {
                    sendJson(res, 500, { error: err.message });
                }
            });

            server.middlewares.use('/api/auth/signup', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                try {
                    const { email, password, name } = await parseBody(req);
                    if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });
                    if (email === 'admin@vidyamitra.com') return sendJson(res, 403, { error: 'Email reserved for admin' });

                    const db = getDb();
                    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
                    if (existing) return sendJson(res, 409, { error: 'Email already in use' });

                    const id = generateId();
                    const passwordHash = hashPassword(password);
                    const displayName = name || email.split('@')[0];

                    db.prepare('INSERT INTO users (id, email, password_hash, name, is_admin) VALUES (?, ?, ?, ?, 0)')
                        .run(id, email, passwordHash, displayName);

                    const token = createSession(id, email, false, displayName);
                    sendJson(res, 201, {
                        token,
                        user: { id, email, name: displayName, isAdmin: false },
                    });
                } catch (err: any) {
                    sendJson(res, 500, { error: err.message });
                }
            });

            server.middlewares.use('/api/auth/me', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                sendJson(res, 200, { user: { id: session.userId, email: session.email, name: session.name, isAdmin: session.isAdmin } });
            });

            server.middlewares.use('/api/auth/logout', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                const authHeader = req.headers.authorization || '';
                const token = authHeader.replace('Bearer ', '');
                sessions.delete(token);
                sendJson(res, 200, { success: true });
            });

            // ==================== GEMINI PROXY ====================
            server.middlewares.use('/api/gemini/generate', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                try {
                    const { prompt, temperature, maxTokens } = await parseBody(req);
                    if (!prompt) return sendJson(res, 400, { error: 'prompt is required' });
                    if (!keys.GEMINI_API_KEY) return sendJson(res, 503, { error: 'Gemini API key not configured' });

                    const result = await callGemini(keys.GEMINI_API_KEY, prompt, { temperature, maxTokens });
                    if (result.success) {
                        sendJson(res, 200, { success: true, text: result.text });
                    } else {
                        sendJson(res, 500, { success: false, error: result.error });
                    }
                } catch (err: any) {
                    sendJson(res, 500, { error: err.message });
                }
            });

            // ==================== YOUTUBE PROXY ====================
            server.middlewares.use('/api/youtube/search', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const params = getQueryParams(req);
                const query = params.get('q') || '';
                const maxResults = parseInt(params.get('maxResults') || '3');
                if (!query) return sendJson(res, 400, { error: 'q parameter required' });
                const videos = await fetchYouTubeVideos(keys.YOUTUBE_API_KEY, query, maxResults);
                sendJson(res, 200, { videos });
            });

            // ==================== PEXELS PROXY ====================
            server.middlewares.use('/api/pexels/search', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const params = getQueryParams(req);
                const query = params.get('q') || '';
                if (!query) return sendJson(res, 400, { error: 'q parameter required' });
                const images = await fetchPexelsImages(keys.PEXELS_API_KEY, query);
                sendJson(res, 200, { images });
            });

            // ==================== NEWS PROXY ====================
            server.middlewares.use('/api/news/search', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const params = getQueryParams(req);
                const query = params.get('q') || 'technology jobs';
                const articles = await fetchNews(keys.NEWS_API_KEY, query);
                sendJson(res, 200, { articles });
            });

            // ==================== EXCHANGE RATE PROXY ====================
            server.middlewares.use('/api/exchange-rates', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const rates = await fetchExchangeRate(keys.EXCHANGE_RATE_API_KEY);
                sendJson(res, 200, rates);
            });

            // ==================== DB CRUD: INTERVIEWS ====================
            server.middlewares.use('/api/interviews', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                const path = getUrlPath(req);

                if (req.method === 'GET' && (path === '/' || path === '')) {
                    if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                    const params = getQueryParams(req);
                    const allParam = params.get('all');
                    const db = getDb();

                    if (allParam === 'true' && session.isAdmin) {
                        const interviews = db.prepare('SELECT * FROM interviews ORDER BY created_at DESC').all();
                        return sendJson(res, 200, { interviews });
                    }
                    const interviews = db.prepare('SELECT * FROM interviews WHERE user_id = ? ORDER BY created_at DESC').all(session.userId);
                    return sendJson(res, 200, { interviews });
                }

                if (req.method === 'POST' && (path === '/' || path === '')) {
                    if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                    try {
                        const body = await parseBody(req);
                        const id = body.id || generateId();
                        const db = getDb();
                        db.prepare(`INSERT OR REPLACE INTO interviews (id, user_id, role_id, role_name, questions, answers, completed, score, feedback, outcome, is_practice, aborted, abort_reason, ai_detection_count, start_time, end_time)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, body.roleId || '', body.roleName || '', JSON.stringify(body.questions || []), JSON.stringify(body.answers || []),
                                body.completed ? 1 : 0, body.score || null, body.feedback || '', body.outcome || '',
                                body.isPracticeMode ? 1 : 0, body.aborted ? 1 : 0, body.abortReason || '', body.aiDetectionCount || 0,
                                body.startTime || new Date().toISOString(), body.endTime || null);
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'DELETE') {
                    if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                    const idMatch = path.match(/^\/(.+)/);
                    if (idMatch) {
                        const db = getDb();
                        db.prepare('DELETE FROM interviews WHERE id = ?').run(idMatch[1]);
                        return sendJson(res, 200, { success: true });
                    }
                }

                next();
            });

            // ==================== DB CRUD: PRACTICE APTITUDE ====================
            server.middlewares.use('/api/practice-aptitude', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const db = getDb();
                    const results = db.prepare('SELECT * FROM practice_aptitude WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(session.userId);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        const db = getDb();
                        db.prepare(`INSERT INTO practice_aptitude (id, user_id, score, total_questions, correct_answers, category_performance, weak_topics, recommendations, completed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, body.score, body.totalQuestions, body.correctAnswers,
                                JSON.stringify(body.categoryPerformance || {}), JSON.stringify(body.weakTopics || []),
                                JSON.stringify(body.recommendations || []), body.completedAt || new Date().toISOString());
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // ==================== DB CRUD: PRACTICE INTERVIEWS ====================
            server.middlewares.use('/api/practice-interviews', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const db = getDb();
                    const results = db.prepare('SELECT * FROM practice_interviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(session.userId);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        const db = getDb();
                        db.prepare(`INSERT INTO practice_interviews (id, user_id, role_id, role_name, questions, overall_score, average_question_score, strengths, improvements, recommendations, completed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, body.roleId || '', body.roleName || '', JSON.stringify(body.questions || []),
                                body.overallScore || 0, body.averageQuestionScore || 0, JSON.stringify(body.strengths || []),
                                JSON.stringify(body.improvements || []), JSON.stringify(body.recommendations || []),
                                body.completedAt || new Date().toISOString());
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // ==================== DB CRUD: BOT INTERVIEWS ====================
            server.middlewares.use('/api/bot-interviews', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const db = getDb();
                    const results = db.prepare('SELECT * FROM bot_interviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(session.userId);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        const db = getDb();
                        db.prepare(`INSERT INTO bot_interviews (id, user_id, candidate_name, role, conversation_log, feedback, completed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, body.candidateName || '', body.role || '',
                                JSON.stringify(body.conversationLog || []), JSON.stringify(body.feedback || {}),
                                body.completedAt || new Date().toISOString());
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // ==================== DB CRUD: PRACTICE CODING ====================
            server.middlewares.use('/api/practice-coding', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const db = getDb();
                    const results = db.prepare('SELECT * FROM practice_coding WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(session.userId);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = body.id || generateId();
                        const db = getDb();
                        db.prepare(`INSERT OR REPLACE INTO practice_coding (id, user_id, session_data, date, start_time, end_time)
              VALUES (?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, JSON.stringify(body), body.date || new Date().toISOString(),
                                body.startTime || new Date().toISOString(), body.endTime || null);
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // ==================== DB CRUD: RESUMES ====================
            server.middlewares.use('/api/resumes', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const db = getDb();
                    const results = db.prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC').all(session.userId);
                    return sendJson(res, 200, { resumes: results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        const db = getDb();
                        db.prepare(`INSERT INTO resumes (id, user_id, file_name, raw_text, parsed_data, ats_score, ats_analysis, target_role)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, body.fileName || '', body.rawText || '',
                                JSON.stringify(body.parsedData || {}), body.atsScore || 0,
                                JSON.stringify(body.atsAnalysis || {}), body.targetRole || '');
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // ==================== DB CRUD: ROUND 1 APTITUDE ====================
            server.middlewares.use('/api/round1-aptitude', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const db = getDb();
                    const params = getQueryParams(req);
                    if (params.get('all') === 'true' && session.isAdmin) {
                        const results = db.prepare('SELECT * FROM round1_aptitude ORDER BY created_at DESC').all();
                        return sendJson(res, 200, { results });
                    }
                    const results = db.prepare('SELECT * FROM round1_aptitude WHERE user_id = ? ORDER BY created_at DESC').all(session.userId);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        const db = getDb();
                        db.prepare(`INSERT INTO round1_aptitude (id, user_id, user_email, user_name, role_id, role_name, score, total_questions, correct_answers, category_performance, completed_at, aborted, abort_reason)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, session.email, session.name, body.roleId || '', body.roleName || '',
                                body.score || 0, body.totalQuestions || 0, body.correctAnswers || 0,
                                JSON.stringify(body.categoryPerformance || {}), body.completedAt || new Date().toISOString(),
                                body.aborted ? 1 : 0, body.abortReason || '');
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'PUT') {
                    try {
                        const body = await parseBody(req);
                        const path = getUrlPath(req);
                        const idMatch = path.match(/^\/(.+)/);
                        if (idMatch && session.isAdmin) {
                            const db = getDb();
                            const updates: string[] = [];
                            const values: any[] = [];
                            if (body.selectedForRound2 !== undefined) { updates.push('selected_for_round2 = ?'); values.push(body.selectedForRound2 ? 1 : 0); }
                            if (body.round2EmailSent !== undefined) { updates.push('round2_email_sent = ?'); values.push(body.round2EmailSent ? 1 : 0); }
                            if (updates.length > 0) {
                                values.push(idMatch[1]);
                                db.prepare(`UPDATE round1_aptitude SET ${updates.join(', ')} WHERE id = ?`).run(...values);
                            }
                            return sendJson(res, 200, { success: true });
                        }
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // ==================== CAREER PLAN ====================
            server.middlewares.use('/api/career-plan', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'POST') {
                    try {
                        const { targetRole, skillGaps } = await parseBody(req);
                        if (!targetRole) return sendJson(res, 400, { error: 'targetRole required' });
                        if (!keys.GEMINI_API_KEY) return sendJson(res, 503, { error: 'Gemini not configured' });

                        // Generate training plan via Gemini
                        const prompt = `You are a career counselor and technical mentor. Create a detailed 8-week training plan for someone aiming to become a "${targetRole}".

Their skill gaps are: ${JSON.stringify(skillGaps || [])}.

Return valid JSON with this structure:
{
  "weeklyPlan": [
    { "week": 1, "title": "Week 1: ...", "topics": ["topic1", "topic2"], "goals": ["goal1"], "resources": ["resource1"] },
    ...8 total weeks
  ],
  "milestones": ["milestone1", "milestone2", "milestone3", "milestone4"],
  "estimatedCompletion": "8 weeks",
  "dailyHours": 2
}

Return ONLY valid JSON.`;

                        const result = await callGemini(keys.GEMINI_API_KEY, prompt, { temperature: 0.6, maxTokens: 2048 });
                        let trainingPlan = {};
                        if (result.success && result.text) {
                            try {
                                let clean = result.text.replace(/```json\n?|\n?```/g, '').trim();
                                const match = clean.match(/\{[\s\S]*\}/);
                                if (match) clean = match[0];
                                trainingPlan = JSON.parse(clean);
                            } catch {
                                trainingPlan = { error: 'Failed to parse plan', raw: result.text?.substring(0, 500) };
                            }
                        }

                        // Fetch YouTube videos for top skills
                        const topSkills = (skillGaps || [targetRole]).slice(0, 3);
                        const allVideos: any[] = [];
                        for (const skill of topSkills) {
                            const videos = await fetchYouTubeVideos(keys.YOUTUBE_API_KEY, `${skill} tutorial for ${targetRole}`, 2);
                            allVideos.push({ skill, videos });
                        }

                        // Generate Image using gemini-2.5-flash-image
                        const imagePrompt = `A visually appealing, highly detailed info-graphic roadmap and flowchart for a learning journey to become a ${targetRole}. Make it modern and clean with milestone paths. Include text highlighting ${targetRole} roadmap.`;
                        const geminiImageResponse = await callGeminiImage(keys.GEMINI_IMAGE_API_KEY, imagePrompt);

                        // Fetch Pexels images fallback if needed, or simply append
                        const images = await fetchPexelsImages(keys.PEXELS_API_KEY, `${targetRole} career learning`);

                        // If the Gemini image generation succeeds, prepend it as the main image
                        if (geminiImageResponse.success && geminiImageResponse.imageBase64) {
                            images.unshift({
                                id: 'gemini-generated',
                                url: geminiImageResponse.imageBase64,
                                photographer: 'Generated by Gemini 2.5 Flash Image',
                                alt: `AI Generated Roadmap for ${targetRole}`,
                                isGemini: true
                            });
                        }

                        // Save plan
                        const id = generateId();
                        const db = getDb();
                        db.prepare(`INSERT INTO career_plans (id, user_id, target_role, skill_gaps, training_plan, youtube_videos, pexels_images)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
                            .run(id, session.userId, targetRole, JSON.stringify(skillGaps || []),
                                JSON.stringify(trainingPlan), JSON.stringify(allVideos), JSON.stringify(images));

                        sendJson(res, 200, { success: true, id, trainingPlan, videos: allVideos, images });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'GET') {
                    const db = getDb();
                    const plans = db.prepare('SELECT * FROM career_plans WHERE user_id = ? ORDER BY created_at DESC').all(session.userId);
                    return sendJson(res, 200, { plans });
                }
                next();
            });

            // ==================== ROADMAP CHART (Groq + Mermaid) ====================
            server.middlewares.use('/api/roadmap-chart', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method !== 'POST') return next();

                try {
                    const { targetRole, timeline, currentSkills, skillsToLearn, notes } = await parseBody(req);
                    if (!targetRole) return sendJson(res, 400, { error: 'Target role is required' });

                    if (!keys.GROQ_API_KEY) {
                        return sendJson(res, 500, { error: 'Groq API key not configured' });
                    }

                    const timelineText = timeline || '3 months';
                    const currentSkillsText = currentSkills || 'None specified';
                    const skillsToLearnText = skillsToLearn || targetRole;
                    const notesText = notes ? `\nAdditional notes: ${notes}` : '';

                    const prompt = `Create a career learning roadmap flowchart for someone who wants to become a "${targetRole}" within ${timelineText}.

Current skills: ${currentSkillsText}
Skills to learn: ${skillsToLearnText}${notesText}

Generate ONLY valid Mermaid.js flowchart code following these STRICT rules:

1. Start with exactly "graph TD" on the first line
2. Use subgraph blocks to group skills by phase/month. Label each subgraph by the phase name.
   Example: subgraph Phase1[Month 1 Fundamentals]
3. Use ONLY alphanumeric characters and underscores for node IDs (e.g., A1, B2, Step1)
4. Use square brackets for node labels: A1[Label Text Here]
5. Use --> for connections between nodes
6. NEVER use colons inside node labels
7. NEVER use quotes or parentheses in labels
8. Keep labels short - maximum 4 words per label
9. Create a WIDE layout - each subgraph should have 2-3 parallel vertical branches side by side
10. Connect the branches within each subgraph vertically (top to bottom)
11. Connect the last nodes of one subgraph to the first nodes of the next subgraph
12. Use style lines at the end with different colors for each phase
13. Create 15-25 nodes across ${timelineText === '1 month' ? '2 phases' : timelineText === '3 months' ? '3 phases' : '4-6 phases'}
14. End with a single final goal node that all paths converge to

Example format:
graph TD
    subgraph Phase1[Month 1 Fundamentals]
        A1[Learn Basics] --> A2[Core Concepts]
        A2 --> A3[Practice Skills]
        B1[Setup Tools] --> B2[Read Docs]
        B2 --> B3[Build Demo]
    end
    subgraph Phase2[Month 2 Advanced]
        C1[Advanced Topics] --> C2[Deep Dive]
        C2 --> C3[Build Projects]
        D1[Testing] --> D2[Optimization]
        D2 --> D3[Deploy Apps]
    end
    A3 --> C1
    B3 --> D1
    C3 --> E1[Final Goal]
    D3 --> E1
    style A1 fill:#4CAF50,color:#fff
    style B1 fill:#4CAF50,color:#fff
    style C1 fill:#2196F3,color:#fff
    style D1 fill:#2196F3,color:#fff
    style E1 fill:#FF9800,color:#fff

Generate the Mermaid code now for the ${targetRole} roadmap:`;

                    const result = await callGroq(keys.GROQ_API_KEY, prompt);
                    if (!result.success) {
                        return sendJson(res, 500, { error: result.error || 'Failed to generate roadmap chart' });
                    }

                    sendJson(res, 200, { success: true, mermaidCode: result.content });
                } catch (err: any) {
                    sendJson(res, 500, { error: err.message });
                }
            });

            // ==================== RESUME BUILDER ====================
            server.middlewares.use('/api/resume-builder', async (req: any, res: any, next: any) => {
                const session = getSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = body.id || generateId();
                        const db = getDb();
                        db.prepare(`INSERT OR REPLACE INTO resume_builds (id, user_id, personal_info, education, experience, projects, skills, template, ats_score, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
                            .run(id, session.userId, JSON.stringify(body.personalInfo || {}),
                                JSON.stringify(body.education || []), JSON.stringify(body.experience || []),
                                JSON.stringify(body.projects || []), JSON.stringify(body.skills || []),
                                body.template || 'modern', body.atsScore || 0);
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'GET') {
                    const db = getDb();
                    const builds = db.prepare('SELECT * FROM resume_builds WHERE user_id = ? ORDER BY updated_at DESC').all(session.userId);
                    return sendJson(res, 200, { builds });
                }
                next();
            });

            // ==================== ADMIN: ALL USERS ====================
            server.middlewares.use('/api/admin/users', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const session = getSession(req);
                if (!session || !session.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
                const db = getDb();
                const users = db.prepare('SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at DESC').all();
                sendJson(res, 200, { users });
            });

            // ==================== ADMIN: STATS ====================
            server.middlewares.use('/api/admin/stats', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const session = getSession(req);
                if (!session || !session.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
                const db = getDb();
                const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
                const totalInterviews = (db.prepare('SELECT COUNT(*) as count FROM interviews').get() as any).count;
                const completedInterviews = (db.prepare('SELECT COUNT(*) as count FROM interviews WHERE completed = 1').get() as any).count;
                const avgScore = (db.prepare('SELECT AVG(score) as avg FROM interviews WHERE completed = 1 AND score IS NOT NULL').get() as any).avg || 0;
                sendJson(res, 200, { totalUsers, totalInterviews, completedInterviews, averageScore: Math.round(avgScore * 10) / 10 });
            });

            // ==================== ROLES ====================
            server.middlewares.use('/api/roles', async (req: any, res: any, next: any) => {
                const db = getDb();
                if (req.method === 'GET') {
                    const roles = db.prepare('SELECT * FROM roles').all();
                    return sendJson(res, 200, { roles });
                }
                if (req.method === 'POST') {
                    const session = getSession(req);
                    if (!session || !session.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
                    try {
                        const { roleId, isOpen } = await parseBody(req);
                        const id = generateId();
                        db.prepare(`INSERT OR REPLACE INTO roles (id, role_id, is_open, updated_at) VALUES (?, ?, ?, datetime('now'))`)
                            .run(id, roleId, isOpen ? 1 : 0);
                        sendJson(res, 200, { success: true });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // ==================== OPENAI PROXY (KEEP EXISTING) ====================
            // Re-use the existing OpenAI proxy routes
            const { openaiProxyPlugin } = require('./openaiProxy');
            // This is already registered via vite.config, we'll keep it as-is
        },
    };
}
