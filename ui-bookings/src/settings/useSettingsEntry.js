import { useCallback, useEffect, useState } from 'react';
import { useOkapiKy } from '@folio/stripes/core';

export const SETTINGS_SCOPE = 'mod-bookings';

const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : ((r % 4) + 8)).toString(16);
  }));

/**
 * Loads and saves one mod-settings entry (scope "mod-bookings", the given key).
 * mod-settings creates with POST (client-supplied id) and updates with PUT.
 */
const useSettingsEntry = (key) => {
  const ky = useOkapiKy();
  const [entry, setEntry] = useState(null); // { id, value } once loaded or null if never saved
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    ky.get('settings/entries', {
      searchParams: { query: `(scope==${SETTINGS_SCOPE} and key==${key})`, limit: 1 },
    }).json()
      .then((data) => {
        if (cancelled) return;
        const found = (data.items || [])[0];
        setEntry(found ? { id: found.id, value: found.value } : null);
        setIsLoading(false);
      })
      .catch((err) => { if (!cancelled) { setError(err.message); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (value) => {
    setError(null);
    try {
      if (entry?.id) {
        await ky.put(`settings/entries/${entry.id}`, { json: { id: entry.id, scope: SETTINGS_SCOPE, key, value } });
        setEntry({ id: entry.id, value });
      } else {
        const id = uuid();
        await ky.post('settings/entries', { json: { id, scope: SETTINGS_SCOPE, key, value } });
        setEntry({ id, value });
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [entry, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { value: entry?.value ?? null, isLoading, error, save, clearError: () => setError(null) };
};

export default useSettingsEntry;
