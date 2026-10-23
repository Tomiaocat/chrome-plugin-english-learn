import { createRoot } from 'react-dom/client';
import { OptionsApp } from '../../src/presentation/options/App';
import { appClient } from '../../src/infrastructure/messaging/client';

createRoot(document.getElementById('root')!).render(
  <OptionsApp client={appClient} />,
);
