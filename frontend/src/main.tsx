import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import App from './App';
import { AuthProvider } from './auth';

/* Ionic базовые стили */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
/* Тёмная палитра Ionic, включается классом ion-palette-dark на <html> */
import '@ionic/react/css/palettes/dark.class.css';
import './theme/variables.css';
import { applyTheme } from './theme/theme';

setupIonicReact({ mode: 'ios' });
applyTheme();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
