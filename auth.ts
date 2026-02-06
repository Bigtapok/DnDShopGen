import { state } from "./state.js";

const API_BASE = "https://dndshopgen-service-374678329775.us-central1.run.app/api";

export async function apiRegister(username: string, email: string, password: string): Promise<{ success: boolean, message?: string, error?: string }> {
    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: username, email, password })
        });

        const data = await res.json();

        if (res.status === 201) {
            return { success: true, message: data.message };
        } else {
            // Handle specific field errors like password validation
            let errMsg = data.error || data.detail; // .detail is common in FastAPI
            if (!errMsg && data.password) errMsg = "Password: " + data.password[0];
            return { success: false, error: errMsg || "Registration failed" };
        }
    } catch (e) {
        return { success: false, error: "Network error during registration." };
    }
}

export async function apiLogin(login: string, password: string): Promise<{ success: boolean, token?: string, refreshToken?: string, error?: string }> {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });

        const data = await res.json();

        // New backend returns 'token', old one returned 'access_token'
        if (res.status === 200 && data.token) {
            // Store tokens
            localStorage.setItem('shopgen_token', data.token);
            // New backend spec didn't mention refresh token, but keeping logic safe
            if (data.refresh_token) {
                localStorage.setItem('shopgen_refresh_token', data.refresh_token);
            }
            return { success: true, token: data.token, refreshToken: data.refresh_token };
        } else {
            return { success: false, error: data.error || data.detail || "Login failed" };
        }
    } catch (e) {
        return { success: false, error: "Network error during login." };
    }
}

export async function apiGetProfile(token: string): Promise<{ success: boolean, user?: any, role?: string, error?: string }> {
    try {
        // Attempt to fetch profile. If endpoint missing (404), assume valid session but no profile data.
        const res = await fetch(`${API_BASE}/auth/profile`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 200) {
            const data = await res.json();
            return { success: true, user: data, role: data.role };
        } else if (res.status === 401) {
            return { success: false, error: "Token expired" };
        } else {
            // Fallback: If /auth/profile doesn't exist on backend yet, return success to keep session alive
            // assuming the token is valid (which is checked by the 401 guard above usually, 
            // but 404 means the path is wrong, not the token).
            return { success: true, user: {} };
        }
    } catch (e) {
        return { success: false, error: "Network error fetching profile." };
    }
}

export async function apiGetUsers(token: string) {
    try {
        const res = await fetch(`${API_BASE}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch users");
        return await res.json();
    } catch (e) {
        console.error(e);
        // Return empty array on error to prevent UI crash
        return [];
    }
}

export async function logout() {
    const token = state.user.token;
    // New backend doesn't explicitly document logout, but we try anyway
    if (token) {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST', // Usually logout is POST or DELETE
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            // Ignore logout errors
        }
    }

    state.user.token = null;
    state.user.username = null;
    state.user.role = null;
    state.user.balance = 0;
    localStorage.removeItem('shopgen_token');
    localStorage.removeItem('shopgen_refresh_token');
    localStorage.removeItem('shopgen_user');
    localStorage.removeItem('shopgen_role');
}

// --- Generations API ---

export async function apiSaveGeneration(data: any) {
    if (!state.user.token) return { success: false, error: "Not logged in" };
    try {
        const res = await fetch(`${API_BASE}/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.user.token}`
            },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            return { success: true, data: await res.json() };
        }
        return { success: false, error: "Failed to save generation" };
    } catch (e) {
        return { success: false, error: "Network error saving generation" };
    }
}

export async function apiGetGenerations() {
    if (!state.user.token) return [];
    try {
        const res = await fetch(`${API_BASE}/generations`, {
            headers: { 'Authorization': `Bearer ${state.user.token}` }
        });
        if (res.ok) return await res.json();
        return [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function apiDeleteGeneration(id: number | string) {
    if (!state.user.token) return { success: false };
    try {
        const res = await fetch(`${API_BASE}/generations/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.user.token}` }
        });
        return { success: res.ok };
    } catch (e) {
        return { success: false };
    }
}

// Assuming the backend supports retrieving details by ID to get the full JSON blob if the list view is summarized
export async function apiGetGenerationById(id: number | string) {
    if (!state.user.token) return null;
    try {
        const res = await fetch(`${API_BASE}/generations/${id}`, {
            headers: { 'Authorization': `Bearer ${state.user.token}` }
        });
        if (res.ok) return await res.json();
        return null;
    } catch (e) {
        return null;
    }
}