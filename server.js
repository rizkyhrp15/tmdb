const express = require('express');
const axios = require('axios');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const TMDB_KEY = process.env.TMDB_KEY;
if (!TMDB_KEY) {
  console.error('ERROR: TMDB_KEY env var is required');
  process.exit(1);
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '86400', 10);

let redis = null;
if (process.env.REDIS_HOST) {
  redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  });
  redis.on('error', (e) => console.error('Redis error', e));
  console.log('Using Redis cache at', process.env.REDIS_HOST);
} else {
  console.log('No REDIS_HOST configured — using local file cache fallback');
}

const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

function cacheKey(prefix, key) {
  return `${prefix}:${key}`;
}

async function getCache(prefix, key) {
  const k = cacheKey(prefix, key);
  if (redis) {
    const val = await redis.get(k);
    return val ? JSON.parse(val) : null;
  }
  const file = path.join(CACHE_DIR, encodeURIComponent(k));
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const obj = JSON.parse(raw);
    if (Date.now() / 1000 - obj._cached_at > CACHE_TTL) {
      fs.unlinkSync(file);
      return null;
    }
    return obj.value;
  } catch (e) {
    return null;
  }
}

async function setCache(prefix, key, value) {
  const k = cacheKey(prefix, key);
  if (redis) {
    await redis.set(k, JSON.stringify(value), 'EX', CACHE_TTL);
    return;
  }
  const file = path.join(CACHE_DIR, encodeURIComponent(k));
  const obj = { _cached_at: Math.floor(Date.now() / 1000), value };
  fs.writeFileSync(file, JSON.stringify(obj));
}

async function tmdbGet(pathname, params = {}) {
  params.api_key = TMDB_KEY;
  const url = `${TMDB_BASE}${pathname}`;
  const cacheId = url + JSON.stringify(params);
  const cached = await getCache('tmdb', cacheId);
  if (cached) return cached;

  const resp = await axios.get(url, { params, timeout: 10000 });
  const data = resp.data;
  await setCache('tmdb', cacheId, data);
  return data;
}

app.get('/health', (req, res) => res.send({ ok: true }));

app.get('/api/search', async (req, res) => {
  const q = req.query.q || req.query.query;
  if (!q) return res.status(400).send({ error: 'query param q is required' });
  try {
    const data = await tmdbGet('/search/movie', { query: q, language: req.query.lang || 'en-US', page: req.query.page || 1 });
    res.json(data);
  } catch (e) {
    console.error(e.message || e);
    res.status(502).send({ error: 'tmdb_error', detail: e.message });
  }
});

app.get('/api/movie/:id', async (req, res) => {
  const id = req.params.id;
  const append = req.query.append_to_response;
  try {
    const data = await tmdbGet(`/movie/${id}`, { append_to_response: append, language: req.query.lang || 'en-US' });
    res.json(data);
  } catch (e) {
    console.error(e.message || e);
    res.status(502).send({ error: 'tmdb_error', detail: e.message });
  }
});

app.get('/api/configuration', async (req, res) => {
  try {
    const data = await tmdbGet('/configuration');
    res.json(data);
  } catch (e) {
    console.error(e.message || e);
    res.status(502).send({ error: 'tmdb_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
