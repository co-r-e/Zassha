export const CHUNK_THRESHOLD_BYTES = Number(process.env.ZASSHA_CHUNK_THRESHOLD_BYTES ?? 50 * 1024 * 1024);
export const CHUNK_SIZE_BYTES = Number(process.env.ZASSHA_CHUNK_SIZE_BYTES ?? 5 * 1024 * 1024);
export const SEGMENT_LEN_SEC = Number(process.env.ZASSHA_SEGMENT_LEN ?? 0);

// UI progress allocation (upload 0-20%, analysis 20-100%)
export const UPLOAD_PROGRESS_MAX = 20;

