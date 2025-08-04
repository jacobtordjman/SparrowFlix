import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const tg = window.Telegram?.WebApp;
if (tg?.initData && !localStorage.getItem('tg-auth')) {
  localStorage.setItem('tg-auth', tg.initData);
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
