import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { test, expect } from 'vitest';
import Header from '../components/Header.jsx';

test('renders brand name', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  root.render(
    <BrowserRouter>
      <Header />
    </BrowserRouter>
  );
  expect(container.textContent).toContain('SparrowFlix');
});
