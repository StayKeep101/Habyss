import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {applyTheme} from './theme/css';
import './ui/ui.css';
import './styles.css';
applyTheme('abyss');
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
