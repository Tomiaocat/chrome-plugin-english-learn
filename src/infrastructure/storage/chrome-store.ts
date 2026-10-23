import { browser } from 'wxt/browser';
import type { ProviderStore, SettingsStore } from '../../domain/ports';
import { defaultSettings, type Provider } from '../../domain/model';
import { providerSchema, settingsSchema } from '../../contracts/schema';

export class ChromeSettingsStore implements SettingsStore {
  async get() {
    const data = await browser.storage.local.get('settings');
    const parsed = settingsSchema.safeParse(data.settings);
    return parsed.success ? parsed.data : structuredClone(defaultSettings);
  }
  async set(value: typeof defaultSettings) {
    await browser.storage.local.set({ settings: settingsSchema.parse(value) });
  }
}
export class ChromeProviderStore implements ProviderStore {
  async list() {
    const data = await browser.storage.local.get('providers');
    const parsed = providerSchema.array().safeParse(data.providers ?? []);
    return parsed.success ? parsed.data : [];
  }
  async save(value: Provider) {
    const profiles = await this.list();
    await browser.storage.local.set({
      providers: [...profiles.filter((p) => p.id !== value.id), value],
    });
  }
  async getKey(id: string) {
    const name = `secret:${id}`;
    const session = await browser.storage.session.get(name);
    const local = await browser.storage.local.get(name);
    const value = session[name] ?? local[name];
    return typeof value === 'string' ? value : undefined;
  }
  async setKey(id: string, key: string, remember: boolean) {
    const name = `secret:${id}`;
    if (remember) {
      await browser.storage.local.set({ [name]: key });
      await browser.storage.session.remove(name);
    } else {
      await browser.storage.session.set({ [name]: key });
      await browser.storage.local.remove(name);
    }
  }
  async remove(id: string) {
    await browser.storage.local.set({
      providers: (await this.list()).filter((p) => p.id !== id),
    });
    await browser.storage.session.remove(`secret:${id}`);
    await browser.storage.local.remove(`secret:${id}`);
  }
}
