import {
  createDefaultRenderer,
  type RendererFactory,
  type RuntimeRenderFrame,
  type RuntimeRenderer,
  type RuntimeTarget,
} from "@manse/runtime-web";

const ART_URL = "/packs/morning-star-catch/assets/images/morning-star-hero.png";
const THEME = {
  gold: "#ffd978",
  cream: "#fff3c2",
  periwinkle: "#a9b5ff",
  periwinkleBright: "#d2d7ff",
  navy: "#071225",
  reactionMs: 880,
  maxDpr: 2,
} as const;

type StarBurst = { x: number; y: number; startedAt: number; seed: number };

export const createMorningStarRenderer: RendererFactory = (options): RuntimeRenderer => {
  const base = createDefaultRenderer(options);
  Object.assign(base.element.style, {
    backgroundImage: `linear-gradient(rgba(4,12,46,.02), rgba(4,12,46,.28)), url('${ART_URL}')`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  });
  base.element.setAttribute(
    "aria-label",
    "Night-sky play field with reachable glowing star targets and a constellation collection trail",
  );
  const cameraSurface = base.element.firstElementChild as HTMLElement | null;
  if (cameraSurface?.tagName === "CANVAS") cameraSurface.style.opacity = "0.3";

  const canvas = options.document.createElement("canvas");
  canvas.dataset.gameForeground = "morning-star-catch";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  });
  base.element.append(canvas);
  const context = canvas.getContext("2d");
  if (context === null) return base;

  let lastCompleted = 0;
  let lastTotal = 3;
  const hitTargets = new Set<string>();
  const bursts: StarBurst[] = [];

  const render = (frame: RuntimeRenderFrame) => {
    base.render(frame);
    const { width, height } = prepareCanvas(canvas, context, THEME.maxDpr);
    if (width === 0 || height === 0) return;
    context.clearRect(0, 0, width, height);

    const guide = frame.challenge?.kind === "touch_targets" ? frame.challenge : null;
    if (guide !== null) lastTotal = Math.max(guide.totalUnits, 1);
    const completed = guide?.completedUnits ?? (frame.celebrationProgress > 0 ? lastCompleted : 0);
    const total = lastTotal;
    if (guide !== null && completed < lastCompleted) {
      lastCompleted = 0;
      hitTargets.clear();
    }
    for (const target of frame.targets) {
      if (!target.hit) hitTargets.delete(target.id);
      if (target.hit && !hitTargets.has(target.id)) {
        hitTargets.add(target.id);
        bursts.push({ x: target.x * width, y: target.y * height, startedAt: frame.timestampMs, seed: hash(target.id) });
      }
    }
    if (completed > lastCompleted && bursts.length === 0) {
      bursts.push({ x: width * 0.5, y: height * 0.45, startedAt: frame.timestampMs, seed: completed * 0.37 });
    }
    lastCompleted = completed;

    drawSkyTexture(context, width, height, frame.timestampMs, frame.reducedStimulation);
    drawCloudBanks(context, width, height, frame.timestampMs, frame.reducedStimulation);
    drawConstellationShelf(context, width, height, total, completed, frame.timestampMs, frame.reducedStimulation);
    for (const target of frame.targets) {
      drawTargetStar(context, target, width, height, frame.timestampMs, frame.reducedStimulation);
    }

    for (let index = bursts.length - 1; index >= 0; index -= 1) {
      const age = frame.timestampMs - bursts[index].startedAt;
      if (age > THEME.reactionMs) {
        bursts.splice(index, 1);
        continue;
      }
      drawStarBurst(context, bursts[index], age / THEME.reactionMs, width, height, frame.reducedStimulation);
    }
    if (frame.celebrationProgress > 0) {
      drawCelebration(context, width, height, frame.celebrationProgress, frame.timestampMs, frame.reducedStimulation);
    }
  };

  return {
    kind: base.kind,
    element: base.element,
    render,
    destroy() {
      canvas.remove();
      base.destroy();
    },
  };
};

function prepareCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, maxDpr: number) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(0, rect.width);
  const height = Math.max(0, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
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
