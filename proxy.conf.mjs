// Dev only: `API_TARGET=http://host:3000 npm start` points ng serve at another API.
export default {
  '/feature-voting': {
    target: process.env.API_TARGET ?? 'http://localhost:3000',
    secure: false,
  },
};
