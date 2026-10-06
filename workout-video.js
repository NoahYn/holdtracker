/*
 * Local workout clip recorder.
 *
 * Records video-only MediaStream tracks with MediaRecorder, stores finished
 * clips in IndexedDB, and keeps a session-memory fallback when persistent
 * storage is unavailable. This module never uploads data or stops source
 * camera tracks supplied by the caller.
 */

const DB_NAME = 'holdtracker-workout-videos';
const STORE_NAME = 'clips';
const DB_VERSION = 1;
const MAX_DURATION_MS = 120_000;
const MAX_BYTES = 30 * 1024 * 1024;
const TIMESLICE_MS = 1_000;
const STOP_TIMEOUT_MS = 3_000;
const OP_TIMEOUT_MS = 4_500;
const FLUSH_TIMEOUT_MS = 5_000;
const MAX_ID_LENGTH = 256;
const MAX_META_KEYS = 48;
const MAX_META_DEPTH = 4;
const MAX_META_ARRAY = 64;
const MAX_META_STRING = 2_000;
const MAX_LIST_ITEMS = 1_000;

const RESERVED_FIELDS = new Set([
  'id', 'blob', 'mimeType', 'bytes', 'createdAt', 'recordingDurationMs',
  'persistence', 'truncated', 'truncatedReason',
]);

function errorText(error) {
  if (!error) return '알 수 없는 오류';
  return String(error.message || error.name || error);
}

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' ||
    /quota|storage.*full|disk.*full/i.test(String(error?.message || ''));
}

function validId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_ID_LENGTH;
}

function copySafeValue(value, depth, budget, seen) {
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, MAX_META_STRING);
  if (typeof value === 'bigint') return String(value).slice(0, MAX_META_STRING);
  if (typeof value !== 'object' || depth >= MAX_META_DEPTH || seen.has(value)) return undefined;

  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = [];
    for (const item of value.slice(0, MAX_META_ARRAY)) {
      const safe = copySafeValue(item, depth + 1, budget, seen);
      if (safe !== undefined) result.push(safe);
    }
  } else if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
    result = {};
    for (const [key, item] of Object.entries(value)) {
      if (budget.count >= MAX_META_KEYS) break;
      if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      budget.count += 1;
      const safe = copySafeValue(item, depth + 1, budget, seen);
      if (safe !== undefined) result[key.slice(0, 128)] = safe;
    }
  }
  seen.delete(value);
  return result;
}

function safeMeta(meta) {
  try {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const copied = copySafeValue(meta, 0, { count: 0 }, new WeakSet()) || {};
    for (const field of RESERVED_FIELDS) delete copied[field];
    return copied;
  } catch (_) {
    return {};
  }
}

function metadataOf(record) {
  if (!record) return null;
  const metadata = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== 'blob') metadata[key] = value;
  }
  return metadata;
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function chooseMimeType(MediaRecorderClass, userAgent) {
  const safari = /Safari/i.test(userAgent || '') && !/Chrome|Chromium|CriOS|Edg|OPR/i.test(userAgent || '');
  const mp4 = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  const webm = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const candidates = safari ? [...mp4, ...webm] : [...webm, ...mp4];
  if (typeof MediaRecorderClass?.isTypeSupported !== 'function') return '';
  for (const type of candidates) {
    try {
      if (MediaRecorderClass.isTypeSupported(type)) return type;
    } catch (_) {
      // Try the next candidate, then fall back to browser defaults.
    }
  }
  return '';
}

/**
 * Create a video-only local workout recorder.
 *
 * @param {{onStatus?:(status:{state:string,message:string,recordId?:string})=>void}} options
 * @returns {{begin:(stream:MediaStream,meta?:object)=>boolean,finish:(recordId:string,meta?:object)=>Promise<object|null>,discard:()=>Promise<void>,flush:()=>Promise<void>,status:()=>object,get:(recordId:string)=>Promise<object|null>,remove:(recordId:string)=>Promise<void>,clear:()=>Promise<void>,list:()=>Promise<object[]>}}
 */
export function createWorkoutVideo({ onStatus = () => {} } = {}) {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const MediaRecorderClass = root.MediaRecorder;
  const IndexedDB = root.indexedDB;
  const memoryClips = new Map();
  const pendingOps = new Set();

  let current = null;
  let dbPromise = null;
  let lastError = null;
  let persistentUnavailable = !IndexedDB;

  const emit = (state, message, recordId) => {
    try {
      onStatus(recordId ? { state, message, recordId } : { state, message });
    } catch (_) {
      // Status callbacks must never break recording.
    }
  };

  const setError = (message, error, recordId) => {
    lastError = error ? `${message}: ${errorText(error)}` : message;
    emit('error', lastError, recordId);
  };

  const track = promise => {
    const tracked = Promise.resolve(promise);
    pendingOps.add(tracked);
    tracked.finally(() => pendingOps.delete(tracked)).catch(() => {});
    return tracked;
  };

  const openDatabase = () => {
    if (!IndexedDB) return Promise.reject(new Error('IndexedDB를 사용할 수 없습니다.'));
    if (dbPromise) return dbPromise;

    dbPromise = withTimeout(new Promise((resolve, reject) => {
      let request;
      try {
        request = IndexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('IndexedDB 열기 실패'));
      request.onblocked = () => reject(new Error('IndexedDB 열기가 차단되었습니다.'));
    }), OP_TIMEOUT_MS, 'IndexedDB 열기 시간이 초과되었습니다.').catch(error => {
      persistentUnavailable = true;
      dbPromise = null;
      throw error;
    });

    return dbPromise;
  };

  const dbRequest = async (mode, operation) => {
    const db = await openDatabase();
    return withTimeout(new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        operation(store, resolve, reject, tx);
      } catch (error) {
        reject(error);
        return;
      }
      tx.onabort = () => reject(tx.error || new Error('IndexedDB 작업이 중단되었습니다.'));
      tx.onerror = () => reject(tx.error || new Error('IndexedDB 작업 실패'));
    }), OP_TIMEOUT_MS, 'IndexedDB 작업 시간이 초과되었습니다.');
  };

  const putPersistent = record => dbRequest('readwrite', (store, resolve, reject, tx) => {
    const request = store.put(record);
    request.onerror = () => reject(request.error || new Error('영상 저장 실패'));
    tx.oncomplete = () => resolve(record);
  });

  const getPersistent = id => dbRequest('readonly', (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('영상 조회 실패'));
  });

  const deletePersistent = id => dbRequest('readwrite', (store, resolve, reject, tx) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error || new Error('영상 삭제 실패'));
    tx.oncomplete = () => resolve();
  });

  const clearPersistent = () => dbRequest('readwrite', (store, resolve, reject, tx) => {
    const request = store.clear();
    request.onerror = () => reject(request.error || new Error('영상 전체 삭제 실패'));
    tx.oncomplete = () => resolve();
  });

  const listPersistent = () => dbRequest('readonly', (store, resolve, reject) => {
    const rows = [];
    const request = store.openCursor();
    request.onerror = () => reject(request.error || new Error('영상 목록 조회 실패'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= MAX_LIST_ITEMS) {
        resolve(rows);
        return;
      }
      rows.push(metadataOf(cursor.value));
      cursor.continue();
    };
  });

  const stopOwnedTracks = session => {
    for (const track of session.clonedTracks) {
      try { track.stop(); } catch (_) {}
    }
    session.clonedTracks.length = 0;
  };

  const resolveStopped = session => {
    if (session.stopped) return;
    session.stopped = true;
    session.stoppedAt = Date.now();
    clearTimeout(session.capTimer);
    clearTimeout(session.stopFallbackTimer);
    stopOwnedTracks(session);
    session.resolveStop();
  };

  const requestStop = (session, reason = null) => {
    if (!session) return;
    if (reason && !session.truncated) {
      session.truncated = true;
      session.truncatedReason = reason;
      const message = reason === 'duration'
        ? '영상이 120초 제한에 도달해 자동으로 멈췄습니다.'
        : '영상이 약 30MB 제한에 도달해 자동으로 멈췄습니다. 컨테이너 구조를 훼손하지 않도록 마무리 데이터를 포함해 실제 크기는 조금 클 수 있습니다.';
      emit('capped', `${message} 운동이 끝나면 저장을 완료해 주세요.`);
    }
    if (session.stopRequested) return;
    session.stopRequested = true;
    clearTimeout(session.capTimer);
    session.stopFallbackTimer = setTimeout(() => resolveStopped(session), STOP_TIMEOUT_MS);
    try {
      if (session.recorder.state !== 'inactive') session.recorder.stop();
      else resolveStopped(session);
    } catch (error) {
      session.recorderError ||= error;
      resolveStopped(session);
    }
  };

  const addChunk = (session, data) => {
    if (session.discarded || !data || !Number.isFinite(data.size) || data.size <= 0) return;

    // MediaRecorder chunks can contain container boundaries and final indexes.
    // Keep every chunk whole. When a periodic chunk crosses the target, stop
    // immediately and still accept the recorder's finalization chunk(s).
    session.chunks.push(data);
    session.bytes += data.size;

    if (session.bytes >= MAX_BYTES && !session.stopRequested) {
      requestStop(session, 'size');
    }
  };

  const attachRecorderHandlers = session => {
    session.recorder.ondataavailable = event => addChunk(session, event?.data);
    session.recorder.onerror = event => {
      const error = event?.error || new Error('MediaRecorder 오류');
      session.recorderError ||= error;
      setError('영상 녹화 중 오류가 발생했습니다.', error);
      requestStop(session);
    };
    session.recorder.onstop = () => resolveStopped(session);
  };

  const makeRecorder = (mediaStream, mimeType) => {
    if (mimeType) {
      try {
        return new MediaRecorderClass(mediaStream, { mimeType });
      } catch (_) {
        // Safari versions can report support but reject the option at runtime.
      }
    }
    return new MediaRecorderClass(mediaStream);
  };

  const begin = (stream, meta = {}) => {
    if (current) {
      emit('busy', '이미 운동 영상을 녹화하고 있습니다.');
      return false;
    }
    if (typeof MediaRecorderClass !== 'function') {
      setError('이 브라우저는 운동 영상 녹화를 지원하지 않습니다.');
      return false;
    }

    try {
      const sourceTracks = typeof stream?.getVideoTracks === 'function'
        ? stream.getVideoTracks().filter(track => track && track.readyState === 'live')
        : [];
      if (!sourceTracks.length) {
        setError('사용 가능한 라이브 카메라 영상이 없습니다.');
        return false;
      }
      if (typeof root.MediaStream !== 'function') {
        setError('카메라 영상 스트림을 만들 수 없습니다.');
        return false;
      }

      const clonedTracks = [];
      const recordingTracks = [];
      try {
        for (const track of sourceTracks) {
          if (typeof track.clone === 'function') {
            const clone = track.clone();
            clonedTracks.push(clone);
            recordingTracks.push(clone);
          } else {
            recordingTracks.push(track);
          }
        }
      } catch (error) {
        for (const track of clonedTracks) {
          try { track.stop(); } catch (_) {}
        }
        throw error;
      }
      const recordingStream = new root.MediaStream(recordingTracks);
      const mimeType = chooseMimeType(MediaRecorderClass, root.navigator?.userAgent || '');
      const recorder = makeRecorder(recordingStream, mimeType);
      let resolveStop;
      const stopPromise = new Promise(resolve => { resolveStop = resolve; });
      const session = {
        recorder,
        recordingStream,
        clonedTracks,
        chunks: [],
        bytes: 0,
        mimeType: recorder.mimeType || mimeType || '',
        startedAt: Date.now(),
        beginMeta: safeMeta(meta),
        stopPromise,
        resolveStop,
        stopped: false,
        stoppedAt: 0,
        stopRequested: false,
        stopFallbackTimer: null,
        capTimer: null,
        truncated: false,
        truncatedReason: null,
        recorderError: null,
        discarded: false,
        timesliced: true,
      };
      attachRecorderHandlers(session);
      current = session;

      try {
        recorder.start(TIMESLICE_MS);
      } catch (firstError) {
        try {
          recorder.start();
          session.timesliced = false;
        } catch (fallbackError) {
          current = null;
          stopOwnedTracks(session);
          setError('영상 녹화를 시작하지 못했습니다.', fallbackError || firstError);
          return false;
        }
      }

      session.capTimer = setTimeout(() => requestStop(session, 'duration'), MAX_DURATION_MS);
      lastError = persistentUnavailable ? lastError : null;
      emit('recording', persistentUnavailable
        ? '운동 영상 녹화를 시작했습니다. 영구 저장을 사용할 수 없어 이번 세션에만 보관됩니다.'
        : '운동 영상 녹화를 시작했습니다.');
      if (!session.timesliced) {
        emit('warning', '이 브라우저에서는 녹화 중 영상 크기를 확인할 수 없어 약 30MB 제한을 정확히 적용하지 못할 수 있습니다. 영상 파일은 임의로 자르지 않습니다.');
      }
      return true;
    } catch (error) {
      setError('영상 녹화를 시작하지 못했습니다.', error);
      return false;
    }
  };

  const finishOperation = async (recordId, meta = {}) => {
    const session = current;
    if (!session) {
      emit('idle', '저장할 운동 영상이 없습니다.', validId(recordId) ? recordId : undefined);
      return null;
    }

    // Claim this exact recorder before awaiting stop or storage. A subsequent
    // begin() is therefore independent from this finish operation.
    current = null;
    if (!validId(recordId)) {
      session.discarded = true;
      requestStop(session);
      await session.stopPromise;
      session.chunks.length = 0;
      setError('영상 ID가 올바르지 않아 저장하지 않았습니다.');
      return null;
    }

    emit('finishing', '운동 영상 저장을 마무리하고 있습니다.', recordId);
    requestStop(session);
    await session.stopPromise;

    if (session.discarded) return null;
    if (!session.chunks.length || session.bytes <= 0) {
      setError('녹화된 영상 데이터가 없어 저장하지 못했습니다.', session.recorderError, recordId);
      return null;
    }

    const finalType = session.mimeType || session.chunks.find(chunk => chunk.type)?.type || '';
    let blob;
    try {
      blob = new Blob(session.chunks, { type: finalType });
    } catch (error) {
      setError('영상 데이터를 만들지 못했습니다.', error, recordId);
      return null;
    } finally {
      session.chunks.length = 0;
    }

    if (blob.size > MAX_BYTES && session.truncatedReason !== 'size') {
      const message = session.timesliced
        ? '컨테이너 마무리 데이터를 보존해 영상이 약 30MB를 조금 넘었습니다.'
        : '브라우저가 분할 녹화 데이터를 제공하지 않아 영상이 30MB를 넘었습니다. 컨테이너 구조를 훼손하지 않기 위해 파일을 자르지 않았습니다.';
      emit('warning', message, recordId);
    }

    const endAt = session.stoppedAt || Date.now();
    const elapsed = Math.max(0, endAt - session.startedAt);
    const recordingDurationMs = session.truncatedReason === 'duration'
      ? Math.min(elapsed, MAX_DURATION_MS)
      : elapsed;
    const mergedMeta = { ...session.beginMeta, ...safeMeta(meta) };
    const record = {
      id: recordId,
      blob,
      mimeType: blob.type || finalType,
      bytes: blob.size,
      createdAt: new Date(session.startedAt).toISOString(),
      recordingDurationMs,
      ...mergedMeta,
      ...(session.truncated ? {
        truncated: true,
        truncatedReason: session.truncatedReason,
      } : {}),
      ...(session.recorderError ? { recordingError: errorText(session.recorderError).slice(0, 500) } : {}),
      persistence: true,
    };

    try {
      await putPersistent(record);
      persistentUnavailable = false;
      memoryClips.delete(recordId);
      lastError = null;
      emit('saved', session.truncated
        ? '제한까지 녹화된 운동 영상을 기기에 저장했습니다.'
        : '운동 영상을 기기에 저장했습니다.', recordId);
      return record;
    } catch (error) {
      persistentUnavailable = true;
      const fallback = { ...record, persistence: false };
      memoryClips.set(recordId, fallback);
      const reason = isQuotaError(error)
        ? '기기 저장 공간이 부족해 영상을 영구 저장하지 못했습니다.'
        : '기기 저장소를 사용할 수 없어 영상을 영구 저장하지 못했습니다.';
      setError(`${reason} 현재 세션에서는 다운로드할 수 있습니다.`, error, recordId);
      return fallback;
    }
  };

  const finish = (recordId, meta = {}) => track(finishOperation(recordId, meta));

  const discardOperation = async () => {
    const session = current;
    if (!session) return;
    current = null;
    session.discarded = true;
    requestStop(session);
    await session.stopPromise;
    session.chunks.length = 0;
    emit('discarded', '짧은 운동 시도 영상을 저장하지 않고 버렸습니다.');
  };

  const discard = () => track(discardOperation());

  const flush = async () => {
    const deadline = Date.now() + FLUSH_TIMEOUT_MS;
    while (pendingOps.size && Date.now() < deadline) {
      const remaining = deadline - Date.now();
      try {
        await withTimeout(Promise.allSettled([...pendingOps]), remaining, '대기 작업 시간 초과');
      } catch (_) {
        break;
      }
    }
    if (pendingOps.size) {
      setError('영상 저장 작업이 5초 안에 끝나지 않았습니다. 백그라운드에서 계속 시도합니다.');
    }
  };

  const get = async recordId => {
    if (!validId(recordId)) return null;
    if (memoryClips.has(recordId)) return memoryClips.get(recordId);
    if (!IndexedDB) return null;
    try {
      return await getPersistent(recordId);
    } catch (error) {
      persistentUnavailable = true;
      setError('저장된 영상을 불러오지 못했습니다.', error, recordId);
      return null;
    }
  };

  // remove()/clear() resolve on success and reject on failure so callers can
  // tell a confirmed delete apart from a failed one. Internal error state
  // (lastError + 'error' status event) is still updated either way; the
  // thrown error is additionally propagated to the caller instead of being
  // swallowed.
  const remove = async recordId => {
    if (!validId(recordId)) return;
    memoryClips.delete(recordId);
    if (!IndexedDB) {
      emit('removed', '현재 세션의 운동 영상을 삭제했습니다.', recordId);
      return;
    }
    const operation = (async () => {
      try {
        await deletePersistent(recordId);
        emit('removed', '저장된 운동 영상을 삭제했습니다.', recordId);
      } catch (error) {
        persistentUnavailable = true;
        setError('운동 영상을 삭제하지 못했습니다.', error, recordId);
        throw error;
      }
    })();
    await track(operation);
  };

  const clear = async () => {
    memoryClips.clear();
    if (!IndexedDB) {
      emit('cleared', '현재 세션의 운동 영상을 모두 삭제했습니다.');
      return;
    }
    const operation = (async () => {
      try {
        await clearPersistent();
        emit('cleared', '저장된 운동 영상을 모두 삭제했습니다.');
      } catch (error) {
        persistentUnavailable = true;
        setError('저장된 운동 영상을 모두 삭제하지 못했습니다.', error);
        throw error;
      }
    })();
    await track(operation);
  };

  const list = async () => {
    let rows = [];
    if (IndexedDB) {
      try {
        rows = await listPersistent();
      } catch (error) {
        persistentUnavailable = true;
        setError('저장된 운동 영상 목록을 불러오지 못했습니다.', error);
      }
    }
    const merged = new Map(rows.map(row => [row.id, row]));
    for (const [id, clip] of memoryClips) merged.set(id, metadataOf(clip));
    return [...merged.values()]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, MAX_LIST_ITEMS);
  };

  const status = () => ({
    active: !!current,
    available: typeof MediaRecorderClass === 'function',
    pending: pendingOps.size,
    lastError,
  });

  if (!MediaRecorderClass) {
    lastError = '이 브라우저는 운동 영상 녹화를 지원하지 않습니다.';
  } else if (!IndexedDB) {
    lastError = 'IndexedDB를 사용할 수 없어 영상은 현재 세션에만 보관됩니다.';
  }

  return { begin, finish, discard, flush, status, get, remove, clear, list };
}
