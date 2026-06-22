import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode is intentionally omitted: react-rnd uses legacy class components
// (react-draggable) that call ReactDOM.findDOMNode, removed in React 19, and
// are not compatible with StrictMode's double-mount cycle.
createRoot(document.getElementById('root')).render(<App />)
