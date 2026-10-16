import { render, screen } from '@testing-library/react';
import App from './App';

test('renders personal info step', () => {
  render(<App />);
  expect(screen.getByText(/personal info/i)).toBeInTheDocument();
});
