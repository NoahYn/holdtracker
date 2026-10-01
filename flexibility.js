/**
 * HoldTracker manual flexibility benchmarks and short guided training.
 *
 * This module intentionally uses explicit centimetre inputs only. It does not
 * request a camera, infer distance from a pose, upload data, or claim clinical
 * validation. The parent owns navigation, persistence, import/export, and backup.
 */

export const FLEXIBILITY_RECORD_VERSION = 1;
export const FLEXIBILITY_PROTOCOL_ID = 'holdtracker-flex-manual-v1';
export const FLEXIBILITY_TRAINING_PROTOCOL_ID = 'holdtracker-flex-training-v1';

export const FLEXIBILITY_KINDS = Object.freeze({
  PANCAKE: Object.freeze({
    label: '팬케이크',
    metric: 'gapCm',
    metricLabel: '가슴뼈 아래쪽부터 바닥까지 간격',
    better: 'lower',
    max: 150,
  }),
  MIDDLE_SPLIT: Object.freeze({
    label: '미들 스플릿',
    metric: 'gapCm',
    metricLabel: '바닥부터 골반 지지대 윗면까지 높이/간격',
    better: 'lower',
    max: 200,
  }),
  FRONT_SPLIT_LEFT: Object.freeze({
    label: '프론트 스플릿 · 왼발 앞',
    metric: 'gapCm',
    metricLabel: '지지된 골반의 바닥 간격',
    better: 'lower',
    max: 150,
  }),
  FRONT_SPLIT_RIGHT: Object.freeze({
    label: '프론트 스플릿 · 오른발 앞',
    metric: 'gapCm',
    metricLabel: '지지된 골반의 바닥 간격',
    better: 'lower',
    max: 150,
  }),
  ANKLE_LEFT: Object.freeze({
    label: '무릎-벽 · 왼쪽',
    metric: 'distanceCm',
    metricLabel: '맨발 엄지발가락부터 벽까지 거리',
    better: 'higher',
    max: 30,
  }),
  ANKLE_RIGHT: Object.freeze({
    label: '무릎-벽 · 오른쪽',
    metric: 'distanceCm',
    metricLabel: '맨발 엄지발가락부터 벽까지 거리',
    better: 'higher',
    max: 30,
  }),
});

const PHASES = Object.freeze({ before: '스트레칭 전 · 워밍업 후', after: '훈련 후' });
const SUPPORTS = Object.freeze({ hands: '손 지지', blocks: '블록/의자 지지', none: '지지 없음' });
const FOOT_ORIENTATIONS = Object.freeze({ forward: '발끝 정면', up: '발끝 위쪽' });
const NOTE_LIMIT = 2000;

const ROUTINES = Object.freeze({
  pancake: Object.freeze({
    name: '팬케이크 짧은 루틴',
    summary: '지지한 앉은 스트래들 힙힌지 6회 후, 편안한 지지 팬케이크를 진행합니다.',
    build(workSeconds, restSeconds, sets) {
      const steps = [manualStep('pancake-hinge', '지지한 앉은 스트래들 힙힌지 6회', '무릎을 편 범위에서 천천히 골반부터 접습니다. 척추만 둥글게 말아 거리를 만들지 않습니다.')];
      addTimedSets(steps, 'pancake-hold', '편안한 지지 팬케이크', sets, workSeconds, restSeconds, '손이나 블록으로 지지하고 힘으로 바닥에 누르지 않습니다.');
      return steps;
    },
  }),
  middle: Object.freeze({
    name: '미들 스플릿 짧은 루틴',
    summary: '손목에 부담이 없도록 서서 지지한 내전근 준비 동작 후, 지지 미들 스플릿을 진행합니다.',
    build(workSeconds, restSeconds, sets) {
      const steps = [manualStep('middle-rock', '지지한 와이드 스탠스/내전근 록백 6회', '의자나 높은 지지대를 잡고 부드럽게 이동합니다. 손목 바닥 지지가 불편하면 서서만 진행합니다.')];
      addTimedSets(steps, 'middle-hold', '지지 미들 스플릿', sets, workSeconds, restSeconds, '무릎과 발 방향을 맞추고, 블록이나 의자로 지지하며 억지로 밀지 않습니다.');
      return steps;
    },
  }),
  front: Object.freeze({
    name: '프론트 스플릿 짧은 루틴',
    summary: '양쪽 고관절 앞쪽과 햄스트링을 각각 지지한 자세로 진행합니다.',
    build(workSeconds, restSeconds, sets) {
      const steps = [];
      for (const side of ['왼쪽', '오른쪽']) {
        addTimedSets(steps, `front-hip-${side}`, `${side} 하프니링 힙플렉서`, sets, workSeconds, restSeconds, '골반을 정면으로 두고 허리를 과하게 젖히지 않습니다.');
        addTimedSets(steps, `front-ham-${side}`, `${side} 하프 스플릿 햄스트링`, sets, workSeconds, restSeconds, '골반을 정면으로 두고 편안한 범위에서 엉덩이를 뒤로 보냅니다.');
      }
      return steps;
    },
  }),
  ankle: Object.freeze({
    name: '발목 선택 루틴',
    summary: '무릎-벽 느린 반복과 무릎을 굽힌 종아리 스트레칭을 양쪽에 진행합니다.',
    build(workSeconds, restSeconds, sets) {
      const steps = [
        manualStep('ankle-wall-left', '왼쪽 무릎-벽 천천히 6회', '맨발, 뒤꿈치를 바닥에 두고 무릎이 발가락 방향을 따르게 합니다.'),
        manualStep('ankle-wall-right', '오른쪽 무릎-벽 천천히 6회', '맨발, 뒤꿈치를 바닥에 두고 무릎이 발가락 방향을 따르게 합니다.'),
      ];
      for (const side of ['왼쪽', '오른쪽']) {
        addTimedSets(steps, `ankle-calf-${side}`, `${side} 무릎 굽힌 종아리 스트레칭`, sets, workSeconds, restSeconds, '뒤꿈치를 내린 채 부드럽게 유지합니다.');
      }
      return steps;
    },
  }),
});

function manualStep(id, label, detail) {
  return { id, label, detail, type: 'manual', plannedSeconds: 0 };
}

function timedStep(id, label, seconds, detail) {
  return { id, label, detail, type: 'timed', plannedSeconds: seconds };
}

function restStep(id, seconds) {
  return { id, label: '휴식', detail: '호흡을 편하게 하고 다음 세트를 준비합니다.', type: 'rest', plannedSeconds: seconds };
}

function addTimedSets(steps, idBase, label, sets, workSeconds, restSeconds, detail) {
  for (let set = 1; set <= sets; set += 1) {
    if (steps.length && steps[steps.length - 1].type !== 'manual') {
      steps.push(restStep(`${idBase}-rest-before-${set}`, restSeconds));
    }
    steps.push(timedStep(`${idBase}-${set}`, `${label} · ${set}/${sets}`, workSeconds, detail));
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function textValue(value) {
  return value == null ? '' : String(value).trim();
}

function booleanValue(value) {
  if (value === true || value === false) return value;
  if (value === 'true' || value === 1 || value === '1' || value === 'on') return true;
  if (value === 'false' || value === 0 || value === '0' || value == null || value === '') return false;
  return null;
}

function numberField(raw, key, label, min, max, errors) {
  const original = raw?.[key];
  if (original === '' || original == null || (typeof original === 'string' && !original.trim())) {
    errors[key] = `${label}을(를) 입력해 주세요.`;
    return null;
  }
  const value = typeof original === 'number' ? original : Number(original);
  if (!Number.isFinite(value)) {
    errors[key] = `${label}은(는) 유한한 숫자여야 합니다.`;
    return null;
  }
  if (value < min || value > max) {
    errors[key] = `${label}은(는) ${min}~${max}cm 범위로 입력해 주세요.`;
    return null;
  }
  return value;
}

function enumField(raw, key, allowed, label, errors) {
  const value = textValue(raw?.[key]);
  if (!allowed.includes(value)) {
    errors[key] = `${label}을(를) 선택해 주세요.`;
    return null;
  }
  return value;
}

function safeIso(value) {
  if (typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function makeId(prefix = 'flex') {
  const random = Math.random().toString(36).slice(2, 9);
  return `${Date.now()}-${prefix}-${random}`;
}

function roundedCondition(value) {
  return Math.round(Number(value) * 10) / 10;
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

/**
 * Validate and normalize a manual benchmark record.
 * Zero is valid; blanks, negatives, infinities, and values outside conservative
 * data-entry bounds are rejected. Bounds are input guards, not normal cutoffs.
 *
 * @returns {{ok:boolean, errors:Record<string,string>, value:object|null}}
 */
export function validateBenchmark(raw) {
  const errors = {};
  if (!isPlainObject(raw)) return { ok: false, errors: { record: '측정 기록 형식이 올바르지 않습니다.' }, value: null, record: null };

  const kind = enumField(raw, 'kind', Object.keys(FLEXIBILITY_KINDS), '측정 종류', errors);
  const phase = enumField(raw, 'phase', Object.keys(PHASES), '측정 시점', errors);
  const supportMode = enumField(raw, 'supportMode', Object.keys(SUPPORTS), '지지 방식', errors);
  const alignmentConfirmed = booleanValue(raw.alignmentConfirmed);
  const painFree = booleanValue(raw.painFree);
  if (alignmentConfirmed == null) errors.alignmentConfirmed = '정렬 확인 값이 올바르지 않습니다.';
  if (painFree == null) errors.painFree = '통증 확인 값이 올바르지 않습니다.';

  const normalized = {
    id: textValue(raw.id) || makeId('benchmark'),
    ts: safeIso(raw.ts),
    recordVersion: FLEXIBILITY_RECORD_VERSION,
    protocolId: FLEXIBILITY_PROTOCOL_ID,
    source: 'local-manual',
    measurementMode: 'manual-cm',
    kind,
    phase,
    supportMode,
    alignmentConfirmed: alignmentConfirmed === true,
    painFree: painFree === true,
    notes: String(raw.notes ?? '').slice(0, NOTE_LIMIT),
  };

  if (kind) {
    const config = FLEXIBILITY_KINDS[kind];
    normalized[config.metric] = numberField(raw, config.metric, config.metricLabel, 0, config.max, errors);

    if (kind === 'PANCAKE') {
      normalized.heelWidthCm = numberField(raw, 'heelWidthCm', '뒤꿈치 사이 너비', 0, 250, errors);
      normalized.seatHeightCm = numberField(raw, 'seatHeightCm', '좌면 높이', 0, 80, errors);
    } else if (kind === 'MIDDLE_SPLIT') {
      normalized.footOrientation = enumField(raw, 'footOrientation', Object.keys(FOOT_ORIENTATIONS), '발 방향', errors);
    } else if (kind === 'FRONT_SPLIT_LEFT') {
      normalized.frontLeg = 'left';
    } else if (kind === 'FRONT_SPLIT_RIGHT') {
      normalized.frontLeg = 'right';
    } else if (kind === 'ANKLE_LEFT') {
      normalized.side = 'left';
    } else if (kind === 'ANKLE_RIGHT') {
      normalized.side = 'right';
    }
  }

  const ok = Object.keys(errors).length === 0;
  const record = ok ? normalized : null;
  return { ok, errors, value: record, record };
}

/**
 * Validate and normalize a saved training log, primarily for backup import.
 * Started-only sessions are not records; a log needs at least one completed,
 * skipped, or partial step and an explicit completion flag.
 */
export function validateTraining(raw) {
  const errors = {};
  if (!isPlainObject(raw)) return { ok: false, errors: { record: '훈련 기록 형식이 올바르지 않습니다.' }, value: null, record: null };

  const routineId = enumField(raw, 'routineId', Object.keys(ROUTINES), '루틴', errors);
  const warmupConfirmed = booleanValue(raw.warmupConfirmed);
  const completion = booleanValue(raw.completion);
  if (warmupConfirmed !== true) errors.warmupConfirmed = '5~10분 워밍업 확인이 필요합니다.';
  if (completion == null) errors.completion = '완료 여부 값이 올바르지 않습니다.';

  const configRaw = isPlainObject(raw.config) ? raw.config : {};
  const workSeconds = numberField(configRaw, 'workSeconds', '동작 시간', 10, 90, errors);
  const restSeconds = numberField(configRaw, 'restSeconds', '휴식 시간', 5, 60, errors);
  const sets = numberField(configRaw, 'sets', '세트 수', 1, 4, errors);
  if (Number.isFinite(sets) && !Number.isInteger(sets)) errors.sets = '세트 수는 정수여야 합니다.';

  if (!Array.isArray(raw.steps) || raw.steps.length === 0 || raw.steps.length > 100) {
    errors.steps = '단계 기록이 필요합니다.';
  }
  const allowedTypes = ['manual', 'timed', 'rest'];
  const allowedStatuses = ['completed', 'skipped', 'partial', 'not_started'];
  const stepsNormalized = [];
  if (Array.isArray(raw.steps)) {
    raw.steps.slice(0, 100).forEach((step, index) => {
      if (!isPlainObject(step)) {
        errors[`steps.${index}`] = '단계 형식이 올바르지 않습니다.';
        return;
      }
      const type = textValue(step.type);
      const status = textValue(step.status);
      const plannedSeconds = Number(step.plannedSeconds);
      const completedSeconds = Number(step.completedSeconds);
      if (!allowedTypes.includes(type)) errors[`steps.${index}.type`] = '단계 종류가 올바르지 않습니다.';
      if (!allowedStatuses.includes(status)) errors[`steps.${index}.status`] = '단계 상태가 올바르지 않습니다.';
      if (!Number.isFinite(plannedSeconds) || plannedSeconds < 0 || plannedSeconds > 600) errors[`steps.${index}.plannedSeconds`] = '계획 시간이 올바르지 않습니다.';
      if (!Number.isFinite(completedSeconds) || completedSeconds < 0 || completedSeconds > 3600) errors[`steps.${index}.completedSeconds`] = '실행 시간이 올바르지 않습니다.';
      stepsNormalized.push({
        id: textValue(step.id) || `step-${index + 1}`,
        label: String(step.label ?? '').slice(0, 300),
        type,
        plannedSeconds,
        completedSeconds,
        status,
      });
    });
  }
  if (stepsNormalized.length && !stepsNormalized.some(step => step.status !== 'not_started')) {
    errors.steps = '시작만 한 세션은 저장할 수 없습니다.';
  }

  const plannedSeconds = stepsNormalized.filter(step => step.type !== 'rest').reduce((sum, step) => sum + (Number.isFinite(step.plannedSeconds) ? step.plannedSeconds : 0), 0);
  const completedSeconds = stepsNormalized.filter(step => step.type !== 'rest').reduce((sum, step) => sum + (Number.isFinite(step.completedSeconds) ? step.completedSeconds : 0), 0);
  const fullyComplete = stepsNormalized.length > 0 && stepsNormalized
    .filter(step => step.type !== 'rest')
    .every(step => step.status === 'completed');

  if (completion === true && !fullyComplete) errors.completion = '모든 훈련 단계를 완료하지 않은 기록은 부분 완료여야 합니다.';
  if (completion === false && fullyComplete) errors.completion = '모든 훈련 단계를 완료한 기록은 완료로 표시해야 합니다.';

  const ok = Object.keys(errors).length === 0;
  const value = ok ? {
    id: textValue(raw.id) || makeId('training'),
    ts: safeIso(raw.ts),
    recordVersion: FLEXIBILITY_RECORD_VERSION,
    protocolId: FLEXIBILITY_TRAINING_PROTOCOL_ID,
    source: 'local-manual',
    routineId,
    routineName: ROUTINES[routineId].name,
    warmupConfirmed: true,
    config: { workSeconds, restSeconds, sets },
    plannedSeconds,
    completedSeconds,
    completion: completion === true,
    completionStatus: completion === true ? 'complete' : 'partial',
    steps: stepsNormalized,
    notes: String(raw.notes ?? '').slice(0, NOTE_LIMIT),
  } : null;
  return { ok, errors, value, record: value };
}

function metricOf(record) {
  const config = FLEXIBILITY_KINDS[record?.kind];
  if (!config) return NaN;
  return Number(record?.[config.metric]);
}

export function benchmarkConditionKey(record) {
  const config = FLEXIBILITY_KINDS[record?.kind];
  if (!config || !PHASES[record?.phase] || !SUPPORTS[record?.supportMode]) return null;
  const base = [record.kind, record.phase, record.supportMode, record.alignmentConfirmed === true ? 'aligned' : 'unconfirmed', record.painFree === true ? 'painfree' : 'pain'];
  if (record.kind === 'PANCAKE') {
    const width = Number(record.heelWidthCm);
    const seat = Number(record.seatHeightCm);
    if (!Number.isFinite(width) || !Number.isFinite(seat)) return null;
    base.push(`width:${roundedCondition(width)}`, `seat:${roundedCondition(seat)}`);
  } else if (record.kind === 'MIDDLE_SPLIT') {
    if (!FOOT_ORIENTATIONS[record.footOrientation]) return null;
    base.push(`feet:${record.footOrientation}`);
  }
  return base.join('|');
}

/**
 * Compare a benchmark only with the exact eligible condition group.
 * deltaCm is current minus recent. improvementCm is direction-normalized, so a
 * positive number always means numerically better. A numerical PB is not proof
 * of certain physiological improvement, especially for small changes.
 */
export function comparison(current, records = []) {
  const config = FLEXIBILITY_KINDS[current?.kind];
  const metric = metricOf(current);
  const conditionKey = benchmarkConditionKey(current);
  if (!config || !Number.isFinite(metric) || !conditionKey) {
    return { eligible: false, reason: '비교할 수 있는 측정 기록이 아닙니다.', direction: null, recent: null, best: null, deltaCm: null, improvementCm: null, isPB: false, conditionKey };
  }
  if (current.alignmentConfirmed !== true || current.painFree !== true) {
    return { eligible: false, reason: '정렬과 통증 없음이 모두 확인된 기록만 PB를 계산합니다.', direction: config.better, recent: null, best: null, deltaCm: null, improvementCm: null, isPB: false, conditionKey };
  }

  const currentTime = Number.isFinite(Date.parse(current.ts)) ? Date.parse(current.ts) : Infinity;
  const recordList = Array.isArray(records) ? records : [];
  const currentIndex = current.id ? recordList.findIndex(record => record?.id === current.id) : -1;
  const candidates = recordList.filter((record, index) => {
    if (currentIndex >= 0 && Date.parse(record?.ts) === currentTime && index >= currentIndex) return false;
    if (!record || (current.id && record.id === current.id)) return false;
    if (record.alignmentConfirmed !== true || record.painFree !== true) return false;
    if (benchmarkConditionKey(record) !== conditionKey) return false;
    if (!Number.isFinite(metricOf(record))) return false;
    return true;
  });
  const prior = candidates.filter(record => {
    const time = Date.parse(record.ts);
    return !Number.isFinite(time) || time <= currentTime;
  });
  const pool = prior;
  const recent = pool.slice().reverse().sort((a, b) => (Date.parse(b.ts) || 0) - (Date.parse(a.ts) || 0))[0] || null;
  const best = pool.slice().sort((a, b) => config.better === 'lower' ? metricOf(a) - metricOf(b) : metricOf(b) - metricOf(a))[0] || null;
  const deltaCm = recent ? round(metric - metricOf(recent)) : null;
  const improvementCm = deltaCm == null ? null : round(config.better === 'lower' ? -deltaCm : deltaCm);
  const isPB = !best || (config.better === 'lower' ? metric < metricOf(best) : metric > metricOf(best));

  return {
    eligible: true,
    reason: null,
    direction: config.better,
    recent,
    best,
    deltaCm,
    improvementCm,
    isPB,
    conditionKey,
    note: '작은 수치 변화는 측정 오차일 수 있어 확실한 향상으로 단정하지 않습니다.',
  };
}

export const compareBenchmark = comparison;

function buildTrainingSteps(routineId, workSeconds = 30, restSeconds = 20, sets = 2) {
  const routine = ROUTINES[routineId];
  if (!routine) return [];
  const work = Math.max(10, Math.min(90, Math.round(Number(workSeconds) || 30)));
  const rest = Math.max(5, Math.min(60, Math.round(Number(restSeconds) || 20)));
  const count = Math.max(1, Math.min(4, Math.round(Number(sets) || 2)));
  return routine.build(work, rest, count).map(step => ({ ...step, completedSeconds: 0, status: 'not_started' }));
}

const STYLE = `
.flexibility-module-host{--flex-bg:var(--bg,#101319);--flex-card:var(--card,#1a2029);--flex-card2:var(--card2,#222a35);--flex-text:var(--text,#f3f5f7);--flex-muted:var(--muted,#aeb8c5);--flex-line:var(--line,#344050);--flex-accent:var(--accent,#66d9a7);--flex-danger:#ff8f8f;--flex-warn:#f2ca72;color:var(--flex-text);background:var(--flex-bg);font:inherit;color-scheme:dark}
.flexibility-module-host *{box-sizing:border-box}.flexibility-module-host .flex-wrap{width:min(100%,390px);margin:0 auto;padding:14px;line-height:1.45}.flexibility-module-host .flex-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;position:sticky;top:0;z-index:2;background:var(--flex-bg);padding:4px 0 10px}.flexibility-module-host button,.flexibility-module-host input,.flexibility-module-host select,.flexibility-module-host textarea{font:inherit}.flexibility-module-host button{min-height:44px;border:1px solid var(--flex-line);border-radius:12px;background:var(--flex-card2);color:var(--flex-text);padding:9px 12px;cursor:pointer}.flexibility-module-host button:hover{border-color:var(--flex-accent)}.flexibility-module-host button:focus-visible,.flexibility-module-host input:focus-visible,.flexibility-module-host select:focus-visible,.flexibility-module-host textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--flex-accent) 55%,transparent);outline-offset:2px}.flexibility-module-host button[disabled]{opacity:.45;cursor:not-allowed}.flexibility-module-host .flex-tabs button[aria-selected=true],.flexibility-module-host .flex-primary{background:var(--flex-accent);border-color:var(--flex-accent);color:#07130e;font-weight:750}.flexibility-module-host .flex-card{background:var(--flex-card);border:1px solid var(--flex-line);border-radius:16px;padding:14px;margin:10px 0}.flexibility-module-host .flex-grid{display:grid;gap:10px}.flexibility-module-host .flex-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.flexibility-module-host .flex-field{display:grid;gap:5px}.flexibility-module-host .flex-field>span,.flexibility-module-host legend{font-weight:700}.flexibility-module-host input[type=number],.flexibility-module-host select,.flexibility-module-host textarea{width:100%;min-height:44px;border:1px solid var(--flex-line);border-radius:10px;background:var(--flex-bg);color:var(--flex-text);padding:9px}.flexibility-module-host textarea{min-height:82px;resize:vertical}.flexibility-module-host fieldset{border:0;padding:0;margin:0}.flexibility-module-host .flex-check{display:flex;align-items:flex-start;gap:9px;padding:9px 0}.flexibility-module-host .flex-check input{width:22px;height:22px;flex:0 0 auto}.flexibility-module-host .flex-muted{color:var(--flex-muted);font-size:.92rem}.flexibility-module-host .flex-warning{color:var(--flex-warn)}.flexibility-module-host .flex-danger{color:var(--flex-danger)}.flexibility-module-host .flex-error{color:var(--flex-danger);min-height:1.2em;font-size:.88rem}.flexibility-module-host .flex-title{margin:4px 0 6px;font-size:1.3rem}.flexibility-module-host .flex-subtitle{margin:18px 0 5px;font-size:1.05rem}.flexibility-module-host .flex-list{display:grid;gap:8px}.flexibility-module-host .flex-choice{text-align:left;width:100%}.flexibility-module-host .flex-badge{display:inline-block;border:1px solid var(--flex-line);border-radius:999px;padding:2px 8px;font-size:.78rem;margin-right:4px}.flexibility-module-host .flex-pb{border-color:var(--flex-accent);color:var(--flex-accent)}.flexibility-module-host .flex-measure{font-size:1.35rem;font-weight:800}.flexibility-module-host .flex-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.flexibility-module-host .flex-actions>*{flex:1 1 120px}.flexibility-module-host .flex-timer{text-align:center;font-variant-numeric:tabular-nums;font-size:2.4rem;font-weight:850;padding:14px}.flexibility-module-host .flex-progress{height:9px;border-radius:99px;background:var(--flex-bg);overflow:hidden}.flexibility-module-host .flex-progress>span{display:block;height:100%;background:var(--flex-accent);width:0}.flexibility-module-host a{color:var(--flex-accent)}.flexibility-module-host hr{border:0;border-top:1px solid var(--flex-line);margin:16px 0}.flexibility-module-host ul{padding-left:20px}.flexibility-module-host .flex-status-completed{color:var(--flex-accent)}.flexibility-module-host .flex-status-skipped,.flexibility-module-host .flex-status-partial{color:var(--flex-warn)}
@media(max-width:350px){.flexibility-module-host .flex-two{grid-template-columns:1fr}.flexibility-module-host .flex-wrap{padding:10px}.flexibility-module-host .flex-tabs button{padding:7px 4px;font-size:.9rem}}
`;

function ensureStyle(element) {
  if (!element.querySelector(':scope > style[data-flexibility-style]')) {
    const style = document.createElement('style');
    style.dataset.flexibilityStyle = 'true';
    style.textContent = STYLE;
    element.prepend(style);
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatDate(iso) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '날짜 없음';
}

function metricText(record) {
  const config = FLEXIBILITY_KINDS[record?.kind];
  const metric = metricOf(record);
  return config && Number.isFinite(metric) ? `${round(metric, 1)}cm` : '측정값 없음';
}

function conditionsText(record) {
  const bits = [PHASES[record.phase] || record.phase, SUPPORTS[record.supportMode] || record.supportMode];
  if (record.kind === 'PANCAKE') bits.push(`뒤꿈치 ${roundedCondition(record.heelWidthCm)}cm`, `좌면 ${roundedCondition(record.seatHeightCm)}cm`);
  if (record.kind === 'MIDDLE_SPLIT') bits.push(FOOT_ORIENTATIONS[record.footOrientation] || record.footOrientation);
  bits.push(record.alignmentConfirmed ? '정렬 확인' : '정렬 미확인', record.painFree ? '통증 없음' : '통증/불편 관찰');
  return bits.filter(Boolean).join(' · ');
}

function setError(form, key, message) {
  const target = form.querySelector(`[data-error-for="${key}"]`);
  if (target) target.textContent = message || '';
}

function appendField(form, { name, label, type = 'number', min = 0, max, step = '0.1', help }) {
  const wrapper = el('label', 'flex-field');
  wrapper.append(el('span', '', label));
  const input = document.createElement('input');
  input.name = name;
  input.type = type;
  if (type === 'number') input.inputMode = 'decimal';
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  if (step != null) input.step = String(step);
  input.required = true;
  wrapper.append(input);
  if (help) wrapper.append(el('small', 'flex-muted', help));
  const error = el('div', 'flex-error');
  error.dataset.errorFor = name;
  wrapper.append(error);
  form.append(wrapper);
  return input;
}

function appendSelect(form, { name, label, options }) {
  const wrapper = el('label', 'flex-field');
  wrapper.append(el('span', '', label));
  const select = document.createElement('select');
  select.name = name;
  select.required = true;
  select.append(new Option('선택', ''));
  for (const [value, text] of Object.entries(options)) select.append(new Option(text, value));
  wrapper.append(select);
  const error = el('div', 'flex-error');
  error.dataset.errorFor = name;
  wrapper.append(error);
  form.append(wrapper);
  return select;
}

function renderResearch(container) {
  const card = el('section', 'flex-card');
  card.append(el('h3', 'flex-subtitle', '근거와 한계'));
  const intro = el('p', 'flex-muted', '이 기능은 실용적인 개인 기록 템플릿이며, 스플릿 달성용으로 과학적으로 검증된 특정 처방이 아닙니다. 180°를 보장하지 않으며 보편적인 정상 기준선을 제시하지 않습니다.');
  card.append(intro);
  const list = el('ul', 'flex-muted');
  const links = [
    ['189개 연구 메타분석', 'https://pubmed.ncbi.nlm.nih.gov/39614059/', '스트레칭이 유연성에 긍정적이었지만 스플릿 전용 프로토콜은 아닙니다. 더 높은 강도가 계속 추가 이득을 준다고 볼 수 없고, 10분/주는 의무 최소치나 보편적 상한이 아닙니다.'],
    ['Mayo Clinic 스트레칭 안내', 'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848', '5~10분 워밍업, 느리고 부드러운 동작, 통증 없이 진행하는 일반 안내입니다.'],
    ['무릎-벽 측정 신뢰도 연구', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3484905/', '발목 측정의 신뢰도를 다루지만 작은 mm 차이를 확실한 변화로 단정하면 안 됩니다.'],
  ];
  for (const [title, href, description] of links) {
    const item = el('li');
    const anchor = el('a', '', title);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    item.append(anchor, document.createTextNode(`: ${description}`));
    list.append(item);
  }
  card.append(list);
  const future = el('div', 'flex-muted');
  future.append(el('strong', '', '향후 우선순위 · 아직 구현 안 됨'));
  future.append(document.createTextNode(' 능동 스트레이트 레그 레이즈, 어깨 오버헤드 굴곡, 고관절 90/90 회전. 적절한 표준화 측정법을 사용하고 능동/수동 범위를 구분해야 합니다.'));
  card.append(future);
  container.append(card);
}

/** Create the standalone flexibility controller. */
export function createFlexibility({ host, store, save, toast } = {}) {
  if (!host || typeof host.replaceChildren !== 'function') throw new TypeError('host HTMLElement가 필요합니다.');
  if (!store || !Array.isArray(store.flexibility) || !Array.isArray(store.flexibilityTraining)) throw new TypeError('store.flexibility와 store.flexibilityTraining 배열이 필요합니다.');
  const persist = typeof save === 'function' ? save : () => {};
  const notify = typeof toast === 'function' ? toast : () => {};

  const trainingState = {
    routineId: null,
    status: 'idle',
    stepIndex: 0,
    steps: [],
    config: { workSeconds: 30, restSeconds: 20, sets: 2 },
    warmupConfirmed: false,
    sessionStartedAt: null,
    runningSince: null,
    elapsedBeforeRunMs: 0,
    frameHandle: null,
    frameKind: null,
    saved: false,
    saving: false,
    hiddenPaused: false,
    notes: '',
  };

  let root = null;
  let content = null;
  let openFlag = false;
  let activeTab = 'benchmark';
  let visibilityAttached = false;

  const performanceNow = () => globalThis.performance?.now?.() ?? Date.now();

  function cancelFrame() {
    if (trainingState.frameHandle == null) return;
    if (trainingState.frameKind === 'raf' && typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(trainingState.frameHandle);
    else globalThis.clearTimeout?.(trainingState.frameHandle);
    trainingState.frameHandle = null;
    trainingState.frameKind = null;
  }

  function scheduleTick() {
    cancelFrame();
    if (typeof globalThis.requestAnimationFrame === 'function') {
      trainingState.frameKind = 'raf';
      trainingState.frameHandle = globalThis.requestAnimationFrame(timerTick);
    } else {
      trainingState.frameKind = 'timeout';
      trainingState.frameHandle = globalThis.setTimeout(timerTick, 100);
    }
  }

  function currentElapsedMs() {
    return trainingState.elapsedBeforeRunMs + (trainingState.status === 'running' && trainingState.runningSince != null ? performanceNow() - trainingState.runningSince : 0);
  }

  function commitElapsed() {
    if (trainingState.status === 'running' && trainingState.runningSince != null) {
      trainingState.elapsedBeforeRunMs += Math.max(0, performanceNow() - trainingState.runningSince);
    }
    trainingState.runningSince = null;
  }

  function pauseTimer(reason = 'user') {
    if (trainingState.status !== 'running') return;
    commitElapsed();
    cancelFrame();
    trainingState.status = 'paused';
    trainingState.hiddenPaused = reason === 'hidden' || reason === 'close';
    updateTimerDisplay();
  }

  function timerTick() {
    if (trainingState.status !== 'running') return;
    const step = trainingState.steps[trainingState.stepIndex];
    if (!step) return;
    const plannedMs = step.plannedSeconds * 1000;
    if (currentElapsedMs() >= plannedMs) {
      commitElapsed();
      trainingState.elapsedBeforeRunMs = Math.max(plannedMs, trainingState.elapsedBeforeRunMs);
      trainingState.status = 'awaiting-confirm';
      cancelFrame();
      updateTimerDisplay();
      renderTrainingControls();
      return;
    }
    updateTimerDisplay();
    scheduleTick();
  }

  function visibilityChange() {
    if (document.hidden && trainingState.status === 'running') {
      pauseTimer('hidden');
      notify('화면이 숨겨져 타이머를 일시정지했어요.');
      renderTrainingControls();
    }
  }

  function attachVisibility() {
    if (!visibilityAttached) {
      document.addEventListener('visibilitychange', visibilityChange);
      visibilityAttached = true;
    }
  }

  function detachVisibility() {
    if (visibilityAttached) {
      document.removeEventListener('visibilitychange', visibilityChange);
      visibilityAttached = false;
    }
  }

  function renderShell() {
    host.replaceChildren();
    host.classList.add('flexibility-module-host');
    ensureStyle(host);
    root = el('div', 'flex-wrap');
    const tabs = el('nav', 'flex-tabs');
    tabs.setAttribute('aria-label', '유연성 메뉴');
    const tabItems = [['benchmark', '측정'], ['training', '짧은 훈련'], ['logs', '기록']];
    for (const [id, label] of tabItems) {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.flexTab = id;
      button.setAttribute('aria-selected', String(activeTab === id));
      button.addEventListener('click', () => setTab(id));
      tabs.append(button);
    }
    content = el('section');
    content.setAttribute('aria-label', '유연성 콘텐츠');
    root.append(tabs, content);
    host.append(root);
  }

  function setTab(tab) {
    activeTab = ['benchmark', 'training', 'logs'].includes(tab) ? tab : 'benchmark';
    if (!root) return;
    root.querySelectorAll('[data-flex-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.flexTab === activeTab)));
    if (activeTab === 'benchmark') renderBenchmarkChooser();
    else if (activeTab === 'training') renderTrainingChooser();
    else renderHistory(content, { includeTraining: true });
  }

  function renderBenchmarkChooser() {
    content.replaceChildren();
    content.append(el('h2', 'flex-title', '수동 유연성 측정'));
    content.append(el('p', 'flex-muted', '줄자나 자로 cm를 직접 측정해 입력합니다. 사진·영상·포즈에서 cm를 추정하지 않습니다. 측정 전과 훈련 후 기록은 섞어 비교하지 않습니다.'));
    const list = el('div', 'flex-list');
    for (const [kind, config] of Object.entries(FLEXIBILITY_KINDS)) {
      const button = el('button', 'flex-choice');
      button.type = 'button';
      button.append(el('strong', '', config.label), document.createElement('br'), el('span', 'flex-muted', config.metricLabel));
      button.addEventListener('click', () => renderBenchmarkForm(kind));
      list.append(button);
    }
    content.append(list);
    const safety = el('div', 'flex-card flex-warning', '날카로운 통증, 관절 통증, 저림이 있으면 즉시 중단하세요. 통증 없음 또는 정렬을 확인하지 않은 기록도 관찰용으로 저장할 수 있지만 PB에는 포함하지 않습니다.');
    content.append(safety);
    renderResearch(content);
  }

  function alignmentCopy(kind) {
    if (kind === 'PANCAKE') return '무릎을 펴고 편안한 힙힌지를 했으며, 척추만 둥글게 말아 거리를 줄이지 않았습니다.';
    if (kind === 'MIDDLE_SPLIT') return '무릎과 발 방향을 맞추고 지지한 상태에서 억지로 누르지 않았습니다.';
    if (kind.startsWith('FRONT_SPLIT')) return '앞다리를 확인했고 골반을 정면으로 향하게 해 좌우가 크게 열리지 않았습니다.';
    return '맨발로 뒤꿈치를 내리고, 무릎이 발가락 방향을 따라가게 했습니다.';
  }

  function benchmarkInstructions(kind) {
    if (kind === 'PANCAKE') return '편안한 스트래들에서 무릎을 편 채 골반부터 중립적으로 접습니다. 가슴뼈 하단(흉골 아래쪽)과 바닥의 수직 간격을 재고, 같은 뒤꿈치 너비와 좌면 높이를 함께 기록합니다.';
    if (kind === 'MIDDLE_SPLIT') return '지지대를 사용하고 억지로 밀지 않습니다. 바닥부터 골반을 받치는 지지대 윗면까지 높이/간격을 재며 발끝 정면과 위쪽을 구분합니다.';
    if (kind === 'FRONT_SPLIT_LEFT') return '왼발이 앞입니다. 골반을 정면으로 두고 지지한 골반과 바닥 사이 간격을 잽니다.';
    if (kind === 'FRONT_SPLIT_RIGHT') return '오른발이 앞입니다. 골반을 정면으로 두고 지지한 골반과 바닥 사이 간격을 잽니다.';
    return '맨발 엄지발가락부터 벽까지 거리를 재며 뒤꿈치는 바닥에 두고 무릎은 발가락 방향을 따릅니다.';
  }

  function renderBenchmarkForm(kind) {
    const config = FLEXIBILITY_KINDS[kind];
    if (!config) return renderBenchmarkChooser();
    content.replaceChildren();
    const back = el('button', '', '측정 종류로 돌아가기');
    back.type = 'button';
    back.addEventListener('click', renderBenchmarkChooser);
    content.append(back, el('h2', 'flex-title', config.label), el('p', 'flex-muted', benchmarkInstructions(kind)));

    const form = el('form', 'flex-card flex-grid');
    form.noValidate = true;
    const date = el('p', 'flex-muted', `기록 시각: ${formatDate(new Date().toISOString())} · 로컬 수동 cm 기록`);
    form.append(date);
    appendSelect(form, { name: 'phase', label: '측정 시점', options: PHASES });
    appendSelect(form, { name: 'supportMode', label: '지지 방식', options: SUPPORTS });
    appendField(form, { name: config.metric, label: `${config.metricLabel} (cm)`, max: config.max, help: config.better === 'lower' ? '간격이 낮을수록 수치상 향상입니다.' : '거리가 높을수록 수치상 향상입니다.' });
    if (kind === 'PANCAKE') {
      appendField(form, { name: 'heelWidthCm', label: '뒤꿈치 사이 너비 (cm)', max: 250, help: 'PB 비교에는 소수 첫째 자리로 반올림한 동일 너비만 사용합니다.' });
      appendField(form, { name: 'seatHeightCm', label: '좌면 높이 (cm)', max: 80, help: '바닥에 앉았다면 0cm. PB 비교에는 소수 첫째 자리로 반올림한 동일 높이만 사용합니다.' });
    }
    if (kind === 'MIDDLE_SPLIT') appendSelect(form, { name: 'footOrientation', label: '발 방향', options: FOOT_ORIENTATIONS });

    const align = el('label', 'flex-check');
    const alignInput = document.createElement('input');
    alignInput.type = 'checkbox'; alignInput.name = 'alignmentConfirmed';
    align.append(alignInput, el('span', '', alignmentCopy(kind)));
    form.append(align);
    const pain = el('label', 'flex-check');
    const painInput = document.createElement('input');
    painInput.type = 'checkbox'; painInput.name = 'painFree';
    pain.append(painInput, el('span', '', '날카로운 통증, 관절 통증, 저림 없이 편안한 범위에서 측정했습니다.'));
    form.append(pain);
    form.append(el('p', 'flex-warning', '체크하지 않아도 관찰 기록은 저장되지만 PB 비교에서는 제외됩니다. 증상이 있으면 측정과 스트레칭을 중단하세요.'));
    const noteLabel = el('label', 'flex-field');
    noteLabel.append(el('span', '', '메모 (선택)'));
    const notes = document.createElement('textarea'); notes.name = 'notes'; notes.maxLength = NOTE_LIMIT;
    noteLabel.append(notes, el('small', 'flex-muted', '메모는 텍스트로만 저장·표시합니다.'));
    form.append(noteLabel);
    const generalError = el('div', 'flex-error'); generalError.dataset.errorFor = 'record'; form.append(generalError);
    const submit = el('button', 'flex-primary', '측정 기록 저장'); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      form.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
      const data = Object.fromEntries(new FormData(form).entries());
      data.kind = kind;
      data.alignmentConfirmed = alignInput.checked;
      data.painFree = painInput.checked;
      const result = validateBenchmark(data);
      if (!result.ok) {
        for (const [key, message] of Object.entries(result.errors)) setError(form, key, message);
        notify('입력값을 확인해 주세요.');
        return;
      }
      submit.disabled = true;
      const record = result.value;
      const compare = comparison(record, store.flexibility);
      store.flexibility.push(record);
      try {
        await Promise.resolve(persist());
        notify(compare.eligible && compare.isPB ? '같은 조건에서 수치상 새 PB를 저장했어요.' : '유연성 측정을 저장했어요.');
        renderBenchmarkResult(record, compare);
      } catch (error) {
        const index = store.flexibility.findIndex(item => item.id === record.id);
        if (index >= 0) store.flexibility.splice(index, 1);
        submit.disabled = false;
        setError(form, 'record', `저장하지 못했습니다: ${String(error?.message || error)}`);
      }
    });
    content.append(form);
  }

  function renderBenchmarkResult(record, compare) {
    content.replaceChildren();
    content.append(el('h2', 'flex-title', '측정 저장 완료'));
    const card = el('section', 'flex-card');
    card.append(el('div', 'flex-muted', FLEXIBILITY_KINDS[record.kind].label), el('div', 'flex-measure', metricText(record)), el('div', 'flex-muted', conditionsText(record)));
    if (!compare.eligible) card.append(el('p', 'flex-warning', compare.reason));
    else {
      if (compare.recent) {
        const sign = compare.improvementCm > 0 ? '+' : '';
        card.append(el('p', '', `직전 같은 조건 대비 ${sign}${round(compare.improvementCm, 1)}cm ${compare.improvementCm > 0 ? '수치상 향상' : compare.improvementCm < 0 ? '수치상 감소' : '변화 없음'}`));
      } else card.append(el('p', '', '같은 조건의 첫 기준 기록입니다.'));
      if (compare.best) card.append(el('p', 'flex-muted', `이전 최고: ${metricText(compare.best)}`));
      if (compare.isPB) card.append(el('span', 'flex-badge flex-pb', '수치상 PB'));
      card.append(el('p', 'flex-muted', compare.note));
    }
    card.append(el('p', 'flex-muted', '조건이 다르면 비교하지 않아요. 보편적인 정상 기준선은 제공하지 않습니다.'));
    content.append(card);
    const again = el('button', 'flex-primary', '다른 측정 기록'); again.type = 'button'; again.addEventListener('click', renderBenchmarkChooser);
    const logs = el('button', '', '기록 보기'); logs.type = 'button'; logs.addEventListener('click', () => setTab('logs'));
    const actions = el('div', 'flex-actions'); actions.append(again, logs); content.append(actions);
  }

  function renderTrainingChooser() {
    if (['running', 'paused', 'awaiting-confirm', 'ready', 'stopped', 'finished'].includes(trainingState.status) && trainingState.routineId) {
      renderTrainingSession();
      return;
    }
    content.replaceChildren();
    content.append(el('h2', 'flex-title', '짧은 유연성 훈련'));
    content.append(el('p', 'flex-muted', '처음에는 주 2~3일 정도의 보수적인 템플릿으로 시작하세요. 고중량 Jefferson curl, oversplit, 반동, 고강도 PNF는 이 모듈에서 처방하지 않습니다.'));
    for (const [id, routine] of Object.entries(ROUTINES)) {
      const card = el('section', 'flex-card');
      card.append(el('h3', '', routine.name), el('p', 'flex-muted', routine.summary));
      const button = el('button', 'flex-primary', '이 루틴 준비'); button.type = 'button'; button.addEventListener('click', () => renderTrainingSetup(id));
      card.append(button); content.append(card);
    }
    const stop = el('div', 'flex-card flex-warning', '날카로운 통증, 관절 통증, 저림이 있으면 즉시 중단하세요. 편안한 범위만 사용합니다.');
    content.append(stop);
    renderResearch(content);
  }

  function renderTrainingSetup(routineId) {
    const routine = ROUTINES[routineId];
    if (!routine) return renderTrainingChooser();
    content.replaceChildren();
    const back = el('button', '', '루틴 목록으로 돌아가기'); back.type = 'button'; back.addEventListener('click', renderTrainingChooser);
    content.append(back, el('h2', 'flex-title', routine.name), el('p', 'flex-muted', routine.summary));
    const form = el('form', 'flex-card flex-grid'); form.noValidate = true;
    const warm = el('label', 'flex-check'); const warmInput = document.createElement('input'); warmInput.type = 'checkbox'; warmInput.name = 'warmupConfirmed';
    warm.append(warmInput, el('span', '', '5~10분 가벼운 워밍업을 완료했습니다.'));
    form.append(warm);
    const config = el('div', 'flex-two');
    const workWrap = el('label', 'flex-field'); workWrap.append(el('span', '', '유지 시간 (초)')); const work = document.createElement('input'); work.type = 'number'; work.min = '10'; work.max = '90'; work.step = '1'; work.value = '30'; workWrap.append(work);
    const restWrap = el('label', 'flex-field'); restWrap.append(el('span', '', '휴식 (초)')); const rest = document.createElement('input'); rest.type = 'number'; rest.min = '5'; rest.max = '60'; rest.step = '1'; rest.value = '20'; restWrap.append(rest);
    const setsWrap = el('label', 'flex-field'); setsWrap.append(el('span', '', '세트')); const sets = document.createElement('input'); sets.type = 'number'; sets.min = '1'; sets.max = '4'; sets.step = '1'; sets.value = '2'; setsWrap.append(sets);
    config.append(workWrap, restWrap, setsWrap); form.append(config);
    form.append(el('p', 'flex-muted', '기본값은 30초 × 2세트, 세트 사이 20초 휴식입니다. 타이머 종료만으로 완료 처리하지 않으며 직접 완료를 눌러야 합니다.'));
    const error = el('div', 'flex-error'); form.append(error);
    const start = el('button', 'flex-primary', '훈련 시작'); start.type = 'submit'; form.append(start);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const workSeconds = Number(work.value), restSeconds = Number(rest.value), setCount = Number(sets.value);
      if (!warmInput.checked) { error.textContent = '먼저 5~10분 워밍업을 완료하고 체크해 주세요.'; return; }
      if (!Number.isFinite(workSeconds) || workSeconds < 10 || workSeconds > 90 || !Number.isFinite(restSeconds) || restSeconds < 5 || restSeconds > 60 || !Number.isInteger(setCount) || setCount < 1 || setCount > 4) { error.textContent = '시간과 세트 범위를 확인해 주세요.'; return; }
      resetTrainingState();
      trainingState.routineId = routineId;
      trainingState.status = 'ready';
      trainingState.warmupConfirmed = true;
      trainingState.sessionStartedAt = new Date().toISOString();
      trainingState.config = { workSeconds, restSeconds, sets: setCount };
      trainingState.steps = buildTrainingSteps(routineId, workSeconds, restSeconds, setCount);
      renderTrainingSession();
    });
    content.append(form);
  }

  function resetTrainingState() {
    cancelFrame();
    Object.assign(trainingState, {
      routineId: null, status: 'idle', stepIndex: 0, steps: [], config: { workSeconds: 30, restSeconds: 20, sets: 2 }, warmupConfirmed: false,
      sessionStartedAt: null, runningSince: null, elapsedBeforeRunMs: 0, frameHandle: null, frameKind: null, saved: false, saving: false, hiddenPaused: false, notes: '',
    });
  }

  function currentStep() {
    return trainingState.steps[trainingState.stepIndex] || null;
  }

  function syncCurrentElapsed() {
    const step = currentStep();
    if (step) step.completedSeconds = round(currentElapsedMs() / 1000, 1);
  }

  function startOrResumeTimer() {
    const step = currentStep();
    if (!step || step.type === 'manual' || ['stopped', 'finished'].includes(trainingState.status)) return;
    if (trainingState.status === 'running') {
      pauseTimer('user');
      renderTrainingControls();
      return;
    }
    if (trainingState.status === 'awaiting-confirm') return;
    trainingState.status = 'running';
    trainingState.runningSince = performanceNow();
    trainingState.hiddenPaused = false;
    scheduleTick();
    renderTrainingControls();
  }

  function resetCurrentStep() {
    if (trainingState.status === 'running') pauseTimer('user');
    trainingState.elapsedBeforeRunMs = 0;
    const step = currentStep();
    if (step) { step.completedSeconds = 0; step.status = 'not_started'; }
    trainingState.status = 'ready';
    updateTimerDisplay();
    renderTrainingControls();
  }

  function advanceStep(status) {
    const step = currentStep();
    if (!step) return;
    if (trainingState.status === 'running') commitElapsed();
    cancelFrame();
    syncCurrentElapsed();
    step.status = status;
    if (status === 'completed' && step.type !== 'manual') step.completedSeconds = Math.max(step.plannedSeconds, step.completedSeconds);
    trainingState.stepIndex += 1;
    trainingState.elapsedBeforeRunMs = 0;
    trainingState.runningSince = null;
    if (trainingState.stepIndex >= trainingState.steps.length) trainingState.status = 'finished';
    else trainingState.status = 'ready';
    renderTrainingSession();
  }

  function completeCurrentStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type !== 'manual' && trainingState.status !== 'awaiting-confirm') return;
    advanceStep('completed');
  }

  function skipCurrentStep() {
    const step = currentStep();
    if (!step) return;
    if (trainingState.status === 'running') pauseTimer('user');
    syncCurrentElapsed();
    advanceStep('skipped');
  }

  function stopTraining() {
    if (trainingState.status === 'running') pauseTimer('user');
    const step = currentStep();
    if (step) {
      syncCurrentElapsed();
      if (step.completedSeconds > 0 && step.status === 'not_started') step.status = 'partial';
    }
    cancelFrame();
    trainingState.status = 'stopped';
    renderTrainingSession();
  }

  function updateTimerDisplay() {
    if (!content) return;
    const timer = content.querySelector('[data-training-timer]');
    const bar = content.querySelector('[data-training-progress]');
    const step = currentStep();
    if (!timer || !bar || !step || step.type === 'manual') return;
    const elapsed = currentElapsedMs();
    const remaining = Math.max(0, step.plannedSeconds * 1000 - elapsed);
    timer.textContent = `${Math.ceil(remaining / 1000)}초`;
    bar.style.width = `${Math.min(100, elapsed / (step.plannedSeconds * 1000) * 100)}%`;
  }

  function renderTrainingControls() {
    if (!content) return;
    const controls = content.querySelector('[data-training-controls]');
    if (!controls) return;
    controls.replaceChildren();
    const step = currentStep();
    if (!step) return;
    if (step.type === 'manual') {
      const complete = el('button', 'flex-primary', '수동 단계 완료'); complete.type = 'button'; complete.addEventListener('click', completeCurrentStep); controls.append(complete);
    } else {
      const toggle = el('button', 'flex-primary', trainingState.status === 'running' ? '일시정지' : '계속/시작'); toggle.type = 'button'; toggle.disabled = trainingState.status === 'awaiting-confirm'; toggle.addEventListener('click', startOrResumeTimer);
      const complete = el('button', '', step.type === 'rest' ? '휴식 완료' : '이 단계 완료'); complete.type = 'button'; complete.disabled = trainingState.status !== 'awaiting-confirm'; complete.addEventListener('click', completeCurrentStep);
      controls.append(toggle, complete);
    }
    const reset = el('button', '', '단계 초기화'); reset.type = 'button'; reset.addEventListener('click', resetCurrentStep);
    const skip = el('button', '', '단계 건너뛰기'); skip.type = 'button'; skip.addEventListener('click', skipCurrentStep);
    const stop = el('button', '', '훈련 중단'); stop.type = 'button'; stop.addEventListener('click', stopTraining);
    controls.append(reset, skip, stop);
  }

  function renderTrainingSession() {
    content.replaceChildren();
    const routine = ROUTINES[trainingState.routineId];
    content.append(el('h2', 'flex-title', routine?.name || '훈련'));
    content.append(el('p', 'flex-muted', `5~10분 워밍업 확인 · ${trainingState.config.workSeconds}초 × ${trainingState.config.sets} · 휴식 ${trainingState.config.restSeconds}초`));

    if (['stopped', 'finished'].includes(trainingState.status)) {
      renderTrainingSummary();
      return;
    }
    const step = currentStep();
    if (!step) { trainingState.status = 'finished'; return renderTrainingSummary(); }
    const card = el('section', 'flex-card');
    card.append(el('div', 'flex-muted', `${trainingState.stepIndex + 1} / ${trainingState.steps.length}`), el('h3', '', step.label), el('p', 'flex-muted', step.detail));
    if (step.type === 'manual') card.append(el('p', 'flex-warning', '반복을 실제로 마친 뒤 아래 완료 버튼을 직접 누르세요.'));
    else {
      const timer = el('div', 'flex-timer', `${step.plannedSeconds}초`); timer.dataset.trainingTimer = 'true';
      const progress = el('div', 'flex-progress'); const fill = el('span'); fill.dataset.trainingProgress = 'true'; progress.append(fill);
      card.append(timer, progress);
      if (trainingState.hiddenPaused) card.append(el('p', 'flex-warning', '화면이 숨겨져 자동 일시정지되었습니다. 계속/시작을 눌러 재개하세요.'));
      if (trainingState.status === 'awaiting-confirm') card.append(el('p', 'flex-warning', '시간이 끝났습니다. 실제로 유지했다면 이 단계 완료를 눌러 주세요.'));
    }
    const controls = el('div', 'flex-actions'); controls.dataset.trainingControls = 'true'; card.append(controls);
    content.append(card);
    renderTrainingControls(); updateTimerDisplay();

    const stepList = el('section', 'flex-card'); stepList.append(el('h3', '', '단계'));
    trainingState.steps.forEach((item, index) => {
      const marker = index === trainingState.stepIndex ? '현재' : item.status === 'completed' ? '완료' : item.status === 'skipped' ? '건너뜀' : item.status === 'partial' ? '부분' : '예정';
      stepList.append(el('div', `flex-muted flex-status-${item.status}`, `${index + 1}. ${item.label} · ${marker}`));
    });
    content.append(stepList);
  }

  function trainingDraft() {
    const steps = trainingState.steps.map((step, index) => {
      let status = step.status;
      let completedSeconds = Number(step.completedSeconds) || 0;
      if (index === trainingState.stepIndex && !['finished', 'stopped'].includes(trainingState.status)) {
        completedSeconds = round(currentElapsedMs() / 1000, 1);
        if (completedSeconds > 0 && status === 'not_started') status = 'partial';
      }
      return { id: step.id, label: step.label, type: step.type, plannedSeconds: step.plannedSeconds, completedSeconds, status };
    });
    const completion = steps.filter(step => step.type !== 'rest').length > 0 && steps.filter(step => step.type !== 'rest').every(step => step.status === 'completed');
    return {
      id: makeId('training'), ts: trainingState.sessionStartedAt || new Date().toISOString(), routineId: trainingState.routineId,
      warmupConfirmed: trainingState.warmupConfirmed, config: { ...trainingState.config }, completion, steps, notes: trainingState.notes,
    };
  }

  function renderTrainingSummary() {
    const draft = trainingDraft();
    const validation = validateTraining(draft);
    const card = el('section', 'flex-card');
    const completed = validation.ok ? validation.value.completedSeconds : draft.steps.filter(step => step.type !== 'rest').reduce((sum, step) => sum + step.completedSeconds, 0);
    const planned = validation.ok ? validation.value.plannedSeconds : draft.steps.filter(step => step.type !== 'rest').reduce((sum, step) => sum + step.plannedSeconds, 0);
    const completion = validation.ok ? validation.value.completion : draft.completion;
    card.append(el('h3', '', completion ? '루틴 완료' : '부분 훈련'), el('div', 'flex-measure', `${round(completed, 1)}초 / 계획 ${round(planned, 1)}초`), el('p', 'flex-muted', '완료·건너뜀·부분 수행을 구분해 저장합니다. 타이머를 시작만 한 경우에는 기록이 생기지 않습니다.'));
    const list = el('div', 'flex-list');
    for (const step of draft.steps) {
      const statusLabel = { completed: '완료', skipped: '건너뜀', partial: '부분', not_started: '미시작' }[step.status] || step.status;
      list.append(el('div', `flex-muted flex-status-${step.status}`, `${step.label} · ${statusLabel}${step.completedSeconds ? ` · ${round(step.completedSeconds, 1)}초` : ''}`));
    }
    card.append(list);
    const noteLabel = el('label', 'flex-field'); noteLabel.append(el('span', '', '훈련 메모 (선택)')); const notes = document.createElement('textarea'); notes.maxLength = NOTE_LIMIT; notes.value = trainingState.notes; notes.addEventListener('input', () => { trainingState.notes = notes.value; }); noteLabel.append(notes); card.append(noteLabel);
    const error = el('div', 'flex-error'); card.append(error);
    const saveButton = el('button', 'flex-primary', trainingState.saved ? '저장됨' : trainingState.saving ? '저장 중…' : '훈련 기록 저장'); saveButton.type = 'button'; saveButton.disabled = trainingState.saved || trainingState.saving || !validation.ok;
    saveButton.addEventListener('click', async () => {
      if (trainingState.saved || trainingState.saving) return;
      const fresh = validateTraining(trainingDraft());
      if (!fresh.ok) { error.textContent = Object.values(fresh.errors)[0] || '저장할 훈련 내용이 없습니다.'; return; }
      trainingState.saving = true; saveButton.disabled = true; saveButton.textContent = '저장 중…';
      store.flexibilityTraining.push(fresh.value);
      try {
        await Promise.resolve(persist());
        trainingState.saved = true; trainingState.saving = false; saveButton.textContent = '저장됨'; notify('훈련 기록을 저장했어요.');
      } catch (saveError) {
        const index = store.flexibilityTraining.findIndex(item => item.id === fresh.value.id);
        if (index >= 0) store.flexibilityTraining.splice(index, 1);
        trainingState.saving = false; saveButton.disabled = false; saveButton.textContent = '훈련 기록 저장'; error.textContent = `저장하지 못했습니다: ${String(saveError?.message || saveError)}`;
      }
    });
    card.append(saveButton); content.append(card);
    const actions = el('div', 'flex-actions');
    const newTraining = el('button', '', '새 루틴'); newTraining.type = 'button'; newTraining.addEventListener('click', () => { resetTrainingState(); renderTrainingChooser(); });
    const logs = el('button', '', '기록 보기'); logs.type = 'button'; logs.addEventListener('click', () => setTab('logs'));
    actions.append(newTraining, logs); content.append(actions);
  }

  function renderHistory(element, options = {}) {
    if (!element || typeof element.replaceChildren !== 'function') throw new TypeError('기록을 표시할 HTMLElement가 필요합니다.');
    const includeTraining = typeof options === 'boolean' ? options : options.includeTraining !== false;
    element.replaceChildren();
    element.classList.add('flexibility-module-host');
    ensureStyle(element);
    const wrap = element === content ? element : el('div', 'flex-wrap');
    if (element !== content) element.append(wrap);
    wrap.append(el('h2', 'flex-title', '유연성 기록'));
    wrap.append(el('p', 'flex-muted', '조건이 다르면 비교하지 않아요. 작은 변화는 측정 오차일 수 있고, 보편적인 정상 기준선은 없습니다.'));
    const records = store.flexibility.slice().sort((a, b) => (Date.parse(b.ts) || 0) - (Date.parse(a.ts) || 0));
    if (!records.length) wrap.append(el('div', 'flex-card flex-muted', '아직 수동 측정 기록이 없습니다.'));
    for (const record of records) {
      const card = el('article', 'flex-card');
      const config = FLEXIBILITY_KINDS[record.kind];
      card.append(el('div', 'flex-muted', `${config?.label || record.kind} · ${formatDate(record.ts)}`), el('div', 'flex-measure', metricText(record)), el('div', 'flex-muted', conditionsText(record)));
      const recordIndex = store.flexibility.findIndex(item => item.id === record.id);
      const recordTime = Date.parse(record.ts) || 0;
      const prior = store.flexibility.filter((item, index) => item.id !== record.id && ((Date.parse(item.ts) || 0) < recordTime || ((Date.parse(item.ts) || 0) === recordTime && index < recordIndex)));
      const compare = comparison(record, prior);
      if (compare.eligible && compare.recent) {
        const sign = compare.improvementCm > 0 ? '+' : '';
        card.append(el('div', compare.improvementCm > 0 ? 'flex-status-completed' : 'flex-muted', `직전 같은 조건 대비 ${sign}${round(compare.improvementCm, 1)}cm`));
      } else if (!compare.eligible) card.append(el('div', 'flex-warning', 'PB 제외 · 정렬/통증 없음 미확인'));
      if (record.notes) {
        const note = el('p', 'flex-muted');
        note.textContent = record.notes;
        card.append(note);
      }
      wrap.append(card);
    }

    if (includeTraining) {
      wrap.append(el('h3', 'flex-subtitle', '훈련 기록'));
      const training = store.flexibilityTraining.slice().sort((a, b) => (Date.parse(b.ts) || 0) - (Date.parse(a.ts) || 0));
      if (!training.length) wrap.append(el('div', 'flex-card flex-muted', '아직 저장한 훈련 기록이 없습니다.'));
      for (const record of training) {
        const card = el('article', 'flex-card');
        card.append(el('div', 'flex-muted', `${record.routineName || ROUTINES[record.routineId]?.name || record.routineId} · ${formatDate(record.ts)}`), el('div', 'flex-measure', `${round(Number(record.completedSeconds) || 0, 1)}초 / 계획 ${round(Number(record.plannedSeconds) || 0, 1)}초`), el('span', `flex-badge ${record.completion ? 'flex-pb' : ''}`, record.completion ? '완료' : '부분 완료'));
        const skipped = Array.isArray(record.steps) ? record.steps.filter(step => step.status === 'skipped').length : 0;
        if (skipped) card.append(el('p', 'flex-warning', `건너뜀 ${skipped}단계`));
        if (record.notes) { const note = el('p', 'flex-muted'); note.textContent = record.notes; card.append(note); }
        wrap.append(card);
      }
    }
    return element;
  }

  function open(initial = 'benchmark') {
    openFlag = true;
    activeTab = ['benchmark', 'training', 'logs'].includes(initial) ? initial : 'benchmark';
    attachVisibility();
    renderShell();
    setTab(activeTab);
    return api;
  }

  function close() {
    if (trainingState.status === 'running') pauseTimer('close');
    else cancelFrame();
    detachVisibility();
    openFlag = false;
    host.replaceChildren();
    host.classList.remove('flexibility-module-host');
  }

  const api = {
    open,
    close,
    renderHistory,
    validateBenchmark,
    validateTraining,
    comparison,
    compareBenchmark,
    trainingState,
    isOpen: () => openFlag,
    test: {
      buildTrainingSteps,
      benchmarkConditionKey,
      metricOf,
      routines: ROUTINES,
      trainingDraft,
      pauseTimer,
      currentElapsedMs,
    },
  };
  return api;
}

export const __flexibilityTest = Object.freeze({
  buildTrainingSteps,
  benchmarkConditionKey,
  metricOf,
  roundedCondition,
  routines: ROUTINES,
});
