import { createRoot } from 'react-dom/client';
import { PopupApp } from '../../src/presentation/popup/App';
import { appClient } from '../../src/infrastructure/messaging/client';

createRoot(document.getElementById('root')!).render(
  <PopupApp client={appClient} />,
);
