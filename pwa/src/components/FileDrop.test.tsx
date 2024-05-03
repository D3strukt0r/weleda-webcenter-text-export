import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import FileDrop from './FileDrop';

describe('FileDrop', () => {
  test('renders drop field', () => {
    render(<FileDrop />);
    expect(screen.getByText(/upload.clickOrDrag/i)).toBeDefined();
  });
});
