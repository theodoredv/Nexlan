import express from 'express';
import { createLogger } from '../logger.js';
import { db } from '../database.js';

const log = createLogger('device-names');

const router = express.Router();

interface DeviceNames {
  [deviceId: string]: string;
}

let deviceNames: DeviceNames = {};

function loadDeviceNames() {
  try {
    const rows = db.prepare('SELECT device_id, name FROM device_names').all() as Array<{
      device_id: string;
      name: string;
    }>;
    for (const row of rows) {
      deviceNames[row.device_id] = row.name;
    }
    log.info(`Loaded ${Object.keys(deviceNames).length} device names from database`);
  } catch (error) {
    log.error('Failed to load device names:', error);
    deviceNames = {};
  }
}

const upsertStmt = db.prepare('INSERT INTO device_names (device_id, name) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET name = excluded.name');

loadDeviceNames();

router.get('/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const name = deviceNames[deviceId];
  if (name) {
    res.json({ deviceId, name });
  } else {
    const defaultName = 'Device-' + Math.floor(Math.random() * 1000);
    deviceNames[deviceId] = defaultName;
    try {
      upsertStmt.run(deviceId, defaultName);
    } catch (error) {
      log.error('Failed to save device name:', error);
    }
    log.info(`New device registered: ${deviceId} -> ${defaultName}`);
    res.json({ deviceId, name: defaultName });
  }
});

router.post('/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (name.length > 50) {
    return res.status(400).json({ error: 'Name must be 50 characters or less' });
  }
  if (!name.trim()) {
    return res.status(400).json({ error: 'Name cannot be whitespace-only' });
  }

  const oldName = deviceNames[deviceId];
  deviceNames[deviceId] = name;
  try {
    upsertStmt.run(deviceId, name);
  } catch (error) {
    log.error('Failed to update device name:', error);
  }

  log.info(`Device renamed: ${deviceId} (${oldName} -> ${name})`);
  res.json({ deviceId, name, oldName });
});

export { router, deviceNames };
