
import app from './app.js';
import { createLogger } from './logger.js';

const log = createLogger('server');
const PORT = process.env.PORT || 34567;

const server = app.listen(PORT, () => {
  log.info(`Server ready on port ${PORT}`);
});

process.on('SIGTERM', () => {
  log.info('SIGTERM signal received');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log.info('SIGINT signal received');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

export default app;
