/**
 * HoldTracker manual flexibility benchmarks and short guided training.
 *
 * Measurements are entered manually. This module never requests camera/photo
 * permissions or estimates centimetres/angles from images. The parent owns
 * navigation, persistence, import/export, and backup.
 */

export const FLEXIBILITY_RECORD_VERSION = 1;
export const FLEXIBILITY_PROTOCOL_ID = 'holdtracker-flex-manual-v1';
export const FLEXIBILITY_TRAINING_PROTOCOL_ID = 'holdtracker-flex-training-v1';
export const FLEXIBILITY_ADAPTED_RECORD_VERSION = 2;

const LATTICE_PANCAKE_URL = 'https://latticetraining.com/blog/flexibility-for-climbers-improve-your-pancake';
const LATTICE_FRONT_URL = 'https://latticetraining.com/blog/flexibility-for-climbers-improve-your-front-split';
const STRETCH_THERAPY_PANCAKE_URL = 'https://stretchtherapy.net/the-pancake-reflections-on-mastering-the-essential-anterior-pelvic-tilt';
const MAYO_STRETCHING_URL = 'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848';
const ANKLE_RESEARCH_URL = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3484905/';

export const FLEXIBILITY_KINDS = Object.freeze({
  PANCAKE: Object.freeze({
    label: '팬케이크 · 앱 보조 간격', metric: 'gapCm', metricLabel: '가슴뼈 아래쪽부터 바닥까지 보조 간격', unit: 'cm', better: 'lower', min: 0, max: 150,
    group: 'app', recordVersion: 1, protocolId: FLEXIBILITY_PROTOCOL_ID,
  }),
  MIDDLE_SPLIT: Object.freeze({
    label: '미들 스플릿 · 앱 보조 간격', metric: 'gapCm', metricLabel: '바닥부터 골반 지지대 윗면까지 보조 간격', unit: 'cm', better: 'lower', min: 0, max: 200,
    group: 'app', recordVersion: 1, protocolId: FLEXIBILITY_PROTOCOL_ID,
  }),
  FRONT_SPLIT_LEFT: Object.freeze({
    label: '프론트 스플릿 · 왼발 앞 · 앱 보조 간격', metric: 'gapCm', metricLabel: '지지된 골반의 바닥 보조 간격', unit: 'cm', better: 'lower', min: 0, max: 150,
    group: 'app', recordVersion: 1, protocolId: FLEXIBILITY_PROTOCOL_ID,
  }),
  FRONT_SPLIT_RIGHT: Object.freeze({
    label: '프론트 스플릿 · 오른발 앞 · 앱 보조 간격', metric: 'gapCm', metricLabel: '지지된 골반의 바닥 보조 간격', unit: 'cm', better: 'lower', min: 0, max: 150,
    group: 'app', recordVersion: 1, protocolId: FLEXIBILITY_PROTOCOL_ID,
  }),
  ANKLE_LEFT: Object.freeze({
    label: '무릎-벽 · 왼쪽', metric: 'distanceCm', metricLabel: '맨발 엄지발가락부터 벽까지 거리', unit: 'cm', better: 'higher', min: 0, max: 30,
    group: 'ankle', recordVersion: 1, protocolId: FLEXIBILITY_PROTOCOL_ID,
  }),
  ANKLE_RIGHT: Object.freeze({
    label: '무릎-벽 · 오른쪽', metric: 'distanceCm', metricLabel: '맨발 엄지발가락부터 벽까지 거리', unit: 'cm', better: 'higher', min: 0, max: 30,
    group: 'ankle', recordVersion: 1, protocolId: FLEXIBILITY_PROTOCOL_ID,
  }),
  LATTICE_PANCAKE_STRADDLE: Object.freeze({
    label: 'Lattice 팬케이크 · 스트래들 각도', metric: 'angleDeg', metricLabel: '360° 각도기로 잰 스트래들 각도', unit: '°', better: 'higher', min: 0, max: 180,
    group: 'expert', recordVersion: 2, protocolId: 'lattice-pancake-straddle-adapted-v1', sourceMethod: 'lattice-adapted', sourceUrl: LATTICE_PANCAKE_URL,
  }),
  LATTICE_PANCAKE_REACH: Object.freeze({
    label: 'Lattice 팬케이크 · 손 도달 거리 (앱 기준선 적용)', metric: 'reachCm', metricLabel: '고정 바닥 기준선 대비 손 도달 거리', unit: 'cm', better: 'higher', min: -100, max: 250,
    group: 'expert', recordVersion: 2, protocolId: 'lattice-pancake-reach-adapted-v1', sourceMethod: 'lattice-adapted', sourceUrl: LATTICE_PANCAKE_URL,
  }),
  LATTICE_FRONT_SPLIT_LEFT: Object.freeze({
    label: 'Lattice 프론트 스플릿 · 왼발 앞', metric: 'distanceCm', metricLabel: '앞뒤 뒤꿈치 사이 바닥 직선거리', unit: 'cm', better: 'higher', min: 0, max: 300,
    group: 'expert', recordVersion: 2, protocolId: 'lattice-front-split-left-adapted-v1', sourceMethod: 'lattice-adapted', sourceUrl: LATTICE_FRONT_URL,
  }),
  LATTICE_FRONT_SPLIT_RIGHT: Object.freeze({
    label: 'Lattice 프론트 스플릿 · 오른발 앞', metric: 'distanceCm', metricLabel: '앞뒤 뒤꿈치 사이 바닥 직선거리', unit: 'cm', better: 'higher', min: 0, max: 300,
    group: 'expert', recordVersion: 2, protocolId: 'lattice-front-split-right-adapted-v1', sourceMethod: 'lattice-adapted', sourceUrl: LATTICE_FRONT_URL,
  }),
});

const PHASES = Object.freeze({ before: '스트레칭 전 · 워밍업 후', after: '훈련 후' });
const SUPPORTS = Object.freeze({ hands: '손 지지', blocks: '블록/의자 지지', none: '지지 없음' });
const FOOT_ORIENTATIONS = Object.freeze({ forward: '발끝 정면', up: '발끝 위쪽' });
const NOTE_LIMIT = 2000;
const MILESTONE_KEYS = Object.freeze(['elbows', 'forearms', 'head', 'chest', 'belly']);
const MILESTONE_LABELS = Object.freeze({ elbows: '팔꿈치', forearms: '전완', head: '머리', chest: '가슴', belly: '배' });

function sourceStep(section, sourceUrl, sourceDose, adaptation) {
  return { section, sourceUrl, sourceDose, adaptation };
}

const ROUTINES = Object.freeze({
  pancake: Object.freeze({
    name: '팬케이크 짧은 루틴', category: 'app', badge: '앱의 일반 저강도 템플릿 · Mayo 일반 권고 참고', sourceMethod: 'app-general-template', sourceUrl: MAYO_STRETCHING_URL, programVersion: 'app-pancake-low-intensity-v1',
    summary: '지지한 앉은 스트래들 힙힌지 6회 후, 편안한 지지 팬케이크를 진행합니다. 30초 × 2와 20초 휴식은 전문가 스플릿 프로토콜이 아닌 앱 기본값입니다.',
    build(workSeconds, restSeconds, sets) {
      const steps = [manualStep('pancake-hinge', '지지한 앉은 스트래들 힙힌지 6회', '무릎을 편 범위에서 천천히 골반부터 접습니다. 척추만 둥글게 말아 거리를 만들지 않습니다.')];
      addTimedSets(steps, 'pancake-hold', '편안한 지지 팬케이크', sets, workSeconds, restSeconds, '손이나 블록으로 지지하고 힘으로 바닥에 누르지 않습니다.');
      return steps;
    },
  }),
  middle: Object.freeze({
    name: '미들 스플릿 짧은 루틴', category: 'app', badge: '앱의 일반 저강도 템플릿 · Mayo 일반 권고 참고', sourceMethod: 'app-general-template', sourceUrl: MAYO_STRETCHING_URL, programVersion: 'app-middle-low-intensity-v1',
    summary: '손목에 부담이 없도록 서서 지지한 내전근 준비 동작 후, 지지 미들 스플릿을 진행합니다. 30초 × 2와 20초 휴식은 전문가 스플릿 프로토콜이 아닌 앱 기본값입니다.',
    build(workSeconds, restSeconds, sets) {
      const steps = [manualStep('middle-rock', '지지한 와이드 스탠스/내전근 록백 6회', '의자나 높은 지지대를 잡고 부드럽게 이동합니다. 손목 바닥 지지가 불편하면 서서만 진행합니다.')];
      addTimedSets(steps, 'middle-hold', '지지 미들 스플릿', sets, workSeconds, restSeconds, '무릎과 발 방향을 맞추고, 블록이나 의자로 지지하며 억지로 밀지 않습니다.');
      return steps;
    },
  }),
  front: Object.freeze({
    name: '프론트 스플릿 짧은 루틴', category: 'app', badge: '앱의 일반 저강도 템플릿 · Mayo 일반 권고 참고', sourceMethod: 'app-general-template', sourceUrl: MAYO_STRETCHING_URL, programVersion: 'app-front-low-intensity-v1',
    summary: '양쪽 고관절 앞쪽과 햄스트링을 각각 지지한 자세로 진행합니다. 30초 × 2와 20초 휴식은 전문가 스플릿 프로토콜이 아닌 앱 기본값입니다.',
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
    name: '발목 선택 루틴', category: 'app', badge: '앱의 일반 저강도 템플릿 · Mayo 일반 권고 참고', sourceMethod: 'app-general-template', sourceUrl: MAYO_STRETCHING_URL, programVersion: 'app-ankle-low-intensity-v1',
    summary: '무릎-벽 느린 반복과 무릎을 굽힌 종아리 스트레칭을 양쪽에 진행합니다. 30초 × 2와 20초 휴식은 전문가 프로토콜이 아닌 앱 기본값입니다.',
    build(workSeconds, restSeconds, sets) {
      const steps = [
        manualStep('ankle-wall-left', '왼쪽 무릎-벽 천천히 6회', '맨발, 뒤꿈치를 바닥에 두고 무릎이 발가락 방향을 따르게 합니다.'),
        manualStep('ankle-wall-right', '오른쪽 무릎-벽 천천히 6회', '맨발, 뒤꿈치를 바닥에 두고 무릎이 발가락 방향을 따르게 합니다.'),
      ];
      for (const side of ['왼쪽', '오른쪽']) addTimedSets(steps, `ankle-calf-${side}`, `${side} 무릎 굽힌 종아리 스트레칭`, sets, workSeconds, restSeconds, '뒤꿈치를 내린 채 부드럽게 유지합니다.');
      return steps;
    },
  }),
  lattice_pancake: Object.freeze({
    name: 'Lattice 팬케이크 · 저강도 앱 변형 루틴', category: 'source-adapted', badge: '출처 기반 앱 변형 · 원문 전체 프로그램 아님 · 제휴/검증 주장 없음', sourceMethod: 'lattice-adapted', sourceUrl: LATTICE_PANCAKE_URL, programVersion: 'lattice-pancake-app-low-intensity-v1', protocolId: 'lattice-pancake-training-adapted-v1', recordVersion: 2,
    summary: '자세 인식/제어 → 준비 → 가동범위 → 끝범위 근력 순서만 참고해 강도·세트·부하를 낮춘 앱 버전입니다. 약 12주 재측정은 선택 안내이며 자동 알림이 아닙니다.',
    build(workSeconds, restSeconds, sets) {
      const src = LATTICE_PANCAKE_URL;
      const steps = [
        manualStep('lp-awareness-rock', 'Awareness/control · Rocking Pancake 6회', '무릎을 편 스트래들에서 가슴을 열고 골반을 앞뒤로 작게 움직입니다. 둔근을 세게 조이지 않습니다.', sourceStep('Awareness/control', src, '원문 권장: 2세트 × 6회, 세트 사이 30초', '앱 변형: 1세트 × 6회, 맨몸·편안한 범위.')),
        manualStep('lp-prep-hinge', 'Preparation · 맨몸 Seated Good Morning 4회', '무릎을 굽힌 지지 스트래들에서 등을 둥글게 말지 말고 3초 내려가기·2초 멈춤·2초 올라오기·1초 멈춤으로 진행합니다.', sourceStep('Preparation', src, '원문 권장: 3세트 × 4회, 60초 휴식, 8초 템포; 처음은 맨몸 가능', '앱 변형: 맨몸 1세트 × 4회, 최대 허용 강도 대신 편안한 범위.')),
      ];
      addTimedSets(steps, 'lp-rom-hold', 'ROM · 지지 팬케이크 홀드', sets, workSeconds, restSeconds, '좌면이나 손 지지를 높여 다리와 등을 곧게 유지하고 가슴을 엽니다. 강제로 누르거나 최대 강도로 버티지 않습니다.', sourceStep('ROM', src, '원문 Elevated Pancake: 3세트 × 4회, 60초 휴식, 8초 템포', `앱 변형: 정적 지지 홀드 ${workSeconds}초 × ${sets}세트, 휴식 ${restSeconds}초.`));
      steps.push(manualStep('lp-strength-side-lift', 'End-range strength · 지지 선 자세 옆다리 들기 좌우 6회', '낮은 지지대를 잡고 각 다리를 편안한 높이까지만 옆으로 천천히 듭니다. 외부 중량과 반동을 사용하지 않습니다.', sourceStep('End-range strength', src, '원문 Barre Lift - Lateral: 2세트 × 6회, 30초 휴식', '앱 변형: 좌우 1세트 × 6회, 낮은 지지·무중량·편안한 높이.')));
      return steps;
    },
  }),
  lattice_front: Object.freeze({
    name: 'Lattice 프론트 스플릿 · 저강도 앱 변형 루틴', category: 'source-adapted', badge: '출처 기반 앱 변형 · 원문 전체 프로그램 아님 · 제휴/검증 주장 없음', sourceMethod: 'lattice-adapted', sourceUrl: LATTICE_FRONT_URL, programVersion: 'lattice-front-app-low-intensity-v1', protocolId: 'lattice-front-training-adapted-v1', recordVersion: 2,
    summary: '자세 인식/제어 → 준비 → 가동범위 → 끝범위 근력 순서만 참고한 낮은 강도 버전입니다. 8~12주 재측정은 선택 안내이며 자동 알림이 아닙니다.',
    build(workSeconds, restSeconds, sets) {
      const src = LATTICE_FRONT_URL;
      const steps = [
        manualStep('lf-awareness-square', 'Awareness/control · 정면 골반 자가 확인', '거울 또는 손으로 양쪽 앞골반 지점을 확인하고 수평·정면을 편안하게 맞춥니다. 앱 비교는 엄격한 square 조건을 선택하지만 원문은 클라이밍을 위해 일부 회전을 허용합니다.', sourceStep('Awareness/control', src, '원문: 골반의 좌우 앞 지점을 확인해 square/level 인지', '앱 변형: 반복 전 수동 자가 확인 1회.')),
        manualStep('lf-prep-leg', 'Preparation · 지지한 느린 다리 움직임 좌우 6회', '고정물을 잡고 반동 없이 각 다리를 앞뒤로 천천히 움직입니다. 편안한 높이만 사용합니다.', sourceStep('Preparation', src, '원문 Leg Swings: 좌우 2세트 × 6회, 15초 휴식', '앱 변형: 좌우 1세트 × 6회, 비탄도성·느린 제어.')),
      ];
      for (const side of ['왼쪽', '오른쪽']) {
        addTimedSets(steps, `lf-rom-hip-${side}`, `ROM · ${side} 지지 하프니링 힙플렉서`, sets, workSeconds, restSeconds, '뒤무릎 아래 패드를 대고 골반을 정면으로 유지합니다. Couch Stretch 대신 발을 벽에 올리지 않는 낮은 노력 대안이며 최대 강도를 사용하지 않습니다.', sourceStep('ROM', src, '원문 Couch Stretch: 3회 × 30초, 세트 사이 30초', `앱 변형: 하프니링 대안 ${workSeconds}초 × ${sets}세트, 휴식 ${restSeconds}초.`));
        addTimedSets(steps, `lf-rom-ham-${side}`, `ROM · ${side} 지지 햄스트링`, sets, workSeconds, restSeconds, '등을 둥글게 말지 않고 골반부터 작게 접습니다. 통증 없는 편안한 범위를 유지합니다.', sourceStep('ROM', src, '원문 Hamstring Stretch: 3회 × 30초', `앱 변형: 지지 홀드 ${workSeconds}초 × ${sets}세트, 휴식 ${restSeconds}초.`));
      }
      steps.push(manualStep('lf-strength-supine', 'End-range strength · 누운 다리 들기 좌우 6회', '누워서 한 다리를 편안한 높이에 가볍게 지지한 뒤 가능한 범위에서 살짝 들어 올립니다. 두 무릎을 펴되 외부 중량과 최대 높이를 요구하지 않습니다.', sourceStep('End-range strength', src, '원문 Supine Hip Flexor Lift: 좌우 2세트 × 6회, 30초 휴식', '앱 변형: 좌우 1세트 × 6회, 편안한 높이·무중량.')));
      return steps;
    },
  }),
});

function manualStep(id, label, detail, metadata = {}) { return { id, label, detail, type: 'manual', plannedSeconds: 0, ...metadata }; }
function timedStep(id, label, seconds, detail, metadata = {}) { return { id, label, detail, type: 'timed', plannedSeconds: seconds, ...metadata }; }
function restStep(id, seconds, metadata = {}) { return { id, label: '휴식', detail: '호흡을 편하게 하고 다음 세트를 준비합니다.', type: 'rest', plannedSeconds: seconds, ...metadata }; }
function addTimedSets(steps, idBase, label, sets, workSeconds, restSeconds, detail, metadata = {}) {
  for (let set = 1; set <= sets; set += 1) {
    if (steps.length && steps[steps.length - 1].type !== 'manual') steps.push(restStep(`${idBase}-rest-before-${set}`, restSeconds, metadata));
    steps.push(timedStep(`${idBase}-${set}`, `${label} · ${set}/${sets}`, workSeconds, detail, metadata));
  }
}

function isPlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function textValue(value) { return value == null ? '' : String(value).trim(); }
function booleanValue(value) {
  if (value === true || value === false) return value;
  if (value === 'true' || value === 1 || value === '1' || value === 'on') return true;
  if (value === 'false' || value === 0 || value === '0' || value == null || value === '') return false;
  return null;
}
function numberField(raw, key, label, min, max, errors, unit = 'cm') {
  const original = raw?.[key];
  if (original === '' || original == null || (typeof original === 'string' && !original.trim())) { errors[key] = `${label}을(를) 입력해 주세요.`; return null; }
  const value = typeof original === 'number' ? original : Number(original);
  if (!Number.isFinite(value)) { errors[key] = `${label}은(는) 유한한 숫자여야 합니다.`; return null; }
  if (value < min || value > max) { errors[key] = `${label}은(는) ${min}~${max}${unit} 범위로 입력해 주세요.`; return null; }
  return value;
}
function enumField(raw, key, allowed, label, errors) {
  const value = textValue(raw?.[key]);
  if (!allowed.includes(value)) { errors[key] = `${label}을(를) 선택해 주세요.`; return null; }
  return value;
}
function safeIso(value) { return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : new Date().toISOString(); }
function makeId(prefix = 'flex') { return `${Date.now()}-${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
function roundedCondition(value) { return Math.round(Number(value) * 10) / 10; }
function round(value, digits = 2) { const scale = 10 ** digits; return Math.round((value + Number.EPSILON) * scale) / scale; }

function expectedBenchmarkVersion(config) { return config?.recordVersion || 1; }
function normalizedBenchmarkProtocol(record) {
  const config = FLEXIBILITY_KINDS[record?.kind];
  if (!config) return '';
  if (record.protocolId == null || record.protocolId === '') return config.recordVersion === 1 ? FLEXIBILITY_PROTOCOL_ID : config.protocolId;
  return textValue(record.protocolId);
}
function validateVersionTags(raw, config, errors) {
  if (!config) return;
  if (raw.recordVersion != null && raw.recordVersion !== '') {
    const supplied = Number(raw.recordVersion);
    if (!Number.isInteger(supplied) || supplied !== expectedBenchmarkVersion(config)) errors.recordVersion = '지원하지 않는 측정 기록 버전입니다.';
  }
  if (raw.protocolId != null && textValue(raw.protocolId) !== config.protocolId) errors.protocolId = '측정 프로토콜이 일치하지 않습니다.';
}

/** Validate and normalize a manual benchmark record. */
export function validateBenchmark(raw) {
  const errors = {};
  if (!isPlainObject(raw)) return { ok: false, errors: { record: '측정 기록 형식이 올바르지 않습니다.' }, value: null, record: null };
  const kind = enumField(raw, 'kind', Object.keys(FLEXIBILITY_KINDS), '측정 종류', errors);
  const config = kind ? FLEXIBILITY_KINDS[kind] : null;
  validateVersionTags(raw, config, errors);
  const phase = enumField(raw, 'phase', Object.keys(PHASES), '측정 시점', errors);
  const supportMode = enumField(raw, 'supportMode', Object.keys(SUPPORTS), '지지 방식', errors);
  const alignmentConfirmed = booleanValue(raw.alignmentConfirmed);
  const painFree = booleanValue(raw.painFree);
  if (alignmentConfirmed == null) errors.alignmentConfirmed = '정렬 확인 값이 올바르지 않습니다.';
  if (painFree == null) errors.painFree = '통증 확인 값이 올바르지 않습니다.';
  const normalized = {
    id: textValue(raw.id) || makeId('benchmark'), ts: safeIso(raw.ts), recordVersion: config?.recordVersion || FLEXIBILITY_RECORD_VERSION,
    protocolId: config?.protocolId || FLEXIBILITY_PROTOCOL_ID,
    ...(config?.recordVersion === 2 ? { sourceMethod: config.sourceMethod, sourceUrl: config.sourceUrl } : { source: 'local-manual' }),
    measurementMode: config?.unit === '°' ? 'manual-angle' : 'manual-cm', kind, phase, supportMode,
    alignmentConfirmed: alignmentConfirmed === true, painFree: painFree === true, notes: String(raw.notes ?? '').slice(0, NOTE_LIMIT),
  };
  if (config) normalized[config.metric] = numberField(raw, config.metric, config.metricLabel, config.min, config.max, errors, config.unit);
  if (kind === 'PANCAKE') {
    normalized.heelWidthCm = numberField(raw, 'heelWidthCm', '뒤꿈치 사이 너비', 0, 250, errors);
    normalized.seatHeightCm = numberField(raw, 'seatHeightCm', '좌면 높이', 0, 80, errors);
  } else if (kind === 'MIDDLE_SPLIT') normalized.footOrientation = enumField(raw, 'footOrientation', Object.keys(FOOT_ORIENTATIONS), '발 방향', errors);
  else if (kind === 'FRONT_SPLIT_LEFT') normalized.frontLeg = 'left';
  else if (kind === 'FRONT_SPLIT_RIGHT') normalized.frontLeg = 'right';
  else if (kind === 'ANKLE_LEFT') normalized.side = 'left';
  else if (kind === 'ANKLE_RIGHT') normalized.side = 'right';
  else if (kind === 'LATTICE_PANCAKE_STRADDLE') {
    normalized.seatHeightCm = numberField(raw, 'seatHeightCm', '좌면 높이', 0, 80, errors);
    normalized.footOrientation = enumField(raw, 'footOrientation', Object.keys(FOOT_ORIENTATIONS), '발 방향', errors);
  } else if (kind === 'LATTICE_PANCAKE_REACH') {
    normalized.referenceLabel = textValue(raw.referenceLabel).slice(0, 120);
    if (!normalized.referenceLabel) errors.referenceLabel = '고정 기준선 이름을 입력해 주세요.';
    normalized.seatHeightCm = numberField(raw, 'seatHeightCm', '좌면 높이', 0, 80, errors);
    normalized.straddleAngleDeg = numberField(raw, 'straddleAngleDeg', '스트래들 각도', 0, 180, errors, '°');
    const milestonesRaw = isPlainObject(raw.milestones) ? raw.milestones : {};
    normalized.milestones = {};
    for (const key of MILESTONE_KEYS) {
      const parsed = booleanValue(milestonesRaw[key] ?? raw[`milestone${key[0].toUpperCase()}${key.slice(1)}`]);
      if (parsed == null) errors[`milestones.${key}`] = `${MILESTONE_LABELS[key]} 도달 값이 올바르지 않습니다.`;
      normalized.milestones[key] = parsed === true;
    }
  } else if (kind === 'LATTICE_FRONT_SPLIT_LEFT' || kind === 'LATTICE_FRONT_SPLIT_RIGHT') {
    normalized.frontLeg = kind.endsWith('LEFT') ? 'left' : 'right';
    normalized.pelvisOrientation = enumField(raw, 'pelvisOrientation', ['square'], '골반 방향', errors);
  }
  const ok = Object.keys(errors).length === 0;
  const record = ok ? normalized : null;
  return { ok, errors, value: record, record };
}

function trainingVersionCheck(raw, routine, errors) {
  const expectedVersion = routine?.recordVersion || 1;
  const expectedProtocol = routine?.protocolId || FLEXIBILITY_TRAINING_PROTOCOL_ID;
  if (raw.recordVersion != null && raw.recordVersion !== '' && Number(raw.recordVersion) !== expectedVersion) errors.recordVersion = '지원하지 않는 훈련 기록 버전입니다.';
  if (raw.protocolId != null && textValue(raw.protocolId) !== expectedProtocol) errors.protocolId = '훈련 프로토콜이 일치하지 않습니다.';
}

/** Validate and normalize a saved training log, primarily for backup import. */
export function validateTraining(raw) {
  const errors = {};
  if (!isPlainObject(raw)) return { ok: false, errors: { record: '훈련 기록 형식이 올바르지 않습니다.' }, value: null, record: null };
  const routineId = enumField(raw, 'routineId', Object.keys(ROUTINES), '루틴', errors);
  const routine = routineId ? ROUTINES[routineId] : null;
  trainingVersionCheck(raw, routine, errors);
  const warmupConfirmed = booleanValue(raw.warmupConfirmed);
  const completion = booleanValue(raw.completion);
  if (warmupConfirmed !== true) errors.warmupConfirmed = '5~10분 워밍업 확인이 필요합니다.';
  if (completion == null) errors.completion = '완료 여부 값이 올바르지 않습니다.';
  const configRaw = isPlainObject(raw.config) ? raw.config : {};
  const workSeconds = numberField(configRaw, 'workSeconds', '동작 시간', 10, 90, errors, '초');
  const restSeconds = numberField(configRaw, 'restSeconds', '휴식 시간', 5, 60, errors, '초');
  const sets = numberField(configRaw, 'sets', '세트 수', 1, 4, errors, '');
  if (Number.isFinite(sets) && !Number.isInteger(sets)) errors.sets = '세트 수는 정수여야 합니다.';
  if (!Array.isArray(raw.steps) || raw.steps.length === 0 || raw.steps.length > 100) errors.steps = '단계 기록이 필요합니다.';
  const allowedTypes = ['manual', 'timed', 'rest'];
  const allowedStatuses = ['completed', 'skipped', 'partial', 'not_started'];
  const stepsNormalized = [];
  if (Array.isArray(raw.steps)) raw.steps.slice(0, 100).forEach((step, index) => {
    if (!isPlainObject(step)) { errors[`steps.${index}`] = '단계 형식이 올바르지 않습니다.'; return; }
    const type = textValue(step.type), status = textValue(step.status);
    const plannedSeconds = Number(step.plannedSeconds), completedSeconds = Number(step.completedSeconds);
    if (!allowedTypes.includes(type)) errors[`steps.${index}.type`] = '단계 종류가 올바르지 않습니다.';
    if (!allowedStatuses.includes(status)) errors[`steps.${index}.status`] = '단계 상태가 올바르지 않습니다.';
    if (!Number.isFinite(plannedSeconds) || plannedSeconds < 0 || plannedSeconds > 600) errors[`steps.${index}.plannedSeconds`] = '계획 시간이 올바르지 않습니다.';
    if (!Number.isFinite(completedSeconds) || completedSeconds < 0 || completedSeconds > 3600) errors[`steps.${index}.completedSeconds`] = '실행 시간이 올바르지 않습니다.';
    if (routine?.category === 'source-adapted' && type === 'manual' && status === 'partial') errors[`steps.${index}.status`] = '수동 반복 단계는 완료 또는 건너뜀으로 기록해 주세요.';
    if (routine?.category === 'source-adapted' && type === 'manual' && (plannedSeconds !== 0 || completedSeconds !== 0)) errors[`steps.${index}.completedSeconds`] = '수동 반복 단계는 타이머 유지 시간에 포함하지 않습니다.';
    const normalizedStep = { id: textValue(step.id) || `step-${index + 1}`, label: String(step.label ?? '').slice(0, 300), type, plannedSeconds, completedSeconds, status };
    if (routine?.category === 'source-adapted') {
      normalizedStep.section = textValue(step.section).slice(0, 80);
      normalizedStep.sourceUrl = routine.sourceUrl;
      normalizedStep.sourceDose = textValue(step.sourceDose).slice(0, 500);
      normalizedStep.adaptation = textValue(step.adaptation).slice(0, 500);
      if (!normalizedStep.section || !normalizedStep.sourceDose || !normalizedStep.adaptation) errors[`steps.${index}.source`] = '출처 기반 단계의 구분·원문 용량·앱 변경 설명이 필요합니다.';
    }
    stepsNormalized.push(normalizedStep);
  });
  if (stepsNormalized.length && !stepsNormalized.some(step => step.status !== 'not_started')) errors.steps = '시작만 한 세션은 저장할 수 없습니다.';
  const exerciseSteps = stepsNormalized.filter(step => step.type !== 'rest');
  const plannedSeconds = exerciseSteps.reduce((sum, step) => sum + (Number.isFinite(step.plannedSeconds) ? step.plannedSeconds : 0), 0);
  const completedSeconds = exerciseSteps.reduce((sum, step) => sum + (Number.isFinite(step.completedSeconds) ? step.completedSeconds : 0), 0);
  const fullyComplete = exerciseSteps.length > 0 && exerciseSteps.every(step => step.status === 'completed');
  if (completion === true && !fullyComplete) errors.completion = '모든 훈련 단계를 완료하지 않은 기록은 부분 완료여야 합니다.';
  if (completion === false && fullyComplete) errors.completion = '모든 훈련 단계를 완료한 기록은 완료로 표시해야 합니다.';
  const ok = Object.keys(errors).length === 0;
  const value = ok ? {
    id: textValue(raw.id) || makeId('training'), ts: safeIso(raw.ts), recordVersion: routine.recordVersion || FLEXIBILITY_RECORD_VERSION,
    protocolId: routine.protocolId || FLEXIBILITY_TRAINING_PROTOCOL_ID,
    ...(routine.category === 'source-adapted' ? { sourceMethod: routine.sourceMethod, sourceUrl: routine.sourceUrl, programVersion: routine.programVersion } : { source: 'local-manual' }),
    routineId, routineName: routine.name, warmupConfirmed: true, config: { workSeconds, restSeconds, sets }, plannedSeconds, completedSeconds,
    completion: completion === true, completionStatus: completion === true ? 'complete' : 'partial', steps: stepsNormalized, notes: String(raw.notes ?? '').slice(0, NOTE_LIMIT),
  } : null;
  return { ok, errors, value, record: value };
}

export function metricOf(record) { const config = FLEXIBILITY_KINDS[record?.kind]; return config ? Number(record?.[config.metric]) : NaN; }
export function metricUnit(recordOrKind) { const kind = typeof recordOrKind === 'string' ? recordOrKind : recordOrKind?.kind; return FLEXIBILITY_KINDS[kind]?.unit || ''; }
export function metricLabel(recordOrKind) { const kind = typeof recordOrKind === 'string' ? recordOrKind : recordOrKind?.kind; return FLEXIBILITY_KINDS[kind]?.metricLabel || '측정값'; }
export function metricText(record) { const metric = metricOf(record); const unit = metricUnit(record); return Number.isFinite(metric) ? `${round(metric, 1)}${unit}` : '측정값 없음'; }

export function benchmarkConditionKey(record) {
  const config = FLEXIBILITY_KINDS[record?.kind];
  if (!config || !PHASES[record?.phase] || !SUPPORTS[record?.supportMode]) return null;
  const protocolId = normalizedBenchmarkProtocol(record);
  if (!protocolId || protocolId !== config.protocolId) return null;
  const base = [record.kind, `protocol:${protocolId}`, record.phase, record.supportMode, record.alignmentConfirmed === true ? 'aligned' : 'unconfirmed', record.painFree === true ? 'painfree' : 'pain'];
  if (record.kind === 'PANCAKE') {
    const width = Number(record.heelWidthCm), seat = Number(record.seatHeightCm);
    if (!Number.isFinite(width) || !Number.isFinite(seat)) return null;
    base.push(`width:${roundedCondition(width)}`, `seat:${roundedCondition(seat)}`);
  } else if (record.kind === 'MIDDLE_SPLIT') {
    if (!FOOT_ORIENTATIONS[record.footOrientation]) return null;
    base.push(`feet:${record.footOrientation}`);
  } else if (record.kind === 'LATTICE_PANCAKE_STRADDLE') {
    const seat = Number(record.seatHeightCm);
    if (!Number.isFinite(seat) || !FOOT_ORIENTATIONS[record.footOrientation]) return null;
    base.push(`seat:${roundedCondition(seat)}`, `feet:${record.footOrientation}`);
  } else if (record.kind === 'LATTICE_PANCAKE_REACH') {
    const seat = Number(record.seatHeightCm), angle = Number(record.straddleAngleDeg), reference = textValue(record.referenceLabel).toLocaleLowerCase('ko-KR');
    if (!Number.isFinite(seat) || !Number.isFinite(angle) || !reference) return null;
    base.push(`reference:${reference}`, `seat:${roundedCondition(seat)}`, `straddle:${roundedCondition(angle)}`);
  } else if (record.kind === 'LATTICE_FRONT_SPLIT_LEFT' || record.kind === 'LATTICE_FRONT_SPLIT_RIGHT') {
    const expectedSide = record.kind.endsWith('LEFT') ? 'left' : 'right';
    if (record.frontLeg !== expectedSide || record.pelvisOrientation !== 'square') return null;
    base.push(`side:${expectedSide}`, 'pelvis:square');
  }
  return base.join('|');
}

/** Compare only exact protocol and condition groups. */
export function comparison(current, records = []) {
  const config = FLEXIBILITY_KINDS[current?.kind], metric = metricOf(current), conditionKey = benchmarkConditionKey(current), unit = metricUnit(current);
  const empty = { eligible: false, direction: config?.better || null, recent: null, best: null, deltaValue: null, improvementValue: null, deltaCm: null, improvementCm: null, unit, isPB: false, conditionKey };
  if (!config || !Number.isFinite(metric) || !conditionKey) return { ...empty, reason: '비교할 수 있는 측정 기록이 아닙니다.' };
  if (current.alignmentConfirmed !== true || current.painFree !== true) return { ...empty, reason: '정렬과 통증 없음이 모두 확인된 기록만 PB를 계산합니다.' };
  const currentTime = Number.isFinite(Date.parse(current.ts)) ? Date.parse(current.ts) : Infinity;
  const recordList = Array.isArray(records) ? records : [];
  const currentIndex = current.id ? recordList.findIndex(record => record?.id === current.id) : -1;
  const candidates = recordList.filter((record, index) => {
    if (currentIndex >= 0 && Date.parse(record?.ts) === currentTime && index >= currentIndex) return false;
    return !!record && !(current.id && record.id === current.id) && record.alignmentConfirmed === true && record.painFree === true && benchmarkConditionKey(record) === conditionKey && Number.isFinite(metricOf(record));
  });
  const pool = candidates.filter(record => { const time = Date.parse(record.ts); return !Number.isFinite(time) || time <= currentTime; });
  const recent = pool.slice().reverse().sort((a, b) => (Date.parse(b.ts) || 0) - (Date.parse(a.ts) || 0))[0] || null;
  const best = pool.slice().sort((a, b) => config.better === 'lower' ? metricOf(a) - metricOf(b) : metricOf(b) - metricOf(a))[0] || null;
  const deltaValue = recent ? round(metric - metricOf(recent)) : null;
  const improvementValue = deltaValue == null ? null : round(config.better === 'lower' ? -deltaValue : deltaValue);
  return {
    eligible: true, reason: null, direction: config.better, recent, best, deltaValue, improvementValue,
    deltaCm: unit === 'cm' ? deltaValue : null, improvementCm: unit === 'cm' ? improvementValue : null, unit,
    isPB: !best || (config.better === 'lower' ? metric < metricOf(best) : metric > metricOf(best)), conditionKey,
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

function conditionsText(record) {
  const bits = [PHASES[record.phase] || record.phase, SUPPORTS[record.supportMode] || record.supportMode];
  if (record.kind === 'PANCAKE') bits.push(`뒤꿈치 ${roundedCondition(record.heelWidthCm)}cm`, `좌면 ${roundedCondition(record.seatHeightCm)}cm`);
  if (record.kind === 'MIDDLE_SPLIT') bits.push(FOOT_ORIENTATIONS[record.footOrientation] || record.footOrientation);
  if (record.kind === 'LATTICE_PANCAKE_STRADDLE') bits.push(`좌면 ${roundedCondition(record.seatHeightCm)}cm`, FOOT_ORIENTATIONS[record.footOrientation] || record.footOrientation);
  if (record.kind === 'LATTICE_PANCAKE_REACH') bits.push(`기준선 ${record.referenceLabel}`, `좌면 ${roundedCondition(record.seatHeightCm)}cm`, `스트래들 ${roundedCondition(record.straddleAngleDeg)}°`);
  if (record.kind === 'LATTICE_FRONT_SPLIT_LEFT' || record.kind === 'LATTICE_FRONT_SPLIT_RIGHT') bits.push(record.frontLeg === 'left' ? '왼발 앞' : '오른발 앞', '골반 골반 정면 자가 확인');
  bits.push(record.alignmentConfirmed ? '정렬 확인' : '정렬 미확인', record.painFree ? '통증 없음' : '통증 없음 미확인');
  return bits.filter(Boolean).join(' · ');
}

function milestoneText(record) {
  if (record?.kind !== 'LATTICE_PANCAKE_REACH' || !isPlainObject(record.milestones)) return '';
  const reached = MILESTONE_KEYS.filter(key => record.milestones[key]).map(key => MILESTONE_LABELS[key]);
  return reached.length ? `자가 보고 접촉: ${reached.join(', ')}` : '자가 보고 접촉: 없음';
}

function appendSourceLink(container, title, href, description) {
  const paragraph = el('p', 'flex-muted');
  const anchor = el('a', '', title); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
  paragraph.append(anchor, document.createTextNode(`: ${description}`)); container.append(paragraph);
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
  card.append(el('h3', 'flex-subtitle', '출처, 앱 변형, 한계'));
  card.append(el('p', 'flex-muted', '원문 권장과 앱이 정한 반복 기록 규칙을 구분합니다. 이 기능은 Lattice 또는 다른 출처와 제휴하지 않았고, 앱 변형 방식이 검증된 표준이라는 뜻도 아닙니다. 180° 달성이나 보편적 정상 기준을 제공하지 않습니다.'));
  appendSourceLink(card, 'Lattice 팬케이크 원문', LATTICE_PANCAKE_URL, '각도기로 스트래들 각도, 바닥 접촉 이정표, 열린 가슴과 굽지 않은 등을 유지한 손 도달 거리를 제안합니다. 앱의 고정 기준선·정확한 조건 키·양수·음수 거리 표기는 반복성을 위한 앱 규칙입니다.');
  appendSourceLink(card, 'Stretch Therapy 팬케이크 설명', STRETCH_THERAPY_PANCAKE_URL, '팬케이크는 척추를 둥글게 만드는 것이 아니라 고관절 굴곡과 전방 골반경사가 핵심이며, 가슴만 낮은 간격은 올바른 동작의 증명이 아닙니다.');
  appendSourceLink(card, 'Lattice 프론트 스플릿 원문', LATTICE_FRONT_URL, '기본 측정은 앞뒤 뒤꿈치 거리입니다. 원문은 곧은 다리와 수평 골반·다리 정렬을 설명하면서 클라이밍 목적의 일부 골반 회전도 허용합니다. 앱 PB는 더 엄격한 골반 정면 자가 확인끼리만 비교합니다.');
  appendSourceLink(card, 'Mayo Clinic 일반 스트레칭 안내', MAYO_STRETCHING_URL, '5~10분 워밍업, 느리고 부드러운 동작, 통증 없는 범위를 참고한 일반 안전 안내입니다. 앱의 30초 × 2/20초 휴식은 전문가 스플릿 프로토콜이 아닙니다.');
  appendSourceLink(card, '무릎-벽 측정 신뢰도 연구', ANKLE_RESEARCH_URL, '발목 무릎-벽 검사의 연구 출처입니다. 작은 mm 차이를 확실한 변화로 단정하지 않습니다.');
  card.append(el('p', 'flex-muted', '팬케이크 약 12주, 프론트 스플릿 8~12주 재측정은 원문의 선택적 가이드 문구일 뿐 자동 알림이나 진급 알고리즘이 아닙니다.'));
  container.append(card);
}

/** Create the standalone flexibility controller. *//** Create the standalone flexibility controller. */
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
    content.append(el('p', 'flex-muted', '줄자·자·각도기로 직접 측정합니다. 사진·영상·포즈에서 cm나 각도를 추정하지 않으며 새 권한을 요청하지 않습니다. 측정 전과 훈련 후, 다른 프로토콜은 섞어 비교하지 않습니다.'));
    const groups = [
      ['expert', '전문가 출처 기반 · 수동 측정'],
      ['app', '앱 자체 보조 기록'],
      ['ankle', '연구 기반 검사'],
    ];
    for (const [group, title] of groups) {
      content.append(el('h3', 'flex-subtitle', title));
      const list = el('div', 'flex-list');
      for (const [kind, config] of Object.entries(FLEXIBILITY_KINDS).filter(([, item]) => item.group === group)) {
        const button = el('button', 'flex-choice'); button.type = 'button';
        button.append(el('strong', '', config.label), document.createElement('br'), el('span', 'flex-muted', `${config.metricLabel} (${config.unit})`));
        button.addEventListener('click', () => renderBenchmarkForm(kind)); list.append(button);
      }
      content.append(list);
    }
    content.append(el('div', 'flex-card flex-warning', '날카로운 통증, 관절 통증, 저림이 있으면 즉시 중단하세요. 통증 없음 또는 정렬을 확인하지 않은 기록도 관찰용으로 저장할 수 있지만 PB에는 포함하지 않습니다.'));
    renderResearch(content);
  }

  function alignmentCopy(kind) {
    if (kind === 'PANCAKE' || kind === 'LATTICE_PANCAKE_STRADDLE' || kind === 'LATTICE_PANCAKE_REACH') return '다리를 곧게 유지하고 가슴을 연 채 골반부터 접었으며, 척추를 둥글게 말아 수치를 늘리거나 간격을 줄이지 않았습니다.';
    if (kind === 'MIDDLE_SPLIT') return '무릎과 발 방향을 맞추고 지지한 상태에서 억지로 누르지 않았습니다.';
    if (kind.includes('FRONT_SPLIT')) return '앞뒤 무릎을 곧게 유지하고 골반 방향·고관절·무릎·발목 정렬을 직접 확인했습니다.';
    return '맨발로 뒤꿈치를 내리고, 무릎이 발가락 방향을 따라가게 했습니다.';
  }

  function benchmarkInstructions(kind) {
    if (kind === 'PANCAKE') return '앱 자체 보조 기록입니다. 편안한 스트래들에서 무릎을 편 채 골반부터 접고 흉골 아래쪽과 바닥의 수직 간격을 잽니다. 이 gap은 전문가 검증 지표가 아니며 가슴만 낮춘 자세가 올바른 팬케이크를 증명하지 않습니다.';
    if (kind === 'MIDDLE_SPLIT') return '앱 자체 보조 기록입니다. 지지대를 사용하고 바닥부터 골반 지지대 윗면까지 보조 간격을 재며 발끝 정면/위쪽을 구분합니다.';
    if (kind === 'FRONT_SPLIT_LEFT') return '앱 자체 보조 기록입니다. 왼발을 앞에 두고 square 골반을 자가 확인한 뒤 지지된 골반과 바닥 사이 보조 간격을 잽니다.';
    if (kind === 'FRONT_SPLIT_RIGHT') return '앱 자체 보조 기록입니다. 오른발을 앞에 두고 square 골반을 자가 확인한 뒤 지지된 골반과 바닥 사이 보조 간격을 잽니다.';
    if (kind === 'LATTICE_PANCAKE_STRADDLE') return '원문은 360° 각도기로 스트래들 각도를 측정하도록 제안합니다. 앱은 좌면 높이와 발 방향까지 고정해 같은 조건끼리만 비교합니다. 다리 곧게·가슴 열림을 직접 확인하세요.';
    if (kind === 'LATTICE_PANCAKE_REACH') return '원문은 열린 가슴과 굽지 않은 등을 유지한 손 도달 거리를 제안하지만 정확한 0점은 지정하지 않습니다. 앱은 바닥의 고정 기준선을 0으로 정하고 앞쪽을 +, 뒤쪽을 -로 기록하는 반복성 규칙을 추가했습니다.';
    if (kind === 'LATTICE_FRONT_SPLIT_LEFT' || kind === 'LATTICE_FRONT_SPLIT_RIGHT') return `${kind.endsWith('LEFT') ? '왼발' : '오른발'}이 앞입니다. 원문의 기본 뒤꿈치-뒤꿈치 바닥 직선거리 측정을 사용합니다. 원문은 클라이밍에 일부 회전을 허용하지만 앱 PB는 엄격한 square 골반 자가 확인끼리만 비교하며 반대쪽이나 gap 기록과 비교하지 않습니다.`;
    return '연구에 사용된 무릎-벽 방식입니다. 맨발 엄지발가락부터 벽까지 거리를 재며 뒤꿈치는 바닥에 두고 무릎은 발가락 방향을 따릅니다.';
  }

  function appendBenchmarkAttribution(form, kind, config) {
    const box = el('div', 'flex-card');
    if (config.group === 'expert') {
      box.append(el('strong', '', '원문 권장 vs 앱 변형'));
      if (kind.startsWith('LATTICE_PANCAKE')) appendSourceLink(box, '원문 권장', LATTICE_PANCAKE_URL, '각도·접촉 이정표·자세를 유지한 손 도달 측정.');
      else appendSourceLink(box, '원문 권장', LATTICE_FRONT_URL, '뒤꿈치-뒤꿈치 기본 측정과 프론트 스플릿 정렬 설명.');
      box.append(el('p', 'flex-muted', kind === 'LATTICE_PANCAKE_REACH' ? '앱 변형: 고정 기준선, signed +/− 방향, 좌면·스트래들 각도 조건 키는 앱의 반복성 규칙이며 원문의 검증된 표준이 아닙니다.' : kind === 'LATTICE_PANCAKE_STRADDLE' ? '앱 변형: 좌면 높이와 발 방향을 정확 조건 키에 포함합니다. 원문이 검증한 판정 규칙이라는 뜻이 아닙니다.' : '앱 변형: 비교용으로 square 골반을 엄격히 요구합니다. 원문은 클라이밍을 위해 일부 회전을 허용합니다.'));
    } else if (config.group === 'ankle') appendSourceLink(box, 'Primary research', ANKLE_RESEARCH_URL, '무릎-벽 검사의 신뢰도 근거.');
    else box.append(el('strong', '', '앱 자체 보조 기록'), el('p', 'flex-muted', '이 간격은 전문가가 검증한 유연성 점수가 아닙니다. 예전 기록과 검색·히스토리 호환을 위해 유지합니다.'));
    form.append(box);
  }

  function renderBenchmarkForm(kind) {
    const config = FLEXIBILITY_KINDS[kind];
    if (!config) return renderBenchmarkChooser();
    content.replaceChildren();
    const back = el('button', '', '측정 종류로 돌아가기'); back.type = 'button'; back.addEventListener('click', renderBenchmarkChooser);
    content.append(back, el('h2', 'flex-title', config.label), el('p', 'flex-muted', benchmarkInstructions(kind)));
    const form = el('form', 'flex-card flex-grid'); form.noValidate = true;
    form.append(el('p', 'flex-muted', `기록 시각: ${formatDate(new Date().toISOString())} · 로컬 수동 ${config.unit} 기록`));
    appendBenchmarkAttribution(form, kind, config);
    appendSelect(form, { name: 'phase', label: '측정 시점', options: PHASES });
    appendSelect(form, { name: 'supportMode', label: '지지 방식', options: SUPPORTS });
    appendField(form, { name: config.metric, label: `${config.metricLabel} (${config.unit})`, min: config.min, max: config.max, help: config.better === 'lower' ? `낮을수록 수치상 향상입니다. ${config.unit} 단위로 입력합니다.` : `높을수록 수치상 향상입니다. ${config.metric === 'reachCm' ? '기준선은 0, 앞은 +, 뒤는 -입니다.' : ''}` });
    if (kind === 'PANCAKE') {
      appendField(form, { name: 'heelWidthCm', label: '뒤꿈치 사이 너비 (cm)', max: 250, help: 'PB 비교에는 소수 첫째 자리로 반올림한 동일 너비만 사용합니다.' });
      appendField(form, { name: 'seatHeightCm', label: '좌면 높이 (cm)', max: 80, help: '바닥에 앉았다면 0cm.' });
    }
    if (kind === 'MIDDLE_SPLIT' || kind === 'LATTICE_PANCAKE_STRADDLE') appendSelect(form, { name: 'footOrientation', label: '발 방향', options: FOOT_ORIENTATIONS });
    if (kind === 'LATTICE_PANCAKE_STRADDLE') appendField(form, { name: 'seatHeightCm', label: '좌면 높이 (cm)', max: 80, help: '같은 좌면 높이와 발 방향끼리만 비교합니다.' });
    if (kind === 'LATTICE_PANCAKE_REACH') {
      appendField(form, { name: 'referenceLabel', label: '고정 기준선 이름', type: 'text', min: null, max: null, step: null, help: '예: 매트 0선. 같은 이름·위치의 기준선만 반복 사용하세요.' });
      appendField(form, { name: 'seatHeightCm', label: '좌면 높이 (cm)', max: 80 });
      appendField(form, { name: 'straddleAngleDeg', label: '스트래들 각도 (°)', min: 0, max: 180, help: '동일 각도 조건끼리 비교하기 위한 앱 규칙입니다.' });
      const fieldset = el('fieldset', 'flex-card'); fieldset.append(el('legend', '', '선택 접촉 이정표 · 자가 보고'));
      fieldset.append(el('p', 'flex-muted', '팔꿈치·전완·머리·가슴·배 접촉은 점수나 PB 순위에 쓰지 않으며 자동 180° 인증이 아닙니다.'));
      for (const key of MILESTONE_KEYS) { const label = el('label', 'flex-check'); const input = document.createElement('input'); input.type = 'checkbox'; input.name = `milestone${key[0].toUpperCase()}${key.slice(1)}`; label.append(input, el('span', '', MILESTONE_LABELS[key])); fieldset.append(label); }
      form.append(fieldset);
    }
    if (kind === 'LATTICE_FRONT_SPLIT_LEFT' || kind === 'LATTICE_FRONT_SPLIT_RIGHT') appendSelect(form, { name: 'pelvisOrientation', label: '비교용 골반 방향 자가 확인', options: { square: 'square · 양쪽 앞골반이 정면/수평' } });
    const align = el('label', 'flex-check'); const alignInput = document.createElement('input'); alignInput.type = 'checkbox'; alignInput.name = 'alignmentConfirmed'; align.append(alignInput, el('span', '', alignmentCopy(kind))); form.append(align);
    const pain = el('label', 'flex-check'); const painInput = document.createElement('input'); painInput.type = 'checkbox'; painInput.name = 'painFree'; pain.append(painInput, el('span', '', '날카로운 통증, 관절 통증, 저림 없이 편안한 범위에서 측정했습니다.')); form.append(pain);
    form.append(el('p', 'flex-warning', '체크하지 않아도 관찰 기록은 저장되지만 PB 비교에서는 제외됩니다. 증상이 있으면 측정과 스트레칭을 중단하세요.'));
    const noteLabel = el('label', 'flex-field'); noteLabel.append(el('span', '', '메모 (선택)')); const notes = document.createElement('textarea'); notes.name = 'notes'; notes.maxLength = NOTE_LIMIT; noteLabel.append(notes, el('small', 'flex-muted', '메모는 텍스트로만 저장·표시합니다.')); form.append(noteLabel);
    const generalError = el('div', 'flex-error'); generalError.dataset.errorFor = 'record'; form.append(generalError);
    const submit = el('button', 'flex-primary', '측정 기록 저장'); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', async event => {
      event.preventDefault(); form.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
      const data = Object.fromEntries(new FormData(form).entries()); data.kind = kind; data.alignmentConfirmed = alignInput.checked; data.painFree = painInput.checked;
      const result = validateBenchmark(data);
      if (!result.ok) { for (const [key, message] of Object.entries(result.errors)) setError(form, key, message); setError(form, 'record', Object.values(result.errors)[0]); notify('입력값을 확인해 주세요.'); return; }
      submit.disabled = true; const record = result.value; const compare = comparison(record, store.flexibility); store.flexibility.push(record);
      try { await Promise.resolve(persist()); notify(compare.eligible && compare.isPB ? '같은 조건에서 수치상 새 PB를 저장했어요.' : '유연성 측정을 저장했어요.'); renderBenchmarkResult(record, compare); }
      catch (error) { const index = store.flexibility.findIndex(item => item.id === record.id); if (index >= 0) store.flexibility.splice(index, 1); submit.disabled = false; setError(form, 'record', `저장하지 못했습니다: ${String(error?.message || error)}`); }
    });
    content.append(form);
  }

  function renderBenchmarkResult(record, compare) {
    content.replaceChildren(); content.append(el('h2', 'flex-title', '측정 저장 완료'));
    const card = el('section', 'flex-card'); card.append(el('div', 'flex-muted', FLEXIBILITY_KINDS[record.kind].label), el('div', 'flex-measure', metricText(record)), el('div', 'flex-muted', conditionsText(record)));
    const milestones = milestoneText(record); if (milestones) card.append(el('div', 'flex-muted', `${milestones} · PB 점수와 무관`));
    if (!compare.eligible) card.append(el('p', 'flex-warning', compare.reason));
    else {
      if (compare.recent) { const sign = compare.improvementValue > 0 ? '+' : ''; card.append(el('p', '', `직전 같은 조건 대비 ${sign}${round(compare.improvementValue, 1)}${compare.unit} ${compare.improvementValue > 0 ? '수치상 향상' : compare.improvementValue < 0 ? '수치상 감소' : '변화 없음'}`)); }
      else card.append(el('p', '', '같은 프로토콜·조건의 첫 기준 기록입니다.'));
      if (compare.best) card.append(el('p', 'flex-muted', `이전 최고: ${metricText(compare.best)}`));
      if (compare.isPB) card.append(el('span', 'flex-badge flex-pb', '수치상 PB'));
      card.append(el('p', 'flex-muted', compare.note));
    }
    card.append(el('p', 'flex-muted', '프로토콜·조건이 다르면 비교하지 않아요. 보편적인 정상 기준선은 제공하지 않습니다.'));
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
      card.append(el('h3', '', routine.name), el('span', 'flex-badge', routine.badge), el('p', 'flex-muted', routine.summary));
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
    content.append(back, el('h2', 'flex-title', routine.name), el('span', 'flex-badge', routine.badge), el('p', 'flex-muted', routine.summary));
    if (routine.category === 'source-adapted') {
      const sourceNote = el('div', 'flex-card');
      appendSourceLink(sourceNote, '원문 권장', routine.sourceUrl, '원문의 4단계 구성과 개별 운동 용량을 확인하세요. 아래 앱 루틴은 전체 원문 프로그램이 아닙니다.');
      sourceNote.append(el('p', 'flex-muted', routineId === 'lattice_front' ? '앱 변형: 원문 전체 프론트 스플릿 시퀀스는 충분한 pike를 전제로 하지만, 이 앱 항목은 진입 판정이나 원문 대체 프로그램이 아닌 편안한 범위의 저강도 기초 적응입니다.' : '앱 변형: 세트·강도·부하를 낮추고 지지 동작으로 바꾼 짧은 기초 버전입니다. 원문 프로그램의 효과를 그대로 주장하지 않습니다.'));
      content.append(sourceNote);
    }
    const form = el('form', 'flex-card flex-grid'); form.noValidate = true;
    const warm = el('label', 'flex-check'); const warmInput = document.createElement('input'); warmInput.type = 'checkbox'; warmInput.name = 'warmupConfirmed';
    warm.append(warmInput, el('span', '', '5~10분 가벼운 워밍업을 완료했습니다.'));
    form.append(warm);
    const config = el('div', 'flex-two');
    const workWrap = el('label', 'flex-field'); workWrap.append(el('span', '', '유지 시간 (초)')); const work = document.createElement('input'); work.type = 'number'; work.min = '10'; work.max = '90'; work.step = '1'; work.value = '30'; workWrap.append(work);
    const restWrap = el('label', 'flex-field'); restWrap.append(el('span', '', '휴식 (초)')); const rest = document.createElement('input'); rest.type = 'number'; rest.min = '5'; rest.max = '60'; rest.step = '1'; rest.value = '20'; restWrap.append(rest);
    const setsWrap = el('label', 'flex-field'); setsWrap.append(el('span', '', '세트')); const sets = document.createElement('input'); sets.type = 'number'; sets.min = '1'; sets.max = '4'; sets.step = '1'; sets.value = '2'; setsWrap.append(sets);
    config.append(workWrap, restWrap, setsWrap); form.append(config);
    form.append(el('p', 'flex-muted', '기본값은 30초 × 2세트, 세트 사이 20초 휴식입니다. 타이머 종료만으로 완료 처리하지 않으며 직접 완료를 눌러야 합니다. 이 시간·세트 설정은 앱 변형값이며 원문 권장 용량과 별도로 표시됩니다.'));
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
    if (step.sourceUrl) {
      const sourceBox = el('div', 'flex-card');
      appendSourceLink(sourceBox, '단계 원문', step.sourceUrl, step.sourceDose || '원문 용량은 링크에서 확인');
      if (step.adaptation) sourceBox.append(el('p', 'flex-muted', step.adaptation));
      card.append(sourceBox);
    }
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
      const savedStep = { id: step.id, label: step.label, type: step.type, plannedSeconds: step.plannedSeconds, completedSeconds, status };
      if (step.sourceUrl) Object.assign(savedStep, { section: step.section, sourceUrl: step.sourceUrl, sourceDose: step.sourceDose, adaptation: step.adaptation });
      return savedStep;
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
    card.append(el('h3', '', completion ? '루틴 완료' : '부분 훈련'), el('div', 'flex-measure', `${round(completed, 1)}초 / 계획 ${round(planned, 1)}초`), el('p', 'flex-muted', '타이머로 잰 유지 동작 시간 · 수동 반복/휴식은 합계 제외'), el('p', 'flex-muted', '완료·건너뜀·부분 수행을 구분해 저장합니다. 타이머를 시작만 한 경우에는 기록이 생기지 않습니다.'));
    const summaryRoutine = ROUTINES[trainingState.routineId];
    if (summaryRoutine?.category === 'source-adapted') appendSourceLink(card, '출처 기반 앱 변형', summaryRoutine.sourceUrl, `${summaryRoutine.programVersion} · 원문 전체 프로그램이나 검증된 처방이 아닙니다.`);
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
        const sign = compare.improvementValue > 0 ? '+' : '';
        card.append(el('div', compare.improvementValue > 0 ? 'flex-status-completed' : 'flex-muted', `직전 같은 조건 대비 ${sign}${round(compare.improvementValue, 1)}${compare.unit}`));
      } else if (!compare.eligible) card.append(el('div', 'flex-warning', 'PB 제외 · 정렬/통증 없음 미확인'));
      const historyMilestones = milestoneText(record);
      if (historyMilestones) card.append(el('div', 'flex-muted', `${historyMilestones} · 자가 보고, PB 순위와 무관`));
      if (record.sourceMethod === 'lattice-adapted' && record.sourceUrl) appendSourceLink(card, '출처 기반 앱 변형', record.sourceUrl, `${record.protocolId} · 앱 반복성 규칙 포함`);
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
        card.append(el('div', 'flex-muted', `${record.routineName || ROUTINES[record.routineId]?.name || record.routineId} · ${formatDate(record.ts)}`), el('div', 'flex-measure', `${round(Number(record.completedSeconds) || 0, 1)}초 / 계획 ${round(Number(record.plannedSeconds) || 0, 1)}초`), el('p', 'flex-muted', '타이머로 잰 유지 동작 시간 · 수동 반복/휴식은 합계 제외'), el('span', `flex-badge ${record.completion ? 'flex-pb' : ''}`, record.completion ? '완료' : '부분 완료'));
        if (record.sourceMethod === 'lattice-adapted' && record.sourceUrl) {
          appendSourceLink(card, '출처 기반 앱 변형', record.sourceUrl, `${record.programVersion || '버전 없음'} · 원문 전체 프로그램 아님`);
          const sourceDetails = el('details');
          sourceDetails.append(el('summary', '', '단계별 원문 용량과 앱 변경 보기'));
          for (const step of (Array.isArray(record.steps) ? record.steps : []).filter(item => item.type !== 'rest' && item.sourceDose && item.adaptation)) {
            const item = el('div', 'flex-card');
            item.append(el('strong', '', `${step.section ? `${step.section} · ` : ''}${step.label}`));
            appendSourceLink(item, '원문 권장', step.sourceUrl || record.sourceUrl, step.sourceDose);
            item.append(el('p', 'flex-muted', `앱 변형: ${step.adaptation}`));
            sourceDetails.append(item);
          }
          card.append(sourceDetails);
        }
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
      metricUnit,
      metricLabel,
      metricText,
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
  metricUnit,
  metricLabel,
  metricText,
  roundedCondition,
  routines: ROUTINES,
});
