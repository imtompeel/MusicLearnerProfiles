import { AppRouter } from './components/AppRouter';
import './App.css';

/**
 * Main App component - now much simpler and modular
 * Delegates routing to AppRouter component
 */
function App() {
  return <AppRouter />;
}

export default App;