/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import * as express from 'express';

import scraper from './scraper';

const app = express();

scraper();

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to policeone-scraper!' });
});

const server = app.listen(0, () => {
  console.log(`Listening at http://localhost:${server.address().port}/api`);
});
server.on('error', console.error);
