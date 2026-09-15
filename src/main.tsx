import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely suppress benign browser media play interruption error when camera/media elements are unmounted or detached
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason &&
    (String(event.reason.message || event.reason).includes('The play() request was interrupted') ||
     String(event.reason.message || event.reason).includes('RenderedCameraImpl') ||
     String(event.reason.name || '') === 'AbortError')
  ) {
    event.preventDefault();
  }
});

// Suppress benign camera abort/error DOM events thrown by html5-qrcode's RenderedCameraImpl on video unmount/teardown
window.addEventListener('error', (event) => {
  const msg = String(event.message || event.error || '');
  if (
    msg.includes('RenderedCameraImpl video surface onabort() called') ||
    msg.includes('RenderedCameraImpl video surface onerror() called') ||
    msg.includes('The play() request was interrupted')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
