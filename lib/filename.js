// Renders the {date} {time} {mode} {title} filename template and sanitizes the result plus the
// Downloads subfolder into a safe, relative path. The default template reproduces the pre-4.5.0
// `google-meet-<mode>-<iso timestamp>` name exactly.
(function (root, factory) {
  const mod = factory();
  root.MeetRecorderFilename = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_TEMPLATE = 'google-meet-{mode}-{date}T{time}';
  const MAX_NAME_LENGTH = 150;
  const MAX_SUBFOLDER_LENGTH = 200;
  const RESERVED_NAMES = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  ]);

  function isoParts(now) {
    const iso = now.toISOString();
    const [datePart, timePart] = iso.split('T');
    return { date: datePart, time: timePart.replace(/[:.]/g, '-') };
  }

  function sanitizeSegment(value, fallback) {
    const cleaned = String(value ?? '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');
    return cleaned || fallback;
  }

  function sanitizeFilenameBase(name) {
    let cleaned = sanitizeSegment(name, 'google-meet-recording');
    if (RESERVED_NAMES.has(cleaned.toUpperCase())) cleaned = `_${cleaned}`;
    if (cleaned.length > MAX_NAME_LENGTH) cleaned = cleaned.slice(0, MAX_NAME_LENGTH);
    return cleaned || 'google-meet-recording';
  }

  function renderTemplate(template, tokens) {
    const source = template && template.trim() ? template : DEFAULT_TEMPLATE;
    const rendered = source.replace(/\{(date|time|mode|title)\}/g, (_, key) => sanitizeSegment(tokens[key], ''));
    return sanitizeFilenameBase(rendered);
  }

  // Relative only: strips drive letters, leading slashes and ".." segments, then sanitizes
  // each remaining path segment the same way a filename is sanitized.
  function sanitizeSubfolder(path) {
    const text = String(path ?? '').trim();
    if (!text) return '';
    const normalized = text.replace(/\\/g, '/');
    const segments = normalized.split('/').map(part => part.trim()).filter(part => part.length > 0 && part !== '.' && part !== '..');
    const safeSegments = segments.map(part => sanitizeSegment(part, '')).filter(Boolean);
    let joined = safeSegments.join('/');
    if (joined.length > MAX_SUBFOLDER_LENGTH) joined = joined.slice(0, MAX_SUBFOLDER_LENGTH);
    return joined;
  }

  function buildFilename({ template, mode, extension, title, subfolder, suffix = '', now = new Date() }) {
    const { date, time } = isoParts(now);
    const base = renderTemplate(template, { date, time, mode, title });
    const folder = sanitizeSubfolder(subfolder);
    const name = `${base}${suffix}.${extension}`;
    return folder ? `${folder}/${name}` : name;
  }

  return { DEFAULT_TEMPLATE, isoParts, renderTemplate, sanitizeFilenameBase, sanitizeSubfolder, buildFilename };
});
