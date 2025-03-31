import React from 'react';
import ReactDOM from 'react-dom/client';
// Import all CSS files
import './styles/base.css';
import './styles/layout.css';
import './styles/header.css';
import './styles/wallet.css';
import './styles/network.css';
import './styles/bridge-form.css';
import './styles/modal.css';
import './styles/animations.css';
import './styles/responsive.css';
import './styles/nft.css';
import App from './App.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
