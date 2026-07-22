import {
  type RendererFactory,
  type RendererFactoryOptions,
  type RuntimeRenderFrame,
  type RuntimeRenderer,
  type RuntimeTarget,
} from "@manse/runtime-web";
import type { GameLocale } from "./game-config";

const THEME = {
  gold: "#ffd978",
  cream: "#fff3c2",
  periwinkle: "#a9b5ff",
  periwinkleBright: "#d2d7ff",
  navy: "#071225",
  reactionMs: 880,
  maxDpr: 2,
} as const;

const TOTAL_STARS = 3;
const SIMULATOR_ART_URL = "/packs/morning-star-catch/assets/images/morning-star-hero.png";
const FONT = '"Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif';
const COPY = {
  en: {
    aria: "Night-sky play field with reachable glowing star targets and a constellation collection trail",
    mission: "CONSTELLATION QUEST",
    progress: "STARS",
    cue: "REACH FOR THE GLOW",
    reactions: ["FIRST LIGHT!", "STAR CAUGHT!", "SKY COMPLETE!"],
    complete: "CONSTELLATION COMPLETE",
    completeBody: "Three warm stars are shining together in the morning sky.",
    camera: "LOCAL CAMERA · LIVE",
    simulator: "SKY POINTER · LIVE",
  },
  ko: {
    aria: "손을 뻗어 잡는 반짝별과 별자리 수집 길이 있는 밤하늘 게임 공간",
    mission: "별자리 탐험",
    progress: "모은 별",
    cue: "반짝빛을 향해 손 뻗기",
    reactions: ["첫 번째 빛!", "별을 잡았어요!", "하늘 완성!"],
    complete: "별자리 완성",
    completeBody: "따뜻한 별 세 개가 아침 하늘에서 함께 빛나요.",
    camera: "기기 내 카메라 · 실행 중",
    simulator: "별 포인터 · 실행 중",
  },
} as const;

type StarBurst = { x: number; y: number; startedAt: number; seed: number };

export function createMorningStarRendererFactory(locale: GameLocale): RendererFactory {
  return (options) => new MorningStarRenderer(options, locale);
}

class MorningStarRenderer implements RuntimeRenderer {
  readonly kind = "canvas2d" as const;
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly simulatorArt: HTMLImageElement;
  private readonly copy: (typeof COPY)[GameLocale];
  private readonly hitTargets = new Set<string>();
  private readonly bursts: StarBurst[] = [];
  private sceneCompleted = 0;
  private missionCompleted = 0;
  private reactionStartedAt = Number.NEGATIVE_INFINITY;
  private destroyed = false;

  constructor(options: RendererFactoryOptions, locale: GameLocale) {
    this.copy = COPY[locale];
    this.element = options.document.createElement("div");
    this.element.dataset.manseRenderer = "morning-star-catch";
    this.element.setAttribute("role", "img");
    this.element.setAttribute("aria-label", this.copy.aria);
    Object.assign(this.element.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: "320px",
      overflow: "hidden",
      background: THEME.navy,
      touchAction: "none",
    });
    this.canvas = options.document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    const context = this.canvas.getContext("2d", { alpha: false });
    if (context === null) throw new Error("Canvas 2D is unavailable.");
    this.context = context;
    this.simulatorArt = options.document.createElement("img");
    this.simulatorArt.decoding = "async";
    this.simulatorArt.src = SIMULATOR_ART_URL;
    this.element.append(this.canvas);
    options.container.append(this.element);
  }

  render(frame: RuntimeRenderFrame): void {
    if (this.destroyed) return;
    const { canvas, context } = this;
    const { width, height } = prepareCanvas(this.element, canvas, context, frame.tier);
    if (width === 0 || height === 0) return;
    context.clearRect(0, 0, width, height);

    if (frame.video !== null && frame.video.readyState >= 2) {
      drawVideoCover(context, frame.video, width, height, frame.mirror);
      drawCameraGrade(context, width, height);
    } else if (this.simulatorArt.complete && this.simulatorArt.naturalWidth > 0) {
      drawImageCover(context, this.simulatorArt, width, height);
      drawSimulatorGrade(context, width, height);
    } else {
      drawNightSet(context, width, height);
    }

    const guide = frame.challenge?.kind === "touch_targets" ? frame.challenge : null;
    if (guide !== null && guide.completedUnits < this.sceneCompleted) {
      this.sceneCompleted = 0;
      this.hitTargets.clear();
    }
    if (guide !== null && guide.completedUnits > this.sceneCompleted) {
      const gained = guide.completedUnits - this.sceneCompleted;
      this.missionCompleted = Math.min(TOTAL_STARS, this.missionCompleted + gained);
      this.reactionStartedAt = frame.timestampMs;
      this.sceneCompleted = guide.completedUnits;
    }
    for (const target of frame.targets) {
      if (!target.hit) this.hitTargets.delete(target.id);
      if (target.hit && !this.hitTargets.has(target.id)) {
        this.hitTargets.add(target.id);
        this.bursts.push({ x: target.x * width, y: target.y * height, startedAt: frame.timestampMs, seed: hash(`${target.id}:${this.missionCompleted}`) });
      }
    }

    drawSkyTexture(context, width, height, frame.timestampMs, frame.reducedStimulation);
    drawCloudBanks(context, width, height, frame.timestampMs, frame.reducedStimulation);
    drawConstellationShelf(context, width, height, TOTAL_STARS, this.missionCompleted, frame.timestampMs, frame.reducedStimulation);
    for (const target of frame.targets) {
      drawTargetStar(context, target, width, height, frame.timestampMs, frame.reducedStimulation);
    }

    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      const age = frame.timestampMs - this.bursts[index].startedAt;
      if (age > THEME.reactionMs) {
        this.bursts.splice(index, 1);
        continue;
      }
      drawStarBurst(context, this.bursts[index], age / THEME.reactionMs, width, height, frame.reducedStimulation);
    }
    if (frame.celebrationProgress > 0) {
      drawCelebration(context, width, height, frame.celebrationProgress, frame.timestampMs, frame.reducedStimulation);
    }
    drawStarHud(context, width, height, frame, this.copy, this.missionCompleted, this.reactionStartedAt);
  }

  destroy(): void {
    this.destroyed = true;
    this.bursts.length = 0;
    this.hitTargets.clear();
    this.element.remove();
  }
}

function prepareCanvas(
  element: HTMLElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  tier: RuntimeRenderFrame["tier"],
) {
  const width = Math.max(1, element.clientWidth || 960);
  const height = Math.max(1, element.clientHeight || 620);
  const deviceRatio = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const tierLimit = tier === "S" || tier === "A" ? THEME.maxDpr : tier === "B" ? 1.5 : 1;
  const dpr = Math.min(deviceRatio, tierLimit);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
}

function drawVideoCover(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirror: boolean,
) {
  const sourceWidth = Math.max(1, video.videoWidth || 1280);
  const sourceHeight = Math.max(1, video.videoHeight || 720);
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }
  context.save();
  if (mirror) {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  context.restore();
}

function drawCameraGrade(context: CanvasRenderingContext2D, width: number, height: number) {
  const vignette = context.createRadialGradient(width * 0.5, height * 0.44, width * 0.08, width * 0.5, height * 0.48, width * 0.74);
  vignette.addColorStop(0, "rgba(10,22,52,.02)");
  vignette.addColorStop(0.7, "rgba(10,22,52,.1)");
  vignette.addColorStop(1, "rgba(5,12,31,.7)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function drawSimulatorGrade(context: CanvasRenderingContext2D, width: number, height: number) {
  const grade = context.createLinearGradient(0, 0, 0, height);
  grade.addColorStop(0, "rgba(4,12,46,.08)");
  grade.addColorStop(0.58, "rgba(4,12,46,.14)");
  grade.addColorStop(1, "rgba(4,10,32,.66)");
  context.fillStyle = grade;
  context.fillRect(0, 0, width, height);
}

function drawNightSet(context: CanvasRenderingContext2D, width: number, height: number) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#172d5b");
  sky.addColorStop(0.55, "#0b1730");
  sky.addColorStop(1, THEME.navy);
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  const moonGlow = context.createRadialGradient(width * 0.76, height * 0.18, 0, width * 0.76, height * 0.18, width * 0.38);
  moonGlow.addColorStop(0, "rgba(255,228,146,.24)");
  moonGlow.addColorStop(1, "rgba(255,228,146,0)");
  context.fillStyle = moonGlow;
  context.fillRect(0, 0, width, height);
}

function drawStarHud(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: RuntimeRenderFrame,
  copy: (typeof COPY)[GameLocale],
  completed: number,
  reactionStartedAt: number,
) {
  context.save();
  context.fillStyle = "rgba(7,18,37,.82)";
  context.strokeStyle = "rgba(210,215,255,.42)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(width * 0.03, height * 0.035, width * 0.34, Math.max(54, height * 0.09), 18);
  context.fill();
  context.stroke();
  context.fillStyle = THEME.gold;
  context.font = `800 ${Math.max(12, width * 0.014)}px ${FONT}`;
  context.textAlign = "left";
  context.fillText(copy.mission, width * 0.052, height * 0.072);
  context.fillStyle = "white";
  context.font = `900 ${Math.max(18, width * 0.025)}px ${FONT}`;
  context.fillText(`${copy.progress}  ${completed}/${TOTAL_STARS}`, width * 0.052, height * 0.115);
  context.textAlign = "right";
  context.font = `750 ${Math.max(11, width * 0.012)}px ${FONT}`;
  context.fillText(frame.video !== null ? copy.camera : copy.simulator, width * 0.97, height * 0.07);

  const reactionAge = frame.timestampMs - reactionStartedAt;
  if (completed > 0 && reactionAge >= 0 && reactionAge < THEME.reactionMs) {
    context.globalAlpha = Math.sin((reactionAge / THEME.reactionMs) * Math.PI);
    context.textAlign = "center";
    context.strokeStyle = "rgba(7,18,37,.85)";
    context.fillStyle = THEME.cream;
    context.lineWidth = 7;
    context.font = `950 ${Math.max(30, width * 0.052)}px ${FONT}`;
    const text = copy.reactions[Math.min(copy.reactions.length - 1, completed - 1)];
    context.strokeText(text, width * 0.5, height * 0.47);
    context.fillText(text, width * 0.5, height * 0.47);
  } else if (frame.challenge !== null && frame.celebrationProgress === 0) {
    context.globalAlpha = 0.94;
    context.textAlign = "center";
    context.fillStyle = THEME.cream;
    context.font = `850 ${Math.max(16, width * 0.022)}px ${FONT}`;
    context.fillText(copy.cue, width * 0.5, height * 0.92);
  }
  context.globalAlpha = 1;
  if (frame.celebrationProgress > 0 && completed >= TOTAL_STARS) {
    context.fillStyle = "rgba(7,18,37,.86)";
    context.beginPath();
    context.roundRect(width * 0.15, height * 0.34, width * 0.7, height * 0.27, 28);
    context.fill();
    context.textAlign = "center";
    context.fillStyle = THEME.gold;
    context.font = `950 ${Math.max(31, width * 0.057)}px ${FONT}`;
    context.fillText(copy.complete, width * 0.5, height * 0.46);
    context.fillStyle = "white";
    context.font = `650 ${Math.max(14, width * 0.018)}px ${FONT}`;
    context.fillText(copy.completeBody, width * 0.5, height * 0.535, width * 0.62);
  }
  if (frame.caption !== null && frame.celebrationProgress === 0) {
    context.fillStyle = "rgba(7,18,37,.8)";
    context.beginPath();
    context.roundRect(width * 0.16, height * 0.79, width * 0.68, height * 0.075, 16);
    context.fill();
    context.textAlign = "center";
    context.fillStyle = "white";
    context.font = `650 ${Math.max(13, width * 0.017)}px ${FONT}`;
    context.fillText(frame.caption, width * 0.5, height * 0.838, width * 0.62);
  }
  context.restore();
}

function drawSkyTexture(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  reduced: boolean,
) {
  context.save();
  for (let index = 0; index < 34; index += 1) {
    const x = ((index * 0.61803398875) % 1) * width;
    const y = (0.05 + ((index * 0.38196601125) % 0.72)) * height;
    const twinkle = reduced ? 0.55 : 0.38 + Math.sin(time / 420 + index * 1.7) * 0.24;
    context.globalAlpha = Math.max(0.12, twinkle);
    context.fillStyle = index % 4 === 0 ? THEME.gold : THEME.periwinkleBright;
    context.beginPath();
    context.arc(x, y, 1.2 + (index % 3) * 0.65, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawCloudBanks(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  reduced: boolean,
) {
  const drift = reduced ? 0 : Math.sin(time / 2800) * width * 0.012;
  context.save();
  context.globalAlpha = 0.76;
  context.fillStyle = "rgba(78,92,173,.82)";
  drawCloud(context, width * 0.12 + drift, height * 0.88, width * 0.22, height * 0.09);
  drawCloud(context, width * 0.57 - drift, height * 0.91, width * 0.31, height * 0.12);
  drawCloud(context, width * 0.92 + drift * 0.4, height * 0.85, width * 0.19, height * 0.08);
  context.fillStyle = "rgba(169,181,255,.42)";
  drawCloud(context, width * 0.31 - drift * 0.5, height * 0.96, width * 0.3, height * 0.09);
  drawCloud(context, width * 0.77 + drift, height * 0.98, width * 0.28, height * 0.1);
  context.restore();
}

function drawCloud(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  context.beginPath();
  context.ellipse(x, y, width * 0.5, height * 0.5, 0, 0, Math.PI * 2);
  context.ellipse(x - width * 0.24, y - height * 0.28, width * 0.25, height * 0.52, 0, 0, Math.PI * 2);
  context.ellipse(x + width * 0.12, y - height * 0.38, width * 0.3, height * 0.68, 0, 0, Math.PI * 2);
  context.ellipse(x + width * 0.34, y - height * 0.18, width * 0.22, height * 0.45, 0, 0, Math.PI * 2);
  context.fill();
}

function drawConstellationShelf(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  total: number,
  completed: number,
  time: number,
  reduced: boolean,
) {
  const centerX = width * 0.5;
  const y = height * 0.105;
  const gap = Math.min(width * 0.095, 82);
  context.save();
  context.strokeStyle = "rgba(210,215,255,.34)";
  context.lineWidth = Math.max(1.5, width * 0.0025);
  context.setLineDash([5, 8]);
  context.beginPath();
  for (let index = 0; index < total; index += 1) {
    const x = centerX + (index - (total - 1) / 2) * gap;
    const shelfY = y + (index % 2) * height * 0.027;
    if (index === 0) context.moveTo(x, shelfY);
    else context.lineTo(x, shelfY);
  }
  context.stroke();
  context.setLineDash([]);
  for (let index = 0; index < total; index += 1) {
    const x = centerX + (index - (total - 1) / 2) * gap;
    const shelfY = y + (index % 2) * height * 0.027;
    const isCaught = index < completed;
    const pulse = isCaught && !reduced ? 1 + Math.sin(time / 240 + index) * 0.07 : 1;
    drawStar(context, x, shelfY, Math.min(width, height) * 0.025 * pulse, isCaught ? THEME.gold : "rgba(210,215,255,.22)", isCaught ? THEME.cream : "rgba(210,215,255,.42)");
  }
  context.restore();
}

function drawTargetStar(
  context: CanvasRenderingContext2D,
  target: RuntimeTarget,
  width: number,
  height: number,
  time: number,
  reduced: boolean,
) {
  const x = target.x * width;
  const y = target.y * height;
  const baseRadius = Math.max(28, target.radius * Math.min(width, height) * 0.88);
  const pulse = reduced ? 1 : 1 + Math.sin(time / 155 + hash(target.id) * 10) * 0.075;
  const radius = baseRadius * pulse;
  context.save();
  const glow = context.createRadialGradient(x, y, radius * 0.08, x, y, radius * 1.7);
  glow.addColorStop(0, `rgba(255,243,194,${target.hit ? 0.84 : 0.58})`);
  glow.addColorStop(0.48, `rgba(255,217,120,${target.hit ? 0.36 : 0.22})`);
  glow.addColorStop(1, "rgba(255,217,120,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius * 1.7, 0, Math.PI * 2);
  context.fill();
  drawStar(context, x, y, radius, target.hit ? THEME.cream : THEME.gold, "#fffaf0");
  context.strokeStyle = "rgba(255,255,255,.88)";
  context.lineWidth = Math.max(3, radius * 0.08);
  context.beginPath();
  context.arc(x, y, radius * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.035, target.dwellProgress));
  context.stroke();
  const trail = reduced ? radius * 0.6 : radius * (0.8 + Math.sin(time / 210) * 0.12);
  context.strokeStyle = "rgba(169,181,255,.72)";
  context.lineWidth = Math.max(2, radius * 0.055);
  context.beginPath();
  context.moveTo(x - radius * 0.85, y + radius * 0.3);
  context.quadraticCurveTo(x - trail * 1.7, y + trail * 0.75, x - trail * 2.4, y + trail * 0.36);
  context.stroke();
  context.restore();
}

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerRadius: number,
  fill: string,
  stroke: string,
) {
  context.save();
  context.translate(x, y);
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : outerRadius * 0.43;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fillStyle = fill;
  context.strokeStyle = stroke;
  context.lineWidth = Math.max(1.5, outerRadius * 0.075);
  context.fill();
  context.stroke();
  context.restore();
}

function drawStarBurst(
  context: CanvasRenderingContext2D,
  burst: StarBurst,
  progress: number,
  width: number,
  height: number,
  reduced: boolean,
) {
  const eased = 1 - (1 - progress) ** 3;
  const shelfX = width * (0.45 + (burst.seed % 0.1));
  const shelfY = height * 0.12;
  const x = burst.x + (shelfX - burst.x) * eased;
  const y = burst.y + (shelfY - burst.y) * eased - (reduced ? 0 : Math.sin(progress * Math.PI) * height * 0.08);
  context.save();
  context.globalAlpha = 1 - progress * 0.7;
  drawStar(context, x, y, Math.min(width, height) * 0.038 * (1 - progress * 0.34), THEME.cream, "white");
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2 + burst.seed;
    const radius = Math.min(width, height) * 0.12 * progress;
    const size = index % 3 === 0 ? 4 : 2;
    context.fillStyle = index % 2 ? THEME.gold : THEME.periwinkleBright;
    context.beginPath();
    context.arc(burst.x + Math.cos(angle) * radius, burst.y + Math.sin(angle) * radius, size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawCelebration(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  time: number,
  reduced: boolean,
) {
  context.save();
  const dawn = context.createLinearGradient(0, 0, 0, height);
  dawn.addColorStop(0, `rgba(118,137,244,${0.12 * progress})`);
  dawn.addColorStop(0.7, `rgba(255,217,120,${0.18 * progress})`);
  dawn.addColorStop(1, "rgba(255,217,120,0)");
  context.fillStyle = dawn;
  context.fillRect(0, 0, width, height);

  const centerX = width * 0.5;
  const centerY = height * 0.43;
  const orbit = Math.min(width, height) * 0.22 * Math.min(1, progress * 1.6);
  context.strokeStyle = `rgba(255,243,194,${0.48 * progress})`;
  context.lineWidth = Math.max(2, width * 0.003);
  context.beginPath();
  context.arc(centerX, centerY, orbit, Math.PI * 0.1, Math.PI * 1.9);
  context.stroke();
  const count = reduced ? 9 : 22;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + (reduced ? 0 : time / 1200);
    const radius = orbit * (0.5 + ((index * 0.37) % 0.55));
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.62;
    drawStar(
      context,
      x,
      y,
      Math.min(width, height) * (index % 5 === 0 ? 0.025 : 0.011),
      index % 3 === 0 ? THEME.cream : THEME.gold,
      "rgba(255,255,255,.72)",
    );
  }
  drawStar(context, centerX, centerY, Math.min(width, height) * 0.105 * Math.min(1, progress * 1.4), THEME.gold, THEME.cream);
  context.restore();
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return (result % 1000) / 1000;
}
