import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { test, expect } from 'vitest';
import Header from '../components/Header.jsx';

test('renders brand name', () => {
  render(
    <BrowserRouter>
      <Header />
    </BrowserRouter>
  );
  expect(screen.getByText('SparrowFlix')).toBeInTheDocument();
});
