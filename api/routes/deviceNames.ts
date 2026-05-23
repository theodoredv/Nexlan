import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../logger.js';

const log = createLogger('device-names');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

const router = express.Router();

const dataDir = path.join(projectRoot, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const deviceNamesPath = path.join(dataDir, 'deviceNames.json');

interface DeviceNames {
  [deviceId: string]: string;
}

let deviceNames: DeviceNames = {};

function loadDeviceNames() {
  if (fs.existsSync(deviceNamesPath)) {
    try {
      const data = fs.readFileSync(deviceNamesPath, 'utf-8');
      deviceNames = JSON.parse(data);
      log.info(`Loaded ${Object.keys(deviceNames).length} device names from disk`);
    } catch (error) {
      log.error('Failed to load device names:', error);
      deviceNames = {};
    }
  }
}

function saveDeviceNames() {
  try {
    fs.writeFileSync(deviceNamesPath, JSON.stringify(deviceNames, null, 2));
  } catch (error) {
    log.error('Failed to save device names:', error);
  }
}

loadDeviceNames();

router.get('/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const name = deviceNames[deviceId];
  if (name) {
    res.json({ deviceId, name });
  } else {
    const defaultName = 'Device-' + Math.floor(Math.random() * 1000);
    deviceNames[deviceId] = defaultName;
    saveDeviceNames();
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

  const oldName = deviceNames[deviceId];
  deviceNames[deviceId] = name;
  saveDeviceNames();

  log.info(`Device renamed: ${deviceId} (${oldName} -> ${name})`);
  res.json({ deviceId, name, oldName });
});

export { router, deviceNames };
