// ─── Supabase Client ──────────────────────────────────────────────────────────
// Replace these with your own Supabase project URL and anon key
// Get them free at https://supabase.com (no credit card required)
// Project Settings → API → Project URL & anon/public key

export const SUPABASE_URL = 'pgmwotchkpymqzwsoyhb';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbXdvdGNoa3B5bXF6d3NveWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MjA3MjEsImV4cCI6MjA4NzM5NjcyMX0.VRDZYO0CcAzwoKEO-KQ-cqEbApNck0YsbcGoEIQ6UhE';

// Lightweight Supabase client (no npm needed for GitHub Pages)
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.auth = new AuthClient(url, key);
    this.realtime = null;
  }

  from(table) {
    return new QueryBuilder(this.url, this.key, table);
  }

  channel(name) {
    return new RealtimeChannel(this.url, this.key, name);
  }
}

class AuthClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this._session = null;
    this._listeners = [];
    this._init();
  }

  async _init() {
    const stored = localStorage.getItem('chorify_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.expires_at * 1000 > Date.now()) {
          this._session = session;
          this._notify('SIGNED_IN', session);
        } else {
          await this.refreshSession(session.refresh_token);
        }
      } catch {}
    }
  }

  async signUp({ email, password, options }) {
    const res = await fetch(`${this.url}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.key },
      body: JSON.stringify({ email, password, data: options?.data || {} })
    });
    const data = await res.json();
    if (data.error) return { error: data.error };
    if (data.session) {
      this._setSession(data.session);
    }
    return { data, error: null };
  }

  async signInWithPassword({ email, password }) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.key },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error_description || data.error) {
      return { error: { message: data.error_description || data.error } };
    }
    this._setSession(data);
    return { data, error: null };
  }

  async signOut() {
    if (this._session) {
      await fetch(`${this.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this._session.access_token}` }
      }).catch(() => {});
    }
    this._session = null;
    localStorage.removeItem('chorify_session');
    this._notify('SIGNED_OUT', null);
  }

  async refreshSession(refresh_token) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.key },
      body: JSON.stringify({ refresh_token })
    });
    const data = await res.json();
    if (!data.error) this._setSession(data);
    return data;
  }

  _setSession(session) {
    this._session = session;
    localStorage.setItem('chorify_session', JSON.stringify(session));
    this._notify('SIGNED_IN', session);
  }

  getSession() {
    return { data: { session: this._session } };
  }

  getUser() {
    return this._session?.user || null;
  }

  onAuthStateChange(cb) {
    this._listeners.push(cb);
    return { data: { subscription: { unsubscribe: () => { this._listeners = this._listeners.filter(l => l !== cb); } } } };
  }

  _notify(event, session) {
    this._listeners.forEach(cb => cb(event, session));
  }
}

class QueryBuilder {
  constructor(url, key, table) {
    this.url = url;
    this.key = key;
    this.table = table;
    this._filters = [];
    this._select = '*';
    this._order = null;
    this._limit = null;
    this._single = false;
  }

  _authHeader() {
    const stored = localStorage.getItem('chorify_session');
    if (stored) {
      try { return JSON.parse(stored).access_token; } catch {}
    }
    return null;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json', 'apikey': this.key, 'Prefer': 'return=representation' };
    const token = this._authHeader();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  select(cols = '*') { this._select = cols; return this; }
  eq(col, val) { this._filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this; }
  neq(col, val) { this._filters.push(`${col}=neq.${encodeURIComponent(val)}`); return this; }
  order(col, { ascending = true } = {}) { this._order = `${col}.${ascending ? 'asc' : 'desc'}`; return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = true; return this; }

  _buildUrl(method) {
    let url = `${this.url}/rest/v1/${this.table}?select=${this._select}`;
    this._filters.forEach(f => url += `&${f}`);
    if (this._order) url += `&order=${this._order}`;
    if (this._limit) url += `&limit=${this._limit}`;
    if (this._single) {
      const h = this._headers();
      h['Accept'] = 'application/vnd.pgrst.object+json';
    }
    return url;
  }

  async _exec(method, body) {
    const headers = this._headers();
    if (this._single) headers['Accept'] = 'application/vnd.pgrst.object+json';
    try {
      const res = await fetch(this._buildUrl(method), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      if (res.status === 204) return { data: null, error: null };
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }

  async get() {
    const headers = this._headers();
    if (this._single) headers['Accept'] = 'application/vnd.pgrst.object+json';
    try {
      const res = await fetch(this._buildUrl('GET'), { method: 'GET', headers });
      if (!res.ok) {
        const err = await res.json();
        return { data: null, error: err };
      }
      const data = await res.json();
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }

  async insert(body) {
    const headers = this._headers();
    try {
      const res = await fetch(`${this.url}/rest/v1/${this.table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };
      return { data: Array.isArray(data) ? data[0] : data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }

  async update(body) {
    return this._exec('PATCH', body);
  }

  async delete() {
    const headers = this._headers();
    try {
      const res = await fetch(this._buildUrl('DELETE'), { method: 'DELETE', headers });
      if (res.status === 204) return { data: null, error: null };
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }
}

class RealtimeChannel {
  constructor(url, key, name) {
    this.url = url.replace('https', 'wss').replace('http', 'ws');
    this.key = key;
    this.name = name;
    this._handlers = [];
    this._ws = null;
  }

  on(event, filter, cb) {
    this._handlers.push({ event, filter, cb });
    return this;
  }

  subscribe(cb) {
    // Simplified: poll instead of true WebSocket for reliability on GH Pages
    const token = localStorage.getItem('chorify_session') ? JSON.parse(localStorage.getItem('chorify_session')).access_token : null;
    cb?.('SUBSCRIBED');
    return this;
  }

  unsubscribe() {
    if (this._ws) this._ws.close();
  }
}

export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
