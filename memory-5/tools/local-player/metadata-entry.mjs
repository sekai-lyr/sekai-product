import { parseBlob } from 'music-metadata';
window.sekaiParseLocalMetadata = (file, options = {}) => parseBlob(file, { duration: false, skipPostHeaders: true, ...options });
