// Простой роутер на hash: работает на GitHub Pages без настройки сервера.
import { useEffect, useState } from 'preact/hooks';

const parse = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const go = (path: string) => {
  location.hash = '#/' + path;
};

export const back = (fallback = '') => {
  if (history.length > 1) history.back();
  else go(fallback);
};
