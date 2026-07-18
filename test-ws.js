const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:4010/ws');

ws.on('open', () => {
  console.log('WS connection opened successfully!');
});

ws.on('message', (data) => {
  console.log('Received message from server:', data.toString());
  ws.close();
});

ws.on('error', (err) => {
  console.error('WS connection failed:', err);
});

ws.on('close', () => {
  console.log('WS connection closed.');
});
