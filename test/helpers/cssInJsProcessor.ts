import postcss from 'postcss';

// Удаляет ВСЕ возможные escape-последовательности ESBuild
function unescapeEsbuild(str: string) {
  return str
    .replace(/\\\n/g, '\n') // ESBuild переносы
    .replace(/\\\r/g, '\r')
    .replace(/\\ /g, ' ') // '\ ' → ' '
    .replace(/\\;/g, ';') // '\;' → ';'
    .replace(/\\\)/g, ')')
    .replace(/\\\(/g, '(')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\\\/g, '\\') // двойные слэши
    .replace(/\\`/g, '`') // экранированная кавычка
    .replace(/\\([\s\S])/g, '$1'); // ВСЕ оставшиеся escape-последовательности
}

export async function processJsCss(input: string, plugin: any) {
  // 1. Находим template literal
  const match = input.match(/`([\s\S]*?)`/m);
  if (!match) return { css: '' };

  // 2. Достаём содержимое
  let css = match[1];

  // 3. Удаляем JS/ESBuild экранирование
  css = unescapeEsbuild(css).trim();

  // 4. Если после очистки осталась пустота — возвращаем
  if (!css) return { css: '' };

  // 5. Пропускаем через PostCSS
  const result = await postcss([plugin]).process(css, { from: undefined });

  return { css: result.css.trim() };
}
