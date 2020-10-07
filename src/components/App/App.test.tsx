import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders drop field', () => {
  const { getByText } = render(<App />);
  const textElement = getByText(/Click or drag the XML file to this area to upload./i);
  expect(textElement).toBeInTheDocument();
});
