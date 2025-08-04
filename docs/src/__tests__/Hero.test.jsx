import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { test, expect } from 'vitest';
import Hero from '../components/Hero.jsx';

test('renders hero with title and play button', () => {
  const movie = { id: 1, title: 'Test', poster: 'poster.jpg' };
  render(
    <BrowserRouter>
      <Hero movie={movie} />
    </BrowserRouter>
  );
  expect(screen.getByText('Test')).toBeInTheDocument();
  expect(screen.getByText('Play')).toBeInTheDocument();
});
