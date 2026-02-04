import { state } from "../state.js";
import { apiLogin, apiRegister, apiGetBalance, logout } from "../auth.js";
import { log } from "./logging.js";

export async function initAuth() {
    // 1. Event Listeners (Attach immediately)
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (state.user.token) {
                // If logged in, open Profile Modal
                openProfileModal();
            } else {
                openAuthModal();
            }
        });
    }

    const currencyBtn = document.getElementById('currencyBtn');
    if (currencyBtn) {
        currencyBtn.addEventListener('click', () => {
            openCurrencyModal();
        });
    }

    // Modal tabs
    document.getElementById('tabLogin')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tabRegister')?.addEventListener('click', () => switchAuthTab('register'));

    // Currency Modal Tabs
    document.getElementById('tabSendGP')?.addEventListener('click', () => switchCurrencyTab('send'));
    document.getElementById('tabBuyGP')?.addEventListener('click', () => switchCurrencyTab('buy'));

    // Forms
    document.getElementById('doLoginBtn')?.addEventListener('click', handleLoginSubmit);
    document.getElementById('doRegisterBtn')?.addEventListener('click', handleRegisterSubmit);
    
    // Auth Close
    document.getElementById('authClose')?.addEventListener('click', closeAuthModal);
    
    // Profile Modal
    document.getElementById('profileClose')?.addEventListener('click', closeProfileModal);
    document.getElementById('doLogoutBtn')?.addEventListener('click', async () => {
        await logout();
        updateAuthUI();
        closeProfileModal();
        log("Logged out.");
    });
    
    // Currency Close & Actions
    document.getElementById('currencyClose')?.addEventListener('click', closeCurrencyModal);
    document.getElementById('doSendBtn')?.addEventListener('click', () => {
        const recip = (document.getElementById('sendRecipient') as HTMLInputElement).value;
        const amt = (document.getElementById('sendAmount') as HTMLInputElement).value;
        if(recip && amt) {
            alert(`Sending ${amt} GP to ${recip}... (Feature Pending Backend)`);
            closeCurrencyModal();
        } else {
            alert("Please fill in all fields.");
        }
    });
    document.getElementById('doBuyBtn')?.addEventListener('click', () => {
        const amt = (document.getElementById('buyAmount') as HTMLInputElement).value;
        if(amt) {
             alert(`Purchasing ${amt} GP... (Feature Pending Backend)`);
             closeCurrencyModal();
        }
    });

    // 2. Check local storage
    const storedToken = localStorage.getItem('shopgen_token');
    if (storedToken) {
        // Verify and get profile
        await refreshProfile(storedToken);
    }
    updateAuthUI();
}

function openAuthModal() {
    const modal = document.getElementById('authModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal && overlay) {
        modal.classList.remove('hidden');
        overlay.style.display = 'flex';
        // Clear inputs
        (document.getElementById('loginEmail') as HTMLInputElement).value = '';
        (document.getElementById('loginPass') as HTMLInputElement).value = '';
        (document.getElementById('regUser') as HTMLInputElement).value = '';
        (document.getElementById('regEmail') as HTMLInputElement).value = '';
        (document.getElementById('regPass') as HTMLInputElement).value = '';
        authStatus("");
        switchAuthTab('login');
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) modal.classList.add('hidden');
    if (overlay) overlay.style.display = 'none';
}

function openProfileModal() {
    const modal = document.getElementById('userProfileModal');
    const overlay = document.getElementById('modalOverlay');
    const nameEl = document.getElementById('profileName');
    
    if (modal && overlay) {
        modal.classList.remove('hidden');
        overlay.style.display = 'flex';
        if (nameEl) nameEl.textContent = state.user.username || "User";
    }
}

function closeProfileModal() {
    const modal = document.getElementById('userProfileModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) modal.classList.add('hidden');
    if (overlay) overlay.style.display = 'none';
}

function openCurrencyModal() {
    const modal = document.getElementById('currencyModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal && overlay) {
        modal.classList.remove('hidden');
        overlay.style.display = 'flex';
        switchCurrencyTab('send');
    }
}

function closeCurrencyModal() {
    const modal = document.getElementById('currencyModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) modal.classList.add('hidden');
    if (overlay) overlay.style.display = 'none';
}

function switchCurrencyTab(tab: 'send' | 'buy') {
    const tSend = document.getElementById('tabSendGP');
    const tBuy = document.getElementById('tabBuyGP');
    const vSend = document.getElementById('viewSendGP');
    const vBuy = document.getElementById('viewBuyGP');
    
    if (tab === 'send') {
        tSend?.classList.add('active');
        tBuy?.classList.remove('active');
        vSend?.classList.remove('hidden');
        vBuy?.classList.add('hidden');
    } else {
        tSend?.classList.remove('active');
        tBuy?.classList.add('active');
        vSend?.classList.add('hidden');
        vBuy?.classList.remove('hidden');
    }
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
    const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
    const p = (document.getElementById('loginPass') as HTMLInputElement).value.trim();
    
    if (!email || !p) {
        authStatus("Email and password required.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Logging in...";
    }
    authStatus("");

    try {
        const res = await apiLogin(email, p);
        if (res.success && res.token) {
            state.user.token = res.token;
            state.user.username = email.split('@')[0]; // Temporary display name until profile fetch
            localStorage.setItem('shopgen_token', res.token);
            
            authStatus("Login successful!", "success");
            await refreshProfile(res.token);
            setTimeout(closeAuthModal, 800);
            updateAuthUI();
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
    const u = (document.getElementById('regUser') as HTMLInputElement).value.trim();
    const email = (document.getElementById('regEmail') as HTMLInputElement).value.trim();
    const p = (document.getElementById('regPass') as HTMLInputElement).value.trim();

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
            (document.getElementById('regUser') as HTMLInputElement).value = '';
            (document.getElementById('regEmail') as HTMLInputElement).value = '';
            (document.getElementById('regPass') as HTMLInputElement).value = '';
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
    const res = await apiGetBalance(token);
    if (res.success) {
        state.user.token = token;
        // Spec for GET /balance only returns { balance: ... }. 
        // We might need another call for username, or decode JWT.
        // For now, let's keep the existing logic or fall back to a placeholder if username isn't in response.
        // But if the previous API returned username and new one doesn't, we need to handle that.
        // Assuming /balance just returns balance.
        state.user.balance = res.balance || 0;
        
        // Try to keep username if we have it, or maybe encoded in token?
        // Ideally we'd decode the JWT to get the username/sub claim.
        if (!state.user.username) {
             // Simple fallback decode
             try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                state.user.username = payload.sub || payload.username || "User";
             } catch(e) {
                state.user.username = "User";
             }
        }
    } else {
        // Token expired or invalid
        await logout();
        log("Session expired.", "warn");
    }
    updateAuthUI();
}

export function updateAuthUI() {
    const btn = document.getElementById('authBtn');
    const curBtn = document.getElementById('currencyBtn');

    if (state.user.token) {
        // Logged In
        if (btn) {
            btn.textContent = state.user.username || "User";
            btn.title = "Open Profile";
            btn.classList.add('status-loaded');
        }
        if (curBtn) {
            curBtn.textContent = `${state.user.balance} GP`;
            curBtn.classList.remove('hidden');
        }
    } else {
        // Logged Out
        if (btn) {
            btn.textContent = "Login / Register";
            btn.title = "Login to save account data";
            btn.classList.remove('status-loaded');
        }
        if (curBtn) {
            curBtn.classList.add('hidden');
        }
    }
}