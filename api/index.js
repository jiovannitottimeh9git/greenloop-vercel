const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../lib/db');
const auth = require('../lib/auth');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});
const parseMultipart = (req, res, next) => {
  if (req.is('multipart/form-data')) return upload.any()(req, res, next);
  next();
};

const VIEWS = path.join(__dirname, '..', 'views');
const PUBLIC = path.join(__dirname, '..', 'public');

function csrfToken(req, res) {
  let token = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('gl_csrf='));
  token = token ? decodeURIComponent(token.slice('gl_csrf='.length)) : null;
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    const existing = (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c && !c.startsWith('gl_csrf='));
    const secure = req.get('x-forwarded-proto') === 'https' || process.env.VERCEL || process.env.NODE_ENV === 'production';
    const cookies = existing.concat(`gl_csrf=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`);
    res.setHeader('Set-Cookie', cookies);
  }
  return token;
}

function checkCsrf(req, res) {
  const header = req.get('X-CSRF-Token') || '';
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('gl_csrf='));
  const expected = cookie ? decodeURIComponent(cookie.slice('gl_csrf='.length)) : '';
  if (!header || header !== expected) {
    res.status(419).json({ success: false, message: 'Security token expired. Refresh the page and try again.' });
    return false;
  }
  return true;
}

function send(res, data, status = 200) {
  res.status(status).json(data);
}

function str(value, max = 255) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ref(prefix) {
  return `${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function renderPage(res, name, req, extra = {}) {
  const file = path.join(VIEWS, `${name}.html`);
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch {
    return res.status(500).send('Page template missing.');
  }
  const user = auth.readSession(req);
  const token = csrfToken(req, res);
  const values = {
    CSRF: token,
    NAME: user ? String(user.name || '').split(' ')[0] : '',
    FULLNAME: user ? user.name || '' : '',
    DATE: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    NEXT: req.query.next === 'admin-create-account.php' ? 'admin-create-account.php' : 'admin.php',
    ...extra
  };
  const RAW_KEYS = new Set(['SETUP_FORM']);
  html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in values)) return match;
    const value = String(values[key]);
    if (RAW_KEYS.has(key)) return value;
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// ---------- Page routes ----------
app.get('/', (req, res) => renderPage(res, 'index', req));
app.get('/index.php', (req, res) => renderPage(res, 'index', req));
app.get('/track.php', (req, res) => renderPage(res, 'track', req));
app.get('/report.php', (req, res) => renderPage(res, 'report', req));
app.get('/marketplace.php', (req, res) => renderPage(res, 'marketplace', req));

app.get('/admin-login.php', (req, res) => renderPage(res, 'admin-login', req));
app.get('/driver-login.php', (req, res) => renderPage(res, 'driver-login', req));

app.get('/admin.php', (req, res) => {
  const user = auth.readSession(req);
  if (!user || user.role !== 'admin') return res.redirect('/admin-login.php');
  renderPage(res, 'admin', req);
});

app.get('/driver.php', (req, res) => {
  const user = auth.readSession(req);
  if (!user || user.role !== 'driver') return res.redirect('/driver-login.php');
  renderPage(res, 'driver', req);
});

app.get('/admin-create-account.php', (req, res) => {
  const user = auth.readSession(req);
  if (!user || user.role !== 'admin') return res.redirect('/admin-login.php?next=admin-create-account.php');
  renderPage(res, 'admin-create-account', req);
});

app.get('/setup-admin.php', async (req, res) => {
  try {
    const row = await db.one('SELECT COUNT(*)::int AS count FROM administrators');
    const count = row ? row.count : 0;
    renderPage(res, 'setup-admin', req, {
      SETUP_FORM: count === 0
        ? '<label>Full name<input name="full_name" required></label><label>Username<input name="username" required></label><label>Password (10+ characters)<input name="password" type="password" minlength="10" required></label><input type="hidden" name="csrf" id="setupCsrf"><button class="btn btn-primary submit-btn">Create administrator</button>'
        : '<p>An administrator account already exists.</p>'
    });
  } catch {
    renderPage(res, 'setup-admin', req, { SETUP_FORM: '<p>Database is not available yet.</p>' });
  }
});

// ---------- Static assets ----------
app.use(express.static(PUBLIC, { index: false, fallthrough: true }));

// ---------- API ----------
app.all('/api.php', parseMultipart, async (req, res) => {
  const action = req.query.action || req.body?.action || '';
  const method = req.method;

  try {
    if (action === 'csrf' && method === 'GET') {
      return send(res, { success: true, csrf: csrfToken(req, res) });
    }

    if (action === 'me' && method === 'GET') {
      return send(res, { success: true, user: auth.readSession(req) });
    }

    if (method === 'POST' && !checkCsrf(req, res)) return;

    // Initial administrator setup (only when no admins exist)
    if (action === 'setup_admin' && method === 'POST') {
      const row = await db.one('SELECT COUNT(*)::int AS count FROM administrators');
      if (row && row.count > 0) {
        return send(res, { success: false, message: 'An administrator already exists.' }, 409);
      }
      const name = str(req.body.full_name, 120);
      const username = str(req.body.username, 80);
      const password = String(req.body.password || '');
      if (name.length < 2 || username.length < 4 || password.length < 10) {
        return send(res, { success: false, message: 'Enter a name, a username of at least 4 characters and a password of at least 10 characters.' }, 422);
      }
      try {
        await db.query(
          'INSERT INTO administrators (username, full_name, password_hash) VALUES ($1,$2,$3)',
          [username, name, auth.hashPassword(password)]
        );
      } catch (err) {
        if (err.code === '23505') return send(res, { success: false, message: 'That username is already in use.' }, 409);
        throw err;
      }
      return send(res, { success: true, message: 'Administrator created. Delete setup-admin.php now, then sign in.' });
    }

    if (action === 'create_request' && method === 'POST') {
      const name = str(req.body.name, 120);
      const phone = str(req.body.phone, 30);
      const region = str(req.body.region, 80);
      let address = str(req.body.address, 255);
      const category = str(req.body.category, 60);
      const quantity = str(req.body.quantity, 80);
      const date = String(req.body.preferred_date || '');
      const time = str(req.body.preferred_time, 40);
      const lat = num(req.body.latitude);
      const lng = num(req.body.longitude);
      const notes = str(req.body.notes, 1000);
      const allowed = ['Plastic', 'Paper', 'Organic waste', 'Metal', 'Glass', 'Electronic waste', 'General waste'];
      if (!name || !phone || !region || !allowed.includes(category)) {
        return send(res, { success: false, message: 'Please provide your name, phone, region and waste category.' }, 422);
      }
      if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return send(res, { success: false, message: 'Choose a pickup location on the map or add your current GPS location.' }, 422);
      }
      if (!address) address = `Pinned map location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return send(res, { success: false, message: 'Please provide a valid preferred date.' }, 422);
      }
      const reference = ref('WW');
      await db.query(
        `INSERT INTO collection_requests
         (reference_code, customer_name, phone, region, address, waste_category, estimated_quantity,
          preferred_date, preferred_time, customer_latitude, customer_longitude, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending')`,
        [reference, name, phone, region, address, category, quantity || null,
          date || null, time || null, lat, lng, notes || null]
      );
      return send(res, { success: true, message: 'Your collection request has been received.', reference });
    }

    if (action === 'track' && method === 'GET') {
      const reference = str(req.query.reference, 40);
      const phone = str(req.query.phone, 30);
      if (!reference || !phone) return send(res, { success: false, message: 'Enter your reference number and phone number.' }, 422);
      const request = await db.one(
        `SELECT id, reference_code, customer_name, region, address, waste_category, preferred_date,
         preferred_time, status, assigned_vehicle_id FROM collection_requests
         WHERE reference_code=$1 AND phone=$2 LIMIT 1`,
        [reference, phone]
      );
      if (!request) return send(res, { success: false, message: 'No matching collection was found. Check your details.' }, 404);
      let vehicle = null;
      let location = null;
      if (request.assigned_vehicle_id) {
        vehicle = await db.one('SELECT registration_number, vehicle_type FROM vehicles WHERE id=$1', [request.assigned_vehicle_id]);
        location = await db.one(
          `SELECT latitude, longitude, accuracy, recorded_at FROM vehicle_locations
           WHERE vehicle_id=$1 ORDER BY recorded_at DESC LIMIT 1`,
          [request.assigned_vehicle_id]
        );
        if (location) {
          location.latitude = num(location.latitude);
          location.longitude = num(location.longitude);
        }
      }
      return send(res, { success: true, request, vehicle, location });
    }

    if (action === 'report' && method === 'POST') {
      const name = str(req.body.name, 120);
      const phone = str(req.body.phone, 30);
      const location = str(req.body.location, 255);
      const category = str(req.body.category, 60);
      const description = str(req.body.description, 1500);
      if (!name || !phone || !location || !category || !description) {
        return send(res, { success: false, message: 'Complete all required fields.' }, 422);
      }
      let evidenceData = null;
      let evidenceMime = null;
      const file = (req.files || []).find((f) => f.fieldname === 'evidence');
      if (file && file.size > 0) {
        const allowed = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
        if (!allowed[file.mimetype]) {
          return send(res, { success: false, message: 'Upload a JPG, PNG or WEBP image.' }, 422);
        }
        evidenceMime = file.mimetype;
        evidenceData = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      }
      const reference = ref('WR');
      await db.query(
        `INSERT INTO environmental_reports
         (reference_code, reporter_name, phone, location, category, description, evidence_data, evidence_mime)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [reference, name, phone, location, category, description, evidenceData, evidenceMime]
      );
      return send(res, { success: true, message: 'Thank you. Your environmental report has been submitted.', reference });
    }

    if (action === 'create_listing' && method === 'POST') {
      const name = str(req.body.name, 120);
      const phone = str(req.body.phone, 30);
      const material = str(req.body.material, 60);
      const qty = num(req.body.quantity);
      const unit = str(req.body.unit || 'kg', 20);
      const location = str(req.body.location, 180);
      const description = str(req.body.description, 1000);
      if (!name || !phone || !material || !qty || qty <= 0 || !location) {
        return send(res, { success: false, message: 'Enter valid listing details.' }, 422);
      }
      await db.query(
        `INSERT INTO recycling_listings (seller_name, phone, material, quantity, unit, location, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [name, phone, material, qty, unit, location, description || null]
      );
      return send(res, { success: true, message: 'Your recyclable material listing has been submitted for review.' });
    }

    if (action === 'login' && method === 'POST') {
      const role = str(req.body.role, 20);
      const username = str(req.body.username, 120);
      const password = String(req.body.password || '');
      if (!['admin', 'driver'].includes(role)) return send(res, { success: false, message: 'Invalid login type.' }, 422);
      const table = role === 'admin' ? 'administrators' : 'drivers';
      const field = role === 'admin' ? 'username' : 'email';
      const user = await db.one(
        `SELECT id, ${field} AS login_name, full_name, password_hash, status FROM ${table} WHERE ${field}=$1 LIMIT 1`,
        [username]
      );
      if (!user || !auth.verifyPassword(password, user.password_hash) || user.status !== 'Active') {
        return send(res, { success: false, message: 'Incorrect login details or inactive account.' }, 401);
      }
      const session = { id: Number(user.id), name: user.full_name, role };
      auth.setSessionCookie(res, session);
      const next = String(req.body.next || '');
      const redirect = role === 'admin' && next === 'admin-create-account.php'
        ? 'admin-create-account.php'
        : (role === 'admin' ? 'admin.php' : 'driver.php');
      return send(res, { success: true, redirect });
    }

    if (action === 'logout' && method === 'POST') {
      auth.clearSessionCookie(res);
      return send(res, { success: true });
    }

    if (action === 'driver_assignments' && method === 'GET') {
      const user = auth.requireRole(req, res, 'driver');
      if (!user) return;
      const assignments = await db.many(
        `SELECT va.id, cr.id AS request_id, cr.reference_code, cr.customer_name, cr.phone, cr.region,
         cr.address, cr.waste_category, cr.preferred_date, cr.preferred_time, cr.status,
         v.id AS vehicle_id, v.registration_number
         FROM vehicle_assignments va
         JOIN collection_requests cr ON cr.id = va.collection_request_id
         JOIN vehicles v ON v.id = va.vehicle_id
         WHERE va.driver_id=$1 AND va.active=TRUE ORDER BY cr.created_at DESC`,
        [user.id]
      );
      return send(res, { success: true, assignments });
    }

    if (action === 'driver_start' && method === 'POST') {
      const user = auth.requireRole(req, res, 'driver');
      if (!user) return;
      const assignment = Number(req.body.assignment_id) || 0;
      const a = await db.one(
        `SELECT va.id, va.vehicle_id, cr.id AS request_id FROM vehicle_assignments va
         JOIN collection_requests cr ON cr.id=va.collection_request_id
         WHERE va.id=$1 AND va.driver_id=$2 AND va.active=TRUE`,
        [assignment, user.id]
      );
      if (!a) return send(res, { success: false, message: 'Assignment not found.' }, 404);
      await db.query("UPDATE collection_requests SET status='Driver En Route', updated_at=NOW() WHERE id=$1", [a.request_id]);
      await db.query('UPDATE vehicle_assignments SET started_at=NOW() WHERE id=$1', [assignment]);
      return send(res, { success: true, vehicle_id: Number(a.vehicle_id) });
    }

    if (action === 'location_update' && method === 'POST') {
      const user = auth.requireRole(req, res, 'driver');
      if (!user) return;
      const assignment = Number(req.body.assignment_id) || 0;
      const latitude = num(req.body.latitude);
      const longitude = num(req.body.longitude);
      const accuracy = num(req.body.accuracy);
      if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return send(res, { success: false, message: 'Invalid GPS coordinates.' }, 422);
      }
      const a = await db.one(
        'SELECT vehicle_id FROM vehicle_assignments WHERE id=$1 AND driver_id=$2 AND active=TRUE',
        [assignment, user.id]
      );
      if (!a) return send(res, { success: false, message: 'No active assignment found.' }, 403);
      await db.query(
        `INSERT INTO vehicle_locations (vehicle_id, driver_id, assignment_id, latitude, longitude, accuracy)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [a.vehicle_id, user.id, assignment, latitude, longitude, accuracy]
      );
      await db.query("UPDATE vehicles SET status='Active' WHERE id=$1", [a.vehicle_id]);
      return send(res, { success: true, message: 'Location updated.' });
    }

    if (action === 'driver_complete' && method === 'POST') {
      const user = auth.requireRole(req, res, 'driver');
      if (!user) return;
      const assignment = Number(req.body.assignment_id) || 0;
      const a = await db.one(
        `SELECT va.id, va.vehicle_id, cr.id AS request_id FROM vehicle_assignments va
         JOIN collection_requests cr ON cr.id=va.collection_request_id
         WHERE va.id=$1 AND va.driver_id=$2 AND va.active=TRUE`,
        [assignment, user.id]
      );
      if (!a) return send(res, { success: false, message: 'Assignment not found.' }, 404);
      await db.query("UPDATE collection_requests SET status='Completed', updated_at=NOW() WHERE id=$1", [a.request_id]);
      await db.query('UPDATE vehicle_assignments SET active=FALSE, completed_at=NOW() WHERE id=$1', [assignment]);
      await db.query("UPDATE vehicles SET status='Available' WHERE id=$1", [a.vehicle_id]);
      return send(res, { success: true, message: 'Pickup completed.' });
    }

    if (action === 'admin_drivers' && method === 'GET') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const drivers = await db.many(
        `SELECT d.id, d.full_name, d.email, d.phone, d.licence_number, d.status, d.created_at,
         (SELECT COUNT(*)::int FROM vehicle_assignments va WHERE va.driver_id=d.id AND va.active=TRUE) AS active_assignments
         FROM drivers d ORDER BY d.created_at DESC`
      );
      return send(res, { success: true, drivers });
    }

    if (action === 'admin_create_admin' && method === 'POST') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const name = str(req.body.full_name, 120);
      const username = str(req.body.username, 80);
      const password = String(req.body.password || '');
      const confirm = String(req.body.confirm_password || '');
      if (name.length < 2 || username.length < 4 || password.length < 10) {
        return send(res, { success: false, message: 'Enter a name, a username of at least 4 characters and a password of at least 10 characters.' }, 422);
      }
      if (password !== confirm) return send(res, { success: false, message: 'The passwords do not match.' }, 422);
      try {
        await db.query('INSERT INTO administrators (username, full_name, password_hash) VALUES ($1,$2,$3)',
          [username, name, auth.hashPassword(password)]);
      } catch (err) {
        if (err.code === '23505') return send(res, { success: false, message: 'That username is already in use.' }, 409);
        throw err;
      }
      return send(res, { success: true, message: 'Admin account created successfully.' });
    }

    if (action === 'admin_create_driver' && method === 'POST') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const name = str(req.body.full_name, 120);
      const email = str(req.body.email, 160).toLowerCase();
      const phone = str(req.body.phone, 30);
      const licence = str(req.body.licence_number, 80);
      const password = String(req.body.password || '');
      if (!name || !phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
        return send(res, { success: false, message: 'Enter a name, valid email, phone number and password of at least 8 characters.' }, 422);
      }
      let row;
      try {
        row = await db.one(
          `INSERT INTO drivers (full_name, email, phone, licence_number, password_hash, status)
           VALUES ($1,$2,$3,$4,$5,'Active') RETURNING id`,
          [name, email, phone, licence || null, auth.hashPassword(password)]
        );
      } catch (err) {
        if (err.code === '23505') return send(res, { success: false, message: 'A driver with that email address already exists.' }, 409);
        throw err;
      }
      return send(res, { success: true, message: 'Driver account created successfully. The driver can now sign in using their email and password.', driver_id: Number(row.id) });
    }

    if (action === 'admin_toggle_driver' && method === 'POST') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const driver = Number(req.body.driver_id) || 0;
      const record = await db.one('SELECT id, status FROM drivers WHERE id=$1 LIMIT 1', [driver]);
      if (!record) return send(res, { success: false, message: 'Driver account not found.' }, 404);
      const active = await db.one('SELECT COUNT(*)::int AS count FROM vehicle_assignments WHERE driver_id=$1 AND active=TRUE', [driver]);
      if (active && active.count > 0) {
        return send(res, { success: false, message: 'This driver has an active collection assignment. Complete or reassign it before deactivating the account.' }, 409);
      }
      const newStatus = record.status === 'Active' ? 'Inactive' : 'Active';
      await db.query('UPDATE drivers SET status=$1 WHERE id=$2', [newStatus, driver]);
      return send(res, { success: true, message: `Driver account is now ${newStatus}.`, status: newStatus });
    }

    if (action === 'admin_vehicles' && method === 'GET') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const vehicles = await db.many(
        `SELECT v.id, v.registration_number, v.vehicle_type, v.vehicle_model, v.capacity, v.status,
         d.full_name AS driver_name FROM vehicles v LEFT JOIN drivers d ON d.id=v.assigned_driver_id
         ORDER BY v.created_at DESC`
      );
      return send(res, { success: true, vehicles });
    }

    if (action === 'admin_create_vehicle' && method === 'POST') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const registration = str(req.body.registration_number, 40).toUpperCase();
      const type = str(req.body.vehicle_type, 80);
      const model = str(req.body.vehicle_model, 100);
      const capacity = str(req.body.capacity, 60);
      if (!registration || !type) {
        return send(res, { success: false, message: 'Enter the vehicle registration number and vehicle type.' }, 422);
      }
      let row;
      try {
        row = await db.one(
          `INSERT INTO vehicles (registration_number, vehicle_type, vehicle_model, capacity, status)
           VALUES ($1,$2,$3,$4,'Available') RETURNING id`,
          [registration, type, model || null, capacity || null]
        );
      } catch (err) {
        if (err.code === '23505') return send(res, { success: false, message: 'A vehicle with this registration number is already registered.' }, 409);
        throw err;
      }
      return send(res, { success: true, message: 'Vehicle registered successfully. It is now available for assignment.', vehicle_id: Number(row.id) });
    }

    if (action === 'admin_data' && method === 'GET') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const getCount = async (sql) => {
        const r = await db.one(sql);
        return Number(r?.count || 0);
      };
      const stats = {
        requests: await getCount('SELECT COUNT(*)::int AS count FROM collection_requests'),
        pending: await getCount("SELECT COUNT(*)::int AS count FROM collection_requests WHERE status='Pending'"),
        completed: await getCount("SELECT COUNT(*)::int AS count FROM collection_requests WHERE status='Completed'"),
        drivers: await getCount("SELECT COUNT(*)::int AS count FROM drivers WHERE status='Active'"),
        vehicles: await getCount('SELECT COUNT(*)::int AS count FROM vehicles'),
        reports: await getCount("SELECT COUNT(*)::int AS count FROM environmental_reports WHERE status NOT IN ('Resolved','Rejected')")
      };
      const requests = await db.many(
        'SELECT id, reference_code, customer_name, phone, region, waste_category, status, created_at FROM collection_requests ORDER BY created_at DESC LIMIT 12'
      );
      const vehicles = await db.many(
        `SELECT v.id, v.registration_number, v.vehicle_type, v.status, vl.latitude, vl.longitude, vl.recorded_at,
         d.full_name AS driver_name FROM vehicles v
         LEFT JOIN drivers d ON d.id=v.assigned_driver_id
         LEFT JOIN vehicle_locations vl ON vl.id=(SELECT v2.id FROM vehicle_locations v2 WHERE v2.vehicle_id=v.id ORDER BY v2.recorded_at DESC LIMIT 1)
         WHERE v.status='Active'`
      );
      vehicles.forEach((v) => {
        v.latitude = v.latitude == null ? null : num(v.latitude);
        v.longitude = v.longitude == null ? null : num(v.longitude);
      });
      return send(res, { success: true, stats, requests, vehicles });
    }

    if (action === 'admin_assign' && method === 'POST') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const request = Number(req.body.request_id) || 0;
      const driver = Number(req.body.driver_id) || 0;
      const vehicle = Number(req.body.vehicle_id) || 0;
      if (!await db.one('SELECT id FROM collection_requests WHERE id=$1', [request])) {
        return send(res, { success: false, message: 'Collection request not found.' }, 404);
      }
      if (!await db.one("SELECT id FROM drivers WHERE id=$1 AND status='Active'", [driver])) {
        return send(res, { success: false, message: 'Choose an active driver.' }, 422);
      }
      if (!await db.one("SELECT id FROM vehicles WHERE id=$1 AND status IN ('Available','Assigned')", [vehicle])) {
        return send(res, { success: false, message: 'Vehicle is not available.' }, 422);
      }
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO vehicle_assignments (collection_request_id, vehicle_id, driver_id) VALUES ($1,$2,$3)', [request, vehicle, driver]);
        await client.query("UPDATE collection_requests SET assigned_vehicle_id=$1, status='Assigned', updated_at=NOW() WHERE id=$2", [vehicle, request]);
        await client.query("UPDATE vehicles SET assigned_driver_id=$1, status='Assigned' WHERE id=$2", [driver, vehicle]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return send(res, { success: true, message: 'Driver and vehicle assigned successfully.' });
    }

    if (action === 'admin_options' && method === 'GET') {
      if (!auth.requireRole(req, res, 'admin')) return;
      const drivers = await db.many("SELECT id, full_name FROM drivers WHERE status='Active' ORDER BY full_name");
      const vehicles = await db.many("SELECT id, registration_number FROM vehicles WHERE status IN ('Available','Assigned') ORDER BY registration_number");
      const requests = await db.many("SELECT id, reference_code, customer_name FROM collection_requests WHERE status IN ('Pending','Approved') ORDER BY created_at DESC");
      return send(res, { success: true, drivers, vehicles, requests });
    }

    return send(res, { success: false, message: 'Unknown action.' }, 404);
  } catch (err) {
    console.error('API error:', err);
    return send(res, { success: false, message: 'A server error occurred. Check the server logs and database connection.' }, 500);
  }
});

// Export for Vercel, or listen locally
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`GreenLoop listening on http://localhost:${port}`));
}

module.exports = app;
