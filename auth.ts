import { state } from "./state.js";

const API_BASE = "https://idx-dndshopgen-27067170-374678329775.europe-west1.run.app";

export async function apiRegister(username: string, email: string, password: string): Promise<{ success: boolean, message?: string, error?: string }> {
    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
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

export async function apiLogin(email: string, password: string): Promise<{ success: boolean, token?: string, refreshToken?: string, error?: string }> {
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        
        if (res.status === 200 && data.access_token) {
            // Store tokens
            localStorage.setItem('shopgen_token', data.access_token);
            if (data.refresh_token) {
                localStorage.setItem('shopgen_refresh_token', data.refresh_token);
            }
            return { success: true, token: data.access_token, refreshToken: data.refresh_token };
        } else {
            return { success: false, error: data.error || data.detail || "Login failed" };
        }
    } catch (e) {
        return { success: false, error: "Network error during login." };
    }
}

export async function apiGetBalance(token: string): Promise<{ success: boolean, balance?: number, error?: string }> {
    try {
        const res = await fetch(`${API_BASE}/balance`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 200) {
            const data = await res.json();
            return { success: true, balance: data.balance };
        } else if (res.status === 401) {
            // TODO: Implement refresh token logic here if needed
            return { success: false, error: "Token expired" };
        } else {
            return { success: false, error: "Failed to fetch balance" };
        }
    } catch (e) {
        return { success: false, error: "Network error fetching balance." };
    }
}

export async function logout() {
    const token = state.user.token;
    if (token) {
        try {
             await fetch(`${API_BASE}/logout`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.warn("Logout failed on server", e);
        }
    }

    state.user.token = null;
    state.user.username = null;
    state.user.balance = 0;
    localStorage.removeItem('shopgen_token');
    localStorage.removeItem('shopgen_refresh_token');
}