import http from 'node:http';
import https from 'node:https';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'data');
const coverDir = path.join(dataDir, 'covers');
const stagingDir = path.join(dataDir, 'cover-staging');
const dataFile = path.join(dataDir, 'manga.txt');
const configFile = path.join(dataDir, 'config.json');
const mainCategory = { id: 'main', name: 'หมวดหลัก' };
const distDir = path.join(root, 'dist');
const port = Number(process.env.PORT || 4174);

await fs.mkdir(coverDir, { recursive: true });
await fs.mkdir(stagingDir, { recursive: true });
try { await fs.access(dataFile); } catch { await fs.writeFile(dataFile, '[]\n', 'utf8'); }
try { await fs.access(configFile); } catch { await fs.writeFile(configFile, JSON.stringify({ cardSize: 158, categories: [mainCategory] }, null, 2) + '\n', 'utf8'); }
const existingConfig = JSON.parse(await fs.readFile(configFile, 'utf8'));
if (!Array.isArray(existingConfig.categories)) {
  existingConfig.categories = [mainCategory];
  await fs.writeFile(configFile, JSON.stringify(existingConfig, null, 2) + '\n', 'utf8');
}

const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
const readItems = async () => {
  const items = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  if (!Array.isArray(items)) throw new Error('manga.txt must contain an array');
  return items;
};
const coverName = name => /^[a-f0-9-]+\.(png|jpg|webp|avif|gif)$/.test(name);
const localCoverName = cover => String(cover || '').match(/^\/covers\/([a-f0-9-]+\.(?:png|jpg|webp|avif|gif))$/)?.[1];
const imageType = buffer => {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'gif';
  if (buffer.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(buffer.toString('ascii', 8, Math.min(buffer.length, 48)))) return 'avif';
  return null;
};
const publicAddress = address => {
  const ip = String(address).replace(/^\[|\]$/g, '');
  const family = net.isIP(ip);
  if (family === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && b >= 18 && b <= 19) || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const first = Number.parseInt(ip.split(':')[0], 16);
    return first >= 0x2000 && first <= 0x3fff && !ip.toLowerCase().startsWith('2001:db8:');
  }
  return false;
};
const remoteError = message => Object.assign(new Error(message), { status: 422 });
const downloadCover = (source, redirects = 0) => new Promise((resolve, reject) => {
  let url;
  try { url = new URL(source); } catch { reject(remoteError('ลิงก์รูปปกไม่ถูกต้อง')); return; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || source.length > 2048 || redirects > 4) { reject(remoteError('ลิงก์รูปปกไม่ถูกต้อง')); return; }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !publicAddress(host)) { reject(remoteError('ไม่อนุญาตให้ใช้ลิงก์รูปปกภายในเครื่องหรือเครือข่ายส่วนตัว')); return; }
  const transport = url.protocol === 'https:' ? https : http;
  const req = transport.get(url, {
    headers: { 'User-Agent': 'MangaShelf/1.0', Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.5' },
    signal: AbortSignal.timeout(15000),
    lookup: (hostname, options, callback) => dns.lookup(hostname, options, (error, address, family) => {
      if (error) return callback(error);
      if (Array.isArray(address)) {
        const allowed = address.filter(entry => publicAddress(entry.address));
        if (!allowed.length) return callback(remoteError('ไม่อนุญาตให้ใช้ลิงก์รูปปกภายในเครื่องหรือเครือข่ายส่วนตัว'));
        callback(null, allowed);
      } else if (publicAddress(address)) callback(null, address, family);
      else callback(remoteError('ไม่อนุญาตให้ใช้ลิงก์รูปปกภายในเครื่องหรือเครือข่ายส่วนตัว'));
    })
  }, response => {
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      response.resume();
      if (redirects >= 4) { reject(remoteError('ลิงก์รูปปกเปลี่ยนปลายทางหลายครั้งเกินไป')); return; }
      resolve(downloadCover(new URL(response.headers.location, url).href, redirects + 1));
      return;
    }
    if (response.statusCode !== 200) { response.resume(); reject(remoteError(`ดาวน์โหลดรูปปกไม่สำเร็จ (HTTP ${response.statusCode})`)); return; }
    const length = Number(response.headers['content-length']);
    if (length > 5 * 1024 * 1024) { response.resume(); reject(remoteError('รูปปกใหญ่เกิน 5 MB')); return; }
    const chunks = [];
    let bytes = 0;
    response.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 5 * 1024 * 1024) { response.destroy(); reject(remoteError('รูปปกใหญ่เกิน 5 MB')); return; }
      chunks.push(chunk);
    });
    response.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const ext = imageType(buffer);
      if (!ext) { reject(remoteError('URL นี้ไม่ได้ส่งรูป PNG, JPG, WebP, AVIF หรือ GIF')); return; }
      resolve({ buffer, ext });
    });
    response.on('error', reject);
  });
  req.on('error', error => reject(error.status ? error : remoteError(`ดาวน์โหลดรูปปกจาก URL ไม่สำเร็จ (${error.code || error.message})`)));
});
const writeUnique = async (file, buffer) => {
  try { await fs.writeFile(file, buffer, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
};
const managedCover = async cover => {
  if (!cover) return '';
  if (/^https?:\/\//i.test(cover)) {
    const { buffer, ext } = await downloadCover(cover);
    const name = `${createHash('sha256').update(buffer).digest('hex')}.${ext}`;
    await writeUnique(path.join(coverDir, name), buffer);
    return `/covers/${name}`;
  }
  const name = localCoverName(cover);
  if (!name) throw Object.assign(new Error('ลิงก์รูปปกไม่ถูกต้อง'), { status: 400 });
  try { await fs.access(path.join(coverDir, name)); return cover; } catch {}
  const staged = path.join(stagingDir, name);
  try { await fs.access(staged); } catch { throw Object.assign(new Error('ไม่พบไฟล์รูปปกที่อัปโหลด'), { status: 400 }); }
  try { await fs.rename(staged, path.join(coverDir, name)); }
  catch (error) { if (error.code !== 'EEXIST') throw error; await fs.unlink(staged); }
  return cover;
};
const cleanupUnusedCovers = async items => {
  const used = new Set(items.map(item => localCoverName(item.cover)).filter(Boolean));
  for (const entry of await fs.readdir(coverDir, { withFileTypes: true })) {
    if (entry.isFile() && coverName(entry.name) && !used.has(entry.name)) await fs.unlink(path.join(coverDir, entry.name));
  }
};
const cleanupStaging = async () => {
  const now = Date.now();
  for (const entry of await fs.readdir(stagingDir, { withFileTypes: true })) {
    if (!entry.isFile() || !coverName(entry.name)) continue;
    const file = path.join(stagingDir, entry.name);
    if (now - (await fs.stat(file)).mtimeMs > 60 * 60 * 1000) await fs.unlink(file);
  }
};
let queue = Promise.resolve();
const updateItems = (change) => {
  const job = queue.then(async () => {
    const items = await readItems();
    const result = await change(items);
    const temp = `${dataFile}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(items, null, 2) + '\n', 'utf8');
    await fs.rename(temp, dataFile);
    await cleanupUnusedCovers(items).catch(error => console.warn('Cover cleanup:', error.message));
    return result;
  });
  queue = job.catch(() => {});
  return job;
};
const readConfig = async () => JSON.parse(await fs.readFile(configFile, 'utf8'));
let configQueue = Promise.resolve();
const updateConfig = (change) => {
  const job = configQueue.then(async () => {
    const config = await readConfig();
    const result = await change(config);
    const temp = `${configFile}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(config, null, 2) + '\n', 'utf8');
    await fs.rename(temp, configFile);
    return result;
  });
  configQueue = job.catch(() => {});
  return job;
};
const body = async (req) => {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8 * 1024 * 1024) throw Object.assign(new Error('ไฟล์ใหญ่เกิน 5 MB'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('ข้อมูลไม่ถูกต้อง'), { status: 400 }); }
};
const clean = (raw) => {
  const title = String(raw.title || '').trim();
  const chapter = Number(raw.chapter);
  if (!title || title.length > 160) throw Object.assign(new Error('กรุณาใส่ชื่อเรื่อง'), { status: 400 });
  if (!Number.isInteger(chapter) || chapter < 0 || chapter > 1000000) throw Object.assign(new Error('เลขตอนต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป'), { status: 400 });
  const cover = String(raw.cover || '').trim();
  if (cover && !cover.startsWith('/covers/') && !/^https?:\/\//i.test(cover)) throw Object.assign(new Error('ลิงก์รูปไม่ถูกต้อง'), { status: 400 });
  const sourceUrl = String(raw.sourceUrl || '').trim();
  if (sourceUrl) {
    let parsed;
    try { parsed = new URL(sourceUrl); } catch {}
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || sourceUrl.length > 2048) throw Object.assign(new Error('URL เว็บที่อ่านต้องขึ้นต้นด้วย http:// หรือ https://'), { status: 400 });
  }
  return { title, chapter, cover, sourceUrl, note: String(raw.note || '').trim().slice(0, 500) };
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon' };
const serveFile = async (res, file) => {
  const content = await fs.readFile(file);
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  res.end(content);
};
await cleanupUnusedCovers(await readItems());
await cleanupStaging();
let migratingCovers = false;
async function migrateExistingCovers() {
  if (migratingCovers) return;
  migratingCovers = true;
  try {
    const pending = (await readItems()).filter(item => /^https?:\/\//i.test(item.cover));
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (next < pending.length) {
        const candidate = pending[next++];
        try {
          const { buffer, ext } = await downloadCover(candidate.cover);
          const name = `${createHash('sha256').update(buffer).digest('hex')}.${ext}`;
          await updateItems(async items => {
            const found = items.find(item => item.id === candidate.id);
            if (!found || found.cover !== candidate.cover) return;
            await writeUnique(path.join(coverDir, name), buffer);
            found.cover = `/covers/${name}`;
          });
        } catch (error) { console.warn(`Cover backup failed for ${candidate.title}: ${error.message}`); }
      }
    }));
  } finally { migratingCovers = false; }
}
setImmediate(() => migrateExistingCovers().catch(error => console.warn('Cover migration:', error.message)));
setInterval(() => migrateExistingCovers().catch(error => console.warn('Cover migration:', error.message)), 30 * 60 * 1000).unref();
setInterval(() => cleanupStaging().catch(error => console.warn('Cover staging cleanup:', error.message)), 10 * 60 * 1000).unref();

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/api/config' && req.method === 'GET') {
      return json(res, 200, await readConfig());
    }
    if (pathname === '/api/config' && req.method === 'PUT') {
      const input = await body(req);
      const cardSize = Number(input.cardSize);
      if (!Number.isInteger(cardSize) || cardSize < 130 || cardSize > 240) throw Object.assign(new Error('ขนาดการ์ดต้องอยู่ระหว่าง 130–240'), { status: 400 });
      const config = await updateConfig(config => { config.cardSize = cardSize; return config; });
      return json(res, 200, config);
    }
    if (pathname === '/api/categories' && req.method === 'POST') {
      const input = await body(req);
      const name = String(input.name || '').trim();
      if (!name || name.length > 60) throw Object.assign(new Error('ชื่อหมวดต้องมี 1–60 ตัวอักษร'), { status: 400 });
      const category = await updateConfig(config => {
        if (config.categories.some(entry => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Object.assign(new Error('มีหมวดชื่อนี้แล้ว'), { status: 409 });
        const created = { id: randomUUID(), name };
        config.categories.push(created);
        return created;
      });
      return json(res, 201, category);
    }
    if (pathname === '/api/categories/order' && req.method === 'PUT') {
      const input = await body(req);
      const ids = input.ids;
      await updateConfig(config => {
        const byId = new Map(config.categories.map(category => [category.id, category]));
        if (!Array.isArray(ids) || ids[0] !== 'main' || ids.length !== config.categories.length || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) {
          throw Object.assign(new Error('ลำดับหมวดไม่ถูกต้อง'), { status: 400 });
        }
        config.categories = ids.map(id => byId.get(id));
      });
      return json(res, 200, { ok: true });
    }
    const categoryMatch = pathname.match(/^\/api\/categories\/(main|[a-f0-9-]+)$/);
    if (categoryMatch && req.method === 'PATCH') {
      const name = String((await body(req)).name || '').trim();
      if (!name || name.length > 60) throw Object.assign(new Error('ชื่อหมวดต้องมี 1–60 ตัวอักษร'), { status: 400 });
      const category = await updateConfig(config => {
        const found = config.categories.find(entry => entry.id === categoryMatch[1]);
        if (!found) throw Object.assign(new Error('ไม่พบหมวดนี้'), { status: 404 });
        if (config.categories.some(entry => entry.id !== found.id && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Object.assign(new Error('มีหมวดชื่อนี้แล้ว'), { status: 409 });
        found.name = name;
        return found;
      });
      return json(res, 200, category);
    }
    if (categoryMatch && req.method === 'DELETE') {
      const categoryId = categoryMatch[1];
      if (categoryId === 'main') throw Object.assign(new Error('ลบหมวดหลักไม่ได้'), { status: 400 });
      const config = await readConfig();
      if (!config.categories.some(entry => entry.id === categoryId)) throw Object.assign(new Error('ไม่พบหมวดนี้'), { status: 404 });
      await updateItems(items => { for (const item of items) if (item.categoryId === categoryId) item.categoryId = 'main'; });
      await updateConfig(config => { config.categories = config.categories.filter(entry => entry.id !== categoryId); });
      return json(res, 200, { ok: true });
    }
    if (pathname === '/api/manga' && req.method === 'GET') return json(res, 200, await readItems());
    if (pathname === '/api/manga' && req.method === 'POST') {
      const raw = await body(req);
      const input = clean(raw);
      const categoryId = String(raw.categoryId || 'main');
      const config = await readConfig();
      if (!config.categories.some(category => category.id === categoryId)) throw Object.assign(new Error('ไม่พบหมวดนี้'), { status: 400 });
      const item = { id: randomUUID(), ...input, categoryId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await updateItems(async items => { item.cover = await managedCover(item.cover); items.push(item); });
      return json(res, 201, item);
    }
    if (pathname === '/api/manga/order' && req.method === 'PUT') {
      const input = await body(req);
      const ids = input.ids;
      if (!Array.isArray(ids)) throw Object.assign(new Error('ลำดับมังงะไม่ถูกต้อง'), { status: 400 });
      await updateItems(items => {
        const byId = new Map(items.map(item => [item.id, item]));
        if (ids.length !== items.length || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) {
          throw Object.assign(new Error('รายการมังงะเปลี่ยนไป กรุณาลองใหม่'), { status: 409 });
        }
        items.splice(0, items.length, ...ids.map(id => byId.get(id)));
      });
      return json(res, 200, { ok: true });
    }
    if (pathname === '/api/manga/layout' && req.method === 'PUT') {
      const input = await body(req);
      const placements = input.placements;
      const config = await readConfig();
      const categoryIds = new Set(config.categories.map(category => category.id));
      if (!Array.isArray(placements) || placements.some(entry => !entry || typeof entry.id !== 'string' || !categoryIds.has(entry.categoryId))) {
        throw Object.assign(new Error('ตำแหน่งมังงะไม่ถูกต้อง'), { status: 400 });
      }
      await updateItems(items => {
        const byId = new Map(items.map(item => [item.id, item]));
        const ids = placements.map(entry => entry.id);
        if (ids.length !== items.length || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) {
          throw Object.assign(new Error('รายการมังงะเปลี่ยนไป กรุณาลองใหม่'), { status: 409 });
        }
        items.splice(0, items.length, ...placements.map(entry => Object.assign(byId.get(entry.id), { categoryId: entry.categoryId })));
      });
      return json(res, 200, { ok: true });
    }
    const match = pathname.match(/^\/api\/manga\/([a-f0-9-]+)$/);
    if (match && req.method === 'PATCH') {
      const input = await body(req);
      const item = await updateItems(async items => {
        const found = items.find(x => x.id === match[1]);
        if (!found) throw Object.assign(new Error('ไม่พบเรื่องนี้'), { status: 404 });
        const changed = clean({ ...found, ...input });
        if (changed.cover !== found.cover) changed.cover = await managedCover(changed.cover);
        Object.assign(found, changed, { updatedAt: new Date().toISOString() });
        return found;
      });
      return json(res, 200, item);
    }
    if (match && req.method === 'DELETE') {
      await updateItems(items => {
        const index = items.findIndex(x => x.id === match[1]);
        if (index < 0) throw Object.assign(new Error('ไม่พบเรื่องนี้'), { status: 404 });
        items.splice(index, 1);
      });
      return json(res, 200, { ok: true });
    }
    if (pathname === '/api/cover' && req.method === 'POST') {
      const input = await body(req);
      const matchImage = String(input.image || '').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!matchImage) throw Object.assign(new Error('รองรับรูป PNG, JPG, WebP'), { status: 400 });
      const buffer = Buffer.from(matchImage[2], 'base64');
      if (buffer.length > 5 * 1024 * 1024) throw Object.assign(new Error('ไฟล์ใหญ่เกิน 5 MB'), { status: 413 });
      const ext = imageType(buffer);
      if (!ext || !['png', 'jpg', 'webp'].includes(ext)) throw Object.assign(new Error('ไฟล์รูปปกไม่ถูกต้อง'), { status: 400 });
      const name = `${createHash('sha256').update(buffer).digest('hex')}.${ext}`;
      await writeUnique(path.join(stagingDir, name), buffer);
      return json(res, 201, { cover: `/covers/${name}` });
    }
    if (pathname.startsWith('/covers/') && req.method === 'GET') {
      const name = pathname.slice(8);
      if (!coverName(name)) return json(res, 404, { error: 'ไม่พบรูป' });
      try { return await serveFile(res, path.join(coverDir, name)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; return await serveFile(res, path.join(stagingDir, name)); }
    }
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      const file = path.resolve(distDir, `.${pathname}`);
      if (file.startsWith(distDir + path.sep)) {
        try { return await serveFile(res, file); } catch {}
      }
      return await serveFile(res, path.join(distDir, 'index.html'));
    }
    json(res, 404, { error: 'ไม่พบหน้าที่ต้องการ' });
  } catch (error) {
    console.error(error);
    json(res, error.status || (error.code === 'ENOENT' ? 404 : 500), { error: error.status ? error.message : 'เกิดข้อผิดพลาด ลองอีกครั้ง' });
  }
}).listen(port, '127.0.0.1', () => console.log(`Manga Shelf API: http://127.0.0.1:${port}`));
