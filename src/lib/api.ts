/**
 * VidyaMitra API Client
 * Replaces all Firebase SDK calls with REST API calls to our Vite server.
 * All API keys stay server-side.
 */

const API_BASE = '';

// Token management
let authToken: string | null = localStorage.getItem('vidyamitra_token');

export function setAuthToken(token: string | null) {
    authToken = token;
    if (token) {
        localStorage.setItem('vidyamitra_token', token);
    } else {
        localStorage.removeItem('vidyamitra_token');
    }
}

export function getAuthToken(): string | null {
    return authToken;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // Guard against non-JSON responses (e.g. Vite serving HTML for unmatched routes)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        if (!res.ok) {
            throw new Error(`API error: ${res.status} (non-JSON response)`);
        }
        // Try parsing anyway, but wrap in try-catch
        try {
            const data = await res.json();
            return data;
        } catch {
            throw new Error(`API error: received non-JSON response from ${path}`);
        }
    }

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || `API error: ${res.status}`);
    }
    return data;
}

// ==================== AUTH ====================
export const authApi = {
    login: (email: string, password: string) =>
        apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

    signup: (email: string, password: string, name?: string) =>
        apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),

    me: () => apiFetch('/api/auth/me'),

    logout: () => {
        const result = apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
        setAuthToken(null);
        return result;
    },
};

// ==================== GEMINI PROXY ====================
export const geminiApi = {
    generate: (prompt: string, temperature?: number, maxTokens?: number) =>
        apiFetch('/api/gemini/generate', {
            method: 'POST',
            body: JSON.stringify({ prompt, temperature, maxTokens }),
        }),
};

// ==================== YOUTUBE PROXY ====================
export const youtubeApi = {
    search: (query: string, maxResults = 3) =>
        apiFetch(`/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}`),
};

// ==================== PEXELS PROXY ====================
export const pexelsApi = {
    search: (query: string) =>
        apiFetch(`/api/pexels/search?q=${encodeURIComponent(query)}`),
};

// ==================== NEWS PROXY ====================
export const newsApi = {
    search: (query = 'technology jobs') =>
        apiFetch(`/api/news/search?q=${encodeURIComponent(query)}`),
};

// ==================== EXCHANGE RATE PROXY ====================
export const exchangeApi = {
    getRates: () => apiFetch('/api/exchange-rates'),
};

// ==================== INTERVIEWS ====================
export const interviewsApi = {
    getAll: (allAdmin = false) =>
        apiFetch(`/api/interviews${allAdmin ? '?all=true' : ''}`),

    save: (interview: any) =>
        apiFetch('/api/interviews', { method: 'POST', body: JSON.stringify(interview) }),

    delete: (id: string) =>
        apiFetch(`/api/interviews/${id}`, { method: 'DELETE' }),
};

// ==================== PRACTICE APTITUDE ====================
export const practiceAptitudeApi = {
    getHistory: () => apiFetch('/api/practice-aptitude'),
    save: (result: any) =>
        apiFetch('/api/practice-aptitude', { method: 'POST', body: JSON.stringify(result) }),
};

// ==================== PRACTICE INTERVIEWS ====================
export const practiceInterviewsApi = {
    getHistory: () => apiFetch('/api/practice-interviews'),
    save: (result: any) =>
        apiFetch('/api/practice-interviews', { method: 'POST', body: JSON.stringify(result) }),
};

// ==================== BOT INTERVIEWS ====================
export const botInterviewsApi = {
    getHistory: () => apiFetch('/api/bot-interviews'),
    save: (result: any) =>
        apiFetch('/api/bot-interviews', { method: 'POST', body: JSON.stringify(result) }),
};

// ==================== PRACTICE CODING ====================
export const practiceCodingApi = {
    getSessions: () => apiFetch('/api/practice-coding'),
    save: (session: any) =>
        apiFetch('/api/practice-coding', { method: 'POST', body: JSON.stringify(session) }),
};

// ==================== RESUMES ====================
export const resumesApi = {
    getAll: () => apiFetch('/api/resumes'),
    save: (resume: any) =>
        apiFetch('/api/resumes', { method: 'POST', body: JSON.stringify(resume) }),
};

// ==================== ROUND 1 APTITUDE ====================
export const round1Api = {
    getResults: (allAdmin = false) =>
        apiFetch(`/api/round1-aptitude${allAdmin ? '?all=true' : ''}`),
    save: (result: any) =>
        apiFetch('/api/round1-aptitude', { method: 'POST', body: JSON.stringify(result) }),
    update: (id: string, updates: any) =>
        apiFetch(`/api/round1-aptitude/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
};

// ==================== CAREER PLAN ====================
export const careerPlanApi = {
    generate: (targetRole: string, skillGaps: string[]) =>
        apiFetch('/api/career-plan', { method: 'POST', body: JSON.stringify({ targetRole, skillGaps }) }),
    getAll: () => apiFetch('/api/career-plan'),
};

// ==================== ROADMAP CHART (Groq + Mermaid) ====================
export const roadmapChartApi = {
    generate: (params: { targetRole: string; timeline?: string; currentSkills?: string; skillsToLearn?: string; notes?: string }) =>
        apiFetch('/api/roadmap-chart', { method: 'POST', body: JSON.stringify(params) }),
};

// ==================== RESUME BUILDER ====================
export const resumeBuilderApi = {
    save: (data: any) =>
        apiFetch('/api/resume-builder', { method: 'POST', body: JSON.stringify(data) }),
    getAll: () => apiFetch('/api/resume-builder'),
};

// ==================== ADMIN ====================
export const adminApi = {
    getUsers: () => apiFetch('/api/admin/users'),
    getStats: () => apiFetch('/api/admin/stats'),
};

// ==================== ROLES ====================
export const rolesApi = {
    getAll: () => apiFetch('/api/roles'),
    update: (roleId: string, isOpen: boolean) =>
        apiFetch('/api/roles', { method: 'POST', body: JSON.stringify({ roleId, isOpen }) }),
};
