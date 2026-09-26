import { animate } from "motion";
import { MAX_ACTIVE_PACKETS } from "@/shared/constants";
import type { Packet } from "@/shared/reducer";

// Packets (design §6.4): a 6px dot moves on the SVG path of an edge. The
// motion runs outside React renders. At most 10 move at one time; extra
// packets are dropped, not queued.

const SVG_NS = "http://www.w3.org/2000/svg";
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
let active = 0;

export function launchPacket(packet: Packet, path: SVGPathElement, layer: SVGGElement): void {
  if (active >= MAX_ACTIVE_PACKETS) return;
  const length = path.getTotalLength();
  if (!Number.isFinite(length) || length <= 0) return;

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("r", "3");
  dot.setAttribute("class", packet.tone === "destructive" ? "fill-destructive" : "fill-live");
  layer.appendChild(dot);
  active += 1;

  const duration = Math.min(400 + 0.8 * length, 900) / 1000;
  const place = (progress: number) => {
    // The path can change while nodes move, so measure it each frame.
    const total = path.getTotalLength();
    const at = packet.direction === "out" ? progress : 1 - progress;
    const point = path.getPointAtLength(at * total);
    dot.setAttribute("cx", String(point.x));
    dot.setAttribute("cy", String(point.y));
  };
  place(0);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    dot.remove();
    active = Math.max(0, active - 1);
  };
  animate(0, 1, { duration, ease: EASE_IN_OUT, onUpdate: place, onComplete: finish }).finished.catch(finish);
}
