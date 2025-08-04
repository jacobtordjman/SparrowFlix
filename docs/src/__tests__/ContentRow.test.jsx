import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { test, expect } from 'vitest';
import ContentRow from '../components/ContentRow.jsx';

test('renders content row title and item', () => {
  const items = [{ id: 1, title: 'Movie', poster: 'poster.jpg' }];
  render(
    <BrowserRouter>
      <ContentRow title="Row" items={items} />
    </BrowserRouter>
  );
  expect(screen.getByText('Row')).toBeInTheDocument();
  expect(screen.getByAltText('Movie')).toBeInTheDocument();
});
