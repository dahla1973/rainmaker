const https = require('https');
const fs = require('fs');

const REFRESH_BUFFER_MS = 60_000;

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const isForm = typeof body === 'string';
    const data = isForm ? body : JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 10000,
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        try {
          const json = chunks ? JSON.parse(chunks) : {};
          if (res.statusCode >= 400) {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}

class FirebaseAuth {
  constructor({ apiKey, tokenFile }) {
    this.apiKey = apiKey;
    this.tokenFile = tokenFile;
    this.tokens = this.load();
    this.inflight = null;
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.tokenFile, 'utf-8'));
    } catch {
      return null;
    }
  }

  save() {
    fs.writeFileSync(this.tokenFile, JSON.stringify(this.tokens, null, 2));
  }

  isSignedIn() {
    return !!this.tokens?.refreshToken;
  }

  email() {
    return this.tokens?.email || null;
  }

  async signIn(email, password) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.apiKey}`;
    const res = await postJson(url, { email, password, returnSecureToken: true });
    this.tokens = {
      email: res.email,
      idToken: res.idToken,
      refreshToken: res.refreshToken,
      expiresAt: Date.now() + Number(res.expiresIn) * 1000,
    };
    this.save();
    return { email: res.email };
  }

  signOut() {
    this.tokens = null;
    try { fs.unlinkSync(this.tokenFile); } catch {}
  }

  async getIdToken() {
    if (!this.tokens) throw new Error('Not signed in');
    if (this.tokens.idToken && Date.now() < this.tokens.expiresAt - REFRESH_BUFFER_MS) {
      return this.tokens.idToken;
    }
    if (!this.inflight) {
      this.inflight = this.refresh().finally(() => { this.inflight = null; });
    }
    return this.inflight;
  }

  async refresh() {
    const url = `https://securetoken.googleapis.com/v1/token?key=${this.apiKey}`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refreshToken,
    }).toString();
    const res = await postJson(url, body);
    this.tokens = {
      ...this.tokens,
      idToken: res.id_token,
      refreshToken: res.refresh_token || this.tokens.refreshToken,
      expiresAt: Date.now() + Number(res.expires_in) * 1000,
    };
    this.save();
    return this.tokens.idToken;
  }
}

module.exports = { FirebaseAuth };
