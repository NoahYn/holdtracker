/**
 * Front-camera bodyweight movement tracking.
 *
 * This module is deliberately pure: it has no DOM, media, storage, or timer
 * dependencies. Callers supply MediaPipe-style 33-point normalized landmarks
 * and monotonically increasing frame timestamps.
 *
 * The tracker only estimates visible frontal motion. It does not judge official
 * squat depth, chin-over-bar, chest/ground contact, lockout quality, or hold
 * quality. Camera perspective, loose clothing, and self-occlusion still matter.
 */

const P = Object.freeze({
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
});

const PAIRS = Object.freeze({
  shoulders: [P.L_SHOULDER, P.R_SHOULDER],
  elbows: [P.L_ELBOW, P.R_ELBOW],
  wrists: [P.L_WRIST, P.R_WRIST],
  hips: [P.L_HIP, P.R_HIP],
  knees: [P.L_KNEE, P.R_KNEE],
  ankles: [P.L_ANKLE, P.R_ANKLE],
});

const MOVE_CONFIG = Object.freeze({
  AIR_SQUAT: {
    amplitude: 0.38,
    calibrationDwellMs: 700,
    excursionDwellMs: 120,
    rearmDwellMs: 220,
    minCycleMs: 650,
    maxCycleMs: 8000,
    gapMs: 700,
    stableTolerance: 0.09,
    returnHysteresis: 0.13,
  },
  PUSH_UP: {
    amplitude: 0.30,
    calibrationDwellMs: 700,
    excursionDwellMs: 120,
    rearmDwellMs: 220,
    minCycleMs: 600,
    maxCycleMs: 8000,
    gapMs: 700,
    stableTolerance: 0.08,
    returnHysteresis: 0.11,
  },
  PULL_UP: {
    amplitude: 0.32,
    calibrationDwellMs: 700,
    excursionDwellMs: 120,
    rearmDwellMs: 220,
    minCycleMs: 650,
    maxCycleMs: 8000,
    gapMs: 700,
    stableTolerance: 0.08,
    returnHysteresis: 0.12,
  },
});

const CONFIDENCE_MIN = 0.55;
const FRAME_EDGE = 0.008;
const EPS = 1e-6;

function finitePoint(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function confidence(p) {
  if (!finitePoint(p)) return 0;
  const v = Number.isFinite(p.visibility) ? p.visibility : 1;
  const pr = Number.isFinite(p.presence) ? p.presence : 1;
  return Math.min(v, pr);
}

function usable(p, endpoint = false) {
  if (!finitePoint(p) || confidence(p) < CONFIDENCE_MIN) return false;
  if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return false;
  if (endpoint && (p.x <= FRAME_EDGE || p.x >= 1 - FRAME_EDGE ||
                   p.y <= FRAME_EDGE || p.y >= 1 - FRAME_EDGE)) return false;
  return true;
}

function point(lm, i, endpoint = false) {
  const p = lm?.[i];
  return usable(p, endpoint) ? { x: p.x, y: p.y, z: Number.isFinite(p.z) ? p.z : 0 } : null;
}

function midpoint(a, b) {
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  return a || b || null;
}

function pair(lm, ids, endpoint = false) {
  const left = point(lm, ids[0], endpoint);
  const right = point(lm, ids[1], endpoint);
  return { left, right, mid: midpoint(left, right), count: Number(!!left) + Number(!!right) };
}

function dist(a, b) {
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : NaN;
}

function angle(a, b, c) {
  if (!a || !b || !c) return NaN;
  const ux = a.x - b.x, uy = a.y - b.y;
  const vx = c.x - b.x, vy = c.y - b.y;
  const den = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (den < EPS) return NaN;
  const cosine = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / den));
  return Math.acos(cosine) * 180 / Math.PI;
}

function meanFinite(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : NaN;
}

function bilateralAngle(lm, upperPair, jointPair, lowerPair) {
  return meanFinite([
    angle(point(lm, upperPair[0]), point(lm, jointPair[0]), point(lm, lowerPair[0], true)),
    angle(point(lm, upperPair[1]), point(lm, jointPair[1]), point(lm, lowerPair[1], true)),
  ]);
}

function groupReady(group, minimum = 1) {
  return group.count >= minimum && !!group.mid;
}

function worldCorroboration(world) {
  if (!Array.isArray(world) || world.length < 33) return null;
  const wp = i => finitePoint(world[i]) ? world[i] : null;
  const d3 = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)) : NaN;
  const shoulderWidth = d3(wp(P.L_SHOULDER), wp(P.R_SHOULDER));
  const hipWidth = d3(wp(P.L_HIP), wp(P.R_HIP));
  const torsoLeft = d3(wp(P.L_SHOULDER), wp(P.L_HIP));
  const torsoRight = d3(wp(P.R_SHOULDER), wp(P.R_HIP));
  const lengths = [shoulderWidth, hipWidth, torsoLeft, torsoRight].filter(v => Number.isFinite(v) && v > EPS);
  if (lengths.length < 2) return { available: false, scaleConsistent: false };
  const min = Math.min(...lengths), max = Math.max(...lengths);
  return { available: true, scaleConsistent: max / min < 4.5 };
}

function warningsFor(validFor) {
  return {
    AIR_SQUAT: validFor.AIR_SQUAT ? '' : '전면에서 몸통, 엉덩이, 무릎, 발목이 화면 안에 보이게 하세요.',
    PUSH_UP: validFor.PUSH_UP ? '' : '전면에서 어깨, 팔꿈치, 손목, 엉덩이가 보이게 하세요. 발은 보이지 않아도 됩니다.',
    PULL_UP: validFor.PULL_UP ? '' : '전면에서 코, 어깨, 팔꿈치, 손목이 보이게 하세요. 발은 보이지 않아도 됩니다.',
    L_SIT: validFor.L_SIT ? '' : '전면에서 어깨, 엉덩이, 손목, 발목이 화면 안에 보이게 하세요.',
    HANDSTAND: validFor.HANDSTAND ? '' : '전면에서 양쪽 손목과 어깨, 엉덩이, 발목이 화면 안에 보이게 하세요.',
  };
}

/**
 * Derive front-view measurements from 33 normalized pose landmarks.
 * Optional world landmarks are used only as a weak consistency annotation and
 * never replace missing normalized-image landmarks.
 *
 * @param {Array<object>} lm MediaPipe-style normalized landmarks (length >= 33).
 * @param {Array<object>|null} world Optional world landmarks.
 * @returns {object} A pure frame descriptor with `validFor`, `measurements`,
 * posture checks, and a front-camera warning. Pass this object to the other APIs.
 */
export function frontFrame(lm, world = null) {
  const malformed = !Array.isArray(lm) || lm.length < 33;
  const emptyValid = { AIR_SQUAT: false, PUSH_UP: false, PULL_UP: false, L_SIT: false, HANDSTAND: false };
  if (malformed) {
    const warning = '사람을 찾지 못했어요. 카메라 앞에서 시작 자세를 잡아 주세요.';
    return {
      view: 'front', valid: false, validFor: emptyValid,
      warnings: Object.fromEntries(Object.keys(emptyValid).map(move => [move, warning])),
      warning,
      measurements: {}, posture: {}, world: worldCorroboration(world),
    };
  }

  const shoulders = pair(lm, PAIRS.shoulders);
  const elbows = pair(lm, PAIRS.elbows);
  const wrists = pair(lm, PAIRS.wrists, true);
  const hips = pair(lm, PAIRS.hips);
  const knees = pair(lm, PAIRS.knees);
  const ankles = pair(lm, PAIRS.ankles, true);
  const nose = point(lm, P.NOSE, true);

  const shoulderSpan = shoulders.left && shoulders.right ? dist(shoulders.left, shoulders.right) : NaN;
  const torsoLength = shoulders.mid && hips.mid ? dist(shoulders.mid, hips.mid) : NaN;
  const fallbackScale = Number.isFinite(shoulderSpan) ? shoulderSpan : torsoLength;
  const scale = Math.max(Number.isFinite(fallbackScale) ? fallbackScale : 0, 0.045);

  const elbowAngle = bilateralAngle(lm, PAIRS.shoulders, PAIRS.elbows, PAIRS.wrists);
  const kneeAngle = bilateralAngle(lm, PAIRS.hips, PAIRS.knees, PAIRS.ankles);
  const torsoDx = shoulders.mid && hips.mid ? Math.abs(shoulders.mid.x - hips.mid.x) / scale : NaN;
  const torsoDy = shoulders.mid && hips.mid ? (hips.mid.y - shoulders.mid.y) / scale : NaN;
  const hipKneeGap = hips.mid && knees.mid ? (knees.mid.y - hips.mid.y) / scale : NaN;
  const kneeAnkleGap = knees.mid && ankles.mid ? (ankles.mid.y - knees.mid.y) / scale : NaN;
  const shoulderWristGap = shoulders.mid && wrists.mid ? (wrists.mid.y - shoulders.mid.y) / scale : NaN;
  const shoulderHipVerticalGap = shoulders.mid && hips.mid ? (hips.mid.y - shoulders.mid.y) / scale : NaN;
  const noseWristGap = nose && wrists.mid ? (nose.y - wrists.mid.y) / scale : NaN;
  const ankleHipDistance = meanFinite([
    dist(ankles.left, hips.left),
    dist(ankles.right, hips.right),
  ]) / scale;

  // Each rep metric is larger at its extended/start posture and decreases
  // during the meaningful excursion. Angles soften perspective-only noise.
  const squatMetric = Number.isFinite(hipKneeGap) && Number.isFinite(kneeAngle)
    ? hipKneeGap + 0.34 * (kneeAngle / 180) : NaN;
  const pushMetric = Number.isFinite(shoulderWristGap) && Number.isFinite(elbowAngle)
    ? shoulderWristGap + 0.38 * (elbowAngle / 180) : NaN;
  const pullMetric = Number.isFinite(noseWristGap) && Number.isFinite(elbowAngle)
    ? noseWristGap + 0.42 * (elbowAngle / 180) : NaN;

  const squatValid = groupReady(shoulders) && groupReady(hips) && groupReady(knees) && groupReady(ankles);
  const pushValid = groupReady(shoulders) && groupReady(elbows) && groupReady(wrists) && groupReady(hips);
  const pullValid = !!nose && groupReady(shoulders) && groupReady(elbows) && groupReady(wrists);
  const lSitValid = groupReady(shoulders) && groupReady(hips) && groupReady(wrists) && groupReady(ankles);
  const handstandValid = shoulders.count === 2 && hips.count >= 1 && wrists.count === 2 && ankles.count >= 1;

  const posture = {
    AIR_SQUAT: squatValid && torsoDy > 0.45 && torsoDx < 0.75 && hipKneeGap > 0.55 && kneeAnkleGap > 0.35 && (!Number.isFinite(kneeAngle) || kneeAngle > 145),
    PUSH_UP: pushValid && elbowAngle > 145 && shoulderWristGap > 0.28 && Math.abs(shoulderHipVerticalGap) < 1.35,
    PULL_UP: pullValid && elbowAngle > 145 && noseWristGap > 0.18 && shoulderWristGap < -0.22,
  };

  const validFor = {
    AIR_SQUAT: squatValid && Number.isFinite(squatMetric),
    PUSH_UP: pushValid && Number.isFinite(pushMetric),
    PULL_UP: pullValid && Number.isFinite(pullMetric),
    L_SIT: lSitValid,
    HANDSTAND: handstandValid,
  };
  const warnings = warningsFor(validFor);

  return {
    view: 'front',
    valid: Object.values(validFor).some(Boolean),
    validFor,
    warnings,
    warning: Object.values(validFor).some(Boolean)
      ? ''
      : '전면에서 필요한 관절이 화면 안에 보이도록 카메라 위치를 조정하세요.',
    scale,
    measurements: {
      shoulderSpan, torsoLength, torsoDx, torsoDy,
      hipKneeGap, kneeAnkleGap, shoulderWristGap, shoulderHipVerticalGap,
      noseWristGap, ankleHipDistance, elbowAngle, kneeAngle,
      squatMetric, pushMetric, pullMetric,
      points: {
        nose,
        shoulders: shoulders.mid, elbows: elbows.mid, wrists: wrists.mid,
        hips: hips.mid, knees: knees.mid, ankles: ankles.mid,
      },
      sidesVisible: {
        shoulders: shoulders.count, elbows: elbows.count, wrists: wrists.count,
        hips: hips.count, knees: knees.count, ankles: ankles.count,
      },
    },
    posture,
    world: worldCorroboration(world),
  };
}

function assertRepMove(move) {
  if (!MOVE_CONFIG[move]) throw new RangeError(`Unsupported front rep move: ${move}`);
}

/**
 * Create mutable state for AIR_SQUAT, PUSH_UP, or PULL_UP.
 * The first stable extended/start posture is calibration only and never counts.
 *
 * @param {'AIR_SQUAT'|'PUSH_UP'|'PULL_UP'} move
 * @returns {object} Mutable tracker state for stepFrontRep().
 */
export function createFrontRepState(move) {
  assertRepMove(move);
  return {
    move,
    count: 0,
    phase: 'CALIBRATING',
    calibration: true,
    baseline: null,
    baselineCandidate: null,
    baselineSince: null,
    smoothed: null,
    lastT: null,
    cycleStartedAt: null,
    excursionSince: null,
    returnSince: null,
    sawExcursion: false,
    rearmRequired: false,
  };
}

function metricFor(move, frame) {
  if (move === 'AIR_SQUAT') return frame.measurements.squatMetric;
  if (move === 'PUSH_UP') return frame.measurements.pushMetric;
  return frame.measurements.pullMetric;
}

function cueFor(move, phase) {
  const words = {
    AIR_SQUAT: {
      CALIBRATING: '선 자세를 잠깐 유지하세요.', READY: '준비됐어요. 앉았다가 다시 서세요.',
      EXCURSION: '조금 더 내려가세요.', RETURN: '다시 선 자세로 돌아오세요.', REARM: '선 자세를 잠깐 유지하세요.',
    },
    PUSH_UP: {
      CALIBRATING: '팔을 편 플랭크 자세를 잠깐 유지하세요.', READY: '준비됐어요. 내려갔다가 다시 올라오세요.',
      EXCURSION: '조금 더 내려가세요.', RETURN: '팔을 편 시작 자세로 돌아오세요.', REARM: '팔을 편 시작 자세를 잠깐 유지하세요.',
    },
    PULL_UP: {
      CALIBRATING: '팔을 편 매달림 자세를 잠깐 유지하세요.', READY: '준비됐어요. 올라갔다가 다시 내려오세요.',
      EXCURSION: '조금 더 올라가세요.', RETURN: '팔을 편 매달림 자세로 돌아오세요.', REARM: '팔을 편 매달림 자세를 잠깐 유지하세요.',
    },
  };
  return words[move][phase] || words[move].READY;
}

function result(state, counted, cue) {
  return { counted, count: state.count, phase: state.phase, cue, calibration: state.calibration };
}

function resetCycle(state, requireRearm) {
  state.cycleStartedAt = null;
  state.excursionSince = null;
  state.returnSince = null;
  state.sawExcursion = false;
  state.rearmRequired = requireRearm;
  if (!state.calibration) state.phase = requireRearm ? 'REARM' : 'READY';
}

/**
 * Reset an in-flight cycle while preserving count and calibration baseline.
 * A stable return to the extended/start posture is required before a new cycle;
 * that reacquisition is never counted as a repetition.
 *
 * @param {object} state State returned by createFrontRepState().
 * @returns {object} The same mutated state.
 */
export function interruptFrontRep(state) {
  assertRepMove(state?.move);
  resetCycle(state, true);
  state.lastT = null;
  state.smoothed = null;
  state.returnSince = null;
  return state;
}

/**
 * Advance one front-view repetition tracker frame.
 * Counting happens only after a calibrated start, a dwell-confirmed meaningful
 * excursion, minimum cycle time, and a dwell-confirmed return with hysteresis.
 * Timestamp gaps reset an in-flight cycle and require uncounted rearming.
 *
 * @param {object} state Mutable state from createFrontRepState().
 * @param {object} frame Descriptor from frontFrame().
 * @param {number} tMs Monotonic capture timestamp in milliseconds.
 * @returns {{counted:boolean,count:number,phase:string,cue:string,calibration:boolean}}
 */
export function stepFrontRep(state, frame, tMs) {
  assertRepMove(state?.move);
  const cfg = MOVE_CONFIG[state.move];
  if (!Number.isFinite(tMs)) throw new TypeError('tMs must be a finite monotonic timestamp');

  const previousT = state.lastT;
  const gap = previousT == null ? 0 : tMs - previousT;
  state.lastT = tMs;
  if (gap < 0 || gap > cfg.gapMs) {
    resetCycle(state, true);
    state.smoothed = null;
    state.baselineSince = null;
    state.baselineCandidate = null;
  }

  if (!frame?.validFor?.[state.move]) {
    if (!state.calibration) resetCycle(state, true);
    state.baselineSince = null;
    state.baselineCandidate = null;
    const missingCue = frame?.warnings?.[state.move] || frame?.warning || '필요한 관절이 화면 안에 보이게 하세요.';
    return result(state, false, missingCue);
  }

  const raw = metricFor(state.move, frame);
  if (!Number.isFinite(raw)) {
    if (!state.calibration) resetCycle(state, true);
    return result(state, false, '필요한 관절이 선명하게 보이게 하세요.');
  }

  state.smoothed = state.smoothed == null ? raw : 0.68 * state.smoothed + 0.32 * raw;
  const metric = state.smoothed;
  const startOK = !!frame.posture?.[state.move];

  if (state.calibration) {
    state.phase = 'CALIBRATING';
    if (!startOK) {
      state.baselineSince = null;
      state.baselineCandidate = null;
      return result(state, false, cueFor(state.move, 'CALIBRATING'));
    }
    if (state.baselineCandidate == null || Math.abs(metric - state.baselineCandidate) > cfg.stableTolerance) {
      state.baselineCandidate = metric;
      state.baselineSince = tMs;
    } else {
      state.baselineCandidate = 0.9 * state.baselineCandidate + 0.1 * metric;
    }
    if (tMs - state.baselineSince >= cfg.calibrationDwellMs) {
      state.baseline = state.baselineCandidate;
      state.calibration = false;
      state.phase = 'READY';
      state.rearmRequired = false;
      return result(state, false, cueFor(state.move, 'READY'));
    }
    return result(state, false, cueFor(state.move, 'CALIBRATING'));
  }

  const returnThreshold = state.baseline - cfg.returnHysteresis;
  const excursionThreshold = state.baseline - cfg.amplitude;

  if (state.rearmRequired) {
    state.phase = 'REARM';
    if (startOK && metric >= returnThreshold) {
      state.returnSince ??= tMs;
      if (tMs - state.returnSince >= cfg.rearmDwellMs) {
        state.rearmRequired = false;
        state.returnSince = null;
        state.phase = 'READY';
        // Adapt only at a confirmed, uncounted start pose; cap drift per sample.
        const delta = Math.max(-0.02, Math.min(0.02, metric - state.baseline));
        state.baseline += 0.08 * delta;
        return result(state, false, cueFor(state.move, 'READY'));
      }
    } else {
      state.returnSince = null;
    }
    return result(state, false, cueFor(state.move, 'REARM'));
  }

  if (!state.sawExcursion) {
    if (metric <= excursionThreshold) {
      state.phase = 'EXCURSION';
      state.cycleStartedAt ??= tMs;
      state.excursionSince ??= tMs;
      if (tMs - state.excursionSince >= cfg.excursionDwellMs) {
        state.sawExcursion = true;
        state.phase = 'RETURN';
        state.returnSince = null;
      }
    } else {
      state.excursionSince = null;
      if (startOK && metric >= returnThreshold) {
        state.phase = 'READY';
        // Very slow, bounded baseline adaptation rejects ordinary camera jitter.
        const delta = Math.max(-0.015, Math.min(0.015, metric - state.baseline));
        state.baseline += 0.025 * delta;
      } else {
        state.phase = 'EXCURSION';
        state.cycleStartedAt ??= tMs;
      }
    }
    return result(state, false, cueFor(state.move, state.phase));
  }

  state.phase = 'RETURN';
  const elapsed = tMs - state.cycleStartedAt;
  if (elapsed > cfg.maxCycleMs) {
    resetCycle(state, true);
    return result(state, false, cueFor(state.move, 'REARM'));
  }

  if (startOK && metric >= returnThreshold) {
    state.returnSince ??= tMs;
    if (tMs - state.returnSince >= cfg.rearmDwellMs && elapsed >= cfg.minCycleMs) {
      state.count += 1;
      resetCycle(state, false);
      state.phase = 'READY';
      const delta = Math.max(-0.02, Math.min(0.02, metric - state.baseline));
      state.baseline += 0.05 * delta;
      return {...result(state, true, `완료. ${state.count}회`), durationMs: elapsed};
    }
  } else {
    state.returnSince = null;
  }
  return result(state, false, cueFor(state.move, 'RETURN'));
}

/**
 * Approximate static front-camera hold gate.
 * L_SIT checks an upright torso, visible floor-support arm arrangement, and feet
 * elevated near hip height. HANDSTAND checks an inverted ankle-hip-shoulder
 * stack with both visible wrists below the shoulders. These are only timer gates:
 * they cannot confirm actual support, balance, contact, or score hold quality.
 *
 * @param {string} move `L_SIT` or `HANDSTAND`.
 * @param {object} frame Descriptor from frontFrame().
 * @returns {{supported:boolean,active:boolean,cue:string}}
 */
export function frontHoldGate(move, frame) {
  if (move !== 'L_SIT' && move !== 'HANDSTAND') {
    return { supported: false, active: false, cue: '이 동작은 수동 타이머를 사용하세요.' };
  }
  if (!frame?.validFor?.[move]) {
    const cue = move === 'L_SIT'
      ? '어깨, 엉덩이, 손목, 발목이 화면 안에 보이게 하세요.'
      : '양쪽 손목과 어깨, 엉덩이, 발목이 화면 안에 보이게 하세요.';
    return { supported: true, active: false, cue };
  }

  const m = frame.measurements;
  const p = m.points;
  if (move === 'L_SIT') {
    const upright = m.torsoDy > 0.45 && m.torsoDx < 0.65;
    const armsSupporting = m.shoulderWristGap > 0.45 && p.wrists.y >= p.hips.y - 0.22 * frame.scale;
    const feetNearHipHeight = Math.abs(p.ankles.y - p.hips.y) / frame.scale <= 0.50;
    const feetProjectedForward = m.ankleHipDistance >= 0.18;
    const active = upright && armsSupporting && feetNearHipHeight && feetProjectedForward;
    return {
      supported: true,
      active,
      cue: active ? 'L-sit 자세가 대략 감지됐어요.' : '몸통을 세우고 손으로 지지한 채 발을 엉덩이 높이 가까이 올리세요.',
    };
  }

  const ankleAboveHip = p.ankles.y < p.hips.y - 0.18 * frame.scale;
  const hipAboveShoulder = p.hips.y < p.shoulders.y - 0.18 * frame.scale;
  const wristsBelowShoulders = p.wrists.y > p.shoulders.y + 0.18 * frame.scale;
  const stackDx = Math.max(
    Math.abs(p.ankles.x - p.hips.x),
    Math.abs(p.hips.x - p.shoulders.x),
  ) / frame.scale;
  const active = ankleAboveHip && hipAboveShoulder && wristsBelowShoulders && stackDx < 0.85;
  return {
    supported: true,
    active,
    cue: active ? '핸드스탠드 자세가 대략 감지됐어요.' : '전신을 거꾸로 세우고 손목이 어깨 아래에 보이게 하세요.',
  };
}
