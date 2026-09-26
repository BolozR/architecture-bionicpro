import React, { useEffect, useState } from 'react';

type User = { id: string; name: string; yandex: boolean; consent: boolean | null };

// Запросы идут последовательно: каждый защищённый ответ меняет session cookie.
let queue: Promise<unknown> = Promise.resolve();
function api(path: string, options: RequestInit = {}): Promise<Response> {
  const result = queue.then(() => fetch(path, { ...options, credentials: 'include' }));
  queue = result.catch(() => undefined);
  return result;
}

const ReportPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const [start, setStart] = useState(yesterday);
  const [end, setEnd] = useState(today);

  useEffect(() => {
    api('/auth/me').then(async response => {
      if (response.ok) setUser(await response.json());
      else if (response.status !== 401) setError('Не удалось получить профиль');
    }).catch(() => setError('Сервер недоступен')).finally(() => setReady(true));
  }, []);

  async function check(response: Response) {
    if (response.status === 401) {
      setUser(null);
      throw new Error('Сессия завершилась. Войдите заново');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.detail === 'string' ? body.detail :
        body.detail?.message || 'Не удалось выполнить запрос');
    }
    return response;
  }

  async function consent(allowed: boolean) {
    setLoading(true); setError('');
    try {
      await check(await api('/auth/consent', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allowed }) }));
      setUser(current => current && { ...current, consent: allowed });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function downloadReport() {
    setLoading(true); setError(''); setStatus('');
    try {
      const response = await check(await api(`/reports?start=${start}&end=${end}`));
      const report = await response.json();
      const file = await check(await api(report.url));
      const url = URL.createObjectURL(await file.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `bionicpro-${start}-${end}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(report.cached ? 'Отчёт скачан из кеша.' : 'Отчёт подготовлен и скачан.');
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function logout() {
    setLoading(true); setError('');
    try { await check(await api('/auth/logout', { method: 'POST' })); setUser(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  if (!ready) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <button
          onClick={() => { window.location.href = '/auth/login'; }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Login
        </button>
        <a className="mt-4 text-blue-600" href="/auth/login?provider=yandex">Войти через Яндекс ID</a>
        {error && <p className="mt-4 text-red-700" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6">Usage Reports</h1>
        <p className="mb-4">Пользователь: {user.name}</p>
        {user.yandex && <section className="mb-6 max-w-xl">
          <h2 className="font-bold">Данные Яндекс ID</h2>
          <p>Разрешить сохранить логин, отображаемое имя и email из Яндекса в профиле BionicPRO?
            Отчёты доступны и без согласия. При отзыве удаляем сохранённые данные профиля.</p>
          <p>Согласие: {user.consent === null ? 'не выбрано' : user.consent ? 'дано' : 'отклонено'}</p>
          <button className="mt-2 mr-4 text-blue-600 disabled:opacity-50"
            disabled={loading || user.consent === true} onClick={() => consent(true)}>Разрешить</button>
          <button className="text-blue-600 disabled:opacity-50" disabled={loading || user.consent === false}
            onClick={() => consent(false)}>{user.consent ? 'Отозвать согласие' : 'Отказаться'}</button>
        </section>}
        <p>Выберите от 1 до 31 завершённого дня по UTC. Конечная дата не включается в отчёт.</p>
        <div className="flex flex-wrap gap-4 my-4">
          <label>С <input className="border rounded p-2" type="date" value={start} disabled={loading}
            onChange={event => setStart(event.target.value)} /></label>
          <label>До <input className="border rounded p-2" type="date" value={end} disabled={loading}
            onChange={event => setEnd(event.target.value)} /></label>
        </div>
        <button
          onClick={downloadReport}
          disabled={loading || !start || !end}
          className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Generating Report...' : 'Download Report'}
        </button>
        <button className="ml-4 text-blue-600 disabled:opacity-50" onClick={logout} disabled={loading}>Выйти</button>
        <p className="mt-4" role="status">{status}</p>

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPage;