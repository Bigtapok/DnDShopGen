import { state } from "../state.js";
import { apiLogin, apiRegister, apiGetProfile, logout } from "../auth.js";
import { log } from "./logging.js";
import { renderShopHeader } from "./results.js";

export function updateAuthUi() {
    const authBtn = document.getElementById('authBtn');
    const userDisplay = document.getElementById('userDisplay');
    const adminBtn = document.getElementById('adminBtn');
    // Можно добавить новые элементы, если переходите на новую структуру

    if (state.user.token) {
        if (authBtn) authBtn.textContent = `Logout (${state.user.username || 'User'})`;
        if (userDisplay) userDisplay.textContent = state.user.username || "User";
        if (adminBtn) {
            if (state.user.role === 'admin') adminBtn.classList.remove('hidden');
            else adminBtn.classList.add('hidden');
        }
    } else {
        if (authBtn) authBtn.textContent = "Login / Register";
        if (userDisplay) userDisplay.textContent = "Guest";
        if (adminBtn) adminBtn.classList.add('hidden');
    }
    renderShopHeader();
}

function openAuthModal() {
    const modal = document.getElementById('authModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal && overlay) {
        modal.classList.remove('hidden');
        overlay.style.display = 'flex';
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) modal.classList.add('hidden');
    if (overlay) overlay.style.display = 'none';
}


function closeProfileModal() {
    const modal = document.getElementById('userProfileModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) modal.classList.add('hidden');
    if (overlay) overlay.style.display = 'none';
}

function switchAuthTab(tab: 'login' | 'register') {
    const tLog = document.getElementById('tabLogin');
    const tReg = document.getElementById('tabRegister');
    const vLog = document.getElementById('viewLogin');
    const vReg = document.getElementById('viewRegister');

    if (tab === 'login') {
        tLog?.classList.add('active');
        tReg?.classList.remove('active');
        vLog?.classList.remove('hidden');
        vReg?.classList.add('hidden');
    } else {
        tLog?.classList.remove('active');
        tReg?.classList.add('active');
        vLog?.classList.add('hidden');
        vReg?.classList.remove('hidden');
    }
    authStatus("");
}

function authStatus(msg: string, type: 'error' | 'success' = 'error') {
    const el = document.getElementById('authStatusMsg');
    if (el) {
        el.textContent = msg;
        el.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
        el.style.display = msg ? 'block' : 'none';
    }
}

async function handleLoginSubmit() {
    const btn = document.getElementById('doLoginBtn') as HTMLButtonElement;
    const loginInput = document.getElementById('loginUser') as HTMLInputElement;
    const passInput = document.getElementById('loginPass') as HTMLInputElement;

    const login = loginInput.value.trim();
    const p = passInput.value.trim();

    if (!login || !p) {
        authStatus("Username and password required.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Logging in...";
    }
    authStatus("");

    try {
        const res = await apiLogin(login, p);
        if (res.success && res.token) {
            state.user.token = res.token;
            state.user.username = login;
            localStorage.setItem('shopgen_token', res.token);
            if (res.refreshToken) localStorage.setItem('shopgen_refresh_token', res.refreshToken);

            authStatus("Login successful!", "success");
            await refreshProfile(res.token);
            setTimeout(closeAuthModal, 800);
            updateAuthUi();
            log(`Logged in as ${state.user.username}`);
        } else {
            authStatus(res.error || "Login failed.");
        }
    } catch (e) {
        authStatus("Login error.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Log In";
        }
    }
}

async function handleRegisterSubmit() {
    const btn = document.getElementById('doRegisterBtn') as HTMLButtonElement;
    const uInput = document.getElementById('regUser') as HTMLInputElement;
    const eInput = document.getElementById('regEmail') as HTMLInputElement;
    const pInput = document.getElementById('regPass') as HTMLInputElement;

    const u = uInput.value.trim();
    const email = eInput.value.trim();
    const p = pInput.value.trim();

    if (!u || !email || !p) {
        authStatus("Username, email and password required.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Registering...";
    }
    authStatus("");

    try {
        const res = await apiRegister(u, email, p);
        if (res.success) {
            authStatus(res.message || "Registration successful! Please login.", "success");
            // Clear inputs
            uInput.value = '';
            eInput.value = '';
            pInput.value = '';
            setTimeout(() => switchAuthTab('login'), 1500);
        } else {
            authStatus(res.error || "Registration failed.");
        }
    } catch (e) {
        authStatus("Registration error.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Register";
        }
    }
}

export async function refreshProfile(token: string) {
    const res = await apiGetProfile(token);

    // Accept if API call succeeded or if fallback (404) happened but token exists
    if (res.success) {
        state.user.token = token;

        // Decode JWT to get username
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            // New API uses 'login' field for username
            state.user.username = payload.login || payload.sub || "User";
        } catch (e) {
            state.user.username = "User";
        }

        // Update balance if available, else 0
        state.user.balance = (res.user && res.user.balance) ? res.user.balance : 0;

        // Update Role
        state.user.role = res.role || null;
        if (state.user.role === 'admin') {
            localStorage.setItem('shopgen_role', 'admin');
        }

        // Handle Admin Button
        const adminBtn = document.getElementById('adminUsersBtn');
        if (adminBtn) {
            if (state.user.role === 'admin') {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
    } else {
        // Token expired or invalid
        await logout();
        log("Session expired.", "warn");
    }
    updateAuthUi();
}


export function initAuth() {
    updateAuthUi();
    // Check for existing token
    const savedToken = localStorage.getItem('shopgen_token');
    const savedUser = localStorage.getItem('shopgen_user');
    const savedRole = localStorage.getItem('shopgen_role');
    if (savedToken) {
        state.user.token = savedToken;
        state.user.username = savedUser;
        state.user.role = savedRole;
        updateAuthUi();
    }

    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.addEventListener('click', async () => {
            if (state.user.token) {
                // Already logged in -> Logout
                await logout();
                updateAuthUi();
                log("Logged out.");
            } else {
                // Open Auth Modal
                openAuthModal();
            }
        });
    }

    // Attach basic login handler for the modal
    const loginBtn = document.getElementById('doLoginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLoginSubmit);
    }

}

const regBtn = document.getElementById('doRegisterBtn');
if (regBtn) {
    regBtn.addEventListener('click', handleRegisterSubmit);
}

// Enter key support
['loginUser', 'loginPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleLoginSubmit();
    });
});

['regUser', 'regEmail', 'regPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleRegisterSubmit();
    });
});

// Tab switching
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const viewLogin = document.getElementById('viewLogin');
const viewRegister = document.getElementById('viewRegister');

if (tabLogin && tabRegister && viewLogin && viewRegister) {
    tabLogin.addEventListener('click', () => {
        switchAuthTab('login');
    });
    tabRegister.addEventListener('click', () => {
        switchAuthTab('register');
    });
}

