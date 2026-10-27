import { BrowserRouter } from 'react-router';
import { AppRoutes } from './AppRoutes';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
